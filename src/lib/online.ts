import { useCallback, useEffect, useRef, useState } from 'react'
import type { Card, ClientMessage, Room, RoomSettings, ServerMessage } from './protocol'
import { serverUrl, socketUrl } from './server'
import { readJSON, writeJSON } from './storage'
import { loadSeen, markSeen } from './seen'

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed'

export interface Session {
  code: string
  playerId: string
}

const SESSION_KEY = 'impostor.session'
const COUNTDOWN_TOTAL_MS = 5000
// A phone that slept keeps a socket that looks open but is dead. Ping often and
// treat silence as a dead connection.
const PING_EVERY_MS = 10_000
const DEAD_AFTER_MS = 25_000
// Render's free plan restarts the server (losing every room) after 15 idle minutes
// of HTTP traffic, and socket messages don't count, so poke /health while in a room.
const KEEP_AWAKE_EVERY_MS = 4 * 60_000

/** Rounds already counted in the seen history (key: "code:round"), so a word counts once per round. */
const countedRounds = new Set<string>()
function countSeen(code: string, round: number, word: string): void {
  const key = `${code}:${round}`
  if (countedRounds.has(key)) return
  countedRounds.add(key)
  markSeen(word)
}

export function loadSession(): Session | null {
  const s = readJSON<Session>('local', SESSION_KEY)
  return s && typeof s.code === 'string' && typeof s.playerId === 'string' ? s : null
}

export interface Online {
  status: SocketStatus
  session: Session | null
  room: Room | null
  /** The private card for the current round, if this player was dealt one. */
  card: Card | null
  /** Date.now()-based deadline of the current countdown. */
  countdownEndsAt: number
  countdownTotalMs: number
  create(name: string, settings: RoomSettings): void
  join(code: string, name: string): void
  updateSettings(settings: RoomSettings): void
  start(): void
  reveal(): void
  backToLobby(): void
  leave(): void
}

/**
 * WebSocket client for shared/PROTOCOL.md.
 * `wanted` keeps a connection open (e.g. while the online tab is visible); a stored
 * session always keeps one open and is resumed after every (re)connect.
 */
export function useOnline(wanted: boolean, onError: (message: string) => void): Online {
  const [status, setStatus] = useState<SocketStatus>('idle')
  const [session, setSessionState] = useState<Session | null>(() => loadSession())
  const [room, setRoom] = useState<Room | null>(null)
  const [cardMsg, setCardMsg] = useState<{ round: number; card: Card } | null>(null)
  const [countdown, setCountdown] = useState({ endsAt: 0, total: COUNTDOWN_TOTAL_MS })

  const wsRef = useRef<WebSocket | null>(null)
  const queueRef = useRef<ClientMessage[]>([])
  const sessionRef = useRef(session)
  const resumingRef = useRef(false)
  const leavingRef = useRef<number>(0)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const setSession = useCallback((s: Session | null) => {
    sessionRef.current = s
    writeJSON('local', SESSION_KEY, s)
    setSessionState(s)
  }, [])

  const clearRoom = useCallback(() => {
    setSession(null)
    setRoom(null)
    setCardMsg(null)
    queueRef.current = []
  }, [setSession])

  const keepOpen = wanted || session !== null

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
    else queueRef.current.push(msg)
  }, [])

  const handle = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'joined':
          resumingRef.current = false
          if (sessionRef.current?.code !== msg.code) setCardMsg(null)
          setSession({ code: msg.code, playerId: msg.playerId })
          break
        case 'room': {
          const r = msg.room
          if (r.phase === 'countdown') {
            const left = Math.max(0, r.countdownMs ?? 0)
            setCountdown((c) => ({
              endsAt: Date.now() + left,
              total: c.endsAt > Date.now() ? c.total : Math.max(COUNTDOWN_TOTAL_MS, left),
            }))
          }
          if (r.revealed) countSeen(r.code, r.round, r.revealed.word)
          setRoom(r)
          break
        }
        case 'card':
          if (msg.card.role === 'crew' && sessionRef.current) countSeen(sessionRef.current.code, msg.round, msg.card.word)
          setCardMsg({ round: msg.round, card: msg.card })
          break
        case 'error':
          if (resumingRef.current) {
            // The stored room or player is gone; start fresh.
            resumingRef.current = false
            clearRoom()
          }
          onErrorRef.current(msg.message)
          break
        case 'left':
          window.clearTimeout(leavingRef.current)
          if (resumingRef.current) {
            resumingRef.current = false
            onErrorRef.current('Стаята вече не съществува. Създай нова или влез с нов код.')
          }
          clearRoom()
          break
        case 'pong':
          break
      }
    },
    [clearRoom, setSession],
  )

  useEffect(() => {
    if (!keepOpen) return
    let disposed = false
    let attempt = 0
    let retryTimer = 0
    let lastHeard = Date.now()
    let hiddenAt = 0

    const connect = () => {
      if (disposed) return
      setStatus('connecting')
      let ws: WebSocket
      try {
        ws = new WebSocket(socketUrl())
      } catch {
        scheduleRetry()
        return
      }
      wsRef.current = ws
      lastHeard = Date.now()
      ws.onopen = () => {
        attempt = 0
        lastHeard = Date.now()
        setStatus('open')
        const s = sessionRef.current
        // A create/join that was queued supersedes resuming an older session.
        const queuedEntry = queueRef.current.some((m) => m.type === 'create' || m.type === 'join')
        if (s && !queuedEntry) {
          resumingRef.current = true
          ws.send(JSON.stringify({ type: 'resume', code: s.code, playerId: s.playerId } satisfies ClientMessage))
        }
        const queued = queueRef.current
        queueRef.current = []
        for (const m of queued) ws.send(JSON.stringify(m))
      }
      ws.onmessage = (ev) => {
        lastHeard = Date.now()
        let msg: ServerMessage
        try {
          msg = JSON.parse(String(ev.data)) as ServerMessage
        } catch {
          return
        }
        handle(msg)
      }
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null
        resumingRef.current = false
        if (disposed) return
        setStatus('closed')
        scheduleRetry()
      }
      ws.onerror = () => {
        // onclose follows and handles the retry.
      }
    }

    const scheduleRetry = () => {
      if (disposed) return
      const delay = Math.min(10000, 500 * 2 ** attempt) + Math.floor(Math.random() * 300)
      attempt++
      retryTimer = window.setTimeout(connect, delay)
    }

    /** Drop the current socket without waiting for its close handshake and dial again. */
    const reconnectNow = () => {
      if (disposed) return
      window.clearTimeout(retryTimer)
      const old = wsRef.current
      wsRef.current = null
      if (old) {
        old.onclose = null
        old.onmessage = null
        old.close()
      }
      attempt = 0
      connect()
    }

    const heartbeat = window.setInterval(() => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      if (Date.now() - lastHeard > DEAD_AFTER_MS) reconnectNow()
      else ws.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage))
    }, PING_EVERY_MS)

    // Back from a locked screen or another app: the old socket is probably dead.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      const ws = wsRef.current
      const broken = !ws || ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED
      const sleptLong = hiddenAt > 0 && Date.now() - hiddenAt > 3000
      hiddenAt = 0
      if (broken || sleptLong) reconnectNow()
    }
    const onOnline = () => reconnectNow()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('pageshow', onVisibility)

    connect()
    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pageshow', onVisibility)
      const ws = wsRef.current
      wsRef.current = null
      if (ws) {
        ws.onclose = null
        ws.close()
      }
      setStatus('idle')
    }
  }, [keepOpen, handle])

  useEffect(() => {
    if (!session) return
    const poke = () => void fetch(`${serverUrl()}/health`, { cache: 'no-store' }).catch(() => {})
    const timer = window.setInterval(poke, KEEP_AWAKE_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [session])

  const create = useCallback(
    (name: string, settings: RoomSettings) => send({ type: 'create', name, settings }),
    [send],
  )
  const join = useCallback((code: string, name: string) => send({ type: 'join', code, name }), [send])
  const updateSettings = useCallback((settings: RoomSettings) => send({ type: 'settings', settings }), [send])
  // The host's history steers the server toward words this device hasn't had yet.
  const start = useCallback(() => send({ type: 'start', seen: loadSeen() }), [send])
  const reveal = useCallback(() => send({ type: 'reveal' }), [send])
  const backToLobby = useCallback(() => send({ type: 'lobby' }), [send])
  const leave = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave' } satisfies ClientMessage))
      // Fall back to leaving locally if the confirmation never arrives.
      window.clearTimeout(leavingRef.current)
      leavingRef.current = window.setTimeout(clearRoom, 1500)
    } else {
      clearRoom()
    }
  }, [clearRoom])

  const card = cardMsg && room && cardMsg.round === room.round ? cardMsg.card : null

  return {
    status,
    session,
    room: session ? room : null,
    card,
    countdownEndsAt: countdown.endsAt,
    countdownTotalMs: countdown.total,
    create,
    join,
    updateSettings,
    start,
    reveal,
    backToLobby,
    leave,
  }
}

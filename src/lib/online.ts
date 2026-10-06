import { useCallback, useEffect, useRef, useState } from 'react'
import type { Card, ClientMessage, Room, RoomSettings, ServerMessage } from './protocol'
import { socketUrl } from './server'
import { readJSON, writeJSON } from './storage'

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed'

export interface Session {
  code: string
  playerId: string
}

const SESSION_KEY = 'impostor.session'
const COUNTDOWN_TOTAL_MS = 5000

export function loadSession(): Session | null {
  const s = readJSON<Session>('session', SESSION_KEY)
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
    writeJSON('session', SESSION_KEY, s)
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
          setRoom(r)
          break
        }
        case 'card':
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
          clearRoom()
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
      ws.onopen = () => {
        attempt = 0
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

    // Reconnect right away when the page comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wsRef.current && !disposed) {
        window.clearTimeout(retryTimer)
        attempt = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)

    connect()
    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      const ws = wsRef.current
      wsRef.current = null
      if (ws) {
        ws.onclose = null
        ws.close()
      }
      setStatus('idle')
    }
  }, [keepOpen, handle])

  const create = useCallback(
    (name: string, settings: RoomSettings) => send({ type: 'create', name, settings }),
    [send],
  )
  const join = useCallback((code: string, name: string) => send({ type: 'join', code, name }), [send])
  const updateSettings = useCallback((settings: RoomSettings) => send({ type: 'settings', settings }), [send])
  const start = useCallback(() => send({ type: 'start' }), [send])
  const reveal = useCallback(() => send({ type: 'reveal' }), [send])
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
    leave,
  }
}

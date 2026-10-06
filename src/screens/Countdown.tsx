import { useEffect, useState } from 'react'
import { PeopleIcon } from '../components/Icons'
import { pluralPlayers } from '../lib/game'
import type { Room } from '../lib/protocol'

const R = 90
const CIRC = 2 * Math.PI * R

export function Countdown({ room, endsAt, totalMs }: { room: Room; endsAt: number; totalMs: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.max(0, endsAt - now)
  const seconds = Math.ceil(left / 1000)
  // Ring empties a second at a time so it matches the number.
  const fraction = totalMs > 0 ? Math.min(1, (seconds * 1000) / totalMs) : 0
  const connected = room.players.filter((p) => p.connected).length

  return (
    <main className="screen screen--fade countdown">
      <div className="ring" role="timer" aria-label={`Играта започва след ${seconds}`}>
        <svg width="200" height="200" viewBox="0 0 200 200" className="ring__svg" aria-hidden="true">
          <circle cx="100" cy="100" r={R} className="ring__track" />
          <circle cx="100" cy="100" r={R} className="ring__bar" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - fraction)} />
        </svg>
        <span className="ring__num" key={seconds}>
          {seconds}
        </span>
      </div>
      <div className="countdown__text">
        <span className="countdown__title">Играта започва</span>
        <span className="countdown__sub">Скрий екрана от останалите. После задръж картата, за да я видиш.</span>
      </div>
      <div className="pill">
        <PeopleIcon />
        {pluralPlayers(connected)} · Стая {room.code}
      </div>
    </main>
  )
}

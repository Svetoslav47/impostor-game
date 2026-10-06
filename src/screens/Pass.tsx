import { CardFace } from '../components/CardFace'
import { NavBar, NavButton } from '../components/Controls'
import { HoldCard } from '../components/HoldCard'
import type { LocalRound } from '../lib/game'

export function Pass({
  round,
  index,
  seen,
  onSeen,
  onNext,
  onExit,
}: {
  round: LocalRound
  index: number
  seen: boolean
  onSeen: () => void
  onNext: () => void
  onExit: () => void
}) {
  const name = round.players[index]
  const total = round.players.length
  const isImpostor = round.impostors.includes(index)
  return (
    <main className="screen" key={index}>
      <NavBar
        left={<NavButton onClick={onExit}>Изход</NavButton>}
        right={
          <span className="navbar__count">
            {index + 1} от {total}
          </span>
        }
      />
      <div className="progress" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden="true">
        {round.players.map((_, i) => (
          <span key={i} className={i <= index ? 'progress__seg progress__seg--on' : 'progress__seg'} />
        ))}
      </div>

      <div className="passBody screen--fade">
        <span className="passBody__kicker">Подай устройството на</span>
        <h1 className="passBody__name">{name}</h1>
        <HoldCard tone={isImpostor ? 'danger' : 'accent'} subtitle={`Картата се скрива, щом пуснеш. Само за ${name}.`} onReveal={onSeen}>
          {isImpostor ? <CardFace role="impostor" hint={round.hint} /> : <CardFace role="crew" word={round.word} />}
        </HoldCard>
      </div>

      <div className="footer">
        <button type="button" className="btn btn--primary" disabled={!seen} onClick={onNext}>
          {index === total - 1 ? 'Готово — кой започва?' : 'Готово — подай нататък'}
        </button>
      </div>
    </main>
  )
}

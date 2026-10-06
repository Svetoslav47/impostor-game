import { useEffect, useState } from 'react'
import { CategoryChip } from '../components/CardFace'
import { Chevron, TargetIcon } from '../components/Icons'
import { joinNames, prefersReducedMotion, type LocalRound } from '../lib/game'

/** Cycles through names with slowing ticks, then lands on the real starter. */
function useShuffledName(names: string[], final: number, key: unknown): { name: string; settled: boolean } {
  const [state, setState] = useState(() => ({ i: final, settled: prefersReducedMotion() || names.length < 2 }))
  useEffect(() => {
    if (prefersReducedMotion() || names.length < 2) {
      setState({ i: final, settled: true })
      return
    }
    const delays = [60, 60, 60, 70, 70, 80, 90, 110, 130, 160, 200, 250]
    let step = 0
    let cur = final
    let timer = 0
    const tick = () => {
      if (step >= delays.length) {
        setState({ i: final, settled: true })
        return
      }
      let next = Math.floor(Math.random() * names.length)
      if (next === cur) next = (next + 1) % names.length
      // Make sure the last shown name before landing isn't the final one.
      if (step === delays.length - 1 && next === final) next = (final + 1) % names.length
      cur = next
      setState({ i: next, settled: false })
      timer = window.setTimeout(tick, delays[step++])
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [key])
  return { name: names[state.i], settled: state.settled }
}

export function Starter({ round, roundKey, onNewGame, onSettings }: { round: LocalRound; roundKey: number; onNewGame: () => void; onSettings: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const { name, settled } = useShuffledName(round.players, round.starter, roundKey)
  const impostorNames = round.impostors.map((i) => round.players[i])

  return (
    <main className="screen screen--fade">
      <div className="starterBody">
        <div className="starterCard">
          <span className="iconCircle">
            <TargetIcon />
          </span>
          <span className="kicker starterCard__kicker">Първи започва</span>
          <span className={`starterCard__name${settled ? ' starterCard__name--settled' : ''}`} aria-live="polite" aria-busy={!settled}>
            {name}
          </span>
        </div>

        <section className="section section--flush">
          <h2 className="sectionHeader">Как продължава</h2>
          <ol className="group steps">
            <li className="step">
              <span className="step__num">1</span>
              <span className="step__text">Две обиколки с асоциации</span>
            </li>
            <li className="step">
              <span className="step__num">2</span>
              <span className="step__text">Гласувайте кой е импосторът</span>
            </li>
          </ol>
        </section>

        <section className="section section--flush">
          {revealed ? (
            <>
              <h2 className="sectionHeader">Разкритие</h2>
              <div className="group revealGroup" aria-live="polite">
                <div className="revealGroup__top">
                  <CategoryChip id={round.category.id} name={round.category.name} />
                  <span className="kicker">Тайната дума</span>
                  <span className="revealGroup__word">{round.word}</span>
                </div>
                <div className="row">
                  <span className="row__label">{impostorNames.length > 1 ? 'Импостори' : 'Импостор'}</span>
                  <span className="row__value row__value--danger">{joinNames(impostorNames)}</span>
                </div>
                <div className="row">
                  <span className="row__label">Подсказка</span>
                  <span className="row__value">{round.hint}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="group">
                <button type="button" className="row row--link row--danger" onClick={() => setRevealed(true)}>
                  <span className="row__label">Разкрий думата и импостора</span>
                  <Chevron />
                </button>
              </div>
              <p className="sectionFooter">Натисни едва след гласуването.</p>
            </>
          )}
        </section>
      </div>

      <div className="footer footer--stack">
        <button type="button" className="btn btn--primary" onClick={onNewGame}>
          Нова игра
        </button>
        <button type="button" className="btn btn--plain" onClick={onSettings}>
          Промени настройките
        </button>
      </div>
    </main>
  )
}

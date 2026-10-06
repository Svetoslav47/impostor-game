import { NavBar, NavButton } from '../components/Controls'
import { defaultName, type LocalSettings } from '../lib/settings'

export function Names({ settings, onSettings, onBack }: { settings: LocalSettings; onSettings: (s: LocalSettings) => void; onBack: () => void }) {
  const setName = (i: number, v: string) => {
    const names = [...settings.names]
    names[i] = v.slice(0, 20)
    onSettings({ ...settings, names })
  }
  const anyCustom = settings.names.slice(0, settings.playerCount).some((n) => n.trim())
  return (
    <main className="screen screen--fade">
      <NavBar
        left={
          <NavButton back onClick={onBack}>
            Назад
          </NavButton>
        }
        title="Имена"
        right={
          anyCustom ? (
            <NavButton onClick={() => onSettings({ ...settings, names: settings.names.map((n, i) => (i < settings.playerCount ? '' : n)) })}>
              Изчисти
            </NavButton>
          ) : null
        }
      />
      <section className="section">
        <h2 className="sectionHeader">Играчи · {settings.playerCount}</h2>
        <div className="group">
          {Array.from({ length: settings.playerCount }, (_, i) => (
            <label key={i} className="row row--input">
              <span className="row__index" aria-hidden="true">
                {i + 1}
              </span>
              <input
                className="textInput"
                value={settings.names[i]}
                maxLength={20}
                placeholder={defaultName(i)}
                aria-label={`Име на играч ${i + 1}`}
                autoComplete="off"
                enterKeyHint={i === settings.playerCount - 1 ? 'done' : 'next'}
                onChange={(e) => setName(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const inputs = document.querySelectorAll<HTMLInputElement>('.row--input input')
                    const next = inputs[i + 1]
                    if (next) next.focus()
                    else e.currentTarget.blur()
                  }
                }}
              />
            </label>
          ))}
        </div>
        <p className="sectionFooter">Картите се раздават в този ред. Празните полета остават „Играч 1“, „Играч 2“ и т.н.</p>
      </section>
      <div className="flexSpacer" />
      <div className="footer">
        <button type="button" className="btn btn--primary" onClick={onBack}>
          Готово
        </button>
      </div>
    </main>
  )
}

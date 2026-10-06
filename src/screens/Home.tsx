import { useRef, useState } from 'react'
import { CategoryList, toggleId } from '../components/CategoryList'
import { Segmented, Stepper } from '../components/Controls'
import { Chevron } from '../components/Icons'
import { ALL_CATEGORY_IDS } from '../lib/categories'
import { pluralCategories, pluralImpostors, pluralPlayers } from '../lib/game'
import type { SocketStatus } from '../lib/online'
import { MAX_PLAYERS, MIN_PLAYERS, TWO_IMPOSTORS_MIN, type LocalSettings } from '../lib/settings'

export type Tab = 'local' | 'online'

interface HomeProps {
  tab: Tab
  onTab: (t: Tab) => void
  showOnline: boolean
  settings: LocalSettings
  onSettings: (s: LocalSettings) => void
  onEditNames: () => void
  onStart: () => void
  online: {
    status: SocketStatus
    name: string
    onName: (n: string) => void
    onCreate: () => void
    onJoin: (code: string) => void
    busy: boolean
  }
}

export function Home(props: HomeProps) {
  const { tab, onTab, showOnline } = props
  return (
    <main className="screen screen--fade">
      <div className="largeHeader">
        <h1 className="largeTitle">Импостор</h1>
        <p className="largeHeader__sub">Всички знаят думата. Освен един.</p>
      </div>

      {showOnline && (
        <div className="tabsWrap">
          <Segmented
            label="Режим на игра"
            value={tab}
            onChange={onTab}
            options={[
              { value: 'local', label: 'Едно устройство' },
              { value: 'online', label: 'Онлайн' },
            ]}
          />
        </div>
      )}

      {tab === 'online' && showOnline ? <OnlineEntry {...props.online} /> : <LocalSetup {...props} />}
    </main>
  )
}

function LocalSetup({ settings, onSettings, onEditNames, onStart }: HomeProps) {
  const set = (patch: Partial<LocalSettings>) => {
    const next = { ...settings, ...patch }
    if (next.playerCount < TWO_IMPOSTORS_MIN) next.impostorCount = 1
    onSettings(next)
  }
  const allOn = settings.categoryIds.length === ALL_CATEGORY_IDS.length
  const customNames = settings.names.slice(0, settings.playerCount).filter((n) => n.trim()).length
  const noCategories = settings.categoryIds.length === 0

  return (
    <>
      <section className="section">
        <h2 className="sectionHeader">Игра</h2>
        <div className="group">
          <div className="row">
            <span className="row__label" id="players-label">Играчи</span>
            <div className="row__trail row__trail--wide">
              <span className="row__value row__value--num" aria-labelledby="players-label" aria-live="polite">
                {settings.playerCount}
              </span>
              <Stepper
                value={settings.playerCount}
                min={MIN_PLAYERS}
                max={MAX_PLAYERS}
                onChange={(v) => set({ playerCount: v })}
                decLabel="Премахни играч"
                incLabel="Добави играч"
              />
            </div>
          </div>
          <div className="row">
            <span className="row__label">Импостори</span>
            <Segmented
              small
              label="Брой импостори"
              value={settings.impostorCount}
              onChange={(v) => set({ impostorCount: v })}
              isDisabled={(v) => v === 2 && settings.playerCount < TWO_IMPOSTORS_MIN}
              options={[
                { value: 1 as const, label: '1' },
                { value: 2 as const, label: '2' },
              ]}
            />
          </div>
          <button type="button" className="row row--link" onClick={onEditNames}>
            <span className="row__label">Имена на играчите</span>
            <span className="row__value">
              {customNames === 0 ? 'По избор' : `${customNames} от ${settings.playerCount}`}
              <Chevron />
            </span>
          </button>
        </div>
        <p className="sectionFooter">Двама импостори са възможни при 5 или повече играчи.</p>
      </section>

      <section className="section section--loose">
        <div className="sectionHeader sectionHeader--split">
          <h2 className="sectionHeader__title">Категории</h2>
          <button
            type="button"
            className="textBtn"
            onClick={() => set({ categoryIds: allOn ? [] : [...ALL_CATEGORY_IDS] })}
          >
            {allOn ? 'Изчисти' : 'Избери всички'}
          </button>
        </div>
        <CategoryList selected={settings.categoryIds} onToggle={(id) => set({ categoryIds: toggleId(settings.categoryIds, id) })} />
      </section>

      <div className="bottomSpacer" />

      <div className="bottomBar">
        <span className={`bottomBar__summary${noCategories ? ' bottomBar__summary--warn' : ''}`} aria-live="polite">
          {noCategories
            ? 'Избери поне една категория'
            : `${pluralPlayers(settings.playerCount)} · ${pluralImpostors(settings.impostorCount)} · ${pluralCategories(settings.categoryIds.length)}`}
        </span>
        <button type="button" className="btn btn--primary" disabled={noCategories} onClick={onStart}>
          Започни играта
        </button>
      </div>
    </>
  )
}

function OnlineEntry({ status, name, onName, onCreate, onJoin, busy }: HomeProps['online']) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const code = digits.join('')
  const nameOk = name.trim().length > 0
  const connected = status === 'open'

  const setDigit = (i: number, raw: string) => {
    let only = raw.replace(/\D/g, '')
    // Typing over an existing digit in the first (multi-char) box.
    if (only.length === 2 && digits[i] && only.startsWith(digits[i])) only = only[1]
    const next = [...digits]
    if (only.length > 1) {
      // Pasted or autofilled several digits at once.
      for (let k = 0; k < only.length && i + k < 4; k++) next[i + k] = only[k]
      setDigits(next)
      refs.current[Math.min(3, i + only.length)]?.focus()
      return
    }
    next[i] = only
    setDigits(next)
    if (only && i < 3) refs.current[i + 1]?.focus()
  }

  const statusText =
    status === 'open' ? 'Свързан със сървъра' : status === 'closed' ? 'Няма връзка. Опитваме отново…' : 'Свързване със сървъра…'

  return (
    <>
      <section className="section">
        <label htmlFor="online-name" className="sectionHeader">
          Твоето име
        </label>
        <div className="group group--input">
          <input
            id="online-name"
            className="textInput"
            value={name}
            maxLength={20}
            autoComplete="nickname"
            enterKeyHint="done"
            placeholder="Напр. Мария"
            onChange={(e) => onName(e.target.value)}
          />
        </div>
      </section>

      <section className="section section--loose">
        <h2 className="sectionHeader">Нова стая</h2>
        <button type="button" className="btn btn--primary" disabled={!nameOk || busy} onClick={onCreate}>
          Създай стая
        </button>
        <p className="sectionFooter">Ти избираш категориите и пускаш играта.</p>
      </section>

      <section className="section section--loose">
        <h2 className="sectionHeader" id="code-label">
          Влез с код
        </h2>
        <form
          className="codeForm"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length === 4 && nameOk && !busy) onJoin(code)
          }}
        >
          <div className="codeBoxes" role="group" aria-labelledby="code-label">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el
                }}
                className="codeBox"
                aria-label={`Цифра ${i + 1}`}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={i === 0 ? 4 : 1}
                value={d}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[i] && i > 0) {
                    e.preventDefault()
                    const next = [...digits]
                    next[i - 1] = ''
                    setDigits(next)
                    refs.current[i - 1]?.focus()
                  } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
                  else if (e.key === 'ArrowRight' && i < 3) refs.current[i + 1]?.focus()
                }}
              />
            ))}
          </div>
          <button type="submit" className="btn btn--tinted" disabled={code.length !== 4 || !nameOk || busy}>
            Влез в стаята
          </button>
        </form>
        {!nameOk && <p className="sectionFooter">Въведи име, за да създадеш стая или да влезеш в нея.</p>}
      </section>

      <div className="flexSpacer" />
      <div className="connStatus" role="status">
        <span className={`connStatus__dot connStatus__dot--${connected ? 'ok' : status === 'closed' ? 'bad' : 'wait'}`} />
        {statusText}
      </div>
    </>
  )
}

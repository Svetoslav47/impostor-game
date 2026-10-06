import { CategoryList, toggleId } from '../components/CategoryList'
import { AVATAR_COLORS, Avatar, NavBar, NavButton, Segmented } from '../components/Controls'
import { ALL_CATEGORY_IDS } from '../lib/categories'
import type { Room, RoomSettings } from '../lib/protocol'
import { TWO_IMPOSTORS_MIN } from '../lib/settings'

export function playerColor(room: Room, id: string): string {
  const i = room.players.findIndex((p) => p.id === id)
  return AVATAR_COLORS[(i < 0 ? 0 : i) % AVATAR_COLORS.length]
}

export function Lobby({
  room,
  me,
  onLeave,
  onSettings,
  onStart,
}: {
  room: Room
  me: string
  onLeave: () => void
  onSettings: (s: RoomSettings) => void
  onStart: () => void
}) {
  const isHost = room.hostId === me
  const connectedCount = room.players.filter((p) => p.connected).length
  const { impostorCount, categoryIds } = room.settings
  const allOn = categoryIds.length === ALL_CATEGORY_IDS.length
  const tooFewPlayers = connectedCount < 3
  // With fewer than 5 players the server deals a single impostor even if 2 is picked.
  const twoFallsBackToOne = impostorCount === 2 && connectedCount < TWO_IMPOSTORS_MIN

  // The host edits categories in place; the last one can't be unticked.
  const toggleCategory = (id: string) => {
    const next = toggleId(categoryIds, id)
    if (next.length) onSettings({ impostorCount, categoryIds: next })
  }

  const categoriesValue = allOn ? `Всички ${ALL_CATEGORY_IDS.length}` : `${categoryIds.length} от ${ALL_CATEGORY_IDS.length}`

  return (
    <main className="screen screen--fade">
      <NavBar left={<NavButton onClick={onLeave}>Напусни</NavButton>} title="Стая" />

      <div className="cardSection">
        <div className="codeCard">
          <span className="kicker">Код на стаята</span>
          <span className="codeCard__code" aria-label={`Код ${room.code.split('').join(' ')}`}>
            {room.code}
          </span>
          <span className="codeCard__sub">Кажи кода на останалите</span>
        </div>
      </div>

      <section className="section">
        <h2 className="sectionHeader">Играчи · {room.players.length}</h2>
        <ul className="group players" aria-live="polite">
          {room.players.map((p) => {
            const tags = [p.id === room.hostId ? 'Домакин' : null, p.id === me ? 'Ти' : null, p.connected ? null : 'Няма връзка'].filter(Boolean)
            return (
              <li key={p.id} className={`playerRow${p.connected ? '' : ' playerRow--off'}`}>
                <Avatar name={p.name} color={playerColor(room, p.id)} />
                <span className="playerRow__main">
                  <span className="playerRow__name">{p.name}</span>
                  <span className="playerRow__tag">{tags.join(' · ')}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="sectionFooter">Нови играчи се появяват тук, щом въведат кода.</p>
      </section>

      <section className="section">
        <h2 className="sectionHeader">Настройки</h2>
        <div className="group">
          <div className="row">
            <span className="row__label">Импостори</span>
            {isHost ? (
              <Segmented
                small
                label="Брой импостори"
                value={impostorCount}
                onChange={(v) => onSettings({ impostorCount: v, categoryIds })}
                options={[
                  { value: 1 as const, label: '1' },
                  { value: 2 as const, label: '2' },
                ]}
              />
            ) : (
              <span className="row__value">{impostorCount}</span>
            )}
          </div>
          {!isHost && (
            <div className="row">
              <span className="row__label">Категории</span>
              <span className="row__value">{categoriesValue}</span>
            </div>
          )}
        </div>
        <p className="sectionFooter">
          {twoFallsBackToOne
            ? `Двама импостори — щом станат поне ${TWO_IMPOSTORS_MIN} играчи. Дотогава играта е с един.`
            : `Двама импостори са възможни при ${TWO_IMPOSTORS_MIN} или повече играчи.`}
        </p>
      </section>

      {isHost && (
        <section className="section">
          <div className="sectionHeader sectionHeader--split">
            <h2 className="sectionHeader__title">Категории · {categoriesValue}</h2>
            {!allOn && (
              <button type="button" className="textBtn" onClick={() => onSettings({ impostorCount, categoryIds: [...ALL_CATEGORY_IDS] })}>
                Избери всички
              </button>
            )}
          </div>
          <CategoryList selected={categoryIds} onToggle={toggleCategory} />
          <p className="sectionFooter">Думата се тегли от избраните категории. Поне една трябва да остане.</p>
        </section>
      )}

      <div className="flexSpacer" />
      <div className="footer footer--lobby">
        {isHost ? (
          <>
            <button type="button" className="btn btn--primary" disabled={tooFewPlayers} onClick={onStart}>
              Започни играта
            </button>
            <span className="footer__caption" aria-live="polite">
              {tooFewPlayers ? 'Нужни са поне 3 играчи' : 'Само домакинът вижда този бутон'}
            </span>
          </>
        ) : (
          <span className="waiting" role="status">
            <span className="spinner" aria-hidden="true" />
            Чакаме домакина да започне…
          </span>
        )}
      </div>
    </main>
  )
}

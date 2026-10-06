import { CardFace, CategoryChip } from '../components/CardFace'
import { Avatar, NavBar, NavButton } from '../components/Controls'
import { HoldCard } from '../components/HoldCard'
import { joinNames } from '../lib/game'
import type { Card, Room } from '../lib/protocol'
import { playerColor } from './Lobby'

export function OnlineCard({
  room,
  me,
  card,
  onLeave,
  onNewGame,
  onChangeSettings,
  onReveal,
}: {
  room: Room
  me: string
  card: Card | null
  onLeave: () => void
  onNewGame: () => void
  onChangeSettings: () => void
  onReveal: () => void
}) {
  const isHost = room.hostId === me
  const myName = room.players.find((p) => p.id === me)?.name ?? ''
  const starter =
    room.players.find((p) => p.id === room.starterId) ??
    (room.starterId && room.starterName ? { id: room.starterId, name: room.starterName } : undefined)
  const revealed = room.revealed
  const revealedCategory = revealed
    ? typeof revealed.category === 'string'
      ? { id: revealed.category, name: revealed.category }
      : revealed.category
    : null
  const impostorNames = revealed ? revealed.impostorIds.map(
        (id, i) => room.players.find((p) => p.id === id)?.name ?? revealed.impostorNames?.[i] ?? '—',
      ) : []

  return (
    <main className="screen screen--fade">
      <NavBar
        left={<NavButton onClick={onLeave}>Напусни</NavButton>}
        title={`Стая ${room.code}`}
        right={<span className="navbar__me">{myName}</span>}
      />

      {starter && (
        <div className="cardSection">
          <div className="starterBanner">
            <Avatar name={starter.name} color={playerColor(room, starter.id)} size={40} />
            <span className="starterBanner__text">
              <span className="starterBanner__label">Първи започва</span>
              <span className="starterBanner__name">
                {starter.name}
                {starter.id === me ? ' (ти)' : ''}
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="onlineCardBody">
        {revealed && revealedCategory ? (
          <div className="staticCard" aria-live="polite">
            <CategoryChip id={revealedCategory.id} name={revealedCategory.name} />
            <span className="face__kicker">Думата беше</span>
            <span className="face__word">{revealed.word}</span>
            <span className="hintBox hintBox--danger">
              <span className="hintBox__label">{impostorNames.length > 1 ? 'Импостори' : 'Импостор'}</span>
              <span className="hintBox__value">{joinNames(impostorNames)}</span>
            </span>
            {card?.role === 'impostor' && <span className="face__note face__note--tight">Ти беше импосторът.</span>}
          </div>
        ) : card ? (
          <HoldCard tall tone={card.role === 'impostor' ? 'danger' : 'accent'} subtitle="Пусни, и картата се скрива.">
            {card.role === 'impostor' ? <CardFace role="impostor" hint={card.hint} /> : <CardFace role="crew" word={card.word} />}
          </HoldCard>
        ) : (
          <div className="staticCard">
            <span className="face__kicker">Тази игра вече тече</span>
            <span className="face__note">Влезе по средата, затова нямаш карта. Ще получиш при следващата игра.</span>
          </div>
        )}
      </div>

      <div className="footer footer--stack">
        {isHost ? (
          <>
            <button type="button" className="btn btn--primary" onClick={onNewGame}>
              Нова игра
            </button>
            <button type="button" className="btn btn--plain btn--danger" disabled={!!revealed} onClick={onReveal}>
              Разкрий думата за всички
            </button>
            <button type="button" className="btn btn--plain" onClick={onChangeSettings}>
              Промени настройките
            </button>
          </>
        ) : (
          <span className="footer__caption footer__caption--block">
            {revealed ? 'Домакинът пуска следващата игра.' : 'Домакинът разкрива думата и пуска следващата игра.'}
          </span>
        )}
      </div>
    </main>
  )
}

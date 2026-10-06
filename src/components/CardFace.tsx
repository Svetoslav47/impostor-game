import { categoryById } from '../lib/categories'
import { CategoryTile } from './Icons'

export function CategoryChip({ id, name }: { id: string; name: string }) {
  const cat = categoryById(id)
  return (
    <span className="chip">
      <CategoryTile color={cat?.color ?? '#8E8E93'} icon={cat?.icon ?? 'M12 3a9 9 0 100 18 9 9 0 000-18z'} size={22} iconSize={14} radius={6} stroke={2.2} />
      <span className="chip__label">{name}</span>
    </span>
  )
}

// No category on the card: knowing the topic made the impostor's job too easy.
export type FaceProps = { role: 'crew'; word: string } | { role: 'impostor'; hint: string }

/** What a player sees while holding the card. */
export function CardFace(props: FaceProps) {
  return (
    <>
      {props.role === 'crew' ? (
        <>
          <span className="face__kicker">Тайната дума</span>
          <span className="face__word">{props.word}</span>
          <span className="face__note">Кажи асоциация, без да издаваш думата.</span>
        </>
      ) : (
        <>
          <span className="face__kicker face__kicker--danger">Ти си</span>
          <span className="face__word face__word--danger">Импосторът</span>
          <span className="hintBox">
            <span className="hintBox__label">Подсказка</span>
            <span className="hintBox__value">{props.hint}</span>
          </span>
          <span className="face__note face__note--tight">Не знаеш думата. Слушай и блъфирай.</span>
        </>
      )}
    </>
  )
}

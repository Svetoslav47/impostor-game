import { CATEGORIES } from '../lib/categories'
import { CategoryTile } from './Icons'

export function CategoryList({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="group">
      {CATEGORIES.map((c) => (
        <label key={c.id} className="catRow">
          <CategoryTile color={c.color} icon={c.icon} />
          <span className="catRow__text">
            <span className="catRow__name">{c.name}</span>
            <span className="catRow__desc">{c.description}</span>
          </span>
          <input type="checkbox" className="checkbox" checked={selected.includes(c.id)} onChange={() => onToggle(c.id)} />
        </label>
      ))}
    </div>
  )
}

export function toggleId(list: string[], id: string): string[] {
  const order = CATEGORIES.map((c) => c.id)
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  return order.filter((x) => next.includes(x))
}

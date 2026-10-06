import type { ReactNode } from 'react'
import { BackChevron } from './Icons'

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  small = false,
  label,
  isDisabled,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  small?: boolean
  label: string
  isDisabled?: (v: T) => boolean
}) {
  return (
    <div className={small ? 'segmented segmented--small' : 'segmented'} role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const selected = o.value === value
        const disabled = isDisabled?.(o.value) ?? false
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            className="segmented__btn"
            disabled={disabled}
            onClick={() => !selected && onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Stepper({ value, min, max, onChange, decLabel, incLabel }: { value: number; min: number; max: number; onChange: (v: number) => void; decLabel: string; incLabel: string }) {
  return (
    <div className="stepper">
      <button type="button" aria-label={decLabel} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="stepper__sep" aria-hidden="true" />
      <button type="button" aria-label={incLabel} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

/** iOS navigation bar: left action, centered title, right slot. */
export function NavBar({ left, title, right }: { left?: ReactNode; title?: ReactNode; right?: ReactNode }) {
  return (
    <header className="navbar">
      <div className="navbar__left">{left}</div>
      <div className="navbar__title">{title}</div>
      <div className="navbar__right">{right}</div>
    </header>
  )
}

export function NavButton({ children, onClick, back = false, bold = false, disabled }: { children: ReactNode; onClick: () => void; back?: boolean; bold?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={`navBtn${bold ? ' navBtn--bold' : ''}`} onClick={onClick} disabled={disabled}>
      {back && <BackChevron />}
      {children}
    </button>
  )
}

export function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?'
  return (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size, background: color, fontSize: size >= 40 ? 17 : 15 }}>
      {initial}
    </span>
  )
}

export const AVATAR_COLORS = ['#0A6CDB', '#AF52DE', '#248A3D', '#C93400', '#D70015', '#5856D6', '#0071A4', '#A2845E', '#C7006E', '#6C6C70', '#B25000', '#007D75']

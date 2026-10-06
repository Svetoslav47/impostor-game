import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EyeIcon } from './Icons'

/**
 * Press-and-hold card: shows `children` only while a pointer (or Space/Enter) is held down.
 */
export function HoldCard({
  subtitle,
  tone,
  onReveal,
  children,
  tall = false,
}: {
  subtitle: string
  /** Ring color while shown. */
  tone: 'accent' | 'danger'
  onReveal?: () => void
  children: ReactNode
  tall?: boolean
}) {
  const [shown, setShown] = useState(false)
  const pointerRef = useRef<number | null>(null)
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  useEffect(() => {
    if (shown) onRevealRef.current?.()
  }, [shown])

  // Hide when the page goes to the background mid-hold.
  useEffect(() => {
    const hide = () => {
      pointerRef.current = null
      setShown(false)
    }
    const onVis = () => document.visibilityState !== 'visible' && hide()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', hide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', hide)
    }
  }, [])

  const release = (e: React.PointerEvent) => {
    if (pointerRef.current !== null && e.pointerId !== pointerRef.current) return
    pointerRef.current = null
    setShown(false)
  }

  return (
    <button
      type="button"
      className={`holdCard${shown ? ` holdCard--shown holdCard--${tone}` : ''}${tall ? ' holdCard--tall' : ''}`}
      aria-label={shown ? undefined : `Задръж, за да видиш. ${subtitle}`}
      aria-live="polite"
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return
        pointerRef.current = e.pointerId
        setShown(true)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          if (!e.repeat) setShown(true)
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          setShown(false)
        }
      }}
      onBlur={() => setShown(false)}
      onClick={(e) => e.preventDefault()}
    >
      {shown ? (
        <span className="cardFace">{children}</span>
      ) : (
        <span className="cardFace cardFace--hidden" aria-hidden="true">
          <span className="eyeCircle">
            <EyeIcon />
          </span>
          <span className="holdCard__title">Задръж, за да видиш</span>
          <span className="holdCard__sub">{subtitle}</span>
        </span>
      )}
    </button>
  )
}

import { useEffect, useRef } from 'react'
import { AlertIcon } from './Icons'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

/** iOS-style alert with Cancel / Confirm. */
export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="alertBackdrop" onClick={onClose}>
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby={options.message ? 'alert-msg' : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="alert__body">
          <h2 id="alert-title" className="alert__title">{options.title}</h2>
          {options.message && <p id="alert-msg" className="alert__msg">{options.message}</p>}
        </div>
        <div className="alert__actions">
          <button ref={cancelRef} type="button" className="alert__btn" onClick={onClose}>
            {options.cancelLabel ?? 'Отказ'}
          </button>
          <button
            type="button"
            className={`alert__btn alert__btn--bold${options.destructive ? ' alert__btn--danger' : ''}`}
            onClick={() => {
              onClose()
              options.onConfirm()
            }}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Small banner for server errors; dismisses itself. */
export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 4000)
    return () => window.clearTimeout(t)
  }, [message, onDismiss])
  return (
    <div className="toastWrap">
      <button type="button" className="toast" role="alert" onClick={onDismiss}>
        <span className="toast__icon">
          <AlertIcon />
        </span>
        <span className="toast__msg">{message}</span>
      </button>
    </div>
  )
}

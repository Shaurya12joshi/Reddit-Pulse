import { useEffect } from 'react'
import Icon from './Icon.jsx'

export default function Modal({ open, onClose, title, subtitle, children, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ boxShadow: 'var(--shadow-modal)' }}
        className={`animate-fade-up my-auto w-full ${width} rounded-[14px] border border-line bg-surface`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-[13px] text-ink-3">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-ink-3 transition-colors hover:bg-elevated hover:text-ink"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

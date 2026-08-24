import { sentimentStyle } from '../../utils/format.js'

export function Badge({ children, className = '', title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated px-2.5 py-1 text-[11px] font-medium text-ink-2 ${className}`}
    >
      {children}
    </span>
  )
}

export function SentimentBadge({ label, showDot = true, className = '' }) {
  const style = sentimentStyle(label)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${style.bg} ${style.border} ${style.text} ${className}`}
    >
      {showDot ? <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} /> : null}
      {style.label}
    </span>
  )
}

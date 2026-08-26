export function formatCompact(value) {
  const n = Number(value) || 0
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(Number(value) || 0))
}

export function formatPercent(value, digits = 0) {
  return `${(Number(value) || 0).toFixed(digits)}%`
}

export function formatSigned(value, digits = 2) {
  const n = Number(value) || 0
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}`
}

const DAY_MS = 24 * 60 * 60 * 1000

export function formatRelative(input) {
  const time = new Date(input).getTime()
  if (Number.isNaN(time)) return ''

  const diff = Date.now() - time
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(diff / DAY_MS)
  if (days < 31) return `${days}d ago`

  const months = Math.round(days / 30)
  return `${months}mo ago`
}

export function formatShortDate(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatLongDate(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function truncate(text, max = 180) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export const SENTIMENT_STYLES = {
  positive: {
    label: 'Positive',
    text: 'text-positive-ink',
    bg: 'bg-positive/10',
    border: 'border-positive/25',
    dot: 'bg-positive',
    cssVar: 'var(--color-positive)',
  },
  neutral: {
    label: 'Neutral',
    text: 'text-neutral-ink',
    bg: 'bg-neutral/10',
    border: 'border-neutral/25',
    dot: 'bg-neutral',
    cssVar: 'var(--color-neutral)',
  },
  negative: {
    label: 'Negative',
    text: 'text-negative-ink',
    bg: 'bg-negative/10',
    border: 'border-negative/25',
    dot: 'bg-negative',
    cssVar: 'var(--color-negative)',
  },
}

export function sentimentStyle(label) {
  return SENTIMENT_STYLES[label] || SENTIMENT_STYLES.neutral
}

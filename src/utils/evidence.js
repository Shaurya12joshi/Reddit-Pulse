export const TONE_CLASSES = {
  positive: 'border-positive/30 bg-positive/10 text-positive-ink',
  caution: 'border-highlight/40 bg-highlight/15 text-highlight-ink',
  negative: 'border-negative/25 bg-negative/10 text-negative-ink',
  neutral: 'border-line bg-elevated text-ink-2',
  info: 'border-secondary/30 bg-secondary/10 text-secondary-ink',
}

const LEVELS = [
  {
    min: 0.75,
    label: 'Well backed',
    tone: 'positive',
    blurb: 'Plenty of discussions say the same thing, so this reads as settled.',
  },
  {
    min: 0.5,
    label: 'Fairly backed',
    tone: 'positive',
    blurb: 'Enough discussions agree to lean this way, with some disagreement.',
  },
  {
    min: 0.3,
    label: 'Lightly backed',
    tone: 'caution',
    blurb: 'Only a handful of discussions cover this. Treat it as a lead, not a finding.',
  },
  {
    min: 0,
    label: 'Barely backed',
    tone: 'negative',
    blurb: 'Almost nothing in the collected discussions supports this. Worth checking yourself.',
  },
]

export function evidenceOf(confidence) {
  const value = Number(confidence)
  const score = Number.isFinite(value) ? value : 0
  const level = LEVELS.find((entry) => score >= entry.min) || LEVELS[LEVELS.length - 1]
  return { ...level, percent: Math.round(score * 100) }
}

export function evidenceTitle(confidence) {
  const { blurb, percent } = evidenceOf(confidence)
  return `${blurb} (${percent}% of the way to a settled read)`
}

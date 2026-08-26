export const CHART_COLORS = {
  positive: 'var(--color-positive)',
  neutral: 'var(--color-neutral)',
  negative: 'var(--color-negative)',

  accent: 'var(--color-accent)',
  secondary: 'var(--color-secondary)',
  highlight: 'var(--color-highlight)',

  grid: 'var(--color-grid)',
  gridStrong: 'var(--color-grid-strong)',
  surface: 'var(--color-surface)',
  canvas: 'var(--color-canvas)',
  ink3: 'var(--color-ink-3)',
}

export const SENTIMENT_SERIES = [
  { key: 'positive', label: 'Positive', color: CHART_COLORS.positive },
  { key: 'neutral', label: 'Neutral', color: CHART_COLORS.neutral },
  { key: 'negative', label: 'Negative', color: CHART_COLORS.negative },
]

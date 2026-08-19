/**
 * Chart colours as CSS variable references.
 *
 * Charts are SVG built in JS, so they cannot always use Tailwind classes — a
 * `<stop stopColor>` or a computed segment fill needs a value. Returning
 * `var(--color-*)` keeps them theme-aware anyway: the browser resolves the
 * variable at paint time, so these follow the active theme with no JS involved
 * and no re-render on switch.
 *
 * IMPORTANT: a `var()` string must be applied via the `style` prop, not as an
 * SVG presentation attribute (`fill="var(--x)"` is not reliably supported).
 */

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

/** Sentiment series in the order they should stack / read in a legend. */
export const SENTIMENT_SERIES = [
  { key: 'positive', label: 'Positive', color: CHART_COLORS.positive },
  { key: 'neutral', label: 'Neutral', color: CHART_COLORS.neutral },
  { key: 'negative', label: 'Negative', color: CHART_COLORS.negative },
]

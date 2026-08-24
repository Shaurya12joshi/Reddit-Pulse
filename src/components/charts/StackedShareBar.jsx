import { CHART_COLORS } from '../../utils/chartColors.js'

export default function StackedShareBar({
  positive = 0,
  neutral = 0,
  negative = 0,
  height = 6,
  showLabels = false,
}) {
  const total = positive + neutral + negative
  if (!total) {
    return (
      <div
        className="w-full rounded-full bg-raised"
        style={{ height }}
        aria-hidden="true"
      />
    )
  }

  const parts = [
    { key: 'positive', value: positive, color: CHART_COLORS.positive, label: 'positive' },
    { key: 'neutral', value: neutral, color: CHART_COLORS.neutral, label: 'neutral' },
    { key: 'negative', value: negative, color: CHART_COLORS.negative, label: 'negative' },
  ].filter((part) => part.value > 0)

  return (
    <div>
      <div
        className="flex w-full gap-0.5 overflow-hidden rounded-full"
        style={{ height }}
        role="img"
        aria-label={`${positive} positive, ${neutral} neutral, ${negative} negative`}
      >
        {parts.map((part) => (
          <div
            key={part.key}
            className="h-full transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(part.value / total) * 100}%`,
              backgroundColor: part.color,
            }}
            title={`${part.label}: ${part.value}`}
          />
        ))}
      </div>

      {showLabels ? (
        <div className="tnum mt-2 flex justify-between text-[11px] text-ink-3">
          <span className="text-positive-ink">
            {((positive / total) * 100).toFixed(0)}% positive
          </span>
          <span>{((neutral / total) * 100).toFixed(0)}% neutral</span>
          <span className="text-negative-ink">
            {((negative / total) * 100).toFixed(0)}% negative
          </span>
        </div>
      ) : null}
    </div>
  )
}

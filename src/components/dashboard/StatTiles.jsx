import Icon from '../ui/Icon.jsx'
import { formatCompact, formatNumber, formatPercent } from '../../utils/format.js'

const TONE_ICON = {
  positive: 'text-positive-ink',
  negative: 'text-negative-ink',
  accent: 'text-accent-ink',
  highlight: 'text-highlight-ink',
  secondary: 'text-secondary-ink',
  default: 'text-ink-3',
}

export default function StatTiles({ insights }) {
  const { sentiment, totals, timeline, competitors } = insights

  const buckets = timeline.buckets
  let delta = null
  if (buckets.length >= 4) {
    const half = Math.floor(buckets.length / 2)
    const mean = (list) =>
      list.reduce((sum, bucket) => sum + bucket.avgScore, 0) / (list.length || 1)
    delta = mean(buckets.slice(half)) - mean(buckets.slice(0, half))
  }

  const tiles = [
    {
      id: 'mentions',
      icon: 'chat',
      label: 'Total mentions',
      value: formatNumber(totals.mentions),
      caption: `${totals.posts} posts · ${totals.comments} comments`,
      tone: 'accent',
    },
    {
      id: 'positive',
      icon: 'trendUp',
      label: 'Positive share',
      value: formatPercent(sentiment.positivePct, 1),
      caption: `${sentiment.positive} of ${totals.mentions} discussions`,
      tone: 'positive',
    },
    {
      id: 'negative',
      icon: 'trendDown',
      label: 'Negative share',
      value: formatPercent(sentiment.negativePct, 1),
      caption: `${sentiment.negative} of ${totals.mentions} discussions`,
      tone: 'negative',
    },
    {
      id: 'engagement',
      icon: 'flame',
      label: 'Total upvotes',
      value: formatCompact(totals.upvotes),
      caption: `${formatCompact(totals.replies)} replies across threads`,
      tone: 'highlight',
    },
    {
      id: 'competitors',
      icon: 'scale',
      label: 'Rivals mentioned',
      value: String(competitors.length),
      caption: competitors.length
        ? `${competitors[0].brand} leads at ${formatPercent(competitors[0].share, 1)}`
        : 'No comparisons detected',
      tone: 'secondary',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className="rounded-[14px] border border-line bg-surface p-4"
        >
          <div className="flex items-center gap-2">
            <Icon
              name={tile.icon}
              className={`h-3.5 w-3.5 ${TONE_ICON[tile.tone] || TONE_ICON.default}`}
            />
            <span className="text-[11px] tracking-wide text-ink-3 uppercase">
              {tile.label}
            </span>
          </div>

          <p className="tnum mt-2.5 text-[26px] leading-none font-semibold text-ink">
            {tile.value}
          </p>

          <p className="mt-2 truncate text-[12px] text-ink-3" title={tile.caption}>
            {tile.caption}
          </p>

          {tile.id === 'mentions' && delta !== null ? (
            <p
              className={`tnum mt-1.5 inline-flex items-center gap-1 text-[11px] ${
                delta >= 0 ? 'text-positive-ink' : 'text-negative-ink'
              }`}
            >
              <Icon
                name={delta >= 0 ? 'trendUp' : 'trendDown'}
                className="h-3 w-3"
              />
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(2)} tone shift vs earlier period
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

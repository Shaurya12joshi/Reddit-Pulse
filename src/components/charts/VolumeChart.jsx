import { useMemo, useState } from 'react'
import useElementSize from '../../hooks/useElementSize.js'
import { niceScale, scale } from './chartUtils.js'
import { formatShortDate } from '../../utils/format.js'
import { CHART_COLORS } from '../../utils/chartColors.js'

const MARGIN = { top: 16, right: 16, bottom: 26, left: 34 }
const HEIGHT = 230

export default function VolumeChart({ buckets, granularity = 'day' }) {
  const [wrapRef, { width }] = useElementSize()
  const [hover, setHover] = useState(null)

  const chart = useMemo(() => {
    if (!width || buckets.length === 0) return null

    const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    const peak = Math.max(1, ...buckets.map((b) => b.total))
    const { max, ticks } = niceScale(0, peak, 3)

    const slot = innerWidth / buckets.length
    const barWidth = Math.max(2, Math.min(26, slot * 0.68))

    const bars = buckets.map((bucket, index) => {
      const x = MARGIN.left + slot * index + (slot - barWidth) / 2
      const segments = []
      let cursor = MARGIN.top + innerHeight

      ;[
        { key: 'negative', color: CHART_COLORS.negative },
        { key: 'neutral', color: CHART_COLORS.neutral },
        { key: 'positive', color: CHART_COLORS.positive },
      ].forEach(({ key, color }) => {
        const value = bucket[key]
        if (!value) return
        const height = (value / max) * innerHeight
        cursor -= height
        segments.push({ key, color, y: cursor, height })
      })

      return { x, barWidth, bucket, segments, index }
    })

    return { innerWidth, innerHeight, bars, ticks, max, slot }
  }, [buckets, width])

  return (
    <div ref={wrapRef} className="relative w-full">
      {chart ? (
        <>
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Reddit discussion volume over time"
            onMouseLeave={() => setHover(null)}
          >
            {chart.ticks.map((tick) => {
              const y =
                MARGIN.top + scale(tick, chart.max, 0, 0, chart.innerHeight)
              return (
                <g key={tick}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={y}
                    y2={y}
                    className={tick === 0 ? 'stroke-grid-strong' : 'stroke-grid'}
                    strokeDasharray={tick === 0 ? '' : '3 4'}
                  />
                  <text
                    x={MARGIN.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-ink-3 text-[10px]"
                  >
                    {tick}
                  </text>
                </g>
              )
            })}

            {chart.bars.map((bar) => (
              <g key={bar.bucket.start}>
                <rect
                  x={MARGIN.left + chart.slot * bar.index}
                  y={MARGIN.top}
                  width={chart.slot}
                  height={chart.innerHeight}
                  className={hover === bar.index ? 'fill-ink' : 'fill-transparent'}
                  fillOpacity={hover === bar.index ? 0.05 : 0}
                  onMouseEnter={() => setHover(bar.index)}
                />
                {bar.segments.map((segment) => (
                  <rect
                    key={segment.key}
                    x={bar.x}
                    y={segment.y}
                    width={bar.barWidth}
                    height={Math.max(1, segment.height)}
                    style={{ fill: segment.color }}
                    fillOpacity={hover === null || hover === bar.index ? 0.9 : 0.35}
                    rx="1.5"
                    className="transition-[fill-opacity] duration-150"
                    pointerEvents="none"
                  />
                ))}
              </g>
            ))}

            {chart.bars.map((bar, index) => {
              const step = Math.max(1, Math.ceil(chart.bars.length / 7))
              if (index % step !== 0 && index !== chart.bars.length - 1) return null
              return (
                <text
                  key={`label-${bar.bucket.start}`}
                  x={bar.x + bar.barWidth / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-ink-3 text-[10px]"
                >
                  {formatShortDate(bar.bucket.start)}
                </text>
              )
            })}
          </svg>

          {hover !== null && chart.bars[hover] ? (
            <VolumeTooltip
              bar={chart.bars[hover]}
              chartWidth={width}
              granularity={granularity}
            />
          ) : null}
        </>
      ) : (
        <div style={{ height: HEIGHT }} />
      )}
    </div>
  )
}

function VolumeTooltip({ bar, chartWidth, granularity }) {
  const { bucket } = bar
  const left = Math.min(Math.max(bar.x + bar.barWidth / 2, 84), chartWidth - 84)

  const rows = [
    { label: 'Positive', value: bucket.positive, color: 'bg-positive' },
    { label: 'Neutral', value: bucket.neutral, color: 'bg-neutral' },
    { label: 'Negative', value: bucket.negative, color: 'bg-negative' },
  ]

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-elevated px-3 py-2 text-[12px]"
      style={{ left, boxShadow: 'var(--shadow-pop)' }}
    >
      <div className="mb-1.5 font-medium whitespace-nowrap text-ink">
        {granularity === 'week' ? 'Week of ' : ''}
        {formatShortDate(bucket.start)} · {bucket.total} total
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 whitespace-nowrap">
            <span className={`h-1.5 w-1.5 rounded-full ${row.color}`} />
            <span className="text-ink-3">{row.label}</span>
            <span className="tnum ml-auto pl-3 font-medium text-ink">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

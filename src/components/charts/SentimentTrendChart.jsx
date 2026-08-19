import { useMemo, useState } from 'react'
import useElementSize from '../../hooks/useElementSize.js'
import { areaPath, nearestIndex, niceScale, scale, smoothPath } from './chartUtils.js'
import { formatShortDate, formatSigned, sentimentStyle } from '../../utils/format.js'
import { CHART_COLORS } from '../../utils/chartColors.js'

const MARGIN = { top: 16, right: 16, bottom: 26, left: 40 }
const HEIGHT = 250

/**
 * Average sentiment over time, drawn as a smooth area around a zero baseline.
 * Above the line is favourable, below is not — the shape tells the story before
 * the reader looks at a single number.
 */
export default function SentimentTrendChart({ buckets, granularity = 'day' }) {
  const [wrapRef, { width }] = useElementSize()
  const [hover, setHover] = useState(null)

  const chart = useMemo(() => {
    if (!width || buckets.length === 0) return null

    const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

    const scores = buckets.map((b) => b.avgScore)
    const bound = Math.max(0.25, ...scores.map((s) => Math.abs(s)))
    const { min, max, ticks } = niceScale(-bound, bound, 4)

    const points = buckets.map((bucket, index) => ({
      x:
        MARGIN.left +
        (buckets.length === 1
          ? innerWidth / 2
          : (index / (buckets.length - 1)) * innerWidth),
      y: MARGIN.top + scale(bucket.avgScore, max, min, 0, innerHeight),
      bucket,
    }))

    const zeroY = MARGIN.top + scale(0, max, min, 0, innerHeight)
    const line = smoothPath(points)

    return {
      innerWidth,
      innerHeight,
      points,
      zeroY,
      line,
      area: areaPath(line, points, zeroY),
      ticks,
      min,
      max,
    }
  }, [buckets, width])

  return (
    <div ref={wrapRef} className="relative w-full">
      {chart ? (
        <>
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Average Reddit sentiment over time"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              const index = nearestIndex(chart.points, event.clientX - rect.left)
              setHover(index)
            }}
          >
            <defs>
              {/* var() must go through `style`, not the stopColor attribute. */}
              <linearGradient id="trend-positive" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  style={{ stopColor: CHART_COLORS.positive }}
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  style={{ stopColor: CHART_COLORS.positive }}
                  stopOpacity="0"
                />
              </linearGradient>
              <linearGradient id="trend-negative" x1="0" y1="1" x2="0" y2="0">
                <stop
                  offset="0%"
                  style={{ stopColor: CHART_COLORS.negative }}
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  style={{ stopColor: CHART_COLORS.negative }}
                  stopOpacity="0"
                />
              </linearGradient>
              {/* Split the fill at the zero line: green above, red below. */}
              <clipPath id="clip-above">
                <rect
                  x={0}
                  y={MARGIN.top}
                  width={width}
                  height={Math.max(0, chart.zeroY - MARGIN.top)}
                />
              </clipPath>
              <clipPath id="clip-below">
                <rect
                  x={0}
                  y={chart.zeroY}
                  width={width}
                  height={Math.max(0, HEIGHT - MARGIN.bottom - chart.zeroY)}
                />
              </clipPath>
            </defs>

            {/* horizontal grid + y labels */}
            {chart.ticks.map((tick) => {
              const y =
                MARGIN.top +
                scale(tick, chart.max, chart.min, 0, chart.innerHeight)
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
                    {tick.toFixed(1)}
                  </text>
                </g>
              )
            })}

            <path d={chart.area} fill="url(#trend-positive)" clipPath="url(#clip-above)" />
            <path d={chart.area} fill="url(#trend-negative)" clipPath="url(#clip-below)" />

            <path
              d={chart.line}
              fill="none"
              style={{ stroke: CHART_COLORS.positive }}
              strokeWidth="2"
              clipPath="url(#clip-above)"
            />
            <path
              d={chart.line}
              fill="none"
              style={{ stroke: CHART_COLORS.negative }}
              strokeWidth="2"
              clipPath="url(#clip-below)"
            />

            {/* x labels — thinned out so they never collide */}
            {chart.points.map((point, index) => {
              const step = Math.max(1, Math.ceil(chart.points.length / 7))
              if (index % step !== 0 && index !== chart.points.length - 1) return null
              return (
                <text
                  key={point.bucket.start}
                  x={point.x}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-ink-3 text-[10px]"
                >
                  {formatShortDate(point.bucket.start)}
                </text>
              )
            })}

            {hover !== null && chart.points[hover] ? (
              <g>
                <line
                  x1={chart.points[hover].x}
                  x2={chart.points[hover].x}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  className="stroke-line-strong"
                />
                <circle
                  cx={chart.points[hover].x}
                  cy={chart.points[hover].y}
                  r="4"
                  style={{
                    fill: CHART_COLORS.surface,
                    stroke:
                      chart.points[hover].bucket.avgScore >= 0
                        ? CHART_COLORS.positive
                        : CHART_COLORS.negative,
                  }}
                  strokeWidth="2"
                />
              </g>
            ) : null}
          </svg>

          {hover !== null && chart.points[hover] ? (
            <TrendTooltip
              point={chart.points[hover]}
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

function TrendTooltip({ point, chartWidth, granularity }) {
  const { bucket } = point
  const style = sentimentStyle(
    bucket.avgScore >= 0.08 ? 'positive' : bucket.avgScore <= -0.08 ? 'negative' : 'neutral',
  )

  // Keep the tooltip inside the chart bounds.
  const left = Math.min(Math.max(point.x, 80), chartWidth - 80)

  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line-strong bg-elevated px-3 py-2 text-[12px] whitespace-nowrap"
      style={{
        left,
        top: Math.max(0, point.y - 78),
        boxShadow: 'var(--shadow-pop)',
      }}
    >
      <div className="mb-1 font-medium text-ink">
        {granularity === 'week' ? 'Week of ' : ''}
        {formatShortDate(bucket.start)}
      </div>
      <div className={`tnum font-semibold ${style.text}`}>
        {formatSigned(bucket.avgScore)} avg score
      </div>
      <div className="tnum mt-0.5 text-ink-3">
        {bucket.total} {bucket.total === 1 ? 'mention' : 'mentions'} · {bucket.positive}↑{' '}
        {bucket.negative}↓
      </div>
    </div>
  )
}

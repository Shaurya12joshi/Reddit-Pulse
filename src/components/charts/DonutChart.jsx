import { useState } from 'react'

const SIZE = 190
const STROKE = 22
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Donut showing how a total splits across a few segments.
 * Hovering a segment swaps the centre label to that segment's numbers.
 *
 * @param {{segments:{key:string,label:string,value:number,color:string}[],
 *          total:number, centerLabel:string}} props
 */
export default function DonutChart({ segments, total, centerLabel = 'mentions' }) {
  const [active, setActive] = useState(null)

  // Pre-compute each arc's start offset so the render pass stays pure.
  const usable = segments
    .filter((segment) => segment.value > 0)
    .reduce((acc, segment) => {
      const previous = acc[acc.length - 1]
      const start = previous ? previous.start + previous.length : 0
      const length = (total ? segment.value / total : 0) * CIRCUMFERENCE
      acc.push({ ...segment, start, length })
      return acc
    }, [])

  const focus = active ? usable.find((s) => s.key === active) : null
  const headline = focus
    ? `${((focus.value / total) * 100).toFixed(1)}%`
    : String(total)
  const caption = focus ? focus.label : centerLabel

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label="Sentiment distribution"
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            className="stroke-raised"
            strokeWidth={STROKE}
          />
          {usable.map((segment) => {
            // A 2px visual gap between segments.
            const drawn = Math.max(0, segment.length - 2)
            return (
              <circle
                key={segment.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                style={{ stroke: segment.color }}
                strokeWidth={active === segment.key ? STROKE + 3 : STROKE}
                strokeDasharray={`${drawn} ${CIRCUMFERENCE - drawn}`}
                strokeDashoffset={-segment.start}
                strokeLinecap="butt"
                opacity={active && active !== segment.key ? 0.35 : 1}
                onMouseEnter={() => setActive(segment.key)}
                onMouseLeave={() => setActive(null)}
                className="cursor-default transition-all duration-150"
              />
            )
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-[30px] leading-none font-semibold text-ink">
            {headline}
          </span>
          <span className="mt-1.5 text-[11px] tracking-wide text-ink-3 uppercase">
            {caption}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-2.5">
        {segments.map((segment) => {
          const share = total ? (segment.value / total) * 100 : 0
          return (
            <li
              key={segment.key}
              onMouseEnter={() => setActive(segment.key)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                active === segment.key ? 'bg-elevated' : ''
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-[13px] text-ink-2">{segment.label}</span>
              <span className="tnum ml-auto text-[13px] font-semibold text-ink">
                {share.toFixed(1)}%
              </span>
              <span className="tnum w-10 text-right text-[12px] text-ink-3">
                {segment.value}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

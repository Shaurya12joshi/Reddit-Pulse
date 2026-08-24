export default function DivergingBars({ items, onSelect, activeId }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-ink-3">
        No topics matched the current filters.
      </p>
    )
  }

  const peak = Math.max(
    ...items.map((item) => Math.max(item.positive, item.negative)),
    1,
  )

  return (
    <div>
      <ul className="space-y-2">
        {items.map((item) => {
          const isActive = activeId === item.id
          const net = item.positive - item.negative
          const Row = onSelect ? 'button' : 'div'

          return (
            <li key={item.id}>
              <Row
                {...(onSelect
                  ? {
                      type: 'button',
                      onClick: () => onSelect(isActive ? null : item.id),
                      'aria-pressed': isActive,
                    }
                  : {})}
                className={`grid w-full grid-cols-[minmax(90px,1.15fr)_2.4fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                  onSelect ? 'cursor-pointer hover:bg-elevated' : ''
                } ${isActive ? 'bg-elevated ring-1 ring-accent/40 ring-inset' : ''}`}
              >
                <span className="truncate text-[13px] text-ink-2">{item.label}</span>

                <span className="flex h-5 items-center">
                  {}
                  <span className="flex h-full flex-1 justify-end">
                    <span
                      className="h-full rounded-l-[3px] bg-negative/80 transition-[width] duration-500 ease-out"
                      style={{ width: `${(item.negative / peak) * 100}%` }}
                      title={`${item.negative} negative`}
                    />
                  </span>
                  <span className="h-full w-px shrink-0 bg-line-strong" />
                  {}
                  <span className="flex h-full flex-1 justify-start">
                    <span
                      className="h-full rounded-r-[3px] bg-positive/80 transition-[width] duration-500 ease-out"
                      style={{ width: `${(item.positive / peak) * 100}%` }}
                      title={`${item.positive} positive`}
                    />
                  </span>
                </span>

                <span
                  className={`tnum w-11 text-right text-[12px] font-semibold ${
                    net > 0 ? 'text-positive-ink' : net < 0 ? 'text-negative-ink' : 'text-ink-3'
                  }`}
                >
                  {net > 0 ? '+' : ''}
                  {net}
                </span>
              </Row>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-center justify-center gap-5 border-t border-line pt-3 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-negative/80" /> negative mentions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-positive/80" /> positive mentions
        </span>
      </div>
    </div>
  )
}

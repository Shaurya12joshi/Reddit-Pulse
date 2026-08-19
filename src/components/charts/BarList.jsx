/**
 * Horizontal bar list — the workhorse for ranked categories
 * (topics, subreddits, competitors).
 *
 * @param {{items:{id:string,label:string,value:number,caption?:string,
 *          color?:string}[], onSelect?:Function, activeId?:string,
 *          valueSuffix?:string}} props
 */
export default function BarList({
  items,
  onSelect,
  activeId,
  valueSuffix = '',
  emptyMessage = 'Nothing to show yet.',
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-[13px] text-ink-3">{emptyMessage}</p>
  }

  const peak = Math.max(...items.map((item) => item.value), 1)

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const width = (item.value / peak) * 100
        const isActive = activeId === item.id
        const interactive = Boolean(onSelect)

        const Row = interactive ? 'button' : 'div'

        return (
          <li key={item.id}>
            <Row
              {...(interactive
                ? {
                    type: 'button',
                    onClick: () => onSelect(isActive ? null : item.id),
                    'aria-pressed': isActive,
                  }
                : {})}
              className={`relative block w-full overflow-hidden rounded-lg px-3 py-2.5 text-left transition-colors ${
                interactive ? 'cursor-pointer hover:bg-elevated' : ''
              } ${isActive ? 'bg-elevated ring-1 ring-accent/40 ring-inset' : ''}`}
            >
              {/* the bar itself sits behind the text */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-r-md transition-[width] duration-500 ease-out"
                style={{
                  width: `${width}%`,
                  backgroundColor: item.color || 'var(--color-accent)',
                  opacity: isActive ? 0.24 : 0.14,
                }}
              />
              <span className="relative flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {item.label}
                </span>
                {item.caption ? (
                  <span className="tnum shrink-0 text-[11px] text-ink-3">
                    {item.caption}
                  </span>
                ) : null}
                <span className="tnum shrink-0 text-[13px] font-semibold text-ink tabular-nums">
                  {item.value}
                  {valueSuffix}
                </span>
              </span>
            </Row>
          </li>
        )
      })}
    </ul>
  )
}

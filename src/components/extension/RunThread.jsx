import { useState } from 'react'

import Icon from '../ui/Icon.jsx'

const READS = [
  { title: 'Is the extra legroom actually worth it on long haul?', sub: 'r/aviation', score: '3.4k', comments: 412, depth: 4 },
  { title: 'Switched last month, here is what nobody tells you', sub: 'r/personalfinance', score: '1.9k', comments: 288, depth: 3 },
  { title: 'Anyone else had their order arrive three days late?', sub: 'r/mildlyinfuriating', score: 842, comments: 96, depth: 2 },
  { title: 'Comparing the two before I commit for a year', sub: 'r/buildapc', score: 517, comments: 64, depth: 2 },
  { title: 'Support finally replied after eight days', sub: 'r/india', score: 211, comments: 38, depth: 1 },
]

export default function RunThread({ assemble = false }) {
  const [open, setOpen] = useState(0)

  return (
    <figure className="m-0">
      <ul className="grid gap-2">
        {READS.map((read, index) => {
          const expanded = open === index
          return (
            <li
              key={read.title}
              style={{ '--i': assemble ? index : 0, '--stagger': 0.09 }}
              className={`overflow-hidden rounded-[10px] border border-line bg-surface/85 backdrop-blur-sm transition-colors hover:border-[#ff4500]/50 ${
                assemble ? 'enter enter-strip' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : index)}
                aria-expanded={expanded}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
              >
                <span className="flex w-9 shrink-0 flex-col items-center pt-0.5">
                  <Icon name="arrowUp" className="h-3.5 w-3.5 text-[#ff4500]" strokeWidth={2.4} />
                  <span className="tnum text-[11px] font-semibold text-ink-2">{read.score}</span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
                    <span className="font-semibold text-ink-2">{read.sub}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tnum">{read.comments} comments read</span>
                  </span>
                  <span className="mt-1 block text-[13.5px] leading-snug font-medium text-ink">
                    {read.title}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1 pt-0.5">
                  {Array.from({ length: read.depth }, (_, bar) => (
                    <span
                      key={bar}
                      className="w-1 rounded-full bg-[#ff4500]"
                      style={{ height: `${6 + bar * 4}px`, opacity: 0.35 + bar * 0.2 }}
                    />
                  ))}
                  <Icon
                    name="chevronDown"
                    className={`ml-1 h-3.5 w-3.5 text-ink-3 transition-transform ${
                      expanded ? 'rotate-180' : ''
                    }`}
                  />
                </span>
              </button>

              {expanded ? (
                <div className="animate-fade border-t border-line bg-elevated/60 px-3 py-2.5 pl-[3.4rem]">
                  <p className="text-[12.5px] leading-relaxed text-ink-3">
                    The collector opened this thread and read its top {read.comments} replies, then
                    handed them to Reddit Pulse. The bars show how deep the discussion ran.
                  </p>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <figcaption className="mt-3 text-[12px] leading-relaxed text-ink-3">
        Illustrative, not real posts. One run opens about 30 threads like these across roughly 10
        communities, reading up to 40 replies in each.
      </figcaption>
    </figure>
  )
}

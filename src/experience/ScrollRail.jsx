import { useEffect, useRef } from 'react'

import { ACTS, actIndexAt } from './acts.js'
import { subscribe } from './scrollDriver.js'

/**
 * Chapter rail — a fixed index of the journey down the right edge.
 *
 * Doubles as the progress indicator and as orientation: at any point the
 * viewer can see how far through the data they are and what comes next.
 */
export default function ScrollRail() {
  const fillRef = useRef(null)
  const itemsRef = useRef([])
  const cueRef = useRef(null)

  useEffect(() => {
    return subscribe(({ damped, moved }) => {
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleY(${damped})`
      }

      const active = actIndexAt(damped)
      itemsRef.current.forEach((item, index) => {
        if (!item) return
        const isActive = index === active
        item.style.opacity = isActive ? '1' : '0.35'
        item.style.transform = `translateX(${isActive ? -6 : 0}px)`
      })

      if (cueRef.current) {
        cueRef.current.style.opacity = moved || damped > 0.02 ? '0' : '1'
      }
    })
  }, [])

  return (
    <>
      <nav
        aria-label="Journey progress"
        className="pointer-events-none absolute top-1/2 right-5 z-20 hidden -translate-y-1/2 lg:block"
      >
        <div className="flex items-stretch gap-4">
          <ul className="flex flex-col justify-center gap-3.5 text-right">
            {ACTS.map((act, index) => (
              <li
                key={act.id}
                ref={(node) => {
                  itemsRef.current[index] = node
                }}
                className="eyebrow text-ink-2 transition-none"
                style={{ opacity: 0.35 }}
              >
                {act.eyebrow}
              </li>
            ))}
          </ul>

          {/* the rail itself */}
          <div className="relative w-px bg-line">
            <div
              ref={fillRef}
              className="absolute inset-x-0 top-0 h-full origin-top bg-ink"
              style={{ transform: 'scaleY(0)' }}
            />
          </div>
        </div>
      </nav>

      <div
        ref={cueRef}
        className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 text-center"
      >
        <span className="eyebrow block text-ink-3">Scroll</span>
        <span className="animate-scroll-cue mx-auto mt-2 block h-6 w-px bg-ink-3" />
      </div>
    </>
  )
}

import { useEffect, useRef } from 'react'

import { ACTS, actAnchor, actIndexAt } from './acts.js'
import { scrollToProgress, subscribe } from './scrollDriver.js'

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
        item.setAttribute('aria-current', isActive ? 'true' : 'false')
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
          <ul className="flex flex-col items-end justify-center gap-3.5 text-right">
            {ACTS.map((act, index) => (
              <li key={act.id}>
                <button
                  type="button"
                  ref={(node) => {
                    itemsRef.current[index] = node
                  }}
                  onClick={() => scrollToProgress(actAnchor(index))}
                  className="eyebrow pointer-events-auto cursor-pointer text-ink-2 transition-none hover:!opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  style={{ opacity: 0.35 }}
                >
                  {act.eyebrow}
                </button>
              </li>
            ))}
          </ul>

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

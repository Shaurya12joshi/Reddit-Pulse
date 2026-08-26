import { useEffect, useRef, useState } from 'react'

const VH_PER_ACT_DESKTOP = 105
const VH_PER_ACT_MOBILE = 82

function bell(local) {
  const clamped = Math.max(0, Math.min(1, local))
  return Math.sin(clamped * Math.PI)
}

export default function PinnedActs({ acts, mobile, onActiveChange }) {
  const sectionRef = useRef(null)
  const layerRefs = useRef([])
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined

    let frame = null

    const paint = () => {
      frame = null
      const rect = section.getBoundingClientRect()
      const travel = Math.max(1, rect.height - window.innerHeight)
      const progress = Math.max(0, Math.min(1, -rect.top / travel))

      const span = 1 / acts.length
      let nextActive = 0

      layerRefs.current.forEach((node, index) => {
        if (!node) return

        const local = (progress - index * span) / span
        const presence = bell(local + 0.5 > 1.5 ? 1 : local)
        const visible = local > -0.55 && local < 1.55

        if (local >= 0 && local < 1) nextActive = index

        const drift = (local - 0.5) * 2
        const settled = Math.max(0, Math.min(1, local * 2.1))
        node.style.setProperty('--t', settled.toFixed(3))
        node.style.opacity = visible ? Math.min(1, presence * 1.35).toFixed(3) : '0'
        node.style.visibility = visible ? 'visible' : 'hidden'
        node.style.transform =
          `perspective(1400px) translate3d(0, ${(drift * -30).toFixed(2)}px, ${(-Math.abs(drift) * 150).toFixed(2)}px) ` +
          `rotateX(${(drift * 5).toFixed(2)}deg)`
      })

      if (nextActive !== activeRef.current) {
        activeRef.current = nextActive
        setActive(nextActive)
        onActiveChange?.(nextActive)
      }
    }

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(paint)
    }

    paint()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [acts.length, onActiveChange])

  const jumpTo = (index) => {
    const section = sectionRef.current
    if (!section) return
    const travel = section.offsetHeight - window.innerHeight
    const target =
      section.offsetTop + travel * ((index + 0.45) / acts.length)
    window.scrollTo({
      top: target,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  const perAct = mobile ? VH_PER_ACT_MOBILE : VH_PER_ACT_DESKTOP

  return (
    <section
      ref={sectionRef}
      style={{ height: `${acts.length * perAct}vh` }}
      className="relative z-10"
      aria-label="How the collector works"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {acts.map((act, index) => (
          <div
            key={act.id}
            ref={(node) => {
              layerRefs.current[index] = node
            }}
            className="act-layer absolute inset-0 flex items-center will-change-transform"
            style={{ opacity: 0, visibility: 'hidden' }}
          >
            <div className="mx-auto w-full max-w-5xl px-5">{act.render}</div>
          </div>
        ))}

        <nav
          aria-label="Sections"
          className="absolute top-1/2 right-5 hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex"
        >
          {acts.map((act, index) => (
            <button
              key={act.id}
              type="button"
              onClick={() => jumpTo(index)}
              aria-current={active === index ? 'true' : undefined}
              className="group flex items-center gap-2.5"
            >
              <span
                className={`eyebrow transition-opacity ${
                  active === index ? 'text-ink opacity-100' : 'text-ink-3 opacity-0 group-hover:opacity-100'
                }`}
              >
                {act.label}
              </span>
              <span
                className={`flex h-4 w-4 items-center justify-center transition-colors ${
                  active === index ? 'text-[#ff4500]' : 'text-line-strong group-hover:text-[#ff8352]'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M12 3.5 21 13h-5v7.5H8V13H3z" />
                </svg>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </section>
  )
}

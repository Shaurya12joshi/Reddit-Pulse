import { lazy, Suspense, useEffect, useRef } from 'react'

import ActOverlay from './ActOverlay.jsx'
import ScrollRail from './ScrollRail.jsx'
import StaticExperience from './StaticExperience.jsx'
import useEnvironment from './useEnvironment.js'
import { setScrollTarget, startDriver } from './scrollDriver.js'

// The WebGL bundle is the heaviest thing on the page and is useless to anyone
// on the static route, so it is only fetched once we know it will be used.
const ExperienceCanvas = lazy(() => import('./ExperienceCanvas.jsx'))

/** Scroll distance for the pinned journey. Shorter on phones. */
const DESKTOP_VH = 780
const MOBILE_VH = 560

export default function Experience({ children }) {
  const sectionRef = useRef(null)
  const { ready, webgl, reducedMotion, mobile } = useEnvironment()

  const immersive = ready && webgl && !reducedMotion

  useEffect(() => {
    if (!immersive) return undefined
    setScrollTarget(sectionRef.current)
    const stop = startDriver()
    return () => {
      stop()
      setScrollTarget(null)
    }
  }, [immersive])

  // Before the environment probe resolves, and on the fallback route, render
  // the editorial version. It is the SSR/first-paint output too, so there is
  // never a blank frame while WebGL boots.
  if (!immersive) {
    return <StaticExperience>{children}</StaticExperience>
  }

  return (
    <section
      ref={sectionRef}
      style={{ height: `${mobile ? MOBILE_VH : DESKTOP_VH}vh` }}
      className="relative"
      aria-label="How Reddit Pulse turns conversations into intelligence"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Suspense fallback={null}>
          <ExperienceCanvas
            count={mobile ? 240 : 620}
            reducedMotion={false}
          />
        </Suspense>

        <ActOverlay finalSlot={children} />
        <ScrollRail />
      </div>
    </section>
  )
}

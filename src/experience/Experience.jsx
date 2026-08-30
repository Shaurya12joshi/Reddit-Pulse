import { lazy, Suspense, useEffect, useRef, useState } from 'react'

import ActOverlay from './ActOverlay.jsx'
import ScrollRail from './ScrollRail.jsx'
import SceneBoundary from './SceneBoundary.jsx'
import StaticExperience from './StaticExperience.jsx'
import useEnvironment from './useEnvironment.js'
import { ACTS } from './acts.js'
import { setScrollTarget, startDriver } from './scrollDriver.js'
import { usePreviewReport } from '../data/previewReport.js'
import PostDetailModal from '../components/dashboard/PostDetailModal.jsx'

const ExperienceCanvas = lazy(() => import('./ExperienceCanvas.jsx'))

const DESKTOP_VH_PER_ACT = 155
const MOBILE_VH_PER_ACT = 115

export default function Experience({ children, fallbackSections }) {
  const sectionRef = useRef(null)
  const { ready, webgl, reducedMotion, mobile } = useEnvironment()
  const [selectedPost, setSelectedPost] = useState(null)

  const preview = usePreviewReport()
  const hasData = preview.status === 'ready'

  const [sceneFailed, setSceneFailed] = useState(false)

  const immersive = ready && webgl && !reducedMotion && !sceneFailed

  const openedAtStart = useRef(false)
  useEffect(() => {
    if (openedAtStart.current) return
    openedAtStart.current = true

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!immersive) return undefined
    setScrollTarget(sectionRef.current)
    const stop = startDriver()
    return () => {
      stop()
      setScrollTarget(null)
    }
  }, [immersive])

  if (!immersive) {
    return (
      <StaticExperience fallbackSections={fallbackSections}>{children}</StaticExperience>
    )
  }

  const perAct = mobile ? MOBILE_VH_PER_ACT : DESKTOP_VH_PER_ACT

  return (
    <section
      ref={sectionRef}
      style={{ height: `${ACTS.length * perAct}vh` }}
      className="relative"
      aria-label="How Reddit Pulse turns conversations into intelligence"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <SceneBoundary onFail={() => setSceneFailed(true)}>
          <Suspense fallback={null}>
            <ExperienceCanvas
              count={mobile ? 240 : 620}
              reducedMotion={false}
              insights={hasData ? preview.insights : null}
              company={hasData ? preview.company : null}
              posts={hasData ? preview.posts : []}
              onOpenPost={setSelectedPost}
            />
          </Suspense>
        </SceneBoundary>

        <ActOverlay slots={{ start: children }} />
        <ScrollRail />
      </div>

      <PostDetailModal
        post={selectedPost}
        open={Boolean(selectedPost)}
        onClose={() => setSelectedPost(null)}
      />
    </section>
  )
}

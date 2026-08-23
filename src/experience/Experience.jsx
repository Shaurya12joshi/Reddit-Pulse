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

// The WebGL bundle is the heaviest thing on the page and is useless to anyone
// on the static route, so it is only fetched once we know it will be used.
const ExperienceCanvas = lazy(() => import('./ExperienceCanvas.jsx'))

/**
 * Scroll distance for the journey.
 *
 * Budgeted per act rather than fixed, so adding a beat to the story lengthens
 * the scroll instead of squeezing every existing act shorter. Shorter per act
 * on phones, where the same distance costs far more thumb travel.
 */
const DESKTOP_VH_PER_ACT = 98
const MOBILE_VH_PER_ACT = 70

/**
 * The landing page, as one world.
 *
 * Everything from the opening noise to the final call to action happens
 * inside a single pinned section with a single camera: the report, the
 * threads behind it and the audience for it are acts of one timeline, not
 * sections stacked underneath a 3D header. Scrolling moves the camera; the
 * world morphs between authored states as it goes.
 *
 * Text stays real HTML above the canvas — crisp, selectable, indexable and
 * reachable by a screen reader, none of which survives being drawn into
 * WebGL. The 3D carries the structure; the DOM carries the words.
 */
export default function Experience({ children, fallbackSections }) {
  const sectionRef = useRef(null)
  const { ready, webgl, reducedMotion, mobile } = useEnvironment()
  const [selectedPost, setSelectedPost] = useState(null)

  // Real measurements for the report and evidence acts. Absent until the
  // backend answers, and absent entirely if nothing has been collected — the
  // stages that need it simply do not mount, rather than inventing content.
  const preview = usePreviewReport()
  const hasData = preview.status === 'ready'

  // A scene that has thrown once will throw again on remount, so the flat
  // route becomes permanent for this visit rather than flickering.
  const [sceneFailed, setSceneFailed] = useState(false)

  const immersive = ready && webgl && !reducedMotion && !sceneFailed

  /*
   * Always begin at the beginning.
   *
   * Browsers restore the previous scroll position on reload, and this page is
   * around twelve screens tall — so refreshing while halfway down dropped the
   * visitor into the middle of the story, with the camera already deep in the
   * journey and the opening act never seen.
   *
   * Guarded by a ref so it only happens on the first mount: a later remount
   * (an environment change, a dev reload) must not yank someone back to the
   * top mid-scroll.
   */
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

  // Before the environment probe resolves, and on the fallback route, render
  // the editorial version. It is the SSR/first-paint output too, so there is
  // never a blank frame while WebGL boots.
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

      {/* Opened from a thread object inside the scene. Rendered outside the
          canvas so it is a normal, focus-trapped dialog rather than something
          competing with WebGL for the pointer. */}
      <PostDetailModal
        post={selectedPost}
        open={Boolean(selectedPost)}
        onClose={() => setSelectedPost(null)}
      />
    </section>
  )
}

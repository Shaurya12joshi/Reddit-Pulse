import { useEffect, useRef } from 'react'

import { ACTS, copyEnvelope } from './acts.js'
import { subscribe } from './scrollDriver.js'

/**
 * The typography layer.
 *
 * All text is real HTML sitting above the canvas — crisp, selectable,
 * accessible and indexable, which none of it would be if it were drawn into
 * WebGL. It is animated by writing transforms straight to the DOM from the
 * scroll driver, so the copy is locked to the same value moving the camera
 * without React re-rendering once during a scroll.
 */

const ALIGNMENT = {
  left: 'items-start text-left',
  right: 'items-end text-right',
  center: 'items-center text-center',
}

const POSITION = {
  left: 'justify-start pl-[6vw] pr-[8vw] md:pl-[8vw] md:pr-[45vw]',
  right: 'justify-end pr-[6vw] pl-[8vw] md:pr-[8vw] md:pl-[45vw]',
  center: 'justify-center px-[7vw]',
}

function ActBlock({ act, index, isFirst, children }) {
  const rootRef = useRef(null)
  const linesRef = useRef([])
  const bodyRef = useRef(null)
  const metaRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    linesRef.current = Array.from(root.querySelectorAll('[data-line]'))

    return subscribe(({ damped }) => {
      const { opacity, reveal, exit } = copyEnvelope(damped, index)

      // Hide completely when out of range so stacked acts never intercept
      // pointer events or get read out by a screen reader mid-scroll.
      const visible = opacity > 0.01
      root.style.opacity = String(opacity)
      root.style.visibility = visible ? 'visible' : 'hidden'
      root.setAttribute('aria-hidden', visible ? 'false' : 'true')
      if (!visible) return

      // Copy drifts up and back as it leaves — it exits *into* the scene
      // rather than fading on the spot.
      root.style.transform = `translate3d(0, ${-exit * 9}vh, 0) scale(${1 - exit * 0.06})`

      // Staggered masked reveal, one line at a time.
      linesRef.current.forEach((line, lineIndex) => {
        const staggered = Math.min(1, Math.max(0, reveal * 1.55 - lineIndex * 0.16))
        line.style.transform = `translate3d(0, ${(1 - staggered) * 108}%, 0)`
      })

      if (metaRef.current) {
        metaRef.current.style.transform = `translate3d(0, ${(1 - reveal) * 22}px, 0)`
        metaRef.current.style.opacity = String(Math.min(1, reveal * 1.7))
      }
      if (bodyRef.current) {
        const delayed = Math.min(1, Math.max(0, reveal * 1.5 - 0.42))
        bodyRef.current.style.transform = `translate3d(0, ${(1 - delayed) * 26}px, 0)`
        bodyRef.current.style.opacity = String(delayed)
      }
    })
  }, [index])

  return (
    <div
      ref={rootRef}
      className={`pointer-events-none absolute inset-0 flex flex-col ${ALIGNMENT[act.align]} ${POSITION[act.align]} justify-center`}
      style={{ opacity: 0, visibility: 'hidden', willChange: 'transform, opacity' }}
    >
      <div className={`flex max-w-2xl flex-col ${ALIGNMENT[act.align]}`}>
        <div ref={metaRef} className="mb-6 flex items-center gap-3">
          {act.step ? (
            <span className="tnum flex h-8 w-8 items-center justify-center rounded-full border border-ink text-[12px] font-semibold text-ink">
              {act.step}
            </span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          )}
          <span className="eyebrow text-ink-3">{act.eyebrow}</span>
        </div>

        <h2
          className={`display text-ink ${
            isFirst
              ? 'text-[13vw] leading-[0.9] sm:text-[9vw] lg:text-[6.6vw]'
              : 'text-[10vw] sm:text-[7vw] lg:text-[4.6vw]'
          }`}
        >
          {act.title.map((line, lineIndex) => (
            <span key={lineIndex} className="line-mask">
              <span data-line>{renderLine(line, act.serifWord)}</span>
            </span>
          ))}
        </h2>

        <p
          ref={bodyRef}
          className={`mt-7 text-[15px] leading-relaxed text-ink-2 sm:text-[17px] ${
            act.align === 'center' ? 'max-w-xl' : 'max-w-md'
          }`}
          style={{ opacity: 0 }}
        >
          {act.body}
        </p>

        {/* The one interactive island in the overlay — the search box. Marked
            auto explicitly because its ancestor is deliberately inert. */}
        {children ? (
          <div className="pointer-events-auto mt-9">{children}</div>
        ) : null}
      </div>
    </div>
  )
}

/** Swaps one word into the display serif — the editorial accent. */
function renderLine(line, serifWord) {
  if (!serifWord || !line.includes(serifWord)) return line
  const [before, after] = line.split(serifWord)
  return (
    <>
      {before}
      <em className="display-serif">{serifWord}</em>
      {after}
    </>
  )
}

/**
 * @param {object} props
 * @param {Record<string, import('react').ReactNode>} [props.slots] extra
 *   content keyed by act id — the search box under the closing act, and
 *   anything else that has to be a real, focusable control rather than
 *   geometry.
 */
export default function ActOverlay({ slots = {} }) {
  return (
    /*
     * Inert by default, all the way down.
     *
     * Every layer here is a full-viewport box sitting on top of the canvas,
     * so anything left interactive is an invisible sheet over the whole 3D
     * scene — which is exactly why nothing could be hovered during an act
     * that had visible copy. Only real controls opt back in, one element at
     * a time.
     */
    <div className="pointer-events-none absolute inset-0 z-10">
      {ACTS.map((act, index) => (
        <ActBlock key={act.id} act={act} index={index} isFirst={index === 0}>
          {slots[act.id] ?? null}
        </ActBlock>
      ))}
    </div>
  )
}

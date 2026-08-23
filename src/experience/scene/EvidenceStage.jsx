import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

import { driver } from '../scrollDriver.js'
import { ACT_INDEX, stagePresence } from '../acts.js'
import useStageActive from '../useStageActive.js'
import { ACCENT_3D, PAPER_3D } from '../palette.js'
import { SENTIMENT_3D } from '../report/reportGeometry.js'
import { formatCompact, truncate } from '../../utils/format.js'

/**
 * The threads themselves, as objects in the world.
 *
 * Every measurement in the report is an aggregate; this is the act where the
 * aggregate is taken apart again and the actual conversations are visible.
 * They hang in a shallow arc in front of the corpus wall — picked out of it,
 * not floating in empty space.
 *
 * A post is a paper sheet with a coloured spine marking its sentiment, and
 * its text is real DOM through drei's `Html`. That is deliberate rather than
 * a shortcut: a Reddit post is prose, and prose has to be selectable,
 * legible at any zoom and reachable by a screen reader. Rendering it into a
 * texture would look like a post without being one.
 */

const SHEET = { w: 4.7, h: 2.9 }

/*
 * A colour per panel, so five threads read as five distinct objects.
 *
 * Sentiment cannot do this job: a brand's threads are overwhelmingly
 * positive-or-neutral, so colouring the frames by sentiment produced a wall
 * of green and grey. Sentiment still appears, as a word on the panel, where
 * it is unambiguous. The frame carries identity instead.
 */
/*
 * Panel text sizing.
 *
 * Transform-mode Html maps CSS pixels to world units, so a hard-coded pixel
 * width silently outgrows its panel the moment the scale changes — which is
 * exactly what happened when the scale went from 0.19 to 0.25 and the text
 * started hanging off the sheets.
 *
 * The ratio is taken from the one configuration observed to fit: at scale
 * 0.19 a 780px-wide block spanned the 4.4-unit sheet. Deriving the pixel size
 * from the sheet keeps the text inside the frame whatever the panel is
 * resized to, instead of needing to be re-guessed each time.
 */
const PANEL_SCALE = 0.19
const PX_PER_WORLD = 780 / 4.4

const PANEL_ACCENTS = [
  ACCENT_3D.orange,
  ACCENT_3D.blue,
  ACCENT_3D.green,
  ACCENT_3D.purple,
  ACCENT_3D.yellow,
  PAPER_3D.muted,
]

/**
 * A wide, shallow arc sweeping away to the left.
 *
 * The arc used to end mid-frame, leaving the right of the screen empty while
 * the act's copy sat in the bottom-right corner — the composition had a hole
 * in it. It now runs the full width and climbs as it goes right, so the
 * panels fill the upper right and hand off to the headline below them.
 */
function arrange(count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const angle = (t - 0.42) * 1.5
    const radius = 8.6

    return {
      x: Math.sin(angle) * radius,
      // Staggered rows, tilted upward toward the right of the arc.
      y: (index % 2 === 0 ? 1.15 : -1.55) + t * 1.5,
      z: -Math.cos(angle) * radius + radius - 1.2,
      rotationY: -angle * 0.85,
      phase: index * 1.37,
    }
  })
}

function ThreadPanel({ post, slot, revealRef, index, total, onOpen }) {
  const accent = PANEL_ACCENTS[index % PANEL_ACCENTS.length]
  const groupRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  const geometry = useMemo(() => new THREE.PlaneGeometry(SHEET.w, SHEET.h), [])
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry])

  const spine = SENTIMENT_3D[post.sentimentLabel] ?? SENTIMENT_3D.neutral

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    const reveal = revealRef.current
    // Staggered, so the arc assembles left to right instead of appearing whole.
    const local = THREE.MathUtils.clamp(reveal * 1.5 - (index / total) * 0.45, 0, 1)
    const eased = local * local * (3 - 2 * local)

    group.visible = eased > 0.01
    if (!group.visible) return

    const time = state.clock.elapsedTime
    const lift = hovered ? 0.32 : 0

    // Rises into place from below and behind, then breathes.
    group.position.set(
      slot.x,
      slot.y + (1 - eased) * -2.6 + Math.sin(time * 0.5 + slot.phase) * 0.09 + lift,
      slot.z + (1 - eased) * -3.4,
    )
    group.rotation.y = slot.rotationY + (1 - eased) * 0.4
    group.scale.setScalar((0.92 + eased * 0.08) * (hovered ? 1.04 : 1))
  })

  return (
    <group ref={groupRef}>
      {/* The sheet, and a coloured spine down its left edge carrying the
          sentiment — the same encoding the report columns use. */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={PAPER_3D.card}
          roughness={0.86}
          metalness={0}
          transparent
          opacity={0.97}
        />
      </mesh>
      {/* The frame itself carries the panel's colour — a chunky bar bolted
          across the top read as a mis-drawn edge rather than as trim. */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={accent} transparent opacity={0.95} depthWrite={false} />
      </lineSegments>
      <mesh position={[-SHEET.w / 2 + 0.05, 0, 0.012]}>
        <planeGeometry args={[0.09, SHEET.h]} />
        <meshBasicMaterial color={accent} />
      </mesh>

      {/*
        Width and height are pinned to the sheet's own dimensions rather than
        guessed: transform-mode Html maps CSS pixels to world units through
        `scale`, so a fixed 780px block silently grew past the panel edge the
        moment the scale went up. Deriving both from SHEET keeps the text
        inside the frame whatever the panel is resized to, and the flex column
        centres it vertically instead of letting it hang from the top.
      */}
      <Html
        transform
        scale={PANEL_SCALE}
        position={[0, 0, 0.02]}
        zIndexRange={[8, 0]}
        // Only the panel itself is interactive; the surrounding transparent
        // box would otherwise swallow scroll and pointer events over the canvas.
        style={{
          width: `${SHEET.w * PX_PER_WORLD}px`,
          height: `${SHEET.h * PX_PER_WORLD}px`,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => onOpen(post)}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          className="flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden py-9 pr-10 pl-12 text-left"
        >
          {/* The community is the label that orients you, so it gets the
              eyebrow treatment the rest of the page uses for exactly that. */}
          <div className="flex items-baseline gap-4">
            <span
              className="shrink-0 text-[22px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: accent }}
            >
              r/{post.subreddit}
            </span>
            <span className="truncate text-[20px] text-ink-3">u/{post.author}</span>
            <span className="tnum shrink-0 text-[20px] text-ink-3">
              ▲ {formatCompact(post.score)}
            </span>
          </div>

          {/* `display` is the page's headline treatment — tight tracking and
              a short leading. A thread title is a headline, and setting it in
              plain sans was the reason these panels read as form fields
              rather than as conversations. */}
          <h3 className="display mt-5 text-[42px] text-ink">
            {truncate(post.title || post.body, 54)}
          </h3>

          {post.title && post.body ? (
            <p className="mt-4 text-[26px] leading-relaxed text-ink-2">
              {truncate(post.body, 62)}
            </p>
          ) : null}

          <span
            className="mt-6 block text-[20px] font-semibold tracking-[0.16em] uppercase"
            style={{ color: hovered ? ACCENT_3D.orange : spine }}
          >
            {hovered ? 'Open thread →' : post.sentimentLabel}
          </span>
        </button>
      </Html>
    </group>
  )
}

export default function EvidenceStage({ posts, onOpenPost, reducedMotion = false }) {
  const revealRef = useRef(0)
  const groupRef = useRef(null)

  // Coalesced rather than defaulted: the preview report is null until the
  // backend answers, and a default parameter only fills in for `undefined`.
  const shown = useMemo(() => (posts ?? []).slice(0, 6), [posts])
  const slots = useMemo(() => arrange(shown.length), [shown.length])

  // Each panel's text is drei `Html` — real DOM outside the canvas, which
  // goes on rendering even when its group is hidden. Unmounting the stage is
  // what actually removes it, and without this the threads were legible over
  // the opening act.
  const active = useStageActive(ACT_INDEX.evidence, { lead: 0.25, tail: 0.08 })

  useFrame((_, delta) => {
    const target = reducedMotion
      ? 1
      : stagePresence(driver.damped, ACT_INDEX.evidence, { lead: 0.25, tail: 0.08 })
    revealRef.current = THREE.MathUtils.damp(
      revealRef.current,
      target,
      2.6,
      Math.min(delta, 0.05),
    )
    if (groupRef.current) groupRef.current.visible = revealRef.current > 0.004
  })

  if (!shown.length || (!active && !reducedMotion)) return null

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {shown.map((post, index) => (
        <ThreadPanel
          key={post.id}
          post={post}
          slot={slots[index]}
          index={index}
          total={shown.length}
          revealRef={revealRef}
          onOpen={onOpenPost}
        />
      ))}
    </group>
  )
}

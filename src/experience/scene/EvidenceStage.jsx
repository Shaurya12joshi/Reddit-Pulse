import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

import { driver } from '../scrollDriver.js'
import { ACT_INDEX, actLocalProgress, stagePresence } from '../acts.js'
import useStageActive from '../useStageActive.js'
import { ACCENT_3D, PAPER_3D } from '../palette.js'
import { SENTIMENT_3D } from '../report/reportGeometry.js'
import { formatCompact, truncate } from '../../utils/format.js'

const SHEET = { w: 4.7, h: 2.9 }

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

function arrange(count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const angle = (t - 0.42) * 1.5
    const radius = 8.6

    return {
      x: Math.sin(angle) * radius,
      y: (index % 2 === 0 ? 1.15 : -1.55) + t * 1.5,
      z: -Math.cos(angle) * radius + radius - 1.2,
      rotationY: -angle * 0.85,
      phase: index * 1.37,
    }
  })
}

function ThreadPanel({ post, slot, revealRef, exitRef, index, total, onOpen }) {
  const accent = PANEL_ACCENTS[index % PANEL_ACCENTS.length]
  const groupRef = useRef(null)
  const cardRef = useRef(null)
  const edgeRef = useRef(null)
  const spineRef = useRef(null)
  const htmlRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  const geometry = useMemo(() => new THREE.PlaneGeometry(SHEET.w, SHEET.h), [])
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry])

  const spine = SENTIMENT_3D[post.sentimentLabel] ?? SENTIMENT_3D.neutral

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    const reveal = revealRef.current
    const local = THREE.MathUtils.clamp(reveal * 1.5 - (index / total) * 0.45, 0, 1)
    const eased = local * local * (3 - 2 * local)

    // Leaving is not entering played backwards. The cards draw back into the
    // depth of the scene and are gone before the next act arrives, so the two
    // never share the screen.
    const leaving = THREE.MathUtils.clamp(
      exitRef.current * 1.35 - ((total - 1 - index) / total) * 0.3,
      0,
      1,
    )
    const gone = leaving * leaving
    const shown = eased * (1 - gone)

    if (cardRef.current) cardRef.current.opacity = 0.97 * shown
    if (edgeRef.current) edgeRef.current.opacity = 0.95 * shown
    if (spineRef.current) spineRef.current.opacity = shown
    if (htmlRef.current) {
      htmlRef.current.style.opacity = String(shown)
      htmlRef.current.style.visibility = shown > 0.02 ? 'visible' : 'hidden'
    }

    group.visible = shown > 0.002
    if (!group.visible) return

    const time = state.clock.elapsedTime
    const lift = hovered ? 0.32 : 0

    group.position.set(
      slot.x * (1 - gone * 0.25),
      slot.y + (1 - eased) * -2.6 + Math.sin(time * 0.5 + slot.phase) * 0.09 + lift,
      slot.z + (1 - eased) * -3.4 - gone * 26,
    )
    group.rotation.y = slot.rotationY + (1 - eased) * 0.4
    group.scale.setScalar((0.92 + eased * 0.08) * (1 - gone * 0.35) * (hovered ? 1.04 : 1))
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          ref={cardRef}
          color={PAPER_3D.card}
          roughness={0.86}
          metalness={0}
          transparent
          opacity={0}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial
          ref={edgeRef}
          color={accent}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
      <mesh position={[-SHEET.w / 2 + 0.05, 0, 0.012]}>
        <planeGeometry args={[0.09, SHEET.h]} />
        <meshBasicMaterial ref={spineRef} color={accent} transparent opacity={0} />
      </mesh>

      <Html
        transform
        scale={PANEL_SCALE}
        position={[0, 0, 0.02]}
        zIndexRange={[8, 0]}
        style={{
          width: `${SHEET.w * PX_PER_WORLD}px`,
          height: `${SHEET.h * PX_PER_WORLD}px`,
          pointerEvents: 'auto',
        }}
      >
        <button
          ref={htmlRef}
          type="button"
          onClick={() => onOpen(post)}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          style={{ opacity: 0 }}
          className="flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden py-9 pr-10 pl-12 text-left"
        >
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
  const exitRef = useRef(0)
  const groupRef = useRef(null)

  const shown = useMemo(() => (posts ?? []).slice(0, 6), [posts])
  const slots = useMemo(() => arrange(shown.length), [shown.length])

  const active = useStageActive(ACT_INDEX.evidence, { lead: 0.32, tail: 0.45 })

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05)

    const target = reducedMotion
      ? 1
      : stagePresence(driver.damped, ACT_INDEX.evidence, { lead: 0.32, tail: 0.45 })
    revealRef.current = THREE.MathUtils.damp(revealRef.current, target, 2.6, step)

    // The withdrawal runs on the act's own clock and completes at 96% of it,
    // so the cards have cleared the frame before the next act opens.
    const local = actLocalProgress(driver.damped, ACT_INDEX.evidence)
    const leaving = reducedMotion
      ? 0
      : THREE.MathUtils.clamp((local - 0.55) / 0.41, 0, 1)
    exitRef.current = THREE.MathUtils.damp(exitRef.current, leaving, 4.2, step)

    if (groupRef.current) {
      groupRef.current.visible = revealRef.current > 0.004 && exitRef.current < 0.999
    }
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
          exitRef={exitRef}
          onOpen={onOpenPost}
        />
      ))}
    </group>
  )
}

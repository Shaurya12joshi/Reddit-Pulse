import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

import { PAPER_3D } from '../palette.js'
import {
  competitorNodes,
  sentimentBars,
  topicColumns,
  volumeStacks,
} from './reportGeometry.js'

/**
 * The report as an object rather than a page.
 *
 * The hero ends with fragments flattening into dashboard panels. This picks
 * the world up from there: the same paper, the same hairlines, the same
 * light — but now the panels have measurements standing on them.
 *
 * Every mark is real geometry driven by real numbers. Text is the one thing
 * rendered as DOM, through drei's `Html` in transform mode, so labels stay
 * crisp and keep the page's own typography instead of being approximated by
 * a texture. No font file is fetched, which matters: nothing here is bundled
 * and a CDN lookup would fail silently offline.
 */

const dummy = new THREE.Object3D()

// Same box proportions as the fragments in the hero field, so the report
// reads as built from the same material rather than a separate visual system.
const BAR_GEOMETRY = [0.82, 1, 0.82]
const RIBBON_GEOMETRY = [0.3, 1, 0.3]

const smoothstep = (t) => t * t * (3 - 2 * t)

/*
 * Pointer feedback.
 *
 * A mark that resizes under the cursor is telling you it is a thing and not a
 * picture, which is the whole claim this act is making. Lift and swell are
 * damped rather than snapped so a fast pass across the ridge reads as a wave
 * rather than as flicker.
 */
const HOVER_LIFT = 0.42
const HOVER_SWELL = 1.16
const HOVER_DAMP = 9

/** Nudge a value toward a target, frame-rate independent. */
const approach = (current, target, delta) =>
  THREE.MathUtils.damp(current, target, HOVER_DAMP, Math.min(delta, 0.05))

/** Shows the cursor as interactive only while something is genuinely under it. */
function useHoverCursor() {
  return {
    enter: () => {
      document.body.style.cursor = 'pointer'
    },
    leave: () => {
      document.body.style.cursor = ''
    },
  }
}

/** A hairline-outlined paper plane — the 3D form of a dashboard card. */
function Sheet({ width, height, position, rotation, reveal }) {
  const fillRef = useRef(null)
  const edgeRef = useRef(null)

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(width, height),
    [width, height],
  )
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry])

  useFrame(() => {
    const eased = smoothstep(reveal.current)
    if (fillRef.current) fillRef.current.material.opacity = eased * 0.55
    if (edgeRef.current) edgeRef.current.material.opacity = eased * 0.7
  })

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={fillRef} geometry={geometry}>
        <meshBasicMaterial
          color={PAPER_3D.card}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <lineSegments ref={edgeRef} geometry={edges}>
        <lineBasicMaterial
          color={PAPER_3D.rule}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

/** A small caption pinned to a point in the scene. */
function Label({ position, children, align = 'center' }) {
  return (
    <Html
      position={position}
      transform
      // Scaled down and then sized up in CSS: transform-mode Html maps one
      // world unit to one CSS pixel, so without this the text would be
      // enormous relative to the geometry.
      scale={0.52}
      pointerEvents="none"
      zIndexRange={[10, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div className={`w-44 text-${align} leading-tight`}>{children}</div>
    </Html>
  )
}

/** Three columns: how the conversation splits. */
function SentimentColumns({ sentiment, reveal }) {
  const bars = useMemo(() => sentimentBars(sentiment), [sentiment])
  const refs = useRef([])
  const [hovered, setHovered] = useState(null)
  const hoverAmount = useRef([])
  const cursor = useHoverCursor()

  useFrame((state, delta) => {
    const eased = smoothstep(reveal.current)
    const time = state.clock.elapsedTime

    bars.forEach((bar, index) => {
      const mesh = refs.current[index]
      if (!mesh) return
      // Staggered so the columns rise in sequence rather than as a block.
      const local = THREE.MathUtils.clamp(eased * 1.4 - index * 0.12, 0, 1)
      const grown = bar.height * smoothstep(local)

      const h = approach(hoverAmount.current[index] ?? 0, hovered === index ? 1 : 0, delta)
      hoverAmount.current[index] = h

      mesh.scale.y = Math.max(0.001, grown)
      mesh.scale.x = 1 + (HOVER_SWELL - 1) * h
      mesh.scale.z = 1 + (HOVER_SWELL - 1) * h
      mesh.position.y =
        grown / 2 + Math.sin(time * 0.6 + index) * 0.03 * eased + HOVER_LIFT * h
      mesh.visible = local > 0.01
    })
  })

  return (
    <group>
      {bars.map((bar, index) => (
        <group key={bar.key} position={[bar.x, 0, 0]}>
          <mesh
            ref={(node) => {
              refs.current[index] = node
            }}
            onPointerOver={(event) => {
              event.stopPropagation()
              setHovered(index)
              cursor.enter()
            }}
            onPointerOut={() => {
              setHovered(null)
              cursor.leave()
            }}
          >
            <boxGeometry args={BAR_GEOMETRY} />
            <meshStandardMaterial color={bar.color} roughness={0.82} metalness={0} />
          </mesh>
          <Label position={[0, -0.62, 0]}>
            <span className="eyebrow text-ink-2">{bar.label}</span>
            <span className="tnum mt-1 block text-[19px] font-semibold text-ink">
              {bar.pct}%
            </span>
          </Label>
        </group>
      ))}
    </group>
  )
}

/** The subjects people keep returning to, tinted by how they are going. */
function TopicRidge({ topics, reveal }) {
  const columns = useMemo(() => topicColumns(topics), [topics])
  const refs = useRef([])
  const caps = useRef([])
  const [hovered, setHovered] = useState(null)
  const hoverAmount = useRef([])
  const cursor = useHoverCursor()

  useFrame((state, delta) => {
    const eased = smoothstep(reveal.current)
    const time = state.clock.elapsedTime

    columns.forEach((column, index) => {
      const mesh = refs.current[index]
      if (!mesh) return
      const local = THREE.MathUtils.clamp(eased * 1.5 - index * 0.09, 0, 1)
      const grown = column.height * smoothstep(local)
      const bob = Math.sin(time * 0.5 + index * 0.8) * 0.025 * eased

      /*
       * Neighbours react too, at a third of the strength — a ridge where one
       * column moves in isolation looks like a bug, where the row leans
       * around the cursor looks like a surface.
       */
      const distance = hovered === null ? 99 : Math.abs(index - hovered)
      const target = distance === 0 ? 1 : distance === 1 ? 0.34 : 0
      const h = approach(hoverAmount.current[index] ?? 0, target, delta)
      hoverAmount.current[index] = h

      mesh.scale.y = Math.max(0.001, grown)
      mesh.scale.x = 1 + (HOVER_SWELL - 1) * h
      mesh.scale.z = 1 + (HOVER_SWELL - 1) * h
      mesh.position.y = grown / 2 + bob + HOVER_LIFT * h
      mesh.visible = local > 0.01

      // The sentiment cap rides on top of whatever height the column reached.
      const cap = caps.current[index]
      if (cap) {
        cap.position.y = grown + 0.06 + bob + HOVER_LIFT * h
        cap.scale.setScalar(1 + (HOVER_SWELL - 1) * h)
        cap.visible = local > 0.01
      }
    })
  })

  return (
    <group>
      {columns.map((column, index) => (
        <group key={column.id} position={[column.x, 0, 0]}>
          <mesh
            ref={(node) => {
              refs.current[index] = node
            }}
            onPointerOver={(event) => {
              event.stopPropagation()
              setHovered(index)
              cursor.enter()
            }}
            onPointerOut={() => {
              setHovered(null)
              cursor.leave()
            }}
          >
            <boxGeometry args={[0.62, 1, 0.62]} />
            <meshStandardMaterial color={column.accent} roughness={0.82} metalness={0} />
          </mesh>
          {/* How the subject is going, carried as a band on top rather than
              as the column's own colour — see IDENTITY_COLORS. */}
          <mesh
            ref={(node) => {
              caps.current[index] = node
            }}
          >
            <boxGeometry args={[0.66, 0.12, 0.66]} />
            <meshStandardMaterial color={column.color} roughness={0.82} metalness={0} />
          </mesh>
          {/* Alternating depth: six captions on one line collide the moment
              two long topic names sit side by side. */}
          <Label position={[0, index % 2 === 0 ? -0.55 : -1.15, 0]}>
            <span className="block text-[14px] leading-tight font-medium text-ink">
              {column.label}
            </span>
            <span className="tnum block text-[12px] text-ink-3">{column.count}</span>
          </Label>
        </group>
      ))}
    </group>
  )
}

/**
 * Mentions over time, stacked by sentiment.
 *
 * One instanced mesh for every segment of every bucket — up to ninety boxes
 * that would otherwise be ninety draw calls.
 */
function VolumeRibbon({ timeline, reveal }) {
  const meshRef = useRef(null)
  const { stacks } = useMemo(() => volumeStacks(timeline), [timeline])

  const segments = useMemo(
    () => stacks.flatMap((stack) => stack.segments.map((segment) => ({ ...segment, x: stack.x }))),
    [stacks],
  )

  const colors = useMemo(() => {
    const array = new Float32Array(segments.length * 3)
    segments.forEach((segment, index) => {
      array[index * 3] = segment.rgb[0]
      array[index * 3 + 1] = segment.rgb[1]
      array[index * 3 + 2] = segment.rgb[2]
    })
    return array
  }, [segments])

  // Attached before the first frame, or three.js compiles the shader without
  // the instancing-colour path and every segment renders flat white.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !segments.length) return
    const attribute = new THREE.InstancedBufferAttribute(colors.slice(), 3)
    mesh.instanceColor = attribute
    attribute.needsUpdate = true
    if (mesh.material) mesh.material.needsUpdate = true
  }, [colors, segments.length])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || !segments.length) return

    const eased = smoothstep(reveal.current)

    segments.forEach((segment, index) => {
      // Left-to-right sweep, so the ribbon draws itself like a timeline
      // being read rather than appearing all at once.
      const sweep = THREE.MathUtils.clamp(eased * 1.8 - index / (segments.length * 1.6), 0, 1)
      const grown = Math.max(0.001, segment.height * smoothstep(sweep))
      dummy.position.set(segment.x, segment.y * smoothstep(sweep), 0)
      dummy.scale.set(1, grown, 1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  if (!segments.length) return null

  return (
    <instancedMesh ref={meshRef} args={[null, null, segments.length]} frustumCulled={false}>
      <boxGeometry args={RIBBON_GEOMETRY} />
      <meshStandardMaterial roughness={0.82} metalness={0} />
    </instancedMesh>
  )
}

/** The brand, and whoever gets named alongside it. */
function CompetitorConstellation({ competitors, company, reveal }) {
  const nodes = useMemo(() => competitorNodes(competitors), [competitors])
  const groupRef = useRef(null)
  const lineRef = useRef(null)
  const nodeRefs = useRef([])
  const hoverAmount = useRef([])
  const [hovered, setHovered] = useState(null)
  const cursor = useHoverCursor()

  const lineGeometry = useMemo(() => {
    const positions = new Float32Array(nodes.length * 6)
    nodes.forEach((node, index) => {
      const o = index * 6
      positions[o] = 0
      positions[o + 1] = 0
      positions[o + 2] = 0
      positions[o + 3] = node.x
      positions[o + 4] = node.y
      positions[o + 5] = 0
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [nodes])

  useFrame((state, delta) => {
    const eased = smoothstep(reveal.current)
    const time = state.clock.elapsedTime

    if (groupRef.current) {
      groupRef.current.scale.setScalar(0.6 + eased * 0.4)
      groupRef.current.rotation.z = Math.sin(time * 0.12) * 0.04
    }
    if (lineRef.current) lineRef.current.material.opacity = eased * 0.35

    // A hovered rival swells and drifts toward the viewer, off the plane the
    // rest of the constellation sits on.
    nodes.forEach((node, index) => {
      const object = nodeRefs.current[index]
      if (!object) return
      const h = approach(hoverAmount.current[index] ?? 0, hovered === index ? 1 : 0, delta)
      hoverAmount.current[index] = h
      object.scale.setScalar(1 + (HOVER_SWELL - 1) * h)
      object.position.z = h * 0.85
      object.rotation.y = h * 0.5 + Math.sin(time * 0.3 + index) * 0.05
    })
  })

  if (!nodes.length) return null

  return (
    <group ref={groupRef}>
      {/* The brand itself, at the centre of its own network. */}
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={PAPER_3D.ink} roughness={0.7} metalness={0} />
      </mesh>
      <Label position={[0, -0.62, 0]}>
        <span className="eyebrow text-ink">{company}</span>
      </Label>

      <lineSegments ref={lineRef} geometry={lineGeometry}>
        <lineBasicMaterial color={PAPER_3D.muted} transparent opacity={0} depthWrite={false} />
      </lineSegments>

      {nodes.map((node, index) => (
        <group
          key={node.name}
          position={[node.x, node.y, 0]}
          ref={(object) => {
            nodeRefs.current[index] = object
          }}
          onPointerOver={(event) => {
            event.stopPropagation()
            setHovered(index)
            cursor.enter()
          }}
          onPointerOut={() => {
            setHovered(null)
            cursor.leave()
          }}
        >
          {node.palette ? (
            /* A brand whose identity is several colours at once, banded
               rather than averaged into a single muddy fill. */
            node.palette.map((band, bandIndex) => (
              <mesh
                key={band}
                scale={node.scale}
                position={[
                  0,
                  ((bandIndex - (node.palette.length - 1) / 2) * node.scale) /
                    node.palette.length,
                  0,
                ]}
              >
                <boxGeometry args={[1, 1 / node.palette.length, 1]} />
                <meshStandardMaterial color={band} roughness={0.82} metalness={0} />
              </mesh>
            ))
          ) : (
            <mesh scale={node.scale}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color={node.accent}
                roughness={0.82}
                metalness={0}
              />
            </mesh>
          )}
          <Label position={[0, -0.42, 0]}>
            <span className="block truncate text-[14px] font-medium text-ink">
              {node.name}
            </span>
            <span className="tnum block text-[12px] text-ink-3">{node.mentions}</span>
          </Label>
        </group>
      ))}
    </group>
  )
}

/**
 * The whole assembly.
 *
 * Four clusters on their own sheets at different depths — the composition is
 * spatial, not a flat layout that happens to be rendered in perspective.
 */
/**
 * @param {object}   props
 * @param {object}   props.insights  a finished report
 * @param {string}   props.company
 * @param {Function} props.presence  read each frame, 0..1 — how present this
 *   stage should be. A boolean would snap; inside the world this is driven by
 *   scroll position so the report builds and dismantles as the camera passes.
 * @param {boolean}  [props.parallax] lean with the pointer. Off inside the
 *   shared world, where `CameraRig` already moves the whole scene and a
 *   second parallax on top of it reads as drift.
 */
export default function ReportObject({ insights, company, presence, parallax = true }) {
  const reveal = useRef(0)
  const groupRef = useRef(null)

  useFrame((state, delta) => {
    // Damped rather than snapped, matching how the hero camera eases toward
    // its keyframes instead of tracking scroll one-to-one.
    const target = presence()
    reveal.current = THREE.MathUtils.damp(reveal.current, target, 2.2, Math.min(delta, 0.05))

    const group = groupRef.current
    if (!group) return

    // Nothing to draw once the act has passed — the stage stops costing
    // anything rather than sitting invisible but still rendering.
    group.visible = reveal.current > 0.004
    if (!group.visible) return

    const ease = 1 - Math.exp(-2.6 * Math.min(delta, 0.05))

    if (parallax) {
      // The world leans away from the pointer, which reads as depth rather
      // than as dragging the camera.
      group.rotation.y += (state.pointer.x * 0.16 - group.rotation.y) * ease
      group.rotation.x += (-state.pointer.y * 0.1 - group.rotation.x) * ease
    }
    group.position.y += (reveal.current * 0.4 - 0.4 - group.position.y) * ease
  })

  const { sentiment, topics, timeline, competitors } = insights

  return (
    <group ref={groupRef}>
      {/* Sentiment — front left, closest to the viewer. */}
      <group position={[-4.9, -1.4, 1.2]} rotation={[0, 0.34, 0]}>
        <Sheet
          width={5.6}
          height={5.4}
          position={[0, 1.6, -0.7]}
          rotation={[0, 0, 0]}
          reveal={reveal}
        />
        <SentimentColumns sentiment={sentiment} reveal={reveal} />
        <Label position={[0, -1.55, -0.6]}>
          <span className="eyebrow text-ink-3">Sentiment</span>
        </Label>
      </group>

      {/* Topics — the ridge across the middle. */}
      <group position={[3.4, -1.2, -0.4]} rotation={[0, -0.16, 0]}>
        <Sheet
          width={13.4}
          height={5}
          position={[0, 1.5, -0.6]}
          rotation={[0, 0, 0]}
          reveal={reveal}
        />
        <TopicRidge topics={topics} reveal={reveal} />
        <Label position={[0, -2.05, -0.5]}>
          <span className="eyebrow text-ink-3">Topics</span>
        </Label>
      </group>

      {/* Volume — a low ribbon along the front edge. */}
      <group position={[-1.1, -4.6, 2.4]} rotation={[-0.28, 0, 0]}>
        <VolumeRibbon timeline={timeline} reveal={reveal} />
        <Label position={[0, -0.7, 0]}>
          <span className="eyebrow text-ink-3">Volume over time</span>
        </Label>
      </group>

      {/* Competitors — set back, so the network reads as behind the report. */}
      <group position={[5.4, 3.1, -3.4]} rotation={[0, -0.42, 0]}>
        <CompetitorConstellation
          competitors={competitors}
          company={company}
          reveal={reveal}
        />
      </group>
    </group>
  )
}

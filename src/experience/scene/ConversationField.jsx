import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { driver } from '../scrollDriver.js'
import { ACTS, layoutBlend } from '../acts.js'
import { buildLayouts } from '../layouts.js'

const dummy = new THREE.Object3D()
const CARD_GEOMETRY_ARGS = [0.66, 0.42, 0.03]

const ACT_REST = 10

export default function ConversationField({ count = 620, reducedMotion = false }) {
  const meshRef = useRef(null)
  const lineRef = useRef(null)
  const groupRef = useRef(null)
  const lastBlend = useRef({ from: -1, to: -1, t: -1 })

  const { layouts, edges, meta } = useMemo(() => buildLayouts(count), [count])

  const currentRef = useRef(null)
  if (currentRef.current === null || currentRef.current.length !== count * 3) {
    currentRef.current = new Float32Array(count * 3)
  }

  const lineBufferRef = useRef(null)
  const expectedLineLength = (edges.length / 2) * 6
  if (
    lineBufferRef.current === null ||
    lineBufferRef.current.length !== expectedLineLength
  ) {
    lineBufferRef.current = new Float32Array(expectedLineLength)
  }

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(lineBufferRef.current, 3),
    )
    return geometry
  }, [expectedLineLength])

  const instanceColor = useMemo(
    () =>
      new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3),
    [count],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.instanceColor = instanceColor
    instanceColor.needsUpdate = true
    if (mesh.material) mesh.material.needsUpdate = true
  }, [instanceColor])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    const time = reducedMotion ? 0 : state.clock.elapsedTime
    const progress = reducedMotion ? 0.84 : driver.damped

    if (groupRef.current) {
      const restStart = ACTS[ACT_REST]?.start ?? 0.87
      const spinIn = Math.max(0, Math.min(1, (progress - restStart + 0.06) / 0.12))
      groupRef.current.rotation.y = reducedMotion ? 0 : time * 0.035 * spinIn
      groupRef.current.rotation.x = reducedMotion ? 0 : Math.sin(time * 0.08) * 0.05 * spinIn
    }

    const { from, to, t } = layoutBlend(progress)
    const a = layouts[from]
    const b = layouts[to]

    const align = a.align + (b.align - a.align) * t
    const lineOpacity = a.lineOpacity + (b.lineOpacity - a.lineOpacity) * t
    const drift = (1 - align) * 0.55

    const { scales, phases, spins, tumble } = meta
    const current = currentRef.current

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3
      const phase = phases[i]

      let x = a.positions[i3] + (b.positions[i3] - a.positions[i3]) * t
      let y = a.positions[i3 + 1] + (b.positions[i3 + 1] - a.positions[i3 + 1]) * t
      let z = a.positions[i3 + 2] + (b.positions[i3 + 2] - a.positions[i3 + 2]) * t

      if (drift > 0.001) {
        x += Math.sin(time * 0.42 + phase) * drift
        y += Math.cos(time * 0.35 + phase * 1.7) * drift
        z += Math.sin(time * 0.29 + phase * 0.8) * drift * 0.7
      }

      current[i3] = x
      current[i3 + 1] = y
      current[i3 + 2] = z

      dummy.position.set(x, y, z)

      const spin = reducedMotion ? 0 : time * spins[i]
      dummy.rotation.set(
        (tumble[i3] + spin) * (1 - align),
        (tumble[i3 + 1] + spin) * (1 - align),
        tumble[i3 + 2] * (1 - align) * 0.5,
      )

      const scale = scales[i] * (0.8 + align * 0.45)
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    const previous = lastBlend.current
    if (previous.from !== from || previous.to !== to || Math.abs(previous.t - t) > 0.002) {
      const array = instanceColor.array
      for (let i = 0; i < count * 3; i += 1) {
        array[i] = a.colors[i] + (b.colors[i] - a.colors[i]) * t
      }
      instanceColor.needsUpdate = true
      lastBlend.current = { from, to, t }
    }

    const line = lineRef.current
    if (line) {
      const linePositions = lineBufferRef.current
      for (let e = 0; e < edges.length; e += 2) {
        const from3 = edges[e] * 3
        const to3 = edges[e + 1] * 3
        const o = (e / 2) * 6
        linePositions[o] = current[from3]
        linePositions[o + 1] = current[from3 + 1]
        linePositions[o + 2] = current[from3 + 2]
        linePositions[o + 3] = current[to3]
        linePositions[o + 4] = current[to3 + 1]
        linePositions[o + 5] = current[to3 + 2]
      }
      line.geometry.attributes.position.needsUpdate = true
      line.material.opacity = lineOpacity
      line.visible = lineOpacity > 0.01
    }
  })

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[null, null, count]}
        frustumCulled={false}
      >
        <boxGeometry args={CARD_GEOMETRY_ARGS} />
        <meshStandardMaterial roughness={0.82} metalness={0} />
      </instancedMesh>

      <lineSegments ref={lineRef} geometry={lineGeometry} frustumCulled={false}>
        <lineBasicMaterial
          color="#8b8778"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

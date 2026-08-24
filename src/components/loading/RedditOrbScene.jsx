import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { PAPER_3D, ACCENT_3D } from '../../experience/palette.js'

// Same three-way split and colors as the landing page's own sentiment donut
// (src/experience/layouts.js) — this is that exact shape, standalone and spinning.
const SENTIMENT_SPLIT = [0.44, 0.19, 0.37]
const BAND_COLORS = [ACCENT_3D.green, PAPER_3D.muted, ACCENT_3D.orange]

const dummy = new THREE.Object3D()

function SentimentRing({ count = 90, radius = 2.6, reducedMotion = false }) {
  const meshRef = useRef(null)
  const groupRef = useRef(null)

  const seeds = useMemo(() => {
    const angle = new Float32Array(count)
    const jitterR = new Float32Array(count)
    const jitterZ = new Float32Array(count)
    const scale = new Float32Array(count)
    const spinX = new Float32Array(count)
    const spinY = new Float32Array(count)
    const spinZ = new Float32Array(count)
    const spinPhase = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      angle[i] = (i / count) * Math.PI * 2 - Math.PI / 2
      jitterR[i] = (Math.random() - 0.5) * 0.3
      jitterZ[i] = (Math.random() - 0.5) * 0.2
      scale[i] = 0.75 + Math.random() * 0.45
      spinX[i] = (Math.random() - 0.5) * 1.4
      spinY[i] = (Math.random() - 0.5) * 1.4
      spinZ[i] = (Math.random() - 0.5) * 1.4
      spinPhase[i] = Math.random() * Math.PI * 2
    }
    return { angle, jitterR, jitterZ, scale, spinX, spinY, spinZ, spinPhase }
  }, [count])

  const instanceColor = useMemo(() => {
    const array = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const t = i / count
      const band =
        t < SENTIMENT_SPLIT[0] ? 0 : t < SENTIMENT_SPLIT[0] + SENTIMENT_SPLIT[1] ? 1 : 2
      const c = new THREE.Color(BAND_COLORS[band])
      array[i * 3] = c.r
      array[i * 3 + 1] = c.g
      array[i * 3 + 2] = c.b
    }
    return new THREE.InstancedBufferAttribute(array, 3)
  }, [count])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.instanceColor = instanceColor
    instanceColor.needsUpdate = true
  }, [instanceColor])

  useFrame((state, delta) => {
    if (groupRef.current && !reducedMotion) {
      groupRef.current.rotation.z += delta * 0.18
    }

    const mesh = meshRef.current
    if (!mesh) return
    const time = reducedMotion ? 0 : state.clock.elapsedTime
    const { angle, jitterR, jitterZ, scale, spinX, spinY, spinZ, spinPhase } = seeds

    for (let i = 0; i < count; i += 1) {
      const r = radius + jitterR[i]
      dummy.position.set(Math.cos(angle[i]) * r, Math.sin(angle[i]) * r, jitterZ[i])
      dummy.rotation.set(
        spinPhase[i] + time * spinX[i],
        spinPhase[i] * 0.6 + time * spinY[i],
        angle[i] + time * spinZ[i],
      )
      const s = scale[i]
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={groupRef} position={[0, 0.55, 0]}>
      <instancedMesh ref={meshRef} args={[null, null, count]} frustumCulled={false}>
        <boxGeometry args={[0.4, 0.4, 0.18]} />
        <meshStandardMaterial roughness={0.85} metalness={0} />
      </instancedMesh>
    </group>
  )
}

export default function RedditOrbScene({ reducedMotion = false }) {
  return (
    <>
      <color attach="background" args={[PAPER_3D.bg]} />
      <fog attach="fog" args={[PAPER_3D.bg, 9, 20]} />

      <ambientLight intensity={2.1} />
      <directionalLight position={[6, 8, 6]} intensity={1.3} />
      <directionalLight position={[-6, -3, 3]} intensity={0.45} color="#e8dfc9" />

      <SentimentRing count={64} radius={1.5} reducedMotion={reducedMotion} />
    </>
  )
}

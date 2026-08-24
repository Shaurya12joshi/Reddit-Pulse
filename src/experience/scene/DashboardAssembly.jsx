import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { driver } from '../scrollDriver.js'
import { ACT_INDEX, stagePresence } from '../acts.js'
import { PAPER_3D } from '../palette.js'

const PANELS = [
  { x: -8.4, y: 1.6, w: 9.2, h: 9.4, from: [-7, 0, -6] },
  { x: 5.2, y: 0.9, w: 11.6, h: 8.2, from: [7, 2, -6] },
  { x: -1.2, y: -6.9, w: 20.4, h: 3.6, from: [0, -6, -7] },
]

function Panel({ config, indexRef }) {
  const groupRef = useRef(null)
  const fillRef = useRef(null)
  const edgeRef = useRef(null)

  const geometry = useMemo(() => new THREE.PlaneGeometry(config.w, config.h), [config])
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    const reveal = indexRef.current
    const eased = reveal * reveal * (3 - 2 * reveal)

    const targetX = config.from[0] + (config.x - config.from[0]) * eased
    const targetY = config.from[1] + (config.y - config.from[1]) * eased
    const targetZ = config.from[2] + (-1.6 - config.from[2]) * eased

    const ease = 1 - Math.exp(-6 * Math.min(delta, 0.05))
    group.position.x += (targetX - group.position.x) * ease
    group.position.y += (targetY - group.position.y) * ease
    group.position.z += (targetZ - group.position.z) * ease

    const scale = 0.86 + eased * 0.14
    group.scale.setScalar(scale)
    group.visible = eased > 0.01

    if (fillRef.current) fillRef.current.material.opacity = eased * 0.5
    if (edgeRef.current) edgeRef.current.material.opacity = eased * 0.75
  })

  return (
    <group ref={groupRef} position={config.from}>
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

export default function DashboardAssembly({ reducedMotion = false }) {
  const revealRef = useRef(0)

  useFrame(() => {
    if (reducedMotion) {
      revealRef.current = 1
      return
    }

    revealRef.current = stagePresence(driver.damped, ACT_INDEX.insights, {
      lead: 0.55,
      tail: 0.1,
    })
  })

  return (
    <group>
      {PANELS.map((config, index) => (
        <Panel key={index} config={config} indexRef={revealRef} />
      ))}
    </group>
  )
}

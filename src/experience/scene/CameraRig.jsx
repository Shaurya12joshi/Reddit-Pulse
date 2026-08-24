import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { driver } from '../scrollDriver.js'
import { layoutBlend } from '../acts.js'

const KEYFRAMES = [
  { pos: [0, 0, 13], look: [0, 0, 0] },
  { pos: [3.2, 1.4, 19], look: [-1, 0, 0] },
  { pos: [-4.5, 2.6, 21], look: [0.5, 0, 0] },
  { pos: [0, 2.2, 25], look: [0, 0.4, 0] },
  { pos: [1.8, -1.4, 22], look: [0, 0.6, 0] },
  { pos: [-2.4, 3.2, 23], look: [0, 0.2, 0] },
  { pos: [0, -0.6, 20.5], look: [-1.2, -0.4, 0] },
  { pos: [3.4, 0.4, 16], look: [-1.6, -0.2, 0] },
  { pos: [-3.6, 0.8, 12.5], look: [1.4, -0.3, -1] },
  { pos: [0, 4.2, 19], look: [0, -1.4, 0] },
  { pos: [0, 0.6, 24], look: [0, 0, 0] },
  { pos: [0, 0, 18], look: [0, 0, 0] },
]

const targetPos = new THREE.Vector3()
const targetLook = new THREE.Vector3()
const currentLook = new THREE.Vector3()

const lerp = (a, b, t) => a + (b - a) * t

export default function CameraRig({ reducedMotion = false }) {
  const initialised = useRef(false)
  const roll = useRef(0)

  useFrame(({ camera }, delta) => {
    const progress = reducedMotion ? 0.84 : driver.damped
    const { from, to, t } = layoutBlend(progress)
    const a = KEYFRAMES[from]
    const b = KEYFRAMES[to]

    const px = reducedMotion ? 0 : driver.pointerX
    const py = reducedMotion ? 0 : driver.pointerY

    targetPos.set(
      lerp(a.pos[0], b.pos[0], t) + px * 1.9,
      lerp(a.pos[1], b.pos[1], t) - py * 1.3,
      lerp(a.pos[2], b.pos[2], t),
    )
    targetLook.set(
      lerp(a.look[0], b.look[0], t) + px * 0.5,
      lerp(a.look[1], b.look[1], t) - py * 0.35,
      lerp(a.look[2], b.look[2], t),
    )

    if (!initialised.current) {
      camera.position.copy(targetPos)
      currentLook.copy(targetLook)
      initialised.current = true
    } else {
      const ease = 1 - Math.exp(-3.4 * Math.min(delta, 0.05))
      camera.position.lerp(targetPos, ease)
      currentLook.lerp(targetLook, ease)
    }

    camera.lookAt(currentLook)

    roll.current = THREE.MathUtils.damp(
      roll.current,
      reducedMotion ? 0 : THREE.MathUtils.clamp(driver.velocity * 0.4, -0.05, 0.05),
      3,
      Math.min(delta, 0.05),
    )
    camera.rotateZ(roll.current)
  })

  return null
}

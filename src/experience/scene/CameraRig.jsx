import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { driver } from '../scrollDriver.js'
import { layoutBlend } from '../acts.js'

/**
 * Cinematic camera.
 *
 * One keyframe per act, interpolated with the same blend the world uses, then
 * damped toward that target every frame. Damping the *result* rather than
 * snapping to it is what removes the one-to-one stickiness of scroll-linked
 * cameras and makes the move feel filmed.
 */

// [position, lookAt] per act — inside the noise, pulling back as it resolves.
const KEYFRAMES = [
  { pos: [0, 0, 13], look: [0, 0, 0] }, // raw — camera inside the field
  { pos: [3.2, 1.4, 19], look: [-1, 0, 0] }, // enter
  { pos: [-4.5, 2.6, 21], look: [0.5, 0, 0] }, // signals
  { pos: [0, 2.2, 25], look: [0, 0.4, 0] }, // sentiment
  { pos: [1.8, -1.4, 22], look: [0, 0.6, 0] }, // topics
  { pos: [-2.4, 3.2, 23], look: [0, 0.2, 0] }, // competitors
  { pos: [0, -0.6, 20.5], look: [-1.2, -0.4, 0] }, // insights — square to dashboard
  // report — pushed in and offset right, framing the report object that
  // occupies the left of the world while the copy sits opposite it.
  { pos: [3.4, 0.4, 16], look: [-1.6, -0.2, 0] },
  // evidence — closer still, angled across the floating conversation panels.
  { pos: [-3.6, 0.8, 12.5], look: [1.4, -0.3, -1] },
  // audience — lifted, looking down the columns.
  { pos: [0, 4.2, 19], look: [0, -1.4, 0] },
  // rest — back out to see the whole corpus turning.
  { pos: [0, 0.6, 24], look: [0, 0, 0] },
  // start — settled square-on, the world far behind the call to action.
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

    // Parallax: the world leans opposite the pointer, which reads as depth
    // rather than as the camera being dragged around.
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

    // A slow roll tied to scroll velocity — the world tilts into the movement.
    // Tracked separately and applied *after* lookAt, which would otherwise
    // overwrite the whole orientation every frame.
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

import { useState } from 'react'
import { useFrame } from '@react-three/fiber'

import { driver } from './scrollDriver.js'
import { stagePresence } from './acts.js'

/**
 * Is this act's stage close enough to matter?
 *
 * Hiding a group with `object.visible = false` is enough for geometry, but
 * drei's `Html` renders real DOM *outside* the canvas and keeps rendering it
 * regardless — which is how the report's labels and the evidence panels' text
 * ended up floating over the opening act.
 *
 * So stages are mounted and unmounted rather than merely hidden. The state
 * flips on a wide hysteresis band: `on` well before the act so nothing pops
 * in visibly, `off` only once presence is unambiguously gone, and never
 * anywhere near enough per scroll to make React the bottleneck.
 */
export default function useStageActive(actIndex, { on = 0.02, off = 0.004, lead = 0.25, tail = 0.08 } = {}) {
  const [active, setActive] = useState(false)

  useFrame(() => {
    const presence = stagePresence(driver.damped, actIndex, { lead, tail })
    // Only ever calls setState on an actual crossing — a few times per full
    // scroll of the page, not per frame.
    if (!active && presence > on) setActive(true)
    else if (active && presence < off) setActive(false)
  })

  return active
}

import { useState } from 'react'
import { useFrame } from '@react-three/fiber'

import { driver } from './scrollDriver.js'
import { stagePresence } from './acts.js'

export default function useStageActive(actIndex, { on = 0.02, off = 0.004, lead = 0.25, tail = 0.08 } = {}) {
  const [active, setActive] = useState(false)

  useFrame(() => {
    const presence = stagePresence(driver.damped, actIndex, { lead, tail })
    if (!active && presence > on) setActive(true)
    else if (active && presence < off) setActive(false)
  })

  return active
}

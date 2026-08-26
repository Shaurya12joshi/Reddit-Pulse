import { useEffect, useRef } from 'react'

import { registerStage } from './stageDriver.js'

const PRESETS = {
  lift: { rotateX: 14, rotateY: 0, lift: 90, depth: 260, scale: 0.08 },
  swing: { rotateX: 6, rotateY: 15, lift: 60, depth: 200, scale: 0.06 },
  deck: { rotateX: 18, rotateY: -9, lift: 70, depth: 320, scale: 0.1 },
  flat: { rotateX: 8, rotateY: 0, lift: 40, depth: 120, scale: 0.04 },
}

export default function Stage({
  children,
  variant = 'lift',
  active = true,
  parallax = 1,
  className = '',
}) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    if (!active) {
      node.style.transform = ''
      node.style.opacity = ''
      return undefined
    }

    const preset = PRESETS[variant] || PRESETS.lift

    return registerStage(node, ({ offset, pointerX, pointerY }) => {
      const away = Math.abs(offset)
      const settle = Math.max(0, 1 - away * 1.35)
      const eased = settle * settle * (3 - 2 * settle)

      const rotateX = offset * preset.rotateX + pointerY * 1.6 * parallax * eased
      const rotateY = offset * preset.rotateY - pointerX * 2.4 * parallax * eased
      const translateY = offset * preset.lift * parallax
      const translateZ = -away * preset.depth
      const scale = 1 - away * preset.scale

      node.style.transform =
        `perspective(1500px) translate3d(0, ${translateY.toFixed(2)}px, ${translateZ.toFixed(2)}px) ` +
        `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(${Math.max(0.82, scale).toFixed(3)})`
      node.style.opacity = Math.max(0, Math.min(1, 1 - away * 0.85)).toFixed(3)
    })
  }, [active, variant, parallax])

  return (
    <div
      ref={ref}
      className={`will-change-transform ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  )
}

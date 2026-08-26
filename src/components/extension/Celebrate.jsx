import { useEffect, useRef } from 'react'

const COLOURS = ['#ff4500', '#ff8352', '#f26b38', '#ffb199', '#171717', '#7193ff']
const LIFE_MS = 2600

export default function Celebrate({ token }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!token) return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const context = canvas.getContext('2d')
    if (!context) return undefined

    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = window.innerWidth * ratio
    canvas.height = window.innerHeight * ratio
    context.scale(ratio, ratio)

    const originX = window.innerWidth / 2
    const originY = window.innerHeight * 0.62

    const pieces = Array.from({ length: 120 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 5 + Math.random() * 13
      return {
        x: originX + (Math.random() - 0.5) * 120,
        y: originY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed * 0.9,
        vy: Math.sin(angle) * speed - 6,
        size: 5 + Math.random() * 8,
        spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI,
        colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      }
    })

    const started = performance.now()
    let frame = null

    const draw = (now) => {
      const elapsed = now - started
      const fade = Math.max(0, 1 - elapsed / LIFE_MS)

      context.clearRect(0, 0, window.innerWidth, window.innerHeight)

      for (const piece of pieces) {
        piece.vy += 0.42
        piece.vx *= 0.99
        piece.x += piece.vx
        piece.y += piece.vy
        piece.angle += piece.spin

        context.save()
        context.translate(piece.x, piece.y)
        context.rotate(piece.angle)
        context.globalAlpha = fade
        context.fillStyle = piece.colour
        const half = piece.size / 2
        context.beginPath()
        context.moveTo(0, -half)
        context.lineTo(half, half * 0.15)
        context.lineTo(half * 0.42, half * 0.15)
        context.lineTo(half * 0.42, half)
        context.lineTo(-half * 0.42, half)
        context.lineTo(-half * 0.42, half * 0.15)
        context.lineTo(-half, half * 0.15)
        context.closePath()
        context.fill()
        context.restore()
      }

      if (elapsed < LIFE_MS) frame = requestAnimationFrame(draw)
      else context.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }

    frame = requestAnimationFrame(draw)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      context.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
  }, [token])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  )
}

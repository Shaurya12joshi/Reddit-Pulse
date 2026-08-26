import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CanvasTexture, LinearFilter, MathUtils } from 'three'

const COUNT = 26
const NEAR = 13
const FAR = -58

const TITLES = [
  ['Is the extra legroom actually worth it', 'on the long haul route?'],
  ['Switched last month, here is what', 'nobody tells you about it'],
  ['Anyone else had their order arrive', 'three days late this week?'],
  ['Comparing both before I commit', 'to a full year of this'],
  ['Support finally replied after', 'eight days of silence'],
  ['Honest review after 6 months', 'of daily use'],
  ['Which one would you pick in 2026', 'and why?'],
  ['They quietly changed the pricing', 'again overnight'],
]

const SUBS = [
  'r/aviation',
  'r/personalfinance',
  'r/technology',
  'r/buildapc',
  'r/india',
  'r/mildlyinfuriating',
]

const SCORES = ['3.4k', '1.9k', '842', '517', '2.1k', '311', '96', '1.2k']

function seeded(index, salt) {
  const value = Math.sin(index * 37.31 + salt * 11.7) * 43758.5453
  return value - Math.floor(value)
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}

const FACE = 'Inter, system-ui, -apple-system, sans-serif'

function fitText(context, text, maxWidth, weight, startSize, minSize) {
  let size = startSize
  context.font = `${weight} ${size}px ${FACE}`

  while (size > minSize && context.measureText(text).width > maxWidth) {
    size -= 1
    context.font = `${weight} ${size}px ${FACE}`
  }

  if (context.measureText(text).width <= maxWidth) return text

  let clipped = text
  while (clipped.length > 3 && context.measureText(`${clipped}\u2026`).width > maxWidth) {
    clipped = clipped.slice(0, -1)
  }
  return `${clipped.trimEnd()}\u2026`
}

function pill(context, x, y, label, size) {
  context.font = `500 ${size}px ${FACE}`
  const width = context.measureText(label).width + 36
  context.fillStyle = '#e7e3d9'
  roundedRect(context, x, y, width, 34, 17)
  context.fill()
  context.fillStyle = '#9a958a'
  context.fillText(label, x + 18, y + 24)
  return width
}

function drawCard(index) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 320
  const context = canvas.getContext('2d')
  if (!context) return canvas

  const hot = seeded(index, 9) > 0.62
  const title = TITLES[index % TITLES.length]
  const sub = SUBS[index % SUBS.length]
  const score = SCORES[index % SCORES.length]

  context.clearRect(0, 0, 640, 320)

  context.fillStyle = '#fffdf8'
  roundedRect(context, 8, 8, 624, 304, 20)
  context.fill()
  context.strokeStyle = hot ? '#ffb199' : '#e4e0d5'
  context.lineWidth = 3
  context.stroke()

  context.fillStyle = hot ? '#fff3ec' : '#f4f1e8'
  roundedRect(context, 8, 8, 92, 304, 20)
  context.fill()

  context.fillStyle = hot ? '#ff4500' : '#b9b4a6'
  context.beginPath()
  context.moveTo(54, 96)
  context.lineTo(78, 128)
  context.lineTo(64, 128)
  context.lineTo(64, 152)
  context.lineTo(44, 152)
  context.lineTo(44, 128)
  context.lineTo(30, 128)
  context.closePath()
  context.fill()

  context.fillStyle = hot ? '#c23a06' : '#6b6961'
  context.font = '600 30px Inter, system-ui, sans-serif'
  context.textAlign = 'center'
  context.fillText(score, 54, 190)

  context.fillStyle = '#b9b4a6'
  context.beginPath()
  context.moveTo(54, 248)
  context.lineTo(70, 224)
  context.lineTo(38, 224)
  context.closePath()
  context.fill()

  const bodyLeft = 128
  const bodyWidth = 632 - bodyLeft - 24

  context.textAlign = 'left'
  context.fillStyle = '#8d887c'
  const subText = fitText(context, sub, bodyWidth - 100, '600', 24, 16)
  context.fillText(subText, bodyLeft, 74)

  context.fillStyle = '#d9d6cc'
  context.beginPath()
  context.arc(560, 66, 12, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.arc(596, 66, 12, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#171717'
  const first = fitText(context, title[0], bodyWidth, '600', 30, 19)
  context.fillText(first, bodyLeft, 136)
  const second = fitText(context, title[1], bodyWidth, '600', 30, 19)
  context.fillText(second, bodyLeft, 178)

  const commentsWidth = pill(context, bodyLeft, 216, `${140 + index * 17} comments`, 20)
  pill(context, bodyLeft + commentsWidth + 14, 216, 'Share', 20)

  return canvas
}

function Card({ card, driftRef }) {
  const meshRef = useRef(null)

  const texture = useMemo(() => {
    const made = new CanvasTexture(drawCard(card.index))
    made.minFilter = LinearFilter
    made.needsUpdate = true
    return made
  }, [card.index])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    const time = state.clock.elapsedTime
    const span = NEAR - FAR
    const travelled = card.z + driftRef.current
    const z = FAR + (((travelled - FAR) % span) + span) % span

    mesh.position.set(card.x, card.y + Math.sin(time * 0.4 + card.index) * 0.2, z)
    mesh.rotation.set(
      card.tilt * 0.35,
      card.tilt + Math.sin(time * 0.18 + card.index) * 0.05,
      Math.sin(time * 0.24 + card.index) * card.spin,
    )

    const closeness = (z - FAR) / span
    mesh.material.opacity = MathUtils.clamp(closeness * 2.1, 0, 1) * (1 - closeness * 0.15)
  })

  return (
    <mesh ref={meshRef} scale={[card.width, card.width * 0.5, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

function Feed({ progress, pointer }) {
  const groupRef = useRef(null)
  const driftRef = useRef(0)
  const dampedScroll = useRef(0)
  const dampedPointer = useRef({ x: 0, y: 0 })
  const { viewport } = useThree()

  const cards = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, index) => ({
        index,
        x: (seeded(index, 1) - 0.5) * 32,
        y: (seeded(index, 2) - 0.5) * 22,
        z: FAR + seeded(index, 3) * (NEAR - FAR),
        width: 6.2 + seeded(index, 4) * 3.4,
        tilt: (seeded(index, 6) - 0.5) * 0.42,
        spin: (seeded(index, 7) - 0.5) * 0.12,
      })),
    [],
  )

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.05)
    const ease = 1 - Math.exp(-7.5 * step)

    const target = progress.current
    const previous = dampedScroll.current
    dampedScroll.current += (target - previous) * ease

    const velocity = (dampedScroll.current - previous) / Math.max(step, 0.0001)
    driftRef.current += (2.2 + Math.min(Math.abs(velocity) * 34, 46)) * step
    driftRef.current += (dampedScroll.current - previous) * 96

    const group = groupRef.current
    if (!group) return

    dampedPointer.current.x += (pointer.current.x - dampedPointer.current.x) * ease
    dampedPointer.current.y += (pointer.current.y - dampedPointer.current.y) * ease

    const swayX = dampedPointer.current.y * 0.1 + dampedScroll.current * 0.12
    const swayY = -dampedPointer.current.x * 0.16 + dampedScroll.current * 0.2
    group.rotation.x += (swayX - group.rotation.x) * ease
    group.rotation.y += (swayY - group.rotation.y) * ease
  })

  const push = viewport.aspect > 1.05 ? viewport.width * 0.06 : 0

  return (
    <group ref={groupRef} position={[push, 0, 0]}>
      {cards.map((card) => (
        <Card key={card.index} card={card} driftRef={driftRef} />
      ))}
    </group>
  )
}

export default function FeedScene({ progress, pointer }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 18], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: 'none' }}
    >
      <Feed progress={progress} pointer={pointer} />
    </Canvas>
  )
}

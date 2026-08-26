import { PAPER_3D, ACCENT_3D, hexToRgbTriplet } from './palette.js'

function createRandom(seed) {
  let state = seed
  return function random() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(random) {
  return (random() + random() + random() - 1.5) * 1.4
}

const SENTIMENT_SPLIT = [0.44, 0.19, 0.37]
const TOPIC_COUNT = 6
const COMPETITOR_COUNT = 5

const SENTIMENT_ANCHORS = [
  { x: -8.2, y: 1.4, z: 0.5, color: ACCENT_3D.green },
  { x: 0, y: -1.2, z: -1.5, color: PAPER_3D.muted },
  { x: 8.2, y: 1.6, z: 0.5, color: ACCENT_3D.orange },
]

const TOPIC_COLORS = [
  ACCENT_3D.orange,
  ACCENT_3D.blue,
  ACCENT_3D.green,
  ACCENT_3D.yellow,
  ACCENT_3D.purple,
  PAPER_3D.muted,
]

const COMPETITOR_COLORS = [
  ACCENT_3D.purple,
  ACCENT_3D.blue,
  ACCENT_3D.green,
  ACCENT_3D.yellow,
  PAPER_3D.muted,
]

const VIVID_COLORS = [
  ACCENT_3D.orange,
  ACCENT_3D.blue,
  ACCENT_3D.green,
  ACCENT_3D.yellow,
  ACCENT_3D.purple,
]

const NEUTRAL_TONES = [PAPER_3D.card, PAPER_3D.card2, PAPER_3D.rule]

function writeColor(array, index, hex) {
  const [r, g, b] = hexToRgbTriplet(hex)
  array[index * 3] = r
  array[index * 3 + 1] = g
  array[index * 3 + 2] = b
}

export function buildLayouts(count) {
  const random = createRandom(0x5eed1234)

  const sentimentGroup = new Uint8Array(count)
  const topicGroup = new Uint8Array(count)
  const competitorGroup = new Uint8Array(count)
  const scales = new Float32Array(count)
  const phases = new Float32Array(count)
  const spins = new Float32Array(count)
  const tumble = new Float32Array(count * 3)

  for (let i = 0; i < count; i += 1) {
    const roll = random()
    sentimentGroup[i] =
      roll < SENTIMENT_SPLIT[0] ? 0 : roll < SENTIMENT_SPLIT[0] + SENTIMENT_SPLIT[1] ? 1 : 2
    topicGroup[i] = Math.floor(random() * TOPIC_COUNT)
    competitorGroup[i] = random() < 0.34 ? 0 : 1 + Math.floor(random() * COMPETITOR_COUNT)
    scales[i] = 0.55 + random() * 0.85
    phases[i] = random() * Math.PI * 2
    spins[i] = (random() - 0.5) * 0.5
    tumble[i * 3] = random() * Math.PI * 2
    tumble[i * 3 + 1] = random() * Math.PI * 2
    tumble[i * 3 + 2] = random() * Math.PI * 2
  }

  const makeLayout = (config) => ({
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
    ...config,
  })

  const chaos = makeLayout({ align: 0, lineOpacity: 0, spread: 1 })
  for (let i = 0; i < count; i += 1) {
    const radius = 7 + random() * 15
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    chaos.positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    chaos.positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.7
    chaos.positions[i * 3 + 2] = radius * Math.cos(phi) * 0.85
    writeColor(chaos.colors, i, NEUTRAL_TONES[i % NEUTRAL_TONES.length])
  }

  const drift = makeLayout({ align: 0.12, lineOpacity: 0.05, spread: 0.85 })
  for (let i = 0; i < count; i += 1) {
    const radius = 6 + random() * 10
    const theta = random() * Math.PI * 2
    const y = (random() - 0.5) * 14
    drift.positions[i * 3] = Math.cos(theta) * radius
    drift.positions[i * 3 + 1] = y
    drift.positions[i * 3 + 2] = Math.sin(theta) * radius * 0.8
    const tinted = i % 11 === 0
    writeColor(
      drift.colors,
      i,
      tinted ? ACCENT_3D.orange : NEUTRAL_TONES[i % NEUTRAL_TONES.length],
    )
  }

  const lattice = makeLayout({ align: 0.55, lineOpacity: 0.55, spread: 0.7 })
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const shell = 9.6 + (random() - 0.5) * 1.1
    lattice.positions[i * 3] = Math.cos(theta) * r * shell
    lattice.positions[i * 3 + 1] = y * shell * 0.82
    lattice.positions[i * 3 + 2] = Math.sin(theta) * r * shell
    writeColor(
      lattice.colors,
      i,
      i % 7 === 0 ? ACCENT_3D.blue : PAPER_3D.card,
    )
  }

  const sentiment = makeLayout({ align: 0.68, lineOpacity: 0.3, spread: 0.6 })
  for (let i = 0; i < count; i += 1) {
    const anchor = SENTIMENT_ANCHORS[sentimentGroup[i]]
    sentiment.positions[i * 3] = anchor.x + gaussian(random) * 2.5
    sentiment.positions[i * 3 + 1] = anchor.y + gaussian(random) * 2.6
    sentiment.positions[i * 3 + 2] = anchor.z + gaussian(random) * 2.2
    writeColor(sentiment.colors, i, anchor.color)
  }

  const topics = makeLayout({ align: 0.74, lineOpacity: 0.22, spread: 0.55 })
  for (let i = 0; i < count; i += 1) {
    const group = topicGroup[i]
    const angle = (group / TOPIC_COUNT) * Math.PI * 2
    const ringRadius = 9.4
    topics.positions[i * 3] = Math.cos(angle) * ringRadius + gaussian(random) * 1.9
    topics.positions[i * 3 + 1] = Math.sin(angle) * ringRadius * 0.62 + gaussian(random) * 1.7
    topics.positions[i * 3 + 2] = gaussian(random) * 2.4 - 1
    writeColor(topics.colors, i, TOPIC_COLORS[group])
  }

  const competitors = makeLayout({ align: 0.8, lineOpacity: 0.42, spread: 0.5 })
  for (let i = 0; i < count; i += 1) {
    const group = competitorGroup[i]
    if (group === 0) {
      competitors.positions[i * 3] = gaussian(random) * 1.9
      competitors.positions[i * 3 + 1] = gaussian(random) * 1.9
      competitors.positions[i * 3 + 2] = gaussian(random) * 1.6
      writeColor(competitors.colors, i, ACCENT_3D.orange)
    } else {
      const angle = ((group - 1) / COMPETITOR_COUNT) * Math.PI * 2 + 0.4
      const radius = 10.5
      competitors.positions[i * 3] = Math.cos(angle) * radius + gaussian(random) * 1.5
      competitors.positions[i * 3 + 1] = Math.sin(angle) * radius * 0.6 + gaussian(random) * 1.4
      competitors.positions[i * 3 + 2] = gaussian(random) * 1.8 - 2
      writeColor(competitors.colors, i, COMPETITOR_COLORS[group - 1])
    }
  }

  const dashboard = makeLayout({ align: 1, lineOpacity: 0.12, spread: 0.4 })
  const donutShare = 0.34
  const barShare = 0.38
  const donutCount = Math.floor(count * donutShare)
  const barCount = Math.floor(count * barShare)
  const BAR_HEIGHTS = [2.4, 3.6, 2.9, 4.6, 3.2, 5.2, 3.9]

  for (let i = 0; i < count; i += 1) {
    if (i < donutCount) {
      const t = i / donutCount
      const angle = t * Math.PI * 2 - Math.PI / 2
      const ringRadius = 3.5 + (random() - 0.5) * 0.5
      dashboard.positions[i * 3] = -8.4 + Math.cos(angle) * ringRadius
      dashboard.positions[i * 3 + 1] = 1.6 + Math.sin(angle) * ringRadius
      dashboard.positions[i * 3 + 2] = (random() - 0.5) * 0.4
      const band = t < SENTIMENT_SPLIT[0] ? 0 : t < SENTIMENT_SPLIT[0] + SENTIMENT_SPLIT[1] ? 1 : 2
      writeColor(dashboard.colors, i, SENTIMENT_ANCHORS[band].color)
    } else if (i < donutCount + barCount) {
      const n = i - donutCount
      const column = n % BAR_HEIGHTS.length
      const height = BAR_HEIGHTS[column]
      const rise = random()
      dashboard.positions[i * 3] = 1.4 + column * 1.5 + (random() - 0.5) * 0.55
      dashboard.positions[i * 3 + 1] = -2.6 + rise * height
      dashboard.positions[i * 3 + 2] = (random() - 0.5) * 0.4
      writeColor(
        dashboard.colors,
        i,
        column % 3 === 0 ? ACCENT_3D.orange : column % 3 === 1 ? ACCENT_3D.blue : ACCENT_3D.green,
      )
    } else {
      const n = i - donutCount - barCount
      const perRow = 16
      const col = n % perRow
      const row = Math.floor(n / perRow)
      dashboard.positions[i * 3] = -9.2 + col * 1.22
      dashboard.positions[i * 3 + 1] = -6.4 - row * 1.05
      dashboard.positions[i * 3 + 2] = (random() - 0.5) * 0.3
      writeColor(dashboard.colors, i, n % 5 === 0 ? ACCENT_3D.purple : PAPER_3D.card2)
    }
  }

  const settle = makeLayout({ align: 1, lineOpacity: 0.03, spread: 0.35 })
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3
    settle.positions[i3] = dashboard.positions[i3] * 1.55
    settle.positions[i3 + 1] = dashboard.positions[i3 + 1] * 1.25 + 1.2
    settle.positions[i3 + 2] = dashboard.positions[i3 + 2] - 19
    writeColor(settle.colors, i, NEUTRAL_TONES[i % NEUTRAL_TONES.length])
  }

  const backdrop = makeLayout({ align: 0.92, lineOpacity: 0.14, spread: 0.4 })
  for (let i = 0; i < count; i += 1) {
    const col = i % 30
    const row = Math.floor(i / 30)
    const x = (col - 14.5) * 1.15 + (random() - 0.5) * 0.5
    const y = 5.5 - row * 1.15 + (random() - 0.5) * 0.5
    backdrop.positions[i * 3] = x
    backdrop.positions[i * 3 + 1] = y
    backdrop.positions[i * 3 + 2] = -9 - (x * x) * 0.022 + (random() - 0.5) * 0.6
    writeColor(
      backdrop.colors,
      i,
      i % 3 === 0
        ? VIVID_COLORS[Math.floor(i / 3) % VIVID_COLORS.length]
        : NEUTRAL_TONES[i % NEUTRAL_TONES.length],
    )
  }

  const columns = makeLayout({ align: 0.9, lineOpacity: 0.1, spread: 0.42 })
  const COLUMN_COLORS = [
    ACCENT_3D.orange,
    ACCENT_3D.blue,
    ACCENT_3D.yellow,
    ACCENT_3D.green,
    ACCENT_3D.purple,
  ]
  for (let i = 0; i < count; i += 1) {
    const group = i % 5
    const inColumn = Math.floor(i / 5)
    columns.positions[i * 3] = (group - 2) * 4.6 + (random() - 0.5) * 1.6
    columns.positions[i * 3 + 1] = -13 + (inColumn % 34) * 0.72 + (random() - 0.5) * 0.5
    columns.positions[i * 3 + 2] = -2 + (random() - 0.5) * 2.2
    writeColor(columns.colors, i, COLUMN_COLORS[group])
  }

  const sphere = makeLayout({ align: 0.72, lineOpacity: 0.2, spread: 0.5 })
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const shell = 7.4 + (random() - 0.5) * 1.4
    sphere.positions[i * 3] = Math.cos(theta) * r * shell * 1.25
    sphere.positions[i * 3 + 1] = y * shell * 0.7
    sphere.positions[i * 3 + 2] = Math.sin(theta) * r * shell
    writeColor(
      sphere.colors,
      i,
      i % 2 === 0 ? VIVID_COLORS[Math.floor(i / 2) % VIVID_COLORS.length] : PAPER_3D.card,
    )
  }

  const recede = makeLayout({ align: 0.6, lineOpacity: 0.04, spread: 0.6 })
  for (let i = 0; i < count; i += 1) {
    recede.positions[i * 3] = sphere.positions[i * 3] * 1.9
    recede.positions[i * 3 + 1] = sphere.positions[i * 3 + 1] * 1.7
    recede.positions[i * 3 + 2] = sphere.positions[i * 3 + 2] * 1.5 - 12
    writeColor(
      recede.colors,
      i,
      i % 4 === 0
        ? VIVID_COLORS[Math.floor(i / 4) % VIVID_COLORS.length]
        : NEUTRAL_TONES[i % NEUTRAL_TONES.length],
    )
  }

  const layouts = [
    chaos,
    drift,
    lattice,
    sentiment,
    topics,
    competitors,
    dashboard,
    settle,
    backdrop,
    columns,
    sphere,
    recede,
  ]

  return {
    layouts,
    edges: buildEdges(lattice.positions, count, random),
    meta: { count, scales, phases, spins, tumble, sentimentGroup, competitorGroup },
  }
}

function buildEdges(positions, count, random, maxEdges = 260) {
  const pairs = []
  const step = Math.max(1, Math.floor(count / 150))

  for (let i = 0; i < count; i += step) {
    let bestIndex = -1
    let bestDistance = Infinity
    let secondIndex = -1
    let secondDistance = Infinity

    for (let j = 0; j < count; j += 1) {
      if (j === i) continue
      const dx = positions[i * 3] - positions[j * 3]
      const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
      const dz = positions[i * 3 + 2] - positions[j * 3 + 2]
      const distance = dx * dx + dy * dy + dz * dz
      if (distance < bestDistance) {
        secondDistance = bestDistance
        secondIndex = bestIndex
        bestDistance = distance
        bestIndex = j
      } else if (distance < secondDistance) {
        secondDistance = distance
        secondIndex = j
      }
    }

    if (bestIndex >= 0) pairs.push(i, bestIndex)
    if (secondIndex >= 0 && random() > 0.35) pairs.push(i, secondIndex)
  }

  return new Uint16Array(pairs.slice(0, maxEdges * 2))
}

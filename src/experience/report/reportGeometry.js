/**
 * Turns a finished report into the numbers a 3D scene needs.
 *
 * Kept apart from the rendering for the same reason the analysis modules are
 * kept apart from the dashboard: this is arithmetic over real measurements,
 * and it should be readable — and checkable — without a WebGL context.
 *
 * Every value here traces to something the pipeline actually measured. A bar
 * that is twice as tall represents twice as many posts; nothing is scaled for
 * looks alone.
 */

import { ACCENT_3D, PAPER_3D, hexToRgbTriplet } from '../palette.js'

/**
 * Semantic colours, mirroring the CSS tokens the 2D report uses so a green
 * bar in the scene is the same green as a positive badge in the dashboard.
 * Declared here rather than added to `palette.js` because that file is the
 * hero scene's palette and is shared with the acts — this is report-specific.
 */
export const SENTIMENT_3D = {
  positive: '#5d9b72', // --color-positive
  neutral: '#9a968c', // --color-neutral
  negative: '#c25a3f', // --color-negative
}

const SENTIMENT_ORDER = ['positive', 'neutral', 'negative']

/*
 * Identity colours, reused from the hero's topics and rivals acts so a
 * subject keeps the same colour it had when it first emerged out of the
 * noise.
 *
 * Sentiment alone could not carry this: most topics come out neutral, so
 * colouring columns by sentiment rendered nearly the whole report grey and
 * threw away the one thing colour is good at here — telling six subjects
 * apart at a glance. Sentiment moves to a cap on top of each column, where
 * it still reads but no longer flattens the palette.
 */
/*
 * Real brand colours, muted to sit inside this palette.
 *
 * A rival is recognisable before its label is legible when it carries the
 * colour people already associate with it — Netflix red, Spotify green — and
 * "why is Netflix grey?" is a fair question to ask of a chart. The vivid
 * originals would shout against warm paper, so each is taken down toward the
 * editorial range rather than used at full strength.
 *
 * Matched on the lowercased name; anything unknown falls back to the
 * identity palette below, so this is a nicety, never a requirement.
 */
/*
 * Brands whose identity is more than one colour.
 *
 * Google is the obvious case — four colours *are* the logo, and flattening it
 * to one blue throws away the thing that makes it recognisable at a glance.
 * Rendered as bands rather than a single fill.
 */
const BRAND_PALETTES = {
  google: ['#4a7fd6', '#cf4a3f', '#e0b03c', '#4f9d69'],
  microsoft: ['#d2543f', '#4f9d69', '#5aa1d8', '#e0b03c'],
  ebay: ['#cf4a3f', '#4a7fd6', '#e0b03c', '#4f9d69'],
  nbc: ['#d2543f', '#e0b03c', '#4f9d69', '#4a7fd6'],
}

const BRAND_COLORS = {
  netflix: '#c9403a',
  youtube: '#c9403a',
  spotify: '#4f9d69',
  google: '#5b8dd6',
  facebook: '#5b7fc7',
  meta: '#5b7fc7',
  microsoft: '#5aa1d8',
  walmart: '#e0a93c', // the spark, not the wordmark — see resolveCollisions
  amazon: '#e08b3c',
  'prime video': '#3fa2ad', // Prime's teal, distinct from Walmart and Google blue
  apple: '#7d7d82',
  samsung: '#4a6fb5',
  tesla: '#c9403a',
  slack: '#8b6fb5',
  notion: '#6b6b70',
  figma: '#d2703f',
  instagram: '#c2557f',
  twitter: '#5b9bd6',
  x: '#4a4a4f',
  reddit: '#e07a4a',
  disney: '#4a63b5',
  'disney+': '#4a63b5',
  hulu: '#4f9d69',
  uber: '#4a4a4f',
  airbnb: '#d15b6a',
  paypal: '#4a72b5',
  visa: '#4a63b5',
  mastercard: '#e08b3c',
  nike: '#6b6b70',
  adidas: '#5a5a5f',
  starbucks: '#3f8f63',
  subway: '#4f9d69',
  ikea: '#e0b03c',
  lego: '#d2543f',
}

/** A rival's own colour where we know it, otherwise its slot in the palette. */
export function brandColor(name, fallback) {
  return BRAND_COLORS[String(name || '').trim().toLowerCase()] ?? fallback
}

/** The multi-colour identity for a brand that has one. */
export function brandPalette(name) {
  return BRAND_PALETTES[String(name || '').trim().toLowerCase()] ?? null
}

/**
 * Hue of a hex colour, 0-360. Used only to notice when two rivals have
 * landed on near-identical colours.
 */
function hueOf(hex) {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16) / 255
  const g = parseInt(v.slice(2, 4), 16) / 255
  const b = parseInt(v.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return h * 60
}

/**
 * Pull apart rivals that happen to share a hue.
 *
 * Real brand colours cluster hard — Walmart, Prime Video and Google are all
 * blue — and three blue cubes in a row stop telling anyone apart, which is
 * the entire job of colouring them. Later collisions fall back to the
 * identity palette, picking the accent furthest in hue from what is already
 * on screen. Nothing is dropped or reordered; only the paint changes.
 */
function resolveCollisions(nodes, tolerance = 26) {
  const used = []

  return nodes.map((node) => {
    if (node.palette) return node

    const hue = hueOf(node.accent)
    const clashes = used.some((h) => Math.abs(h - hue) < tolerance)

    if (!clashes) {
      used.push(hue)
      return node
    }

    let best = node.accent
    let bestDistance = -1
    for (const candidate of IDENTITY_COLORS) {
      const candidateHue = hueOf(candidate)
      const distance = Math.min(...used.map((h) => Math.abs(h - candidateHue)))
      if (distance > bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }
    used.push(hueOf(best))
    return { ...node, accent: best, recoloured: true }
  })
}

const IDENTITY_COLORS = [
  ACCENT_3D.orange,
  ACCENT_3D.blue,
  ACCENT_3D.green,
  ACCENT_3D.yellow,
  ACCENT_3D.purple,
  PAPER_3D.muted,
]

/** Largest value in a list, floored at 1 so an all-zero series can't divide by 0. */
const peak = (values) => Math.max(1, ...values)

/**
 * The three sentiment columns.
 *
 * Heights come from the share of mentions, not the raw count, so the shape
 * reads the same for a brand with 200 posts and one with 2000.
 */
export function sentimentBars(sentiment) {
  if (!sentiment) return []

  const shares = {
    positive: sentiment.positivePct ?? 0,
    neutral: sentiment.neutralPct ?? 0,
    negative: sentiment.negativePct ?? 0,
  }
  const tallest = peak(Object.values(shares))

  return SENTIMENT_ORDER.map((key, index) => ({
    key,
    label: key,
    pct: shares[key],
    count: sentiment[key] ?? 0,
    // 0.35 keeps a near-zero share visible as a sliver rather than vanishing.
    height: 0.35 + (shares[key] / tallest) * 3.6,
    x: (index - 1) * 1.5,
    color: SENTIMENT_3D[key],
    rgb: hexToRgbTriplet(SENTIMENT_3D[key]),
  }))
}

/**
 * The topic ridge — one column per subject people keep returning to.
 *
 * Tinted by whichever sentiment dominates that topic, which is the single
 * most useful thing to know at a glance: not just "pricing comes up a lot"
 * but "pricing comes up a lot, and it is going badly".
 */
export function topicColumns(topics, limit = 6) {
  const shown = (topics ?? []).slice(0, limit)
  if (!shown.length) return []

  const tallest = peak(shown.map((topic) => topic.count ?? 0))
  // Wide enough that two full-length captions cannot touch.
  const span = 2.15

  return shown.map((topic, index) => {
    const dominant = SENTIMENT_ORDER.reduce(
      (best, key) => ((topic[key] ?? 0) > (topic[best] ?? 0) ? key : best),
      'neutral',
    )

    return {
      id: topic.id,
      label: topic.label,
      count: topic.count ?? 0,
      dominant,
      accent: IDENTITY_COLORS[index % IDENTITY_COLORS.length],
      height: 0.3 + ((topic.count ?? 0) / tallest) * 3.1,
      x: (index - (shown.length - 1) / 2) * span,
      color: SENTIMENT_3D[dominant],
      rgb: hexToRgbTriplet(SENTIMENT_3D[dominant]),
    }
  })
}

/**
 * The volume ribbon — mentions over time, each bucket stacked by sentiment.
 *
 * Only the most recent `limit` buckets: a two-year corpus would otherwise
 * compress into a comb too fine to read, and the recent end is the part
 * anyone monitoring a brand actually looks at.
 */
export function volumeStacks(timeline, limit = 30) {
  const buckets = (timeline?.buckets ?? []).slice(-limit)
  if (!buckets.length) return { stacks: [], granularity: timeline?.granularity ?? 'day' }

  const tallest = peak(buckets.map((bucket) => bucket.total ?? 0))
  const span = 0.42

  const stacks = buckets.map((bucket, index) => {
    const x = (index - (buckets.length - 1) / 2) * span
    let base = 0

    const segments = SENTIMENT_ORDER.map((key) => {
      const value = bucket[key] ?? 0
      const height = (value / tallest) * 2.4
      const segment = {
        key,
        value,
        height,
        // Boxes are centred on their origin, so a stacked segment sits half
        // its own height above the running total.
        y: base + height / 2,
        rgb: hexToRgbTriplet(SENTIMENT_3D[key]),
      }
      base += height
      return segment
    }).filter((segment) => segment.height > 0.001)

    return { x, start: bucket.start, total: bucket.total ?? 0, segments }
  })

  return { stacks, granularity: timeline?.granularity ?? 'day' }
}

/**
 * The competitor constellation — the brand at the centre, rivals in orbit.
 *
 * Distance is inverse to how often the two are named together: a competitor
 * mentioned in the same breath constantly sits close in, one mentioned twice
 * sits out at the edge. That makes proximity mean something rather than
 * being decorative placement.
 */
export function competitorNodes(competitors, limit = 5) {
  const shown = (competitors ?? []).slice(0, limit)
  if (!shown.length) return []

  const most = peak(shown.map((entry) => entry.mentions ?? 0))

  const placed = shown.map((entry, index) => {
    const share = (entry.mentions ?? 0) / most
    const angle = (index / shown.length) * Math.PI * 2 + Math.PI * 0.18
    const radius = 1.5 + (1 - share) * 1.9

    return {
      name: entry.brand,
      accent: brandColor(entry.brand, IDENTITY_COLORS[index % IDENTITY_COLORS.length]),
      palette: brandPalette(entry.brand),
      sentimentLabel: entry.sentimentLabel ?? 'neutral',
      mentions: entry.mentions ?? 0,
      radius,
      angle,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.62,
      // Node size carries the same signal as distance, doubled up on purpose:
      // depth makes size ambiguous, so proximity alone would be misread.
      scale: 0.24 + share * 0.3,
    }
  })

  return resolveCollisions(placed)
}

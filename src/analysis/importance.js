
import { buildBrandMatcher, makeSenseClassifier, brandTokens } from './buzz.js'
import { escapeRegex } from './topics.js'
import { analyzeSentiment } from './sentiment.js'

const HOUR_MS = 60 * 60 * 1000

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const round = (value, places = 3) => Number(value.toFixed(places))

const textOf = (thread) =>
  thread.text || [thread.title, thread.body].filter(Boolean).join('. ')

const QUESTION =
  /^(?:how|why|what|which|when|where|who|is|are|do|does|did|can|should|would|any(?:one|body)|looking for|recommend)\b|\?/i

export function makeRelevanceTest(brand, identity = {}) {
  const matchesBrand = buildBrandMatcher(brand, identity.aliases || [])
  const senseOf = makeSenseClassifier(brand)
  const tokens = brandTokens(brand)

  const compile = (terms) =>
    (terms || [])
      .filter(Boolean)
      .map((term) => new RegExp(`\\b${escapeRegex(String(term).toLowerCase())}\\b`, 'i'))

  const positive = compile(identity.positive_markers)
  const negative = compile(identity.negative_markers)
  const countMentions = (text) => {
    const escaped = escapeRegex(String(brand).trim()).replace(/\\?\s+/g, '[\\s-]?')
    return (text.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length
  }

  return (thread) => {
    const text = textOf(thread)
    if (!matchesBrand(text)) return { relevance: 0, sense: 'absent', markers: 0, vetoed: false }

    const sense = senseOf(thread)
    const inOwnCommunity = tokens.some((token) =>
      String(thread.subreddit || '').toLowerCase().includes(token),
    )

    const positiveHits = positive.filter((regex) => regex.test(text)).length
    const negativeHits = negative.filter((regex) => regex.test(text)).length

    if (negativeHits > 0 && positiveHits === 0 && sense !== 'brand' && !inOwnCommunity) {
      return { relevance: 0, sense, markers: -negativeHits, vetoed: true }
    }

    const senseWeight = sense === 'brand' ? 1 : sense === 'unknown' ? 0.6 : 0.2
    const markerWeight = positive.length ? clamp(positiveHits / 2) : 0.5
    const density = clamp((countMentions(text) - 1) / 2)

    let relevance = 0.5 * senseWeight + 0.3 * markerWeight + 0.2 * density
    if (negativeHits > 0) relevance *= 0.5

    return {
      relevance: round(clamp(relevance)),
      sense,
      markers: positiveHits - negativeHits,
      vetoed: false,
    }
  }
}

export const PRESCORE_WEIGHTS = {
  reach: 0.3,
  velocity: 0.25,
  community: 0.2,
  recency: 0.15,
  urgency: 0.1,
}

export function scoreThreads({ threads = [], brand, identity = {}, communityScores, now = Date.now() }) {
  if (!threads.length) return []

  const relevanceOf = makeRelevanceTest(brand, identity)

  const ranked = communityScores instanceof Map ? communityScores : new Map(Object.entries(communityScores || {}))
  const haveRanking = ranked.size > 0

  const scoreFor = (name) => {
    if (!haveRanking) return null
    const value = ranked.get(name)
    if (Number.isFinite(value)) return value / 100
    return 0.1
  }

  const prepared = threads
    .filter((thread) => thread && thread.type !== 'comment')
    .map((thread) => {
      const timestamp = Number.isFinite(thread.timestamp)
        ? thread.timestamp
        : new Date(thread.createdAt).getTime()
      const ageHours = Math.max(2, (now - timestamp) / HOUR_MS)
      const score = thread.score ?? 0
      const replies = thread.numComments ?? 0

      return {
        thread,
        id: thread.id,
        subreddit: thread.subreddit,
        timestamp,
        ageHours,
        ageDays: ageHours / 24,
        score,
        replies,
        engagement: score + 2 * replies,
        perHour: score / ageHours,
        ...relevanceOf(thread),
      }
    })

  const bySub = new Map()
  for (const entry of prepared) {
    if (!bySub.has(entry.subreddit)) bySub.set(entry.subreddit, [])
    bySub.get(entry.subreddit).push(entry.perHour)
  }
  const globalMedian = Math.max(0.01, median(prepared.map((entry) => entry.perHour)))
  const medianFor = (sub) => {
    const rates = bySub.get(sub) || []
    return rates.length >= 3 ? Math.max(0.01, median(rates)) : globalMedian
  }

  return prepared
    .map((entry) => {
      const community = scoreFor(entry.subreddit)
      const sentiment = Number.isFinite(entry.thread.sentimentScore)
        ? entry.thread.sentimentScore
        : analyzeSentiment(textOf(entry.thread)).score

      const unanswered =
        QUESTION.test((entry.thread.title || '').trim()) && entry.replies <= 3 ? 1 : 0

      const components = {
        reach: round(clamp(Math.log10(1 + entry.engagement) / 5)),
        velocity: round(clamp(Math.log2(1 + entry.perHour / medianFor(entry.subreddit)) / 5)),
        community,
        recency: round(clamp(Math.exp(-entry.ageDays / 14))),
        urgency: round(Math.max(clamp(Math.abs(sentiment)), unanswered)),
      }

      let weighted = 0
      let available = 0
      for (const [name, weight] of Object.entries(PRESCORE_WEIGHTS)) {
        if (components[name] === null || components[name] === undefined) continue
        weighted += weight * components[name]
        available += weight
      }
      const base = available ? weighted / available : 0

      return {
        id: entry.id,
        subreddit: entry.subreddit,
        timestamp: entry.timestamp,
        ageDays: round(entry.ageDays, 1),
        score: entry.score,
        replies: entry.replies,
        engagement: entry.engagement,
        relevance: entry.relevance,
        sense: entry.sense,
        vetoed: entry.vetoed,
        unanswered: Boolean(unanswered),
        sentiment: round(sentiment),
        components,
        prescore: round(100 * base * entry.relevance, 1),
      }
    })
    .sort((a, b) => b.prescore - a.prescore)
}

export function selectForDeepCollection(
  scored,
  { limit = 32, freshShare = 0.3, freshDays = 7, maxAgeDays = 90 } = {},
) {
  const eligible = scored.filter(
    (entry) => entry.relevance > 0 && entry.replies > 0 && entry.ageDays <= maxAgeDays,
  )
  const freshSlots = Math.round(limit * freshShare)

  const picked = []
  const taken = new Set()

  for (const entry of eligible) {
    if (picked.length >= limit - freshSlots) break
    picked.push(entry)
    taken.add(entry.id)
  }

  for (const entry of eligible) {
    if (picked.length >= limit) break
    if (taken.has(entry.id)) continue
    if (entry.ageDays > freshDays) continue
    picked.push(entry)
    taken.add(entry.id)
  }

  for (const entry of eligible) {
    if (picked.length >= limit) break
    if (taken.has(entry.id)) continue
    picked.push(entry)
    taken.add(entry.id)
  }

  return picked
}

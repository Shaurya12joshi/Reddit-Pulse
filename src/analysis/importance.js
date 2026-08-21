/**
 * Thread importance prescore — deterministic, cheap, and computed from signals
 * that exist *before* any comment has been fetched.
 *
 * This is the pivot the whole pipeline turns on. Comment trees are the most
 * expensive thing the collector fetches and the most valuable thing the
 * analysis layer reads, so which threads get one cannot be decided by
 * collection order or by a fixed "first 18 threads". It has to be decided by a
 * score, and the score has to be computable from a search listing alone:
 * title, body, subreddit, upvotes, Reddit's own reply count, and age.
 *
 * The same function then runs server-side over stored threads to build the
 * candidate set for the LLM, so the collector and the analyser always agree
 * about what matters.
 *
 * Pure module: no DOM, no database, no network.
 */

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

/** Threads that ask something and have not been answered are cheap wins. */
const QUESTION =
  /^(?:how|why|what|which|when|where|who|is|are|do|does|did|can|should|would|any(?:one|body)|looking for|recommend)\b|\?/i

/* --------------------------------------------------------------- relevance */

/**
 * Is this thread about the brand at all?
 *
 * Three independent readings, combined — and a hard veto. Negative markers
 * come from Stage 0 ("dye", "pantone" for Indigo; "the notion that" for
 * Notion) and are the cheapest, sharpest disambiguation available: a thread
 * carrying one and no brand-sense evidence is simply not about the brand.
 */
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

    // The veto: an unambiguous wrong-sense marker, with nothing arguing back.
    if (negativeHits > 0 && positiveHits === 0 && sense !== 'brand' && !inOwnCommunity) {
      return { relevance: 0, sense, markers: -negativeHits, vetoed: true }
    }

    const senseWeight = sense === 'brand' ? 1 : sense === 'unknown' ? 0.6 : 0.2
    const markerWeight = positive.length ? clamp(positiveHits / 2) : 0.5
    const density = clamp((countMentions(text) - 1) / 2)

    let relevance = 0.5 * senseWeight + 0.3 * markerWeight + 0.2 * density
    if (negativeHits > 0) relevance *= 0.5 // argued both ways — discount, don't veto

    return {
      relevance: round(clamp(relevance)),
      sense,
      markers: positiveHits - negativeHits,
      vetoed: false,
    }
  }
}

/* ------------------------------------------------------------- the prescore */

export const PRESCORE_WEIGHTS = {
  reach: 0.3,
  velocity: 0.25,
  community: 0.2,
  recency: 0.15,
  urgency: 0.1,
}

/**
 * Score a set of candidate threads.
 *
 * @param {object}   input
 * @param {object[]} input.threads          posts (enriched or raw); comments are ignored
 * @param {string}   input.brand
 * @param {object}   [input.identity]       Stage 0 output, for markers and aliases
 * @param {Map|object} [input.communityScores] subreddit → 0–100 buzz score
 * @param {number}   [input.now]
 */
export function scoreThreads({ threads = [], brand, identity = {}, communityScores, now = Date.now() }) {
  if (!threads.length) return []

  const relevanceOf = makeRelevanceTest(brand, identity)

  const ranked = communityScores instanceof Map ? communityScores : new Map(Object.entries(communityScores || {}))
  const haveRanking = ranked.size > 0

  const scoreFor = (name) => {
    // No ranking supplied at all — this runs mid-collection, before communities
    // have been scored. Genuinely unmeasured, so the weight is renormalised away.
    if (!haveRanking) return null
    const value = ranked.get(name)
    if (Number.isFinite(value)) return value / 100
    // Ranking exists and this community is not in it: that is a *measurement*
    // saying the community was rejected or never cleared the bar, not a gap.
    // Treating it as null let threads from discarded communities compete on
    // reach alone, which is how r/pettyrevenge reached the top of Tesla.
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
        // Upvotes and replies both count, replies double — a thread people are
        // arguing in matters more to a brand than one people scrolled past.
        engagement: score + 2 * replies,
        perHour: score / ageHours,
        ...relevanceOf(thread),
      }
    })

  /*
   * Velocity is judged against the *subreddit's own* median rate, not against
   * an absolute number. Forty upvotes an hour in a 5k-member community is a
   * bigger event for the brand than four thousand upvotes in r/pics, and this
   * is the concrete mechanism behind "do not rank purely by upvotes".
   */
  const bySub = new Map()
  for (const entry of prepared) {
    if (!bySub.has(entry.subreddit)) bySub.set(entry.subreddit, [])
    bySub.get(entry.subreddit).push(entry.perHour)
  }
  const globalMedian = Math.max(0.01, median(prepared.map((entry) => entry.perHour)))
  const medianFor = (sub) => {
    const rates = bySub.get(sub) || []
    // Under three samples the sub's "median" is just one post talking about
    // itself; fall back to the corpus.
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
        // Divided by 5, so saturation needs ~31× the community's median rate.
        // At /2 almost every candidate scored a flat 1.0 and the signal
        // discriminated nothing.
        velocity: round(clamp(Math.log2(1 + entry.perHour / medianFor(entry.subreddit)) / 5)),
        community,
        recency: round(clamp(Math.exp(-entry.ageDays / 14))),
        // Either a strongly-worded thread or an unanswered question earns the
        // same slot: both are moments where a brand could actually act.
        urgency: round(Math.max(clamp(Math.abs(sentiment)), unanswered)),
      }

      // Unmeasurable signals are dropped and the rest renormalised, rather
      // than being scored as zero — same rule the community ranking uses.
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
        // Relevance gates multiplicatively, exactly as it does for communities:
        // a viral thread that merely contains the word cannot buy its way in.
        prescore: round(100 * base * entry.relevance, 1),
      }
    })
    .sort((a, b) => b.prescore - a.prescore)
}

/**
 * Which threads deserve a comment tree?
 *
 * Takes the top of the prescore, but guarantees a slice of the budget to
 * threads that are *recent* rather than merely big. A month-old 5,000-upvote
 * thread outranks everything on reach and would otherwise crowd out the
 * three-day-old complaint that a brand could still do something about.
 */
export function selectForDeepCollection(
  scored,
  { limit = 32, freshShare = 0.3, freshDays = 7, maxAgeDays = 90 } = {},
) {
  /*
   * The age ceiling is a product decision, stated here rather than buried in a
   * weight. Comment trees exist so the brand can understand and possibly act
   * on a conversation; nobody acts on a 485-day-old thread. Without this,
   * Tesla's selection came back with a median age of 485 days, because reach
   * accumulates over time and recency is only 15% of the score.
   *
   * Old threads still get scored — they inform the corpus — they just do not
   * spend the collector's most expensive budget.
   */
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

  // Any budget the freshness reservation did not use goes back to the top.
  for (const entry of eligible) {
    if (picked.length >= limit) break
    if (taken.has(entry.id)) continue
    picked.push(entry)
    taken.add(entry.id)
  }

  return picked
}

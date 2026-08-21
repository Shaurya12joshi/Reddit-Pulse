/**
 * The funnel: 1,600 stored items → ~50 thread digests.
 *
 * Everything here is deterministic. Its job is to make sure the expensive
 * layer only ever sees threads that are (a) genuinely about the brand, (b) not
 * duplicates of each other, (c) recent enough to act on, and (d) worth the
 * attention — and to hand each one over in a compact form rather than as raw
 * Reddit output.
 *
 * The cost argument for this is real but secondary: a full corpus is ~120k
 * tokens, which is not expensive, it is just *bad input* — most of it is not
 * about the brand, and burying fifty useful threads in nine hundred mediocre
 * ones produces worse analysis, not more of it.
 */

import { scoreThreads } from './importance.js'
import { threadIdFromPermalink } from './buzz.js'
import { tokenize } from './sentiment.js'

const DAY_MS = 24 * 60 * 60 * 1000

/* --------------------------------------------------------- near-duplicates */

/**
 * A 32-bit simhash over title tokens.
 *
 * Crossposts, reposted news and "X announces Y" threads arrive many times over
 * from different facet queries. Exact-id dedup does not catch them because
 * they are genuinely different threads carrying the same conversation.
 */
export function simhash(text) {
  const tokens = tokenize(text)
  if (!tokens.length) return 0

  const bits = new Array(32).fill(0)
  for (const token of tokens) {
    // Cheap deterministic string hash (FNV-1a, 32-bit).
    let hash = 0x811c9dc5
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    for (let bit = 0; bit < 32; bit++) {
      bits[bit] += (hash >>> bit) & 1 ? 1 : -1
    }
  }

  let out = 0
  for (let bit = 0; bit < 32; bit++) if (bits[bit] > 0) out |= 1 << bit
  return out >>> 0
}

const hammingDistance = (a, b) => {
  let xor = (a ^ b) >>> 0
  let count = 0
  while (xor) {
    count += xor & 1
    xor >>>= 1
  }
  return count
}

/**
 * Collapse near-identical threads, keeping the highest-scoring representative
 * and recording what it stood in for — the duplicate count is itself a signal
 * that a story is spreading.
 */
export function collapseDuplicates(scored, { threshold = 3 } = {}) {
  const kept = []

  for (const entry of scored) {
    const hash = simhash(entry.title || '')
    const match = kept.find((candidate) => hammingDistance(candidate.hash, hash) <= threshold)

    if (match) {
      match.duplicates.push(entry.id)
      match.duplicateSubs.add(entry.subreddit)
      continue
    }
    kept.push({ ...entry, hash, duplicates: [], duplicateSubs: new Set([entry.subreddit]) })
  }

  return kept.map((entry) => ({
    ...entry,
    duplicateCount: entry.duplicates.length,
    spreadAcross: entry.duplicateSubs.size,
  }))
}

/* -------------------------------------------------------------- cache keys */

/** Deterministic 32-bit hash of a string, rendered hex. */
function hashString(value) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Buckets grow by ~50% before they move, so ordinary score drift never
 * invalidates an analysis while a genuinely bigger thread always does.
 */
const bucket = (n) => Math.floor(Math.log(Math.max(0, n) + 1) / Math.log(1.5))

/**
 * The cache key for a thread's analysis. Changes only when something that
 * would change the *analysis* changes: the body, which comments are on top, or
 * a real jump in size.
 */
export function analysisCacheKey(thread, comments = []) {
  const top = [...comments]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((comment) => comment.id)
    .join(',')

  return [
    thread.id,
    hashString(thread.body || ''),
    hashString(top),
    bucket(thread.score ?? 0),
    bucket(thread.numComments ?? 0),
  ].join('.')
}

/* ---------------------------------------------------------------- digests */

const truncate = (value, max) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * The only shape that ever reaches the LLM. ~400 tokens per thread, versus
 * ~8k for a raw thread with its comment tree.
 *
 * Deliberately omits: author names (not needed for judgment, and it is
 * personal data we have no reason to ship), urls, ids of comments, and every
 * field the model would only be echoing back.
 */
export function buildDigest(entry, { thread, comments = [], communityMembers = null }) {
  const topComments = [...comments]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((comment) => ({ s: comment.score ?? 0, t: truncate(comment.body, 200) }))

  const competitors = new Set()
  for (const mention of thread.competitorMentions || []) competitors.add(mention.brand)
  for (const comment of comments) {
    for (const mention of comment.competitorMentions || []) competitors.add(mention.brand)
  }

  return {
    id: thread.id,
    sub: thread.subreddit,
    sub_members: communityMembers ?? undefined,
    title: truncate(thread.title, 200),
    body: truncate(thread.body, 400),
    age_days: Math.round(entry.ageDays),
    score: thread.score ?? 0,
    comments: thread.numComments ?? 0,
    comments_read: comments.length,
    velocity_pct: Math.round((entry.components?.velocity ?? 0) * 100),
    top_comments: topComments,
    competitor_hits: [...competitors].slice(0, 6),
    duplicate_of: entry.duplicateCount || undefined,
    prescore: Math.round(entry.prescore),
  }
}

/* ----------------------------------------------------------------- the run */

/**
 * Build the candidate set for analysis.
 *
 * @param {object} input
 * @param {object[]} input.posts        every stored item for the brand
 * @param {string}   input.brand
 * @param {object}   [input.identity]   Stage 0, for markers and aliases
 * @param {Map}      [input.communityScores]
 * @param {Map}      [input.communityMembers]
 * @param {object}   [input.options]    { limit, maxAgeDays }
 * @returns {{ digests: object[], entries: object[], stats: object }}
 */
export function buildCandidates({
  posts,
  brand,
  identity = {},
  communityScores,
  communityMembers,
  options = {},
  now = Date.now(),
}) {
  const { limit = 60, maxAgeDays = 120 } = options

  const threads = posts.filter((post) => post.type === 'post')
  const commentsByThread = new Map()
  for (const post of posts) {
    if (post.type !== 'comment') continue
    const parent = threadIdFromPermalink(post.permalink)
    if (!parent) continue
    if (!commentsByThread.has(parent)) commentsByThread.set(parent, [])
    commentsByThread.get(parent).push(post)
  }

  const scored = scoreThreads({ threads, brand, identity, communityScores, now })
  const byId = new Map(threads.map((thread) => [thread.id, thread]))

  const relevant = scored
    .filter((entry) => entry.relevance > 0)
    .filter((entry) => entry.ageDays <= maxAgeDays)
    .map((entry) => ({ ...entry, title: byId.get(entry.id)?.title || '' }))

  const deduped = collapseDuplicates(relevant)
  const selected = deduped.slice(0, limit)

  const digests = selected.map((entry) => {
    const thread = byId.get(entry.id)
    const comments = commentsByThread.get(entry.id) || []
    return buildDigest(entry, {
      thread,
      comments,
      communityMembers: communityMembers?.get(entry.subreddit) ?? null,
    })
  })

  const entries = selected.map((entry) => ({
    ...entry,
    cacheKey: analysisCacheKey(byId.get(entry.id), commentsByThread.get(entry.id) || []),
    hasComments: (commentsByThread.get(entry.id) || []).length > 0,
  }))

  return {
    digests,
    entries,
    stats: {
      stored: posts.length,
      threads: threads.length,
      relevant: relevant.length,
      afterDedup: deduped.length,
      selected: selected.length,
      withComments: entries.filter((entry) => entry.hasComments).length,
      droppedIrrelevant: scored.length - scored.filter((entry) => entry.relevance > 0).length,
      droppedStale: scored.filter((entry) => entry.relevance > 0 && entry.ageDays > maxAgeDays).length,
      droppedDuplicate: relevant.length - deduped.length,
    },
  }
}

export const FUNNEL_DEFAULTS = { limit: 60, maxAgeDays: 120 }
export { DAY_MS }

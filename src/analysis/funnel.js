
import { scoreThreads } from './importance.js'
import { threadIdFromPermalink } from './buzz.js'
import { tokenize } from './sentiment.js'

const DAY_MS = 24 * 60 * 60 * 1000

export function simhash(text) {
  const tokens = tokenize(text)
  if (!tokens.length) return 0

  const bits = new Array(32).fill(0)
  for (const token of tokens) {
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

function hashString(value) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const bucket = (n) => Math.floor(Math.log(Math.max(0, n) + 1) / Math.log(1.5))

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

const truncate = (value, max) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

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

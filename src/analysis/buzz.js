import { escapeRegex, extractTrendingPhrases, topicLabel } from './topics.js'
import { tokenize } from './sentiment.js'

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_MS = 30 * DAY_MS

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function minMax(values) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  return (value) => (span > 0 ? (value - min) / span : values.length > 1 ? 0.5 : 1)
}

const round = (value, places = 3) => Number(value.toFixed(places))

const textOf = (post) => post.text || [post.title, post.body].filter(Boolean).join('. ')

export function threadIdFromPermalink(permalink) {
  const match = /\/comments\/([a-z0-9]+)/i.exec(permalink || '')
  return match ? `t3_${match[1]}` : null
}

export function brandTokens(brand) {
  return String(brand)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
}

export function buildBrandMatcher(brand, aliases = []) {
  const forms = [String(brand), ...aliases]
    .map((form) => String(form).trim())
    .filter(Boolean)
    .map((form) => escapeRegex(form).replace(/\\?\s+/g, '[\\s-]?'))

  if (!forms.length) return () => false
  const regex = new RegExp(`\\b(?:${forms.join('|')})(?:'?s)?\\b`, 'i')
  return (text) => regex.test(text || '')
}

export function deriveAliases(posts, brand, communities = []) {
  const tokens = brandTokens(brand)
  if (!tokens.length) return []

  const escaped = escapeRegex(String(brand).trim()).replace(/\\?\s+/g, '[\\s-]?')
  const parenthetical = new RegExp(`\\b${escaped}\\s*\\(([\\w.-]{2,12})\\)`, 'gi')
  const spelledOut = new RegExp(
    `\\b${escaped}\\s+(?:aka|a\\.k\\.a\\.?|also known as)\\s+([\\w.-]{2,15})\\b`,
    'gi',
  )

  const candidates = new Map()
  const propose = (raw) => {
    const value = String(raw || '').trim().toLowerCase()
    if (value.length < 2 || value.length > 12) return
    if (tokens.includes(value)) return
    if (/^\d+$/.test(value)) return
    candidates.set(value, (candidates.get(value) || 0) + 1)
  }

  for (const post of posts) {
    const text = textOf(post)
    for (const match of text.matchAll(parenthetical)) propose(match[1])
    for (const match of text.matchAll(spelledOut)) propose(match[1])
  }

  for (const community of communities) {
    const name = String(community?.name || '').toLowerCase()
    for (const token of tokens) {
      if (!name.includes(token) || name === token) continue
      const remainder = name.replace(token, '').replace(/[^a-z0-9]/g, '')
      if (remainder.length >= 2 && remainder.length <= 6) propose(remainder)
    }
  }

  const corpus = posts.map(textOf).join('\n')
  return [...candidates.entries()]
    .map(([alias, proposals]) => {
      const all = corpus.match(new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi')) || []
      const capitalised = all.filter((hit) => hit === hit.toUpperCase()).length
      return {
        alias,
        proposals,
        mentions: all.length,
        capitalisedShare: all.length ? round(capitalised / all.length, 2) : 0,
      }
    })
    .filter((entry) => entry.mentions >= 3)
    .filter((entry) => entry.capitalisedShare >= 0.5 || /\d/.test(entry.alias))
    .filter((entry) => entry.mentions <= posts.length * 0.2)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5)
}

export function makeOtherSenseTell(brand) {
  const escaped = escapeRegex(String(brand).trim()).replace(/\\?\s+/g, '[\\s-]?')
  const locative = new RegExp(
    `\\b(?:in|near|around|across|through|over)\\s+the\\s+${escaped}\\b`,
    'i',
  )
  const descriptorNoun = new RegExp(
    `\\b${escaped}\\s+(?:rain ?forest|forest|river|basin|jungle|delta|valley|tributary|biome|wilderness|orchard|grove|tree|blossom|pie|sauce|juice|cider|seed|core)\\b`,
    'i',
  )
  return (text) => locative.test(text) || descriptorNoun.test(text)
}

export function makeCapitalisationTest(brand) {
  const escaped = escapeRegex(String(brand).trim()).replace(/\\?\s+/g, '[\\s-]?')
  const midSentence = new RegExp(`\\S\\s+(${escaped})\\b`, 'gi')
  const otherSenseTell = makeOtherSenseTell(brand)

  const isTitleCase = (title) => {
    const words = String(title || '').split(/\s+/).filter((word) => /^[A-Za-z]/.test(word))
    if (words.length < 3) return false
    const capitalised = words.filter((word) => /^[A-Z]/.test(word)).length
    return capitalised / words.length >= 0.6
  }

  return (post) => {
    const fullText = textOf(post)
    if (otherSenseTell(fullText)) return 'other'

    const prose = isTitleCase(post.title) ? post.body || '' : fullText
    const hits = [...prose.matchAll(midSentence)]
    if (!hits.length) return 'unknown'
    return hits.some((match) => /^[A-Z]/.test(match[1])) ? 'brand' : 'other'
  }
}

export function makeSenseClassifier(brand) {
  const tokens = brandTokens(brand)
  const capitalisation = makeCapitalisationTest(brand)

  return (post) => {
    const sense = capitalisation(post)
    if (sense === 'other') return 'other'

    const name = String(post.subreddit || '').toLowerCase()
    if (tokens.some((token) => name.includes(token))) return 'brand'
    return sense
  }
}

export function calibrateSenseUsable(posts, brand) {
  const capitalisationOf = makeCapitalisationTest(brand)
  const tokens = brandTokens(brand)
  let brandSense = 0
  let otherSense = 0
  let ownCap = 0
  let ownEvidence = 0

  for (const post of posts) {
    const sense = capitalisationOf(post)
    if (sense === 'brand') brandSense += 1
    else if (sense === 'other') otherSense += 1
    if (sense === 'unknown') continue

    const inOwn = tokens.some((token) => String(post.subreddit || '').toLowerCase().includes(token))
    if (inOwn) {
      ownEvidence += 1
      if (sense === 'brand') ownCap += 1
    }
  }

  const senseEvidence = brandSense + otherSense
  return ownEvidence >= 8
    ? ownCap / ownEvidence >= 0.5
    : senseEvidence >= 20 && brandSense / senseEvidence >= 0.25
}

export function filterRelevantPosts(posts, brand) {
  if (!posts.length) return posts

  const matchesBrand = buildBrandMatcher(brand)
  const tellOf = makeOtherSenseTell(brand)
  const senseOf = makeSenseClassifier(brand)
  const senseUsable = calibrateSenseUsable(posts, brand)

  const threadsById = new Map()
  for (const post of posts) {
    if (post.type === 'post') threadsById.set(post.id, post)
  }

  const relevant = (post) => {
    const text = textOf(post)
    if (!matchesBrand(text)) return false
    if (tellOf(text)) return false
    if (senseUsable && senseOf(post) === 'other') return false
    return true
  }

  return posts.filter((post) => {
    if (post.type === 'post') return relevant(post)
    const parent = threadsById.get(threadIdFromPermalink(post.permalink))
    return (parent && relevant(parent)) || relevant(post)
  })
}

export function deriveAnchorPosts(posts, brand) {
  const escaped = escapeRegex(String(brand).trim()).replace(/\\?\s+/g, '[\\s-]?')
  const anyCase = new RegExp(`\\b${escaped}\\b`, 'gi')
  const tokens = brandTokens(brand)
  const senseOf = makeSenseClassifier(brand)

  const named = []
  const proper = []
  const repeated = []

  for (const post of posts) {
    const sense = senseOf(post)
    if (sense === 'other') continue

    const name = String(post.subreddit || '').toLowerCase()
    if (tokens.some((token) => name.includes(token))) {
      named.push(post)
      continue
    }
    if (sense === 'brand') {
      proper.push(post)
      continue
    }
    if ((textOf(post).match(anyCase) || []).length >= 3) repeated.push(post)
  }

  const confident = [...named, ...proper]
  const anchors = confident.length >= 15 ? confident : [...confident, ...repeated]
  anchors.tiers = { named: named.length, proper: proper.length, repeated: repeated.length }
  anchors.usedRepeated = confident.length < 15
  return anchors
}

export function deriveContextTerms(posts, brand, { limit = 20, anchors, window = 5 } = {}) {
  if (!posts.length) return []

  const source = anchors && anchors.length >= 15 ? anchors : posts
  const minCount = Math.max(3, Math.round(source.length * 0.02))

  const candidates = extractTrendingPhrases(
    source.map(textOf),
    { limit: limit * 3, minCount, exclude: brandTokens(brand) },
  ).filter(({ phrase }) => !phrase.includes("'"))

  const unigrams = new Set(candidates.filter((c) => c.type === 'word').map((c) => c.phrase))
  const bigrams = new Set(candidates.filter((c) => c.type === 'phrase').map((c) => c.phrase))

  const near = new Map()
  const total = new Map()
  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1)

  const brandSeq = brandTokens(brand)
  const isBrandAt = (tokens, index) =>
    brandSeq.every((token, offset) => {
      const word = tokens[index + offset]
      return word === token || word === `${token}s`
    })

  for (const post of source) {
    const tokens = tokenize(textOf(post))
    const inWindow = new Array(tokens.length).fill(false)

    tokens.forEach((_, index) => {
      if (!isBrandAt(tokens, index)) return
      const from = Math.max(0, index - window)
      const to = Math.min(tokens.length - 1, index + brandSeq.length - 1 + window)
      for (let i = from; i <= to; i++) inWindow[i] = true
    })

    tokens.forEach((token, index) => {
      if (unigrams.has(token)) {
        bump(total, token)
        if (inWindow[index]) bump(near, token)
      }
      const pair = `${token} ${tokens[index + 1]}`
      if (tokens[index + 1] && bigrams.has(pair)) {
        bump(total, pair)
        if (inWindow[index] || inWindow[index + 1]) bump(near, pair)
      }
    })
  }

  const allTexts = posts.map((post) => textOf(post).toLowerCase())
  const docFrequency = (phrase) => {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`)
    return round(allTexts.filter((text) => regex.test(text)).length / (allTexts.length || 1), 3)
  }

  const scored = candidates
    .map(({ phrase, count, type }) => {
      const beside = near.get(phrase) || 0
      const everywhere = total.get(phrase) || 0
      return {
        term: phrase,
        posts: count,
        type,
        besideBrand: beside,
        collocation: everywhere ? round(beside / everywhere, 2) : 0,
        docFrequency: docFrequency(phrase),
      }
    })
    .filter((entry) => entry.besideBrand >= 3 && entry.collocation >= 0.15)
    .sort((a, b) => b.besideBrand - a.besideBrand)
    .slice(0, limit)

  return scored.length >= 6
    ? scored
    : candidates.slice(0, limit).map(({ phrase, count, type }) => ({
        term: phrase,
        posts: count,
        type,
        besideBrand: near.get(phrase) || 0,
        collocation: null,
        docFrequency: docFrequency(phrase),
      }))
}

export function groupContextFacets(contextTerms, posts, { threshold = 0.4, max = 6 } = {}) {
  if (!contextTerms.length) return []

  const texts = posts.map((post) => textOf(post).toLowerCase())
  const appearsIn = new Map()
  for (const { term } of contextTerms) {
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`)
    const found = new Set()
    texts.forEach((text, index) => {
      if (regex.test(text)) found.add(index)
    })
    appearsIn.set(term, found)
  }

  const overlap = (a, b) => {
    const first = appearsIn.get(a)
    const second = appearsIn.get(b)
    if (!first?.size || !second?.size) return 0
    const [small, large] = first.size < second.size ? [first, second] : [second, first]
    let shared = 0
    for (const index of small) if (large.has(index)) shared += 1
    return shared / small.size
  }

  const facets = []
  for (const entry of contextTerms) {
    let best = null
    let bestScore = 0
    for (const facet of facets) {
      const score = Math.max(...facet.terms.map((term) => overlap(entry.term, term)))
      if (score > bestScore) {
        bestScore = score
        best = facet
      }
    }

    if (best && bestScore >= threshold) best.terms.push(entry.term)
    else if (facets.length < max) facets.push({ label: entry.term, terms: [entry.term], posts: entry.posts })
    else if (best) best.terms.push(entry.term)
  }

  return facets
}

export function expansionQueries(facets, { limit = 8, exclude = [], maxDocFrequency = 0.15, terms = [] } = {}) {
  const used = new Set(exclude.map((term) => String(term).toLowerCase()))

  const frequency = new Map(terms.map((entry) => [entry.term, entry.docFrequency ?? 0]))
  const specific = (term) =>
    term.includes(' ') || (frequency.get(term) ?? 0) <= maxDocFrequency

  const queues = facets
    .map((facet) => ({
      label: facet.label,
      terms: facet.terms.filter((term) => !used.has(term.toLowerCase()) && specific(term)),
      untouched: facet.terms.every((term) => !used.has(term.toLowerCase())),
    }))
    .filter((queue) => queue.terms.length)
    .sort((a, b) => Number(b.untouched) - Number(a.untouched))

  const picked = []
  for (let round = 0; picked.length < limit; round++) {
    if (!queues.some((queue) => queue.terms.length > round)) break
    for (const queue of queues) {
      if (picked.length >= limit) break
      if (queue.terms.length > round) picked.push({ term: queue.terms[round], facet: queue.label })
    }
  }
  return picked
}

export function deriveGeoTerms(posts, contextTerms) {
  const corpus = posts.map(textOf).join('\n')
  const lower = corpus.toLowerCase()
  const geo = new Set()

  for (const { term } of contextTerms) {
    const escaped = escapeRegex(term)
    const total = (lower.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length
    if (total < 4) continue

    const locative = (
      lower.match(new RegExp(`\\b(?:in|from|at|near|around)\\s+${escaped}\\b`, 'g')) || []
    ).length
    if (locative / total < 0.4) continue

    const written = corpus.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []
    const capitalised = written.filter((hit) => /^[A-Z]/.test(hit)).length
    if (written.length && capitalised / written.length >= 0.5) geo.add(term)
  }

  return geo
}

export function deriveBrandContext(posts, brand, communities = [], { alreadySearched = [] } = {}) {
  const anchors = deriveAnchorPosts(posts, brand)
  const contextTerms = deriveContextTerms(posts, brand, { anchors })
  const facets = groupContextFacets(contextTerms, anchors.length >= 15 ? anchors : posts)

  return {
    aliases: deriveAliases(anchors.length >= 15 ? anchors : posts, brand, communities),
    contextTerms,
    facets,
    queries: expansionQueries(facets, { exclude: alreadySearched, terms: contextTerms }),
    geoTerms: [...deriveGeoTerms(anchors.length >= 15 ? anchors : posts, contextTerms)],
    anchors: {
      count: anchors.length,
      share: posts.length ? round(anchors.length / posts.length) : 0,
      tiers: anchors.tiers,
      usedRepeated: Boolean(anchors.usedRepeated),
      sufficient: anchors.length >= 15,
    },
  }
}

const GEO_DESCRIPTION = /\b(?:residents|locals|metro area|city of|county|province|prefecture|subreddit (?:for|about) (?:the )?(?:city|town|state|country|region|island))\b/i

function isGeographic(meta, geoTerms) {
  const name = String(meta?.name || '').toLowerCase()
  if ([...geoTerms].some((term) => name === term.replace(/\s+/g, ''))) return true
  return GEO_DESCRIPTION.test(meta?.title || '')
}

function discussionType(entry) {
  const { threads, questionThreads, sentiment, topics } = entry
  const parts = []

  const topTopics = topics.slice(0, 2).map((topic) => topic.label)
  if (topTopics.length) parts.push(topTopics.join(' · '))

  const share = (n) => (threads ? n / threads : 0)
  if (share(questionThreads) >= 0.35) parts.push('questions & advice')
  else if (sentiment.negative >= sentiment.positive * 1.6) parts.push('complaints')
  else if (sentiment.positive >= sentiment.negative * 1.6) parts.push('recommendations')
  else parts.push('mixed discussion')

  return parts.join(' - ')
}

const QUESTION = /^(?:how|why|what|which|when|where|who|is|are|do|does|did|can|should|would|any(?:one|body))\b|\?/i

function measureCommunities({
  posts,
  metaByName,
  matchesBrand,
  senseOf,
  capitalisationOf,
  otherSenseTellOf,
  contextRegexes,
  geoTerms,
  now,
  history,
}) {
  const threadsById = new Map()
  for (const post of posts) {
    if (post.type === 'post') threadsById.set(post.id, post)
  }

  const contextHits = (text) => contextRegexes.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0)

  const rows = new Map()
  const row = (name) => {
    if (!rows.has(name)) {
      const meta = metaByName.get(name) || {}
      rows.set(name, {
        name,
        subscribers: meta.subscribers ?? null,
        activeUsers: meta.activeUsers ?? null,
        title: meta.title || null,
        discoveredVia: meta.discoveredVia ? String(meta.discoveredVia).split(',').filter(Boolean) : [],
        subPostRate: Number.isFinite(meta.subPostRate) ? meta.subPostRate : null,
        coverageStart: Number.isFinite(meta.coverageStart) ? meta.coverageStart : null,
        threads: 0,
        relevantThreads: 0,
        brandSense: 0,
        otherSense: 0,
        capBrand: 0,
        capOther: 0,
        questionThreads: 0,
        comments: 0,
        engagements: [],
        commentCounts: [],
        commentChars: [],
        timestamps: [],
        threadTimestamps: [],
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        sentimentSum: 0,
        topicCounts: new Map(),
        examples: [],
      })
    }
    return rows.get(name)
  }

  for (const post of posts) {
    if (!post.subreddit) continue
    const text = textOf(post)
    const isThread = post.type === 'post'

    if (otherSenseTellOf(text)) continue

    if (!isThread) {
      const parent = threadsById.get(threadIdFromPermalink(post.permalink))
      const parentText = parent ? textOf(parent) : ''
      const underBrandThread = Boolean(
        parent && matchesBrand(parentText) && !otherSenseTellOf(parentText),
      )
      if (!underBrandThread && !matchesBrand(text)) continue
    } else if (!matchesBrand(text)) {
      continue
    }

    const entry = row(post.subreddit)
    entry.timestamps.push(post.timestamp)
    entry.sentiment[post.sentimentLabel] += 1
    entry.sentimentSum += post.sentimentScore ?? 0
    for (const id of post.topicIds || []) {
      entry.topicCounts.set(id, (entry.topicCounts.get(id) || 0) + 1)
    }

    if (isThread) {
      entry.threads += 1
      entry.threadTimestamps.push(post.timestamp)
      entry.engagements.push(post.engagement ?? 0)
      entry.commentCounts.push(post.numComments ?? 0)
      if (contextHits(text) >= 1) entry.relevantThreads += 1

      const sense = senseOf(post)
      if (sense === 'brand') entry.brandSense += 1
      else if (sense === 'other') entry.otherSense += 1

      const written = capitalisationOf(post)
      if (written === 'brand') entry.capBrand += 1
      else if (written === 'other') entry.capOther += 1
      if (QUESTION.test((post.title || '').trim())) entry.questionThreads += 1
      if (entry.examples.length < 3) {
        entry.examples.push({
          id: post.id,
          title: post.title,
          score: post.score ?? 0,
          numComments: post.numComments ?? 0,
          url: post.url,
          timestamp: post.timestamp,
        })
      }
    } else {
      entry.comments += 1
      entry.commentChars.push((post.body || '').length)
    }
  }

  return [...rows.values()].map((entry) => finishRow(entry, { geoTerms, now, history }))
}

function velocityFromSnapshots(history) {
  if (!Array.isArray(history) || history.length < 2) return null

  const points = [...history].sort((a, b) => a.runAt - b.runAt)
  const rateBetween = (from, to) => {
    const days = (to.runAt - from.runAt) / DAY_MS
    if (days < 0.5) return null
    return Math.max(0, to.threads - from.threads) / days
  }

  const latest = rateBetween(points[points.length - 2], points[points.length - 1])
  if (latest === null) return null

  if (points.length < 3) {
    return { ratio: null, arrivalRate: round(latest, 2), source: 'snapshots', intervals: 1 }
  }

  const previous = rateBetween(points[points.length - 3], points[points.length - 2])
  if (previous === null) {
    return { ratio: null, arrivalRate: round(latest, 2), source: 'snapshots', intervals: 1 }
  }

  return {
    ratio: round((latest + 0.1) / (previous + 0.1), 2),
    arrivalRate: round(latest, 2),
    source: 'snapshots',
    intervals: points.length - 1,
  }
}

function finishRow(entry, { geoTerms, now, history }) {
  const items = entry.threads + entry.comments
  const ages = entry.timestamps.map((t) => (now - t) / DAY_MS)

  const recent30 = entry.timestamps.filter((t) => t >= now - WINDOW_MS).length
  const prior30 = entry.timestamps.filter(
    (t) => t >= now - 2 * WINDOW_MS && t < now - WINDOW_MS,
  ).length
  const recent90 = entry.timestamps.filter((t) => t >= now - 3 * WINDOW_MS).length

  const oldest = entry.timestamps.length ? Math.min(...entry.timestamps) : now
  const coversPriorWindow = Math.min(oldest, entry.coverageStart ?? oldest) <= now - 2 * WINDOW_MS
  const inSampleVelocity =
    coversPriorWindow && items >= 4 ? round((recent30 + 1) / (prior30 + 1), 2) : null

  const measured = velocityFromSnapshots(history?.get(entry.name))
  const velocity = measured?.ratio ?? inSampleVelocity
  const velocitySource = measured?.ratio ? 'snapshots' : inSampleVelocity !== null ? 'sample' : null

  const monthKeys = new Set()
  for (const timestamp of entry.timestamps) {
    if (timestamp < now - 365 * DAY_MS) continue
    const date = new Date(timestamp)
    monthKeys.add(`${date.getUTCFullYear()}-${date.getUTCMonth()}`)
  }
  const monthsCovered = Math.max(
    1,
    Math.min(12, Math.ceil((now - Math.max(oldest, now - 365 * DAY_MS)) / (30 * DAY_MS))),
  )

  const threadsPerDay = entry.threadTimestamps.length
    ? entry.threadTimestamps.length / Math.max(1, (now - oldest) / DAY_MS)
    : 0

  const topics = [...entry.topicCounts.entries()]
    .map(([id, count]) => ({ id, label: topicLabel(id), count }))
    .sort((a, b) => b.count - a.count)

  const finished = {
    ...entry,
    items,
    recent30,
    prior30,
    recent90,
    share30: items ? round(recent30 / items) : 0,
    share90: items ? round(recent90 / items) : 0,
    medianAgeDays: Math.round(median(ages)),
    newestAgeDays: ages.length ? Math.round(Math.min(...ages)) : null,
    velocity,
    velocitySource,
    velocityMeasurable: velocity !== null,
    arrivalRate: measured?.arrivalRate ?? null,
    engagementMedian: Math.round(median(entry.engagements)),
    commentsPerThread: entry.threads ? round(entry.comments / entry.threads, 1) : 0,
    repliesPerThread: round(median(entry.commentCounts), 1),
    medianCommentChars: Math.round(median(entry.commentChars)),
    activeMonths: monthKeys.size,
    consistency: round(Math.min(1, monthKeys.size / monthsCovered)),
    brandShare:
      entry.subPostRate && entry.subPostRate > 0
        ? round(Math.min(1, threadsPerDay / entry.subPostRate), 4)
        : null,
    threadsPerDay: round(threadsPerDay, 3),
    avgSentiment: items ? round(entry.sentimentSum / items) : 0,
    topics,
    geo: isGeographic(entry, geoTerms),
  }

  finished.discussionType = discussionType(finished)
  return finished
}

const WEIGHTS = {
  volume: 0.24,
  recency: 0.15,
  brandShare: 0.15,
  engagement: 0.14,
  velocity: 0.13,
  consistency: 0.09,
  depth: 0.05,
  size: 0.05,
}

const velocityComponent = (ratio) => clamp((Math.log2(ratio) + 2) / 4)

const smooth = (hits, n, prior, strength = 2) => (hits + strength * prior) / (n + strength)

function scoreCommunities(rows, corpus) {
  const volumeScale = minMax(rows.map((row) => Math.log1p(row.threads)))
  const engagementScale = minMax(rows.map((row) => Math.log1p(row.engagementMedian)))
  const depthScale = minMax(rows.map((row) => Math.log1p(row.repliesPerThread)))

  return rows.map((row) => {
    const senseEvidence = row.brandSense + row.otherSense
    const context = smooth(row.relevantThreads, row.threads, corpus.contextRate)
    const sense =
      corpus.senseUsable && senseEvidence
        ? smooth(row.brandSense, senseEvidence, corpus.senseRate)
        : null

    const relevance = round(sense === null ? context : 0.5 * context + 0.5 * sense)

    const confidence = row.threads / (row.threads + 3)

    const components = {
      volume: round(volumeScale(Math.log1p(row.threads))),
      engagement: round(engagementScale(Math.log1p(row.engagementMedian)) * confidence),
      recency: round(0.6 * row.share90 + 0.4 * row.share30),
      brandShare: row.brandShare === null ? null : round(clamp(row.brandShare / 0.05)),
      velocity: row.velocity === null ? null : round(velocityComponent(row.velocity)),
      consistency: row.consistency,
      depth: round(depthScale(Math.log1p(row.repliesPerThread)) * confidence),
      size: row.subscribers ? round(clamp(Math.log10(row.subscribers) / 7)) : null,
    }

    let weighted = 0
    let available = 0
    for (const [key, weight] of Object.entries(WEIGHTS)) {
      if (components[key] === null) continue
      weighted += weight * components[key]
      available += weight
    }
    const base = available ? weighted / available : 0

    const gate = round(0.25 + 0.75 * relevance)

    return {
      ...row,
      relevance,
      relevanceRaw: row.threads ? round(row.relevantThreads / row.threads) : 0,
      senseRaw: senseEvidence ? round(row.brandSense / senseEvidence) : null,
      relevanceParts: { context: round(context), sense: sense === null ? null : round(sense) },
      components,
      gate,
      score: round(100 * base * gate, 1),
    }
  })
}

function categorise(row, stats) {
  const badges = []

  const nameMatchesBrand = stats.brandTokens.some((token) =>
    row.name.toLowerCase().includes(token),
  )
  if (nameMatchesBrand || row.brandShare >= 0.15 || (row.relevance >= 0.7 && row.threads >= 3)) {
    badges.push({ id: 'relevant', label: '🎯 Highly Relevant', why: nameMatchesBrand
      ? 'community is named after the brand'
      : `${Math.round(row.relevanceRaw * 100)}% of threads sit in the brand's own vocabulary` })
  }
  if (row.recent30 >= 5 && row.share30 >= 0.2) {
    badges.push({ id: 'hot', label: '🔥 Hot', why: `${row.recent30} items in the last 30 days` })
  }
  if (row.velocity !== null && row.velocity >= 1.6 && row.recent30 >= 4) {
    badges.push({ id: 'trending', label: '📈 Trending', why: `×${row.velocity} vs the previous 30 days` })
  }
  if (row.threads >= 3 && row.repliesPerThread >= Math.max(8, stats.medianRepliesPerThread * 1.4)) {
    badges.push({ id: 'discussion', label: '💬 High Discussion Volume', why: `median ${row.repliesPerThread} replies per brand thread` })
  }
  if (row.subscribers >= 250_000 && row.relevance >= 0.5) {
    badges.push({ id: 'large', label: '👥 Large Relevant Community', why: `${Math.round(row.subscribers / 1000)}k members and on-topic` })
  }
  if (row.geo) {
    badges.push({ id: 'geo', label: '🌍 Geographic Relevance', why: 'a place-based community, not a topic one' })
  }
  if (row.activeMonths >= 6 && row.items >= 10) {
    badges.push({ id: 'consistent', label: '⭐ Consistently Important', why: `brand talk in ${row.activeMonths} of the last 12 months` })
  }

  return badges
}

const STATUS_ORDER = ['hot', 'trending', 'consistent', 'discussion']
const STATUS_LABEL = {
  hot: '🔥 Hot',
  trending: '📈 Trending',
  consistent: '⭐ Steady',
  discussion: '💬 Active',
}

function buzzStatus(badges, row) {
  for (const id of STATUS_ORDER) {
    if (badges.some((badge) => badge.id === id)) return STATUS_LABEL[id]
  }
  return row.newestAgeDays !== null && row.newestAgeDays > 180 ? '💤 Dormant' : '· Low activity'
}

function whyItMatters(row, stats) {
  const clauses = []

  clauses.push(
    `${row.threads} brand thread${row.threads === 1 ? '' : 's'}` +
      (row.comments ? ` and ${row.comments} comments` : ''),
  )

  if (row.brandShare !== null && row.brandShare >= 0.02) {
    clauses.push(`${(row.brandShare * 100).toFixed(1)}% of everything posted here`)
  } else if (row.relevance >= 0.6 && row.threads >= 3) {
    clauses.push(`${Math.round(row.relevance * 100)}% on-topic`)
  }

  if (row.share90 >= 0.4) clauses.push(`${Math.round(row.share90 * 100)}% from the last 90 days`)
  if (row.velocity !== null && row.velocity >= 1.5) clauses.push(`accelerating (×${row.velocity})`)
  if (row.engagementMedian >= stats.medianEngagement * 1.3) {
    clauses.push(`median engagement ${row.engagementMedian}`)
  }
  if (row.subscribers) clauses.push(`${formatMembers(row.subscribers)} members`)

  return clauses.join(' · ')
}

function formatMembers(count) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`
  return String(count)
}

function keySignals(row) {
  const signals = [
    `${row.items} items`,
    `${row.recent30} in 30d`,
    row.velocity !== null ? `×${row.velocity} vs prior 30d` : 'trend: sample too shallow',
    `eng ${row.engagementMedian}`,
    row.brandShare !== null ? `${(row.brandShare * 100).toFixed(1)}% of sub` : 'sub rate unknown',
    `rel ${Math.round(row.relevance * 100)}%`,
    row.subscribers ? `${formatMembers(row.subscribers)} subs` : 'size unknown',
  ]
  return signals.join(' · ')
}

export function rankCommunities({
  posts,
  communities = [],
  brand,
  brandContext,
  history,
  now = Date.now(),
  // A field corpus has no brand to match: the posts are about the market and
  // its other companies. Filtering them by the field's name would discard the
  // lot, so every post counts and the ranking is by activity alone.
  matchAll = false,
}) {
  if (!posts?.length) {
    return {
      brand,
      ranked: [],
      top: [],
      emerging: [],
      excluded: [],
      context: { aliases: [], contextTerms: [], geoTerms: [] },
      discovery: { viaExpansion: [], nonObvious: [], geographic: [], contexts: [], aliases: [] },
      weights: WEIGHTS,
      coverage: { items: 0, communities: 0, ranked: 0, excluded: 0 },
    }
  }

  const context =
    brandContext?.contextTerms?.length
      ? {
          aliases: brandContext.aliases || [],
          contextTerms: brandContext.contextTerms,
          facets: brandContext.facets || [],
          geoTerms: brandContext.geoTerms || [],
          anchors: brandContext.anchors,
        }
      : deriveBrandContext(posts, brand, communities)

  const aliasList = context.aliases.map((entry) => entry.alias || entry)
  const matchesBrand = matchAll ? () => true : buildBrandMatcher(brand, aliasList)
  const geoTerms = new Set(context.geoTerms)

  const contextRegexes = context.contextTerms
    .slice(0, 18)
    .map(({ term }) => new RegExp(`\\b${escapeRegex(term)}\\b`, 'i'))

  const metaByName = new Map(communities.filter((c) => c?.name).map((c) => [c.name, c]))
  const senseOf = matchAll ? () => 'brand' : makeSenseClassifier(brand)

  const measured = measureCommunities({
    posts,
    metaByName,
    matchesBrand,
    senseOf,
    capitalisationOf: matchAll ? () => 'brand' : makeCapitalisationTest(brand),
    otherSenseTellOf: matchAll ? () => false : makeOtherSenseTell(brand),
    contextRegexes,
    geoTerms,
    now,
    history,
  })
  if (!measured.length) {
    return {
      brand,
      ranked: [],
      top: [],
      emerging: [],
      excluded: [],
      context,
      discovery: { viaExpansion: [], nonObvious: [], geographic: [], contexts: [], aliases: [] },
      weights: WEIGHTS,
      coverage: { items: posts.length, communities: 0, ranked: 0, excluded: 0 },
    }
  }

  const sum = (key) => measured.reduce((total, row) => total + row[key], 0)
  const corpusThreads = sum('threads')
  const brandSense = sum('brandSense')
  const otherSense = sum('otherSense')
  const senseEvidence = brandSense + otherSense

  const tokens = brandTokens(brand)
  const own = measured.filter((row) => tokens.some((token) => row.name.toLowerCase().includes(token)))
  const ownCap = own.reduce((total, row) => total + row.capBrand, 0)
  const ownEvidence = ownCap + own.reduce((total, row) => total + row.capOther, 0)

  const corpus = {
    contextRate: corpusThreads ? sum('relevantThreads') / corpusThreads : 0.5,
    senseRate: senseEvidence ? brandSense / senseEvidence : 0.5,
    senseUsable:
      ownEvidence >= 8
        ? ownCap / ownEvidence >= 0.5
        : senseEvidence >= 20 && brandSense / senseEvidence >= 0.25,
  }

  const scored = scoreCommunities(measured, corpus)

  const stats = {
    brandTokens: brandTokens(brand),
    medianEngagement: Math.max(1, median(scored.map((row) => row.engagementMedian))),
    medianRepliesPerThread: Math.max(1, median(scored.map((row) => row.repliesPerThread))),
  }

  const excluded = []
  const eligible = []
  for (const row of scored) {
    const senseEvidenceHere = row.brandSense + row.otherSense
    const senseVerdict =
      corpus.senseUsable && senseEvidenceHere >= 5 && row.senseRaw !== null ? row.senseRaw : null

    if (row.threads >= 5 && row.relevanceRaw < 0.2 && !(senseVerdict >= 0.6)) {
      excluded.push({
        name: row.name,
        items: row.items,
        test: 'vocabulary',
        reason: `${row.threads} threads name "${brand}" but ${row.threads - row.relevantThreads} share none of its context vocabulary - likely a different sense of the word`,
      })
      continue
    }
    if (corpus.senseUsable && senseEvidenceHere >= 5 && row.senseRaw !== null && row.senseRaw < 0.2) {
      excluded.push({
        name: row.name,
        items: row.items,
        test: 'sense',
        reason: `"${brand}" is written in lower case in ${row.otherSense} of ${row.brandSense + row.otherSense} threads here - the ordinary word, not the brand`,
      })
      continue
    }
    if (row.items < 3) continue
    eligible.push(row)
  }

  const ranked = eligible
    .map((row) => {
      const badges = categorise(row, stats)
      return {
        name: row.name,
        score: row.score,
        relevance: row.relevance,
        relevanceParts: row.relevanceParts,
        badges,
        buzzStatus: buzzStatus(badges, row),
        discussionType: row.discussionType,
        why: whyItMatters(row, stats),
        keySignals: keySignals(row),
        discoveredVia: row.discoveredVia,
        signals: {
          items: row.items,
          threads: row.threads,
          comments: row.comments,
          recent30: row.recent30,
          prior30: row.prior30,
          share90: row.share90,
          velocity: row.velocity,
          velocitySource: row.velocitySource,
          arrivalRate: row.arrivalRate,
          engagementMedian: row.engagementMedian,
          commentsPerThread: row.commentsPerThread,
          medianCommentChars: row.medianCommentChars,
          brandShare: row.brandShare,
          subscribers: row.subscribers,
          activeUsers: row.activeUsers,
          activeMonths: row.activeMonths,
          consistency: row.consistency,
          medianAgeDays: row.medianAgeDays,
          newestAgeDays: row.newestAgeDays,
          relevanceRaw: row.relevanceRaw,
          avgSentiment: row.avgSentiment,
          sentiment: row.sentiment,
        },
        components: row.components,
        topics: row.topics.slice(0, 3),
        examples: row.examples,
        title: row.title,
        geo: row.geo,
      }
    })
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }))

  const topNames = new Set(ranked.slice(0, 5).map((row) => row.name))
  const emerging = ranked
    .filter((row) => !topNames.has(row.name))
    .filter((row) => {
      const young = row.signals.medianAgeDays <= 60 && row.signals.items >= 3
      const accelerating = row.signals.velocity !== null && row.signals.velocity >= 1.8 && row.signals.recent30 >= 3
      return young || accelerating
    })
    .sort((a, b) => (b.signals.velocity ?? 1) - (a.signals.velocity ?? 1) || b.score - a.score)
    .slice(0, 6)

  return {
    brand,
    ranked,
    top: ranked.slice(0, 5),
    emerging,
    excluded,
    context,
    discovery: discoveryInsights(ranked, context, brand),
    weights: WEIGHTS,
    relevanceGate: { usesSense: corpus.senseUsable, corpusSenseRate: round(corpus.senseRate) },
    coverage: {
      items: posts.length,
      communities: measured.length,
      ranked: ranked.length,
      excluded: excluded.length,
      oldest: Math.min(...posts.map((post) => post.timestamp)),
      newest: Math.max(...posts.map((post) => post.timestamp)),
    },
  }
}

function discoveryInsights(ranked, context, brand) {
  const tokens = brandTokens(brand)
  const viaExpansion = ranked.filter(
    (row) =>
      row.discoveredVia.length &&
      !row.discoveredVia.includes('global') &&
      !row.discoveredVia.includes('named'),
  )

  const nonObvious = ranked
    .filter((row) => !tokens.some((token) => row.name.toLowerCase().includes(token)))
    .filter((row) => row.relevance >= 0.5 && row.signals.items >= 5)

  return {
    viaExpansion: viaExpansion.slice(0, 8).map((row) => ({
      name: row.name,
      via: row.discoveredVia,
      items: row.signals.items,
      rank: row.rank,
    })),
    nonObvious: nonObvious.slice(0, 8).map((row) => ({
      name: row.name,
      rank: row.rank,
      items: row.signals.items,
      discussionType: row.discussionType,
    })),
    geographic: ranked
      .filter((row) => row.geo)
      .slice(0, 6)
      .map((row) => ({ name: row.name, rank: row.rank, items: row.signals.items })),
    contexts: context.contextTerms.slice(0, 12),
    aliases: context.aliases,
  }
}

export const BUZZ_WEIGHTS = WEIGHTS

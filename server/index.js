import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  buildInsights,
  deriveBrandContext,
  displayName,
  enrichPosts,
  filterRelevantPosts,
  makeRelevanceTest,
  rankCommunities,
  threadIdFromPermalink,
} from './analysis.js'
import {
  aboutnessProgress,
  brandContext,
  brandIdentity,
  cachedComparisons,
  saveComparisons,
  cachedNamedComparison,
  saveNamedComparison,
  cachedVoiceRead,
  saveVoiceRead,
  cachedTrending,
  saveTrending,
  cachedProductComparison,
  saveProductComparison,
  collectionStats,
  countPosts,
  knownIds,
  lastRun,
  listCompanies,
  listRecommendations,
  migrateLegacyJson,
  reviewRecommendation,
  collectedCommentPermalinks,
  deletePosts,
  markAboutChecked,
  markCommentsChecked,
  savePosts,
  saveBrandContext,
  saveBrandIdentity,
  saveSnapshot,
  saveSubredditRules,
  saveSubreddits,
  selectPosts,
  selectPostsPage,
  staleRuleTargets,
  subredditBreakdown,
  subredditMeta,
} from './db.js'
import { scoreThreads, selectForDeepCollection } from '../src/analysis/importance.js'
import { dropContentFree } from '../src/analysis/text.js'
import { assessPromoRisk } from './intelligence/compliance.js'
import { classifyAboutness } from './intelligence/relevance.js'
import { heuristicIdentity, resolveBrand } from './intelligence/resolve.js'
import { runIntelligence, snapshotHistory } from './intelligence/pipeline.js'
import { buildSearchPlan, mergeQueries } from './intelligence/searchPlan.js'
import { compareAgainstCompetitors } from './intelligence/comparison.js'
import { compareWithNamed } from './intelligence/namedComparison.js'
import { readVoice } from './intelligence/voice.js'
import { refineTrending } from './intelligence/trending.js'
import { compareProducts } from './intelligence/productComparison.js'
import { extractTrendingPhrases } from '../src/analysis/topics.js'
import { tokenize } from '../src/analysis/sentiment.js'
import { catalogue, credentialContext, siteReady, testConnection } from './connection.js'

const IDENTITY_MAX_AGE = 90 * 24 * 60 * 60 * 1000

const app = express()
const PORT = Number(process.env.PORT) || 3001
const DAY_MS = 24 * 60 * 60 * 1000
const POSTS_PAGE_SIZE = 40

app.set('trust proxy', 1)

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((entry) => entry.trim().replace(/\/$/, ''))
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const clean = origin.replace(/\/$/, '')
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean)
      const isExtension = /^chrome-extension:\/\/[a-z]+$/.test(clean)
      const isAllowed = ALLOWED_ORIGINS.includes(clean)
      callback(null, isLocalhost || isExtension || isAllowed)
    },
  }),
)
app.use(express.json({ limit: '100mb' }))
app.use(credentialContext)

const migrated = migrateLegacyJson(enrichPosts)
if (migrated?.length) {
  console.log(`Migrated from JSON into SQLite: ${migrated.join(', ')}`)
}

app.get('/api/ping', (req, res) => res.json({ status: 'ok' }))

app.get('/api/providers', async (req, res) => {
  res.json({ ...catalogue(), siteReady: await siteReady() })
})

app.post('/api/providers/test', async (req, res) => {
  res.json(await testConnection(req.body || {}))
})

app.post('/api/ingest', async (req, res) => {
  const { company, posts, subreddits, brandContext: context, rules, phase = 'discovery' } = req.body || {}

  if (!company || typeof company !== 'string' || !company.trim()) {
    return res.status(400).json({ error: 'Expected a non-empty "company" string in the body' })
  }
  if (!Array.isArray(posts)) {
    return res.status(400).json({ error: 'Expected "posts" to be an array' })
  }

  const started = Date.now()

  const readable = dropContentFree(posts)
  const heuristically = filterRelevantPosts(readable, company)

  let identity = brandIdentity(company)
  const stale =
    !identity ||
    identity.category === undefined ||
    Date.now() - identity.updatedAt > IDENTITY_MAX_AGE
  if (!identity) {
    identity = { ...heuristicIdentity(company, heuristically, Array.isArray(subreddits) ? subreddits : []), source: 'heuristic' }
  }
  if (stale) {
    resolveBrand(company, heuristically, Array.isArray(subreddits) ? subreddits : [])
      .then((resolved) => saveBrandIdentity(company, resolved.identity, { source: resolved.source, model: resolved.model }))
      .catch((error) => console.warn(`[ingest] identity resolution failed for ${company}:`, error.message))
  }
  const relevanceOf = makeRelevanceTest(company, identity)
  const relevant = filterByRelevance(heuristically, relevanceOf)

  const enriched = enrichPosts(relevant, displayName(company), {
    knownBrands: resolvedMarket(company).competitors,
  })
  const total = savePosts(company, enriched)

  if (Array.isArray(subreddits)) saveSubreddits(company, subreddits)
  if (context) saveBrandContext(company, context)

  if (Array.isArray(rules) && rules.length) {
    saveSubredditRules(
      rules.map((entry) => ({ ...entry, promoRisk: assessPromoRisk(entry).promoRisk })),
    )
  }

  if (phase === 'discovery') {
    saveSnapshot(company, snapshotRows(company))
  }

  console.log(
    `ingest ${company} [${phase}]: +${enriched.length} items (${total} total), ` +
      `${posts.length - readable.length} content-free dropped, in ${Date.now() - started}ms`,
  )
  res.json({ ok: true, phase, received: posts.length, stored: enriched.length, total })

  ensureAboutnessPass(company)
})

const passesInFlight = new Map()
function ensureAboutnessPass(company) {
  const key = String(company).trim().toLowerCase()
  if (passesInFlight.has(key)) return passesInFlight.get(key)

  const run = runAboutnessPass(key)
    .catch((error) => console.warn(`[aboutness] pass failed for ${key}:`, error.message))
    .finally(() => passesInFlight.delete(key))

  passesInFlight.set(key, run)
  return run
}

async function runAboutnessPass(company) {
  const pending = selectPosts(company, { type: 'post', aboutChecked: 0 })
  if (!pending.length) {
    markCommentsChecked(company)
    return
  }

  const started = Date.now()
  const offTopicIds = new Set()
  let kept = 0

  await classifyAboutness(company, pending, {
    identity: brandIdentity(company),
    onBatch: (batchVerdicts) => {
      const onTopicIds = []
      for (const [id, onTopic] of batchVerdicts) {
        if (onTopic === false) offTopicIds.add(id)
        else onTopicIds.push(id)
      }
      if (onTopicIds.length) {
        kept += onTopicIds.length
        markAboutChecked(company, onTopicIds)
      }
    },
  })

  if (!offTopicIds.size) {
    markCommentsChecked(company)
    console.log(`[aboutness] ${company}: all ${pending.length} clear (${Date.now() - started}ms)`)
    return
  }

  if (!kept) {
    markAboutChecked(company, [...offTopicIds])
    markCommentsChecked(company)
    console.warn(
      `[aboutness] ${company}: every one of ${pending.length} threads was judged off-topic, ` +
        'so none were removed. A total prune points at a wrong brand identity rather than an ' +
        'irrelevant corpus, and an empty report tells the reader nothing.',
    )
    return
  }

  deletePosts(company, [...offTopicIds])

  const comments = selectPosts(company, { type: 'comment', includeUnchecked: true })
  const orphanIds = comments
    .filter((post) => offTopicIds.has(threadIdFromPermalink(post.permalink)))
    .map((post) => post.id)
  if (orphanIds.length) deletePosts(company, orphanIds)

  const released = markCommentsChecked(company)

  console.log(
    `[aboutness] ${company}: kept ${kept}, pruned ${offTopicIds.size} thread(s) + ` +
      `${orphanIds.length} comment(s), released ${released} comment(s) (${Date.now() - started}ms)`,
  )
}

function filterByRelevance(posts, relevanceOf) {
  const threadsById = new Map()
  for (const post of posts) {
    if (post.type === 'post') threadsById.set(post.id, post)
  }

  const passes = (post) => relevanceOf(post).relevance > 0

  return posts.filter((post) => {
    if (post.type === 'post') return passes(post)
    const parent = threadsById.get(threadIdFromPermalink(post.permalink))
    return (parent && passes(parent)) || passes(post)
  })
}

function resolvedMarket(company) {
  const identity = brandIdentity(company) || {}
  const roster = (identity.competitors || []).filter((entry) => entry?.name)
  const competitors = (identity.competitors || [])
    .flatMap((entry) => [entry?.name, ...(entry?.aliases || [])])
    .map((name) => String(name || '').trim())
    .filter(Boolean)

  const category = String(identity.category || identity.industry || '').trim()

  return {
    category: category || null,
    industry: String(identity.industry || '').trim() || null,
    competitors,
    roster,
    source: identity.source || null,
  }
}

function snapshotRows(company) {
  return subredditBreakdown(company).map((row) => ({
    scope: 'community',
    key: row.name,
    threads: row.posts ?? 0,
    comments: row.comments ?? 0,
    scoreSum: row.upvotes ?? 0,
    members: row.subscribers ?? null,
  }))
}

app.get('/api/collection-plan', (req, res) => {
  const { company, limit } = req.query
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }

  const posts = selectPosts(company, { includeUnchecked: true })
  if (!posts.length) return res.json({ threads: [], rules: [] })

  const communities = subredditMeta(company)
  const ranking = rankCommunities({
    posts,
    communities,
    brand: String(company).trim().toLowerCase(),
    history: snapshotHistory(company),
  })

  const identity = brandIdentity(company) || {}
  const scored = scoreThreads({
    threads: posts,
    brand: String(company).trim().toLowerCase(),
    identity,
    communityScores: new Map(ranking.ranked.map((row) => [row.name, row.score])),
  })

  const alreadyRead = new Set(
    collectedCommentPermalinks(company).map(threadIdFromPermalink).filter(Boolean),
  )
  const REFRESH_DAYS = 2
  const unread = scored.filter(
    (entry) => !alreadyRead.has(entry.id) || entry.ageDays <= REFRESH_DAYS,
  )

  const chosen = selectForDeepCollection(unread, { limit: Number(limit) || 32 })
  const byId = new Map(posts.map((post) => [post.id, post]))

  const topCommunities = ranking.ranked.slice(0, 6).map((row) => row.name)

  res.json({
    threads: chosen.map((entry) => {
      const post = byId.get(entry.id)
      return {
        id: post.id,
        permalink: post.permalink,
        subreddit: post.subreddit,
        title: post.title,
        body: post.body,
        author: post.author,
        score: post.score,
        numComments: post.numComments,
        createdAt: post.createdAt,
        url: post.url,
        type: 'post',
        prescore: entry.prescore,
      }
    }),
    rules: staleRuleTargets(topCommunities),
    considered: scored.length,
  })
})

app.post('/api/understand', (req, res) => {
  const { company, posts, alreadySearched } = req.body || {}
  if (!company || !Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: 'Expected "company" and a non-empty "posts" array' })
  }

  const started = Date.now()
  const searched = Array.isArray(alreadySearched) ? alreadySearched : []
  const enriched = enrichPosts(posts, displayName(company))
  const context = deriveBrandContext(enriched, company.trim().toLowerCase(), [], {
    alreadySearched: searched,
  })

  const identity = brandIdentity(company) || {}
  const planned = buildSearchPlan(company, identity, { alreadySearched: searched })
  const queries = mergeQueries(planned, context.queries)

  console.log(
    `understand ${company}: ${context.facets.length} facets ` +
      `(${context.facets.map((f) => f.label).join(', ')}), ${context.aliases.length} aliases, ` +
      `${planned.length} identity queries (${planned.map((q) => q.kind).join('/') || 'none'}) ` +
      `from ${posts.length} posts in ${Date.now() - started}ms`,
  )

  res.json({
    ...context,
    queries,
    market: {
      industry: identity.industry || null,
      category: identity.category || null,
      competitors: (identity.competitors || []).map((entry) => entry.name).filter(Boolean),
    },
  })
})

app.get('/api/analysis-status', (req, res) => {
  const company = req.query.company
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }

  const key = String(company).trim().toLowerCase()
  const { checked, pending } = aboutnessProgress(company)

  if (pending > 0 && !passesInFlight.has(key)) ensureAboutnessPass(key)

  const running = passesInFlight.has(key)

  res.json({
    checked,
    pending,
    running,
    analysing: running || pending > 0,
    total: checked + pending,
  })
})

app.get('/api/known-ids', (req, res) => {
  const company = req.query.company
  if (!company) return res.status(400).json({ error: 'Missing "company" query parameter' })
  res.json({ ids: knownIds(company) })
})

const INGESTION_FRESH_MS = Number(process.env.INGESTION_FRESH_MS) || 12 * 60 * 60 * 1000

app.get('/api/freshness', (req, res) => {
  const company = req.query.company
  if (!company) return res.status(400).json({ error: 'Missing "company" query parameter' })

  const postCount = countPosts(company)
  const run = lastRun(company)
  const age = run?.lastRunAt ? Date.now() - run.lastRunAt : null

  res.json({
    exists: postCount > 0,
    postCount,
    lastRunAt: run?.lastRunAt ?? null,
    lastCount: run?.lastCount ?? 0,
    freshForMs: INGESTION_FRESH_MS,
    stale: age === null || age > INGESTION_FRESH_MS,
  })
})

app.get('/api/companies', (req, res) => {
  res.json({ companies: listCompanies() })
})

app.get('/api/report', (req, res) => {
  const { company, subreddit, sentiment, topic, type, days, offset } = req.query
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }

  if (countPosts(company) === 0) {
    return res.status(404).json({
      error: `No Reddit data has been collected for "${String(company).trim()}" yet.`,
    })
  }

  ensureAboutnessPass(company)

  const filters = {
    subreddit,
    sentiment,
    topic,
    type,
    since: days && days !== 'all' ? Date.now() - Number(days) * DAY_MS : undefined,
  }

  const started = Date.now()
  const market = resolvedMarket(company)
  const label = displayName(company)

  let analysing = false
  let all = selectPosts(company, {})
  let filtered = selectPosts(company, filters)

  if (all.length === 0) {
    analysing = true
    all = selectPosts(company, { includeUnchecked: true })
    filtered = selectPosts(company, { ...filters, includeUnchecked: true })
  }

  const insights = buildInsights(filtered, label, {
    market: market.category,
    roster: market.roster,
  })

  const baseInsights = buildInsights(all, label, {
    market: market.category,
    roster: market.roster,
  })

  const start = Number(offset) || 0
  const page = filtered.slice(start, start + POSTS_PAGE_SIZE)

  res.json({
    company: label,
    insights,
    filterOptions: {
      subreddits: baseInsights.subreddits,
      topics: baseInsights.topics,
    },
    subredditMeta: subredditMeta(company),
    market: { ...market, roster: undefined },
    analysing,
    posts: page,
    total: filtered.length,
    totalUnfiltered: all.length,
    nextOffset: start + page.length < filtered.length ? start + page.length : null,
    computedInMs: Date.now() - started,
  })
})

app.get('/api/buzz', (req, res) => {
  const { company } = req.query
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }

  const name = String(company).trim()
  if (countPosts(name) === 0) {
    return res.status(404).json({
      error: `No Reddit data has been collected for "${name}" yet.`,
      needsCollection: true,
    })
  }

  const started = Date.now()
  const posts = selectPosts(name, {})
  const stored = brandContext(name)

  const result = rankCommunities({
    posts,
    communities: subredditMeta(name),
    brand: name.toLowerCase(),
    brandContext: stored,
    history: snapshotHistory(name),
  })

  const run = lastRun(name)
  res.json({
    ...result,
    brand: displayName(name),
    contextSource: stored?.contextTerms?.length ? 'collector' : 'derived',
    lastRunAt: run?.lastRunAt ?? null,
    stale: run?.lastRunAt ? Date.now() - run.lastRunAt > 7 * DAY_MS : true,
    computedInMs: Date.now() - started,
  })
})

app.post('/api/intelligence', async (req, res) => {
  const { company, force, limit } = req.body || {}
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Expected a "company" in the body' })
  }

  try {
    const result = await runIntelligence(String(company).trim(), {
      force: Boolean(force),
      limit: Number(limit) || 60,
      onProgress: (message) => console.log(`  intelligence ${company}: ${message}`),
    })
    console.log(
      `intelligence ${company}: ${result.stats.selected} candidates, ` +
        `${result.stats.llmAnalysed} via LLM, ${result.recommendations} recommendations ` +
        `(${result.blocked} blocked) in ${result.tookMs}ms`,
    )
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

const comparisonsInFlight = new Map()

app.get('/api/comparisons', async (req, res) => {
  const company = req.query.company
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }

  const corpus = countPosts(company)
  if (corpus === 0) {
    return res.status(404).json({ error: `No Reddit data has been collected for "${company}" yet.` })
  }

  const cached = cachedComparisons(company)
  const refresh = req.query.refresh === 'true'
  const GROWTH = 1.15

  if (cached && !refresh && cached.source === 'llm' && corpus < cached.corpus * GROWTH) {
    return res.json({ ...cached, cached: true })
  }

  const key = String(company).trim().toLowerCase()
  if (comparisonsInFlight.has(key)) return res.json(await comparisonsInFlight.get(key))

  const identity = brandIdentity(company) || {}
  const run = (async () => {
    const started = Date.now()
    const posts = selectPosts(company, {})
    const result = await compareAgainstCompetitors(company, posts, identity)
    saveComparisons(company, result, corpus)
    console.log(
      `comparisons ${company}: ${result.comparisons.length} head-to-heads from ` +
        `${result.coverage.reduce((sum, row) => sum + row.excerpts, 0)} excerpts ` +
        `(${result.source}) in ${Date.now() - started}ms`,
    )
    return { ...result, corpus, cached: false }
  })()
    .finally(() => comparisonsInFlight.delete(key))

  comparisonsInFlight.set(key, run)

  try {
    res.json(await run)
  } catch (error) {
    console.warn(`[comparisons] ${company} failed:`, error.message)
    res.status(500).json({ error: 'Could not read the comparisons for this company.' })
  }
})

const namedInFlight = new Map()

app.get('/api/comparisons/named', async (req, res) => {
  const { company, against } = req.query
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }
  if (!against || !String(against).trim()) {
    return res.status(400).json({ error: 'Missing "against" query parameter' })
  }

  const target = String(against).trim().slice(0, 80)
  const corpus = countPosts(company)
  if (corpus === 0) {
    return res.status(404).json({ error: `No Reddit data has been collected for "${company}" yet.` })
  }

  const cached = cachedNamedComparison(company, target)
  const refresh = req.query.refresh === 'true'
  const GROWTH = 1.15

  if (cached && !refresh && cached.source === 'llm' && corpus < cached.corpus * GROWTH) {
    return res.json({ ...cached, cached: true })
  }

  const key = `${String(company).trim().toLowerCase()}::${target.toLowerCase()}`
  if (namedInFlight.has(key)) return res.json(await namedInFlight.get(key))

  const identity = brandIdentity(company) || {}
  const run = (async () => {
    const started = Date.now()
    const posts = selectPosts(company, {})
    const result = await compareWithNamed(String(company).trim(), posts, identity, target)
    saveNamedComparison(company, target, result, corpus)
    console.log(
      `named comparison ${company} vs ${target}: ${result.source} ` +
        `(${result.coverage?.headToHead ?? 0} head-to-head excerpts) in ${Date.now() - started}ms`,
    )
    return { ...result, corpus, cached: false }
  })().finally(() => namedInFlight.delete(key))

  namedInFlight.set(key, run)

  try {
    res.json(await run)
  } catch (error) {
    console.warn(`[named comparison] ${company} vs ${target} failed:`, error.message)
    res.status(500).json({ error: 'Could not read that comparison.' })
  }
})

const voiceInFlight = new Map()

app.get('/api/voice', async (req, res) => {
  const { company, subject } = req.query
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }
  if (!subject || !String(subject).trim()) {
    return res.status(400).json({ error: 'Missing "subject" query parameter' })
  }

  const asked = String(subject).trim().slice(0, 200)
  const corpus = countPosts(company)
  if (corpus === 0) {
    return res.status(404).json({ error: `No Reddit data has been collected for "${company}" yet.` })
  }

  const cached = cachedVoiceRead(company, asked)
  const refresh = req.query.refresh === 'true'
  const GROWTH = 1.15

  if (cached && !refresh && cached.source === 'llm' && corpus < cached.corpus * GROWTH) {
    return res.json({ ...cached, cached: true })
  }

  const key = `${String(company).trim().toLowerCase()}::${asked.toLowerCase()}`
  if (voiceInFlight.has(key)) return res.json(await voiceInFlight.get(key))

  const identity = brandIdentity(company) || {}
  const run = (async () => {
    const started = Date.now()
    const posts = selectPosts(company, {})
    const result = await readVoice(String(company).trim(), posts, identity, asked)
    saveVoiceRead(company, asked, result, corpus)
    console.log(
      `voice ${company} "${asked}": ${result.source} ` +
        `(${result.coverage?.matched ?? 0} matching excerpts) in ${Date.now() - started}ms`,
    )
    return { ...result, corpus, cached: false }
  })().finally(() => voiceInFlight.delete(key))

  voiceInFlight.set(key, run)

  try {
    res.json(await run)
  } catch (error) {
    console.warn(`[voice] ${company} "${asked}" failed:`, error.message)
    res.status(500).json({ error: 'Could not read that question.' })
  }
})

const trendingInFlight = new Map()

app.get('/api/trending', async (req, res) => {
  const company = req.query.company
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }

  const corpus = countPosts(company)
  if (corpus === 0) {
    return res.status(404).json({ error: `No Reddit data has been collected for "${company}" yet.` })
  }

  const cached = cachedTrending(company)
  const refresh = req.query.refresh === 'true'
  const GROWTH = 1.15

  if (cached && !refresh && cached.source === 'llm' && corpus < cached.corpus * GROWTH) {
    return res.json({ ...cached, cached: true })
  }

  const key = String(company).trim().toLowerCase()
  if (trendingInFlight.has(key)) return res.json(await trendingInFlight.get(key))

  const identity = brandIdentity(company) || {}
  const run = (async () => {
    const started = Date.now()
    const posts = selectPosts(company, {})
    const label = displayName(company)

    const candidates = extractTrendingPhrases(
      posts.map((post) => post.text || [post.title, post.body].filter(Boolean).join('. ')),
      {
        limit: 40,
        minCount: Math.max(2, Math.round(posts.length * 0.02)),
        exclude: tokenize(label),
      },
    )

    const result = await refineTrending(String(company).trim(), candidates, posts, identity)
    saveTrending(company, result, corpus)
    console.log(
      `trending ${company}: ${result.themes.length} kept from ${candidates.length} candidates ` +
        `(${result.source}) in ${Date.now() - started}ms`,
    )
    return { ...result, candidates: candidates.length, corpus, cached: false }
  })().finally(() => trendingInFlight.delete(key))

  trendingInFlight.set(key, run)

  try {
    res.json(await run)
  } catch (error) {
    console.warn(`[trending] ${company} failed:`, error.message)
    res.status(500).json({ error: 'Could not read the trending themes.' })
  }
})

const productInFlight = new Map()

app.get('/api/comparisons/product', async (req, res) => {
  const { company, mine, theirs, rivalCompany } = req.query
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }
  if (!mine || !String(mine).trim()) {
    return res.status(400).json({ error: 'Missing "mine" query parameter' })
  }

  const own = String(mine).trim().slice(0, 120)
  const rival = String(theirs || '').trim().slice(0, 120)
  const rivalBrand = String(rivalCompany || '').trim().slice(0, 120)

  const corpus = countPosts(company)
  if (corpus === 0) {
    return res.status(404).json({ error: `No Reddit data has been collected for "${company}" yet.` })
  }

  const cacheKey = rival || `@${rivalBrand}`
  const cached = cachedProductComparison(company, own, cacheKey)
  const refresh = req.query.refresh === 'true'
  const GROWTH = 1.15

  if (cached && !refresh && cached.source === 'llm' && corpus < cached.corpus * GROWTH) {
    return res.json({ ...cached, cached: true })
  }

  const key = `${String(company).trim().toLowerCase()}::${own.toLowerCase()}::${cacheKey.toLowerCase()}`
  if (productInFlight.has(key)) return res.json(await productInFlight.get(key))

  const identity = brandIdentity(company) || {}
  const run = (async () => {
    const started = Date.now()
    const posts = selectPosts(company, {})
    const result = await compareProducts(
      String(company).trim(),
      posts,
      identity,
      own,
      rival,
      rivalBrand,
    )
    saveProductComparison(company, own, cacheKey, result, corpus)
    console.log(
      `product comparison ${company}: "${own}" vs "${rival || result.products?.theirs?.name || rivalBrand}" — ${result.source} ` +
        `(${result.coverage?.headToHead ?? 0} head-to-head excerpts) in ${Date.now() - started}ms`,
    )
    return { ...result, corpus, cached: false }
  })().finally(() => productInFlight.delete(key))

  productInFlight.set(key, run)

  try {
    res.json(await run)
  } catch (error) {
    console.warn(`[product comparison] ${company} failed:`, error.message)
    res.status(500).json({ error: 'Could not read that product comparison.' })
  }
})

app.get('/api/recommendations', (req, res) => {
  const { company, status } = req.query
  if (!company) return res.status(400).json({ error: 'Missing "company" query parameter' })

  const rows = listRecommendations(company, { status })
  res.json({
    company: displayName(company),
    recommendations: rows,
    counts: rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {}),
  })
})

app.post('/api/recommendations/:id/review', (req, res) => {
  const { status, note } = req.body || {}
  try {
    const result = reviewRecommendation(req.params.id, { status, note })
    if (!result) return res.status(404).json({ error: 'No such recommendation' })
    if (result.unchanged) {
      return res.status(409).json({
        error: 'This recommendation is blocked by the community\'s own rules and cannot be approved.',
        status: 'blocked',
      })
    }
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/results', (req, res) => {
  const company = req.query.company
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }

  if (countPosts(company) === 0) {
    return res.status(404).json({
      error: `No Reddit data has been collected for "${String(company).trim()}" yet.`,
    })
  }

  const posts = selectPosts(company, {}).map((post) => ({
    id: post.id,
    type: post.type,
    title: post.title,
    body: post.body,
    author: post.author,
    subreddit: post.subreddit,
    score: post.score,
    numComments: post.numComments,
    createdAt: post.createdAt,
    permalink: post.permalink,
    url: post.url,
  }))

  res.json({ posts, scrapedAt: collectionStats(company).collectedAt })
})

app.get('/api/raw', (req, res) => {
  const { company, subreddit, sentiment, type, q, sort, order, limit, offset } = req.query
  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Missing "company" query parameter' })
  }

  const started = Date.now()
  const page = selectPostsPage(
    company,
    { subreddit, sentiment, type, q },
    { sort, order, limit, offset },
  )

  res.json({
    company: displayName(company),
    ...page,
    stats: collectionStats(company),
    subreddits: subredditBreakdown(company),
    computedInMs: Date.now() - started,
  })
})

app.get('/api/posts', (req, res) => {
  const { company, subreddit, sentiment, topic, type, days, offset } = req.query
  if (!company) return res.status(400).json({ error: 'Missing "company" query parameter' })

  const filtered = selectPosts(company, {
    subreddit,
    sentiment,
    topic,
    type,
    since: days && days !== 'all' ? Date.now() - Number(days) * DAY_MS : undefined,
  })

  const start = Number(offset) || 0
  const page = filtered.slice(start, start + POSTS_PAGE_SIZE)

  res.json({
    posts: page,
    total: filtered.length,
    nextOffset: start + page.length < filtered.length ? start + page.length : null,
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    companies: listCompanies().length,
  })
})

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

if (existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '1h', index: false }))

  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(join(DIST, 'index.html'))
  })
  console.log('Serving the built site from ./dist')
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})

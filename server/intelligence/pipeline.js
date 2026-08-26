import { rankCommunities } from '../../src/analysis/buzz.js'
import { buildCandidates } from '../../src/analysis/funnel.js'
import { classifyAll, taxonomyDrift, BASE_CATEGORIES } from '../../src/analysis/classify.js'
import { resolveBrand } from './resolve.js'
import { induceTaxonomy, DRIFT_THRESHOLD } from './taxonomy.js'
import { analyseThreads, deterministicAnalyses, recommendActions } from './analyse.js'
import { gateRecommendation } from './compliance.js'
import { usageSnapshot, estimatedCost, llmAvailable, activeModel } from './client.js'
import {
  brandIdentity,
  cachedAnalyses,
  listCompanies,
  saveAnalyses,
  saveBrandIdentity,
  saveRecommendations,
  saveTaxonomy,
  selectPosts,
  snapshots,
  subredditMeta,
  subredditRules,
  taxonomy as storedTaxonomy,
} from '../db.js'

const IDENTITY_MAX_AGE = 90 * 24 * 60 * 60 * 1000

export async function runIntelligence(company, { force = false, limit = 60, onProgress } = {}) {
  const started = Date.now()
  const step = (message) => onProgress?.(message)

  const posts = selectPosts(company, {})
  if (!posts.length) throw new Error(`No stored conversations for "${company}"`)

  const communities = subredditMeta(company)

  step('Ranking communities')
  const ranking = rankCommunities({
    posts,
    communities,
    brand: company.toLowerCase(),
    history: snapshotHistory(company),
  })
  const communityScores = new Map(ranking.ranked.map((row) => [row.name, row.score]))
  const communityMembers = new Map(communities.map((row) => [row.name, row.subscribers]))

  step('Resolving brand identity')
  let identity = brandIdentity(company)
  if (!identity || Date.now() - identity.updatedAt > IDENTITY_MAX_AGE) {
    const resolved = await resolveBrand(company, posts, communities)
    saveBrandIdentity(company, resolved.identity, { source: resolved.source, model: resolved.model })
    identity = { ...resolved.identity, source: resolved.source }
  }

  step('Selecting candidates')
  const { digests, entries, stats } = buildCandidates({
    posts,
    brand: company.toLowerCase(),
    identity,
    communityScores,
    communityMembers,
    options: { limit },
  })

  if (!digests.length) {
    return { company, degraded: true, stats, analysed: 0, recommendations: 0, reason: 'no candidates' }
  }

  step('Applying taxonomy')
  let taxonomy = storedTaxonomy(company)
  let categories = taxonomy?.categories ?? BASE_CATEGORIES

  let classification = classifyAll(digests, categories)

  const drift = taxonomyDrift(classification.results)
  if (!taxonomy || drift > DRIFT_THRESHOLD) {
    const induced = await induceTaxonomy(company, digests, identity)
    if (induced.source === 'llm') {
      saveTaxonomy(company, induced.categories, induced.source)
      categories = induced.categories
      classification = classifyAll(digests, categories)
    } else if (!taxonomy) {
      saveTaxonomy(company, BASE_CATEGORIES, 'base')
    }
  }

  const classifiedById = new Map(classification.results.map((result) => [result.id, result]))

  step('Checking analysis cache')
  const cached = force ? new Map() : cachedAnalyses(company, entries.map((entry) => entry.id))
  const keyById = new Map(entries.map((entry) => [entry.id, entry.cacheKey]))

  const escalatedIds = new Set(classification.escalate.map((result) => result.id))

  const needsLlm = []
  const reused = new Map()

  for (const digest of digests) {
    const hit = cached.get(digest.id)
    if (hit && hit.cacheKey === keyById.get(digest.id)) {
      reused.set(digest.id, hit)
      continue
    }
    if (escalatedIds.has(digest.id)) needsLlm.push(digest)
    else reused.set(digest.id, null)
  }

  step(`Analysing ${needsLlm.length} threads`)
  const { analyses, source } = await analyseThreads({
    digests: needsLlm,
    categories,
    identity,
    fallbacks: classifiedById,
    onProgress: (progress) => step(`Analysing ${progress.done}/${progress.total}`),
  })

  const settledDigests = digests.filter(
    (digest) => !reused.get(digest.id) && !analyses.has(digest.id),
  )
  const merged = new Map(deterministicAnalyses(settledDigests, classifiedById))
  for (const [id, analysis] of reused) if (analysis) merged.set(id, analysis)
  for (const [id, analysis] of analyses) merged.set(id, analysis)

  const realAnalyses = [...analyses.entries()].filter(([, analysis]) => !analysis.degraded)
  if (realAnalyses.length) {
    saveAnalyses(
      company,
      realAnalyses.map(([id, analysis]) => ({
        id,
        cacheKey: keyById.get(id),
        analysis,
        model: activeModel(),
      })),
    )
  }

  step('Preparing recommendations')
  const actions = await recommendActions({ digests, analyses: merged, identity })

  const bySubreddit = new Map(digests.map((digest) => [digest.id, digest.sub]))
  const rules = subredditRules([...new Set(digests.map((digest) => digest.sub))])

  const gated = [...actions.entries()].map(([id, recommendation]) =>
    gateRecommendation({
      threadId: id,
      subreddit: bySubreddit.get(id),
      recommendation,
      rulesEntry: rules.get(bySubreddit.get(id)),
    }),
  )
  if (gated.length) saveRecommendations(company, gated)

  const ranked = digests
    .map((digest) => ({ digest, analysis: merged.get(digest.id) }))
    .sort((a, b) => (b.analysis?.importance ?? 0) - (a.analysis?.importance ?? 0))

  const ranSuccessfully = needsLlm.length > 0 ? source === 'llm' : await llmAvailable()

  return {
    company,
    degraded: !ranSuccessfully,
    identitySource: identity.source,
    taxonomySource: storedTaxonomy(company)?.source ?? 'base',
    stats: {
      ...stats,
      ...classification.stats,
      cacheHits: [...reused.values()].filter(Boolean).length,
      llmAnalysed: realAnalyses.length,
      analysedDegraded: analyses.size - realAnalyses.length,
      drift,
    },
    disagreement: ranked
      .map(({ digest, analysis }) => ({
        id: digest.id,
        prescore: digest.prescore,
        importance: analysis?.importance ?? 0,
        delta: Math.abs((analysis?.importance ?? 0) - (digest.prescore ?? 0)),
      }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 20),
    top: ranked.slice(0, 20).map(({ digest, analysis }) => ({
      id: digest.id,
      subreddit: digest.sub,
      title: digest.title,
      importance: analysis?.importance ?? 0,
      category: analysis?.category,
      topic: analysis?.topic,
      sentiment: analysis?.sentiment,
      drivers: analysis?.drivers ?? [],
      participationWorthy: Boolean(analysis?.participation_worthy),
    })),
    recommendations: gated.length,
    blocked: gated.filter((entry) => entry.status === 'blocked').length,
    usage: { ...usageSnapshot(), estimatedCostUsd: estimatedCost() },
    tookMs: Date.now() - started,
  }
}

export function snapshotHistory(company) {
  const rows = snapshots(company, { scope: 'community' })
  const history = new Map()
  for (const row of rows) {
    if (!history.has(row.key)) history.set(row.key, [])
    history.get(row.key).push(row)
  }
  return history
}

export const companies = () => listCompanies().map((row) => row.company)

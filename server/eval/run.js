import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { rankCommunities } from '../../src/analysis/buzz.js'
import { buildCandidates } from '../../src/analysis/funnel.js'
import { classifyAll } from '../../src/analysis/classify.js'
import { makeRelevanceTest } from '../../src/analysis/importance.js'
import { heuristicIdentity } from '../intelligence/resolve.js'
import { selectPosts, subredditMeta } from '../db.js'

const LABELS = fileURLToPath(new URL('./labels.json', import.meta.url))
const verbose = process.argv.includes('--verbose')

export const THRESHOLDS = {
  communityPrecision: 0.7,
  relevanceSeparation: 0.25,
  classifierAgreement: 0.6,
}

function loadLabels() {
  try {
    return JSON.parse(readFileSync(LABELS, 'utf8'))
  } catch {
    console.error(`No labels found at ${LABELS}. Nothing to evaluate against.`)
    process.exit(2)
  }
}

function communityPrecision(labels) {
  const results = []

  for (const [company, expected] of Object.entries(labels.communities || {})) {
    const posts = selectPosts(company, {})
    if (!posts.length) continue

    const ranked = rankCommunities({
      posts,
      communities: subredditMeta(company),
      brand: company,
    }).ranked.slice(0, 10)

    const judged = ranked.filter((row) => expected[row.name] !== undefined)
    const correct = judged.filter((row) => expected[row.name] === 'relevant')

    const unlabelled = ranked.filter((row) => expected[row.name] === undefined)

    results.push({
      company,
      precision: judged.length ? correct.length / judged.length : null,
      judged: judged.length,
      unlabelled: unlabelled.map((row) => row.name),
      misses: judged.filter((row) => expected[row.name] !== 'relevant').map((row) => row.name),
    })
  }

  return results
}

function relevanceSeparation(labels) {
  const results = []

  for (const [company, expected] of Object.entries(labels.threads || {})) {
    const posts = selectPosts(company, {})
    if (!posts.length) continue

    const identity = heuristicIdentity(company, posts, subredditMeta(company))
    const relevanceOf = makeRelevanceTest(company, identity)
    const byId = new Map(posts.map((post) => [post.id, post]))

    const onBrand = []
    const offBrand = []

    for (const [id, label] of Object.entries(expected)) {
      const post = byId.get(id)
      if (!post) continue
      const { relevance } = relevanceOf(post)
      ;(label.onBrand ? onBrand : offBrand).push(relevance)
    }

    if (!onBrand.length || !offBrand.length) continue
    const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length

    results.push({
      company,
      onBrand: Number(mean(onBrand).toFixed(3)),
      offBrand: Number(mean(offBrand).toFixed(3)),
      separation: Number((mean(onBrand) - mean(offBrand)).toFixed(3)),
      samples: onBrand.length + offBrand.length,
    })
  }

  return results
}

function classifierAgreement(labels) {
  const results = []

  for (const [company, expected] of Object.entries(labels.threads || {})) {
    const withCategory = Object.entries(expected).filter(([, label]) => label.category)
    if (!withCategory.length) continue

    const posts = selectPosts(company, {})
    if (!posts.length) continue

    const { digests } = buildCandidates({
      posts,
      brand: company,
      identity: heuristicIdentity(company, posts, subredditMeta(company)),
      options: { limit: 500, maxAgeDays: 3650 },
    })
    const { results: classified } = classifyAll(digests, undefined, { alwaysEscalate: 0 })
    const byId = new Map(classified.map((result) => [result.id, result]))

    let agreed = 0
    let judged = 0
    const disagreements = []

    for (const [id, label] of withCategory) {
      const result = byId.get(id)
      if (!result) continue
      judged += 1
      if (result.category === label.category) agreed += 1
      else disagreements.push(`${id}: said ${result.category}, labelled ${label.category}`)
    }

    if (!judged) continue
    results.push({ company, agreement: Number((agreed / judged).toFixed(3)), judged, disagreements })
  }

  return results
}

function mean(values) {
  const usable = values.filter((value) => Number.isFinite(value))
  if (!usable.length) return null
  return Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(3))
}

export function runEval() {
  const labels = loadLabels()

  const communities = communityPrecision(labels)
  const separation = relevanceSeparation(labels)
  const agreement = classifierAgreement(labels)

  const scores = {
    communityPrecision: mean(communities.map((row) => row.precision)),
    relevanceSeparation: mean(separation.map((row) => row.separation)),
    classifierAgreement: mean(agreement.map((row) => row.agreement)),
  }

  console.log('\nEvaluation\n══════════')

  const rows = [
    ['community precision@10', scores.communityPrecision, THRESHOLDS.communityPrecision,
      `${communities.reduce((sum, row) => sum + row.judged, 0)} labelled`],
    ['relevance separation', scores.relevanceSeparation, THRESHOLDS.relevanceSeparation,
      `${separation.reduce((sum, row) => sum + row.samples, 0)} threads`],
    ['classifier agreement', scores.classifierAgreement, THRESHOLDS.classifierAgreement,
      `${agreement.reduce((sum, row) => sum + row.judged, 0)} threads`],
  ]

  let failed = 0
  for (const [name, score, floor, detail] of rows) {
    if (score === null) {
      console.log(`  ?  ${name.padEnd(24)} no labels`)
      continue
    }
    const pass = score >= floor
    if (!pass) failed += 1
    console.log(
      `  ${pass ? '✓' : '✗'}  ${name.padEnd(24)} ${String(score).padEnd(7)} ` +
        `(floor ${floor}) · ${detail}`,
    )
  }

  if (verbose) {
    console.log('\nPer brand:')
    for (const row of communities) {
      console.log(
        `  ${row.company}: precision ${row.precision ?? '—'}` +
          (row.misses.length ? ` · wrongly ranked: ${row.misses.join(', ')}` : '') +
          (row.unlabelled.length ? ` · unlabelled: ${row.unlabelled.join(', ')}` : ''),
      )
    }
    for (const row of separation) {
      console.log(`  ${row.company}: on-brand ${row.onBrand} vs off-brand ${row.offBrand}`)
    }
    for (const row of agreement) {
      for (const line of row.disagreements) console.log(`  ${row.company} — ${line}`)
    }
  }

  console.log(
    failed
      ? `\n${failed} metric${failed === 1 ? '' : 's'} below floor.\n`
      : '\nAll metrics above floor.\n',
  )

  return { scores, failed, communities, separation, agreement }
}

if (process.argv[1] && process.argv[1].endsWith('run.js')) {
  const { failed } = runEval()
  process.exit(failed ? 1 : 0)
}

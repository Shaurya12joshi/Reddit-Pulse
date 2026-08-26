import { rankCommunities } from '../src/analysis/buzz.js'
import { scoreThreads, selectForDeepCollection } from '../src/analysis/importance.js'
import { buildCandidates, analysisCacheKey, simhash } from '../src/analysis/funnel.js'
import { classifyAll } from '../src/analysis/classify.js'
import { assessPromoRisk, gateRecommendation } from './intelligence/compliance.js'
import { heuristicIdentity } from './intelligence/resolve.js'
import { llmAvailable, activeModel, activeProvider } from './intelligence/client.js'
import { runEval } from './eval/run.js'
import {
  db,
  collectionStats,
  listCompanies,
  selectPosts,
  snapshotRuns,
  subredditMeta,
} from './db.js'

const argBrand = process.argv.includes('--brand')
  ? process.argv[process.argv.indexOf('--brand') + 1]
  : null

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name.padEnd(42)} ${detail}`)
}
const warn = (name, detail) => {
  results.push({ name, pass: true, warn: true, detail })
  console.log(`  ! ${name.padEnd(42)} ${detail}`)
}

const section = (title) => console.log(`\n${title}\n${'─'.repeat(title.length)}`)

section('Storage')

const EXPECTED_TABLES = [
  'posts', 'subreddits', 'runs', 'brand_context', 'brand_identity',
  'snapshots', 'analyses', 'taxonomies', 'subreddit_rules', 'recommendations', 'eval_labels',
]
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((row) => row.name)

const missing = EXPECTED_TABLES.filter((name) => !tables.includes(name))
check('schema complete', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${EXPECTED_TABLES.length} tables`)

const companies = listCompanies()
check('collected data present', companies.length > 0, `${companies.length} brands`)

const brands = argBrand ? [argBrand] : companies.slice(0, 5).map((row) => row.company)

section('Stage 1 — discovery and ranking')

for (const brand of brands) {
  const posts = selectPosts(brand, {})
  if (!posts.length) {
    check(`${brand}: data`, false, 'no stored posts')
    continue
  }

  const started = Date.now()
  const ranking = rankCommunities({ posts, communities: subredditMeta(brand), brand })
  const ms = Date.now() - started

  check(
    `${brand}: ranking`,
    ranking.ranked.length > 0 && ms < 3000,
    `${ranking.ranked.length} communities, ${ranking.excluded.length} excluded, ${ms}ms`,
  )

  const weak = ranking.ranked.filter((row) => row.relevance < 0.25)
  const weakInTop = weak.filter((row) => row.rank <= 10)
  check(
    `${brand}: relevance gate holds`,
    weakInTop.length === 0,
    weakInTop.length
      ? `${weakInTop.map((row) => `r/${row.name}`).join(', ')} in top 10`
      : `${weak.length} weak, all below rank ${weak.length ? Math.min(...weak.map((r) => r.rank)) : '—'}`,
  )

  const stats = collectionStats(brand)
  const spread = stats.subreddits / Math.max(1, stats.posts)
  if (stats.subreddits > 150 && spread > 0.2) {
    warn(`${brand}: corpus spread`, `${stats.subreddits} communities for ${stats.posts} posts — likely polluted`)
  }
}

section('Stage 2 — prescore and collection planning')

for (const brand of brands) {
  const posts = selectPosts(brand, {})
  if (!posts.length) continue

  const ranking = rankCommunities({ posts, communities: subredditMeta(brand), brand })
  const scored = scoreThreads({
    threads: posts,
    brand,
    identity: heuristicIdentity(brand, posts, subredditMeta(brand)),
    communityScores: new Map(ranking.ranked.map((row) => [row.name, row.score])),
  })
  const picked = selectForDeepCollection(scored, { limit: 32 })

  check(`${brand}: prescore`, scored.length > 0, `${scored.length} threads scored`)

  const ages = picked.map((entry) => entry.ageDays).sort((a, b) => a - b)
  const medianAge = ages[Math.floor(ages.length / 2)] ?? 0
  check(
    `${brand}: comment targets are actionable`,
    picked.length === 0 || medianAge <= 90,
    `${picked.length} selected, median age ${Math.round(medianAge)}d`,
  )

  const inRanked = picked.filter((entry) =>
    ranking.ranked.some((row) => row.name === entry.subreddit),
  ).length
  check(
    `${brand}: targets sit in ranked communities`,
    picked.length === 0 || inRanked / picked.length >= 0.5,
    `${inRanked}/${picked.length}`,
  )
}

section('Stage 2.5 — funnel')

for (const brand of brands) {
  const posts = selectPosts(brand, {})
  if (!posts.length) continue

  const { digests, entries, stats } = buildCandidates({
    posts,
    brand,
    identity: heuristicIdentity(brand, posts, subredditMeta(brand)),
  })

  check(
    `${brand}: narrows the corpus`,
    digests.length > 0 && digests.length <= 60,
    `${stats.stored} stored → ${stats.relevant} relevant → ${digests.length} digests`,
  )

  const chars = JSON.stringify(digests).length
  const perThread = Math.round(chars / 4 / Math.max(1, digests.length))
  check(`${brand}: digests are compact`, perThread < 600, `~${perThread} tokens/thread`)

  const first = entries[0]
  if (first) {
    const post = posts.find((entry) => entry.id === first.id)
    const repeat = analysisCacheKey(post, [])
    check(`${brand}: cache key stable`, repeat === analysisCacheKey(post, []), repeat.slice(0, 24) + '…')
  }
}

section('Stage 3 — classification')

for (const brand of brands) {
  const posts = selectPosts(brand, {})
  if (!posts.length) continue

  const { digests } = buildCandidates({ posts, brand })
  const { stats } = classifyAll(digests)

  check(
    `${brand}: code settles the easy majority`,
    stats.settledByCode > 0,
    `${stats.settledByCode} settled, ${stats.escalated} escalated to the LLM`,
  )
}

section('Stage 4 — compliance gate')

const prohibited = {
  name: 'testsub',
  rules: [{ short_name: 'No self-promotion', description: 'Self-promotion and advertising are not allowed.' }],
}
const posting = { action: 'address_complaint', should_participate: true, say: ['x'], avoid: ['y'] }

check('prohibited rules detected', assessPromoRisk(prohibited).promoRisk === 'prohibited')
check(
  'posting into a prohibited community is blocked',
  gateRecommendation({ threadId: 't', subreddit: 'testsub', recommendation: posting, rulesEntry: prohibited })
    .status === 'blocked',
)
check(
  'monitoring is never blocked',
  gateRecommendation({
    threadId: 't',
    subreddit: 'testsub',
    recommendation: { ...posting, action: 'monitor_only' },
    rulesEntry: prohibited,
  }).status === 'pending',
)
check(
  'unknown rules default to unclear, not allowed',
  assessPromoRisk({ name: 'x', rules: [] }).promoRisk === 'unclear',
)
check('simhash is deterministic', simhash('Amazon lost my package') === simhash('Amazon lost my package'))

section('LLM layer')

const available = await llmAvailable()
if (available) {
  check('provider reachable', true, `${activeProvider()} · ${activeModel()}`)
  console.log('\n  Run the staged smoke test to exercise it:  npm run smoke -- 1 notion')
} else {
  warn('provider not configured', `${activeProvider()} · running deterministic fallbacks`)
  console.log('\n  This is not a failure. Everything above runs without it.')
  console.log('  To enable: see server/.env.example (Ollama and Groq are free).')
}

section('Evaluation against hand-labelled truth')

const { scores, failed } = runEval()
check('eval metrics above floor', failed === 0, JSON.stringify(scores))

const failures = results.filter((row) => !row.pass)
const warnings = results.filter((row) => row.warn)

section('Result')
console.log(`  ${results.length - failures.length - warnings.length} passed · ${warnings.length} warnings · ${failures.length} failed`)

if (failures.length) {
  console.log('\n  Failed:')
  for (const row of failures) console.log(`    ✗ ${row.name} — ${row.detail}`)
}

console.log(`
  Not testable from here (needs your browser):
    · live collection — load the extension at chrome://extensions, sign in to
      Reddit, then search a brand on the dashboard. Watch for the step
      "Working out which discussions matter…" — that is the prescore driving
      comment collection.
    · after a second run of the same brand, snapshot velocity becomes real:
      look for "velocitySource": "snapshots" in /api/buzz.
`)

const runs = brands.map((brand) => ({ brand, runs: snapshotRuns(brand).length }))
const multi = runs.filter((row) => row.runs >= 2)
console.log(
  `  Snapshot history: ${runs.map((row) => `${row.brand}=${row.runs}`).join(' ')}` +
    (multi.length ? '' : '  (need ≥2 runs of one brand for real velocity)'),
)

process.exit(failures.length ? 1 : 0)

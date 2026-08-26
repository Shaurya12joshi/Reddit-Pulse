import { llmAvailable, usage, estimatedCost, activeModel, activeProvider } from './client.js'
import { resolveBrand } from './resolve.js'
import { induceTaxonomy } from './taxonomy.js'
import { runIntelligence } from './pipeline.js'
import { buildCandidates } from '../../src/analysis/funnel.js'
import { makeRelevanceTest } from '../../src/analysis/importance.js'
import { brandIdentity, saveBrandIdentity, selectPosts, subredditMeta } from '../db.js'

const step = process.argv[2] || '0'
const brand = process.argv[3] || 'notion'

const line = (label, value) => console.log(`  ${String(label).padEnd(26)} ${value}`)
const ok = (pass, text) => console.log(`  ${pass ? '✓' : '✗'} ${text}`)

const spend = () =>
  console.log(
    `\n  spent this run: ${usage.calls} calls · ${usage.inputTokens} in / ` +
      `${usage.outputTokens} out · ` +
      (estimatedCost() === null ? 'cost unknown for this provider' : `~$${estimatedCost()}`) +
      (usage.cachedTokens ? ` · ${usage.cachedTokens} cached` : ''),
  )

async function step0() {
  console.log('\nStep 0 — credentials (no API call)\n')
  const available = await llmAvailable()

  line('provider', activeProvider())
  line('model', activeModel())
  line(
    'credential',
    activeProvider() === 'ollama'
      ? 'not needed (local)'
      : activeProvider() === 'openai-compatible'
        ? (process.env.LLM_API_KEY ? 'LLM_API_KEY set' : 'LLM_API_KEY not set')
        : (process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY set' : 'ANTHROPIC_API_KEY not set'),
  )
  line('SDK + credentials', available ? 'resolved' : 'NOT resolved')

  ok(available, available ? 'Ready.' : 'Not ready — see the warning printed above.')
  if (!available) {
    console.log(
      '\n  Most common cause: the server process was started before the key was\n' +
        '  exported. Environment is read at process start, so export first, then run.\n',
    )
  }
  return available
}

async function step1() {
  console.log(`\nStep 1 — brand resolution for "${brand}"\n`)
  const posts = selectPosts(brand, {})
  if (!posts.length) return console.log(`  No stored data for "${brand}".`)

  const { identity, source, model } = await resolveBrand(brand, posts, subredditMeta(brand))

  line('source', source === 'llm' ? `llm (${model})` : 'heuristic — LLM did not run')
  line('canonical name', identity.canonical_name)
  line('entity type', identity.entity_type)
  line('aliases', identity.aliases.join(', ') || '—')
  line('positive markers', identity.positive_markers.slice(0, 8).join(', '))
  line('negative markers', identity.negative_markers.join(', ') || '(none)')
  line('competitors', identity.competitors.map((c) => c.name).join(', ') || '—')
  line('confidence', identity.confidence)

  console.log()
  ok(source === 'llm', 'Ran on the LLM (not the fallback)')
  ok(identity.entity_type !== 'unknown', 'Identified what kind of thing the brand is')
  ok(
    identity.negative_markers.length > 0,
    'Produced negative markers — the whole point of Stage 0 for an ambiguous name',
  )

  if (source === 'llm') {
    saveBrandIdentity(brand, identity, { source, model })
    console.log('\n  Saved. Step 2 will use it.')
  }
  spend()
}

async function step2() {
  console.log(`\nStep 2 — what the markers change (free, no API call)\n`)
  const identity = brandIdentity(brand)
  if (!identity) return console.log('  No stored identity. Run step 1 first.')

  line('identity source', identity.source)
  line('negative markers', identity.negative_markers.join(', ') || '(none)')

  const posts = selectPosts(brand, {})
  const withOut = buildCandidates({ posts, brand, identity: { ...identity, negative_markers: [] } })
  const withIn = buildCandidates({ posts, brand, identity })

  console.log()
  line('relevant without markers', withOut.stats.relevant)
  line('relevant with markers', withIn.stats.relevant)
  line('threads vetoed', withOut.stats.relevant - withIn.stats.relevant)

  const relevanceOf = makeRelevanceTest(brand, identity)
  const vetoed = posts
    .filter((post) => post.type === 'post')
    .map((post) => ({ post, ...relevanceOf(post) }))
    .filter((entry) => entry.vetoed)
    .slice(0, 6)

  if (vetoed.length) {
    console.log('\n  Vetoed as the wrong sense of the word:')
    for (const entry of vetoed) console.log(`    r/${entry.post.subreddit}: ${entry.post.title.slice(0, 70)}`)
  }

  console.log()
  ok(withIn.stats.relevant <= withOut.stats.relevant, 'Markers removed threads rather than adding any')
  ok(
    vetoed.length > 0 || identity.negative_markers.length === 0,
    'Markers actually fired on real threads',
  )
  console.log(
    '\n  Note: this affects thread relevance and the funnel only.\n' +
      '  Community ranking (/api/buzz) does not consume markers yet.',
  )
}

async function step3() {
  console.log(`\nStep 3 — taxonomy induction for "${brand}"\n`)
  const posts = selectPosts(brand, {})
  const identity = brandIdentity(brand) || {}
  const { digests } = buildCandidates({ posts, brand, identity })

  const { categories, source, model } = await induceTaxonomy(brand, digests, identity)

  line('source', source === 'llm' ? `llm (${model})` : 'base — LLM did not run')
  line('categories', categories.length)

  const base = 7
  console.log('\n  Brand-specific categories induced:')
  for (const category of categories.slice(base)) {
    console.log(`    ${category.id}: ${category.definition}`)
    console.log(`      hints: ${category.hints.slice(0, 6).join(', ')}`)
  }

  console.log()
  ok(source === 'llm', 'Ran on the LLM')
  ok(categories.length > base, 'Added brand-specific categories on top of the base set')
  spend()
}

async function step4() {
  console.log(`\nStep 4 — full pipeline for "${brand}"\n`)
  const result = await runIntelligence(brand, { onProgress: (message) => console.log(`  … ${message}`) })

  console.log()
  line('degraded', result.degraded)
  line('identity source', result.identitySource)
  line('taxonomy source', result.taxonomySource)
  line('candidates', result.stats.selected)
  line('settled by code', result.stats.settledByCode)
  line('analysed by LLM', result.stats.llmAnalysed)
  line('recommendations', `${result.recommendations} (${result.blocked} blocked)`)
  line(
    'estimated cost',
    result.usage.estimatedCostUsd === null
      ? 'unknown for this provider/model'
      : `$${result.usage.estimatedCostUsd}`,
  )
  line('took', `${result.tookMs}ms`)

  console.log('\n  Most important threads:')
  for (const row of result.top.slice(0, 5)) {
    console.log(
      `    ${String(row.importance).padStart(3)} ${row.category?.padEnd(22) || ''} ` +
        `r/${row.subreddit} — ${row.title.slice(0, 55)}`,
    )
    if (row.drivers?.length) console.log(`        drivers: ${row.drivers.join(', ')}`)
  }

  console.log('\n  Biggest prescore↔LLM disagreements (these tune the weights):')
  for (const row of result.disagreement.slice(0, 5)) {
    console.log(`    ${row.id}  prescore ${row.prescore} vs importance ${row.importance}  (Δ${row.delta})`)
  }

  console.log()
  ok(!result.degraded, 'Ran with the LLM')
  ok(result.stats.llmAnalysed > 0, 'Threads actually reached the model')
  ok(
    result.stats.settledByCode > 0,
    'Code settled some threads without the LLM (the token-efficiency claim)',
  )
}

async function step5() {
  console.log(`\nStep 5 — cache proof for "${brand}"\n`)
  console.log('  Re-running immediately. Nothing has changed, so nothing should be paid for.\n')

  const before = { ...usage }
  const result = await runIntelligence(brand, {})

  line('cache hits', result.stats.cacheHits)
  line('analysed by LLM', result.stats.llmAnalysed)
  line('calls this run', usage.calls - before.calls)
  line('tokens this run', usage.inputTokens - before.inputTokens)

  console.log()
  ok(result.stats.cacheHits > 0, 'Reused stored analyses')
  ok(
    result.stats.llmAnalysed < result.stats.escalated || result.stats.llmAnalysed === 0,
    'Paid for fewer threads than the first run',
  )
}

const steps = { 0: step0, 1: step1, 2: step2, 3: step3, 4: step4, 5: step5 }
const runner = steps[step]
if (!runner) {
  console.error(`Unknown step "${step}". Use 0-5.`)
  process.exit(1)
}
await runner()
console.log()

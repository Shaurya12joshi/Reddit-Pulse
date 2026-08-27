// A head-to-head the user asked for by name. The automatic read in
// comparison.js decides for itself which rivals are worth weighing; this one
// takes the rival as given, works out who that rival actually is, and reads
// the corpus for that pairing alone.
//
// Two model calls: one to resolve the typed name into a real company (with
// aliases, so the corpus scan finds it) and to say how the two relate, then
// one to read the excerpts. Every claim cites a numbered excerpt, so quotes
// can be traced back to the thread they came from.

import { structured, activeModel, llmAvailable } from './client.js'
import { patternsFor } from './comparison.js'

const RESOLVE_SYSTEM = `You identify a company a user typed in, so a Reddit monitoring system can find its mentions in a corpus.

You are given the brand the user is researching and the name of the company they want it compared against.

- canonical_name: the company's usual written name. Correct obvious misspellings and expand abbreviations.
- aliases: other strings Reddit commenters use for it — abbreviations, old names, product names that stand in for the company, common misspellings. No generic words that would match unrelated text.
- relationship: how the two actually relate. "direct" when people genuinely choose between them, "adjacent" when they overlap but are not usually a straight either/or, "unrelated" when there is no real buying or usage decision connecting them.
- rationale: one sentence on why they do or do not get compared.
- dimensions: the specific things people weigh when choosing between these two — price, reliability, support, catalogue, latency, and so on. Short lowercase noun phrases. This steers the read, so name the dimensions that matter for this pairing rather than generic ones.
- also_worth_comparing: up to three other companies that belong in the same shortlist as the pair, most relevant first. Real, current competitors only.
- exists: false only when the name matches no real company you can identify.

Be terse. Every field is consumed by code.`

const RESOLVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'exists',
    'canonical_name',
    'aliases',
    'relationship',
    'rationale',
    'dimensions',
    'also_worth_comparing',
  ],
  properties: {
    exists: { type: 'boolean' },
    canonical_name: { type: 'string' },
    aliases: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    relationship: { type: 'string', enum: ['direct', 'adjacent', 'unrelated'] },
    rationale: { type: 'string' },
    dimensions: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    also_worth_comparing: { type: 'array', items: { type: 'string' }, maxItems: 3 },
  },
}

const READ_SYSTEM = `You read Reddit discussions and report how one brand stands against one named rival, according to the people writing.

Report only what the excerpts support. Every claim must trace to a passage you were given — you are summarising a corpus, not recalling what you know about these companies. Where the excerpts are thin, one-sided, or never put the two together, say so through coverage, confidence and gaps rather than inventing a verdict.

Excerpts are numbered and arrive in three groups: passages naming both companies, passages naming only the rival, and passages naming only the brand. Head-to-head passages are the strongest evidence; the single-company groups tell you how each is spoken about on its own, which is worth reporting when nobody compares them directly.

- verdict: which way commenters lean overall. "brand", "competitor", "mixed" when opinion genuinely splits, "unclear" when the excerpts do not settle it.
- headline: one short sentence a reader could put in a deck.
- summary: two or three sentences on what the comparison turns on.
- dimensions: one row per thing people actually weigh. brand_view and competitor_view say what commenters report about each side on that dimension; write "not discussed" when a side is never covered. edge is who comes out ahead on that dimension alone.
- brand_wins / competitor_wins: short lowercase noun phrases, only dimensions the excerpts raise.
- switching: direction people move, and what triggers it. direction is "to_brand", "to_competitor", "both", or "none" when nobody mentions moving.
- brand_reception / competitor_reception: how each company is spoken about across all the excerpts mentioning it.
- gaps: what a reader should know the excerpts do not cover. Empty when coverage is genuinely even.
- quotes: the passages that carry the comparison. excerpt is the number as given. Never quote text you were not given, and never renumber.
- confidence: how well the excerpts support the verdict.

Be terse. Every field is consumed by code.`

const READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'verdict',
    'headline',
    'summary',
    'dimensions',
    'brand_wins',
    'competitor_wins',
    'switching',
    'brand_reception',
    'competitor_reception',
    'gaps',
    'quotes',
    'confidence',
  ],
  properties: {
    verdict: { type: 'string', enum: ['brand', 'competitor', 'mixed', 'unclear'] },
    headline: { type: 'string' },
    summary: { type: 'string' },
    dimensions: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dimension', 'brand_view', 'competitor_view', 'edge'],
        properties: {
          dimension: { type: 'string' },
          brand_view: { type: 'string' },
          competitor_view: { type: 'string' },
          edge: { type: 'string', enum: ['brand', 'competitor', 'tie', 'unclear'] },
        },
      },
    },
    brand_wins: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    competitor_wins: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    switching: {
      type: 'object',
      additionalProperties: false,
      required: ['direction', 'detail'],
      properties: {
        direction: { type: 'string', enum: ['to_brand', 'to_competitor', 'both', 'none'] },
        detail: { type: 'string' },
      },
    },
    brand_reception: {
      type: 'string',
      enum: ['positive', 'mixed', 'negative', 'unclear'],
    },
    competitor_reception: {
      type: 'string',
      enum: ['positive', 'mixed', 'negative', 'unclear'],
    },
    gaps: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    quotes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['excerpt', 'quote', 'side', 'point'],
        properties: {
          excerpt: { type: 'integer', minimum: 1 },
          quote: { type: 'string' },
          side: { type: 'string', enum: ['brand', 'competitor', 'both'] },
          point: { type: 'string' },
        },
      },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

const HEAD_TO_HEAD = 24
const RIVAL_ONLY = 12
const BRAND_ONLY = 10
const EXCERPT_CHARS = 460

function textOf(post) {
  return post.text || [post.title, post.body].filter(Boolean).join('. ')
}

function byEngagement(posts) {
  return [...posts].sort(
    (a, b) => (b.engagement ?? b.score ?? 0) - (a.engagement ?? a.score ?? 0),
  )
}

// Splits the corpus three ways: both names in one passage, the rival alone,
// the brand alone. The single-name groups are what let the read say something
// useful when nobody has put the two side by side.
export function splitEvidence(posts, brandNames, rivalNames) {
  const brandPatterns = patternsFor(brandNames)
  const rivalPatterns = patternsFor(rivalNames)
  if (!rivalPatterns.length) return { both: [], rival: [], brand: [] }

  const both = []
  const rival = []
  const brand = []

  for (const post of byEngagement(posts)) {
    const text = textOf(post)
    if (!text) continue

    const hasBrand = brandPatterns.some((pattern) => pattern.test(text))
    const hasRival = rivalPatterns.some((pattern) => pattern.test(text))
    if (!hasBrand && !hasRival) continue

    const entry = {
      id: post.id,
      subreddit: post.subreddit,
      score: post.score ?? 0,
      permalink: post.permalink || null,
      title: post.title || null,
      sentiment: post.sentimentLabel || null,
      text: text.slice(0, EXCERPT_CHARS),
    }

    if (hasBrand && hasRival) {
      if (both.length < HEAD_TO_HEAD) both.push(entry)
    } else if (hasRival) {
      if (rival.length < RIVAL_ONLY) rival.push(entry)
    } else if (brand.length < BRAND_ONLY) {
      brand.push(entry)
    }
  }

  return { both, rival, brand }
}

function numbered(groups) {
  const byNumber = new Map()
  let next = 1
  const sections = []

  for (const [heading, excerpts] of groups) {
    if (!excerpts.length) continue
    const lines = excerpts.map((excerpt) => {
      const number = next
      next += 1
      byNumber.set(number, excerpt)
      return `  [${number}] (r/${excerpt.subreddit}, ${excerpt.score} points) ${excerpt.text}`
    })
    sections.push(`### ${heading}\n${lines.join('\n')}`)
  }

  return { sections, byNumber }
}

async function resolveTarget(brand, target, identity) {
  if (!(await llmAvailable())) {
    return {
      exists: true,
      canonical_name: target,
      aliases: [],
      relationship: 'adjacent',
      rationale: '',
      dimensions: [],
      also_worth_comparing: [],
      source: 'unavailable',
    }
  }

  const user =
    `Brand being researched: ${identity.canonical_name || brand}` +
    (identity.category ? ` — competes in ${identity.category}` : '') +
    (identity.industry ? ` (${identity.industry})` : '') +
    `\nCompany the user wants it compared against, as typed: ${target}`

  const result = await structured({
    system: RESOLVE_SYSTEM,
    user,
    schema: RESOLVE_SCHEMA,
    effort: 'low',
    maxTokens: 1500,
  })

  if (!result) {
    return {
      exists: true,
      canonical_name: target,
      aliases: [],
      relationship: 'adjacent',
      rationale: '',
      dimensions: [],
      also_worth_comparing: [],
      source: 'failed',
    }
  }

  return { ...result, source: 'llm' }
}

export async function compareWithNamed(brand, posts = [], identity = {}, target = '') {
  const typed = String(target || '').trim()
  const label = identity.canonical_name || brand
  if (!typed) return { source: 'none', reason: 'no target', comparison: null, model: null }

  const resolved = await resolveTarget(brand, typed, identity)
  const rivalName = String(resolved.canonical_name || typed).trim() || typed

  const rivalNames = [typed, rivalName, ...(resolved.aliases || [])]
  const brandNames = [brand, identity.canonical_name, ...(identity.aliases || [])]
  const evidence = splitEvidence(posts, brandNames, rivalNames)

  const coverage = {
    headToHead: evidence.both.length,
    competitorOnly: evidence.rival.length,
    brandOnly: evidence.brand.length,
  }

  const target_info = {
    typed,
    name: rivalName,
    aliases: resolved.aliases || [],
    relationship: resolved.relationship || 'adjacent',
    rationale: resolved.rationale || '',
    dimensions: resolved.dimensions || [],
    alsoWorthComparing: resolved.also_worth_comparing || [],
    resolvedBy: resolved.source,
  }

  if (!evidence.both.length && !evidence.rival.length) {
    return {
      source: 'none',
      reason: 'The collected discussions never mention this company.',
      target: target_info,
      coverage,
      comparison: null,
      model: null,
    }
  }

  if (!(await llmAvailable())) {
    return {
      source: 'unavailable',
      reason: 'No model is connected, so the excerpts cannot be read.',
      target: target_info,
      coverage,
      comparison: null,
      model: null,
    }
  }

  const { sections, byNumber } = numbered([
    [`Excerpts naming both ${label} and ${rivalName}`, evidence.both],
    [`Excerpts naming only ${rivalName}`, evidence.rival],
    [`Excerpts naming only ${label}`, evidence.brand],
  ])

  const user =
    `Brand: ${label}` +
    (identity.category ? ` — competes in ${identity.category}` : '') +
    `\nRival the user named: ${rivalName}` +
    (target_info.rationale ? `\nHow they relate: ${target_info.rationale}` : '') +
    (target_info.dimensions.length
      ? `\nDimensions worth checking for this pairing: ${target_info.dimensions.join(', ')}`
      : '') +
    `\n\n${sections.join('\n\n')}`

  const read = await structured({
    system: READ_SYSTEM,
    user,
    schema: READ_SCHEMA,
    effort: 'high',
    maxTokens: 5000,
  })

  if (!read) {
    return {
      source: 'failed',
      reason: 'The model did not return a usable comparison.',
      target: target_info,
      coverage,
      comparison: null,
      model: activeModel(),
    }
  }

  const quotes = (read.quotes || [])
    .map((entry) => {
      const excerpt = byNumber.get(entry.excerpt)
      if (!excerpt) return null
      return {
        quote: entry.quote,
        side: entry.side,
        point: entry.point,
        id: excerpt.id,
        subreddit: excerpt.subreddit,
        score: excerpt.score,
        permalink: excerpt.permalink,
        sentiment: excerpt.sentiment,
      }
    })
    .filter(Boolean)

  return {
    source: 'llm',
    target: target_info,
    coverage,
    comparison: { ...read, quotes },
    model: activeModel(),
  }
}

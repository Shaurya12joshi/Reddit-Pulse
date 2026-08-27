
import { structured, activeModel, llmAvailable } from './client.js'

const RESOLVE_SYSTEM = `You identify two products or services a user wants compared, so a Reddit monitoring system can find discussions about each.

You are given the brand being researched and one of its products or services, written loosely — a nickname, a feature, a plan, a whole service line.

The rival side may be given as a product, or only as a company, or not at all. When the rival product is not named, pick the counterpart yourself: the product from the rival company (or, with no company either, from the closest competitor you know) that a buyer would actually weigh against the first one. Say so through theirs_inferred.

For each side:
- name: the clearest name for it, corrected and expanded.
- owner: the company it belongs to.
- terms: words and short phrases that appear in posts genuinely about this product. Include the official name, informal names, abbreviations, model numbers, and the words people use for the activity around it. Lowercase. Nothing so generic it would match any post about the company.
- what_it_is: one short sentence, for a reader who does not know it.

Then:
- theirs_inferred: true when you chose the rival product rather than being given it.
- comparable: true when the two are genuinely alternatives someone would weigh against each other. False when they do different jobs.
- relationship: one sentence on how they relate, or why they do not compare.
- dimensions: what people actually weigh when choosing between these two specifically — price, coverage, latency, build quality, catalogue, support. Short lowercase noun phrases. This steers the read, so be specific to this pairing.

Be terse. Every field is consumed by code.`

const SIDE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'owner', 'terms', 'what_it_is'],
  properties: {
    name: { type: 'string' },
    owner: { type: 'string' },
    terms: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 14 },
    what_it_is: { type: 'string' },
  },
}

const RESOLVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mine', 'theirs', 'theirs_inferred', 'comparable', 'relationship', 'dimensions'],
  properties: {
    mine: SIDE_SCHEMA,
    theirs: SIDE_SCHEMA,
    theirs_inferred: { type: 'boolean' },
    comparable: { type: 'boolean' },
    relationship: { type: 'string' },
    dimensions: { type: 'array', items: { type: 'string' }, maxItems: 8 },
  },
}

const READ_SYSTEM = `You read Reddit discussions and report how one product stands against a rival product, according to the people writing.

Report only what the excerpts support. Every claim must trace to a passage you were given — you are summarising a corpus, not recalling what you know about these products. Where the excerpts are thin, one-sided, or never put the two together, say so through coverage, confidence and gaps rather than inventing a verdict.

Excerpts are numbered and arrive in three groups: passages about both products, passages about the rival product only, and passages about the user's product only. Passages covering both are the strongest evidence; the single-product groups tell you how each is spoken about on its own, which is worth reporting when nobody compares them directly.

- verdict: which product commenters lean toward. "mine", "theirs", "mixed" when opinion genuinely splits, "unclear" when the excerpts do not settle it.
- headline: one short sentence a reader could put in a deck.
- summary: two or three sentences on what the choice turns on.
- dimensions: one row per thing people weigh. mine_view and theirs_view say what commenters report about each product on that dimension; write "not discussed" when a side is never covered. edge is which product comes out ahead on that dimension alone.
- mine_wins / theirs_wins: short lowercase noun phrases, only dimensions the excerpts raise.
- best_for_mine / best_for_theirs: the kind of person or use each product suits, as the excerpts describe it. Empty string when the excerpts never say.
- switching: which way people move between the two and what triggers it. direction is "to_mine", "to_theirs", "both", or "none".
- mine_reception / theirs_reception: how each product is spoken about across all the excerpts mentioning it.
- gaps: what a reader should know the excerpts do not cover.
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
    'mine_wins',
    'theirs_wins',
    'best_for_mine',
    'best_for_theirs',
    'switching',
    'mine_reception',
    'theirs_reception',
    'gaps',
    'quotes',
    'confidence',
  ],
  properties: {
    verdict: { type: 'string', enum: ['mine', 'theirs', 'mixed', 'unclear'] },
    headline: { type: 'string' },
    summary: { type: 'string' },
    dimensions: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dimension', 'mine_view', 'theirs_view', 'edge'],
        properties: {
          dimension: { type: 'string' },
          mine_view: { type: 'string' },
          theirs_view: { type: 'string' },
          edge: { type: 'string', enum: ['mine', 'theirs', 'tie', 'unclear'] },
        },
      },
    },
    mine_wins: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    theirs_wins: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    best_for_mine: { type: 'string' },
    best_for_theirs: { type: 'string' },
    switching: {
      type: 'object',
      additionalProperties: false,
      required: ['direction', 'detail'],
      properties: {
        direction: { type: 'string', enum: ['to_mine', 'to_theirs', 'both', 'none'] },
        detail: { type: 'string' },
      },
    },
    mine_reception: { type: 'string', enum: ['positive', 'mixed', 'negative', 'unclear'] },
    theirs_reception: { type: 'string', enum: ['positive', 'mixed', 'negative', 'unclear'] },
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
          side: { type: 'string', enum: ['mine', 'theirs', 'both'] },
          point: { type: 'string' },
        },
      },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

const BOTH = 22
const THEIRS_ONLY = 12
const MINE_ONLY = 12
const EXCERPT_CHARS = 460

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchers(terms = []) {
  return terms
    .map((term) => String(term || '').trim().toLowerCase())
    .filter((term) => term.length > 1)
    .map((term) =>
      term.includes(' ')
        ? { term, pattern: null }
        : { term, pattern: new RegExp(`(?:^|[^a-z0-9])${escapeRegex(term)}(?:$|[^a-z0-9])`) },
    )
}

function hits(haystack, terms) {
  return terms.some(({ term, pattern }) =>
    pattern ? pattern.test(haystack) : haystack.includes(term),
  )
}

function textOf(post) {
  return post.text || [post.title, post.body].filter(Boolean).join('. ')
}

export function splitByProduct(posts, mineTerms, theirsTerms) {
  const mine = matchers(mineTerms)
  const theirs = matchers(theirsTerms)
  if (!mine.length || !theirs.length) return { both: [], theirs: [], mine: [] }

  const ranked = [...posts].sort(
    (a, b) => (b.engagement ?? b.score ?? 0) - (a.engagement ?? a.score ?? 0),
  )

  const groups = { both: [], theirs: [], mine: [] }

  for (const post of ranked) {
    const text = textOf(post)
    if (!text) continue
    const haystack = text.toLowerCase()

    const isMine = hits(haystack, mine)
    const isTheirs = hits(haystack, theirs)
    if (!isMine && !isTheirs) continue

    const entry = {
      id: post.id,
      subreddit: post.subreddit,
      score: post.score ?? 0,
      permalink: post.permalink || null,
      sentiment: post.sentimentLabel || null,
      text: text.slice(0, EXCERPT_CHARS),
    }

    if (isMine && isTheirs) {
      if (groups.both.length < BOTH) groups.both.push(entry)
    } else if (isTheirs) {
      if (groups.theirs.length < THEIRS_ONLY) groups.theirs.push(entry)
    } else if (groups.mine.length < MINE_ONLY) {
      groups.mine.push(entry)
    }
  }

  return groups
}

function numbered(sections) {
  const byNumber = new Map()
  let next = 1
  const rendered = []

  for (const [heading, excerpts] of sections) {
    if (!excerpts.length) continue
    const lines = excerpts.map((excerpt) => {
      const number = next
      next += 1
      byNumber.set(number, excerpt)
      return `  [${number}] (r/${excerpt.subreddit}, ${excerpt.score} points) ${excerpt.text}`
    })
    rendered.push(`### ${heading}\n${lines.join('\n')}`)
  }

  return { rendered, byNumber }
}

async function resolveProducts(brand, mine, theirs, rivalCompany, identity) {
  const user =
    `Brand being researched: ${identity.canonical_name || brand}` +
    (identity.category ? ` — ${identity.category}` : '') +
    (identity.industry ? ` (${identity.industry})` : '') +
    `\nTheir product or service, as typed: ${mine}` +
    (theirs
      ? `\nThe rival product to compare it against, as typed: ${theirs}`
      : rivalCompany
        ? `\nNo rival product was named. Pick the counterpart from: ${rivalCompany}`
        : '\nNo rival product and no rival company were named. Pick both yourself.')

  return structured({
    system: RESOLVE_SYSTEM,
    user,
    schema: RESOLVE_SCHEMA,
    effort: 'low',
    maxTokens: 1800,
  })
}

export async function compareProducts(
  brand,
  posts = [],
  identity = {},
  mine = '',
  theirs = '',
  rivalCompany = '',
) {
  const ownTyped = String(mine || '').trim()
  const rivalTyped = String(theirs || '').trim()
  const rivalBrand = String(rivalCompany || '').trim()
  if (!ownTyped) {
    return { source: 'none', reason: 'no product named', comparison: null, model: null }
  }

  if (!(await llmAvailable())) {
    return {
      source: 'unavailable',
      reason: 'No model is connected, so this comparison cannot be read.',
      products: { mine: { typed: ownTyped }, theirs: { typed: rivalTyped } },
      comparison: null,
      model: null,
    }
  }

  const resolved = await resolveProducts(brand, ownTyped, rivalTyped, rivalBrand, identity)
  if (!resolved?.mine?.terms?.length || !resolved?.theirs?.terms?.length) {
    return {
      source: 'failed',
      reason: 'Could not work out what to compare from those two names.',
      products: { mine: { typed: ownTyped }, theirs: { typed: rivalTyped } },
      comparison: null,
      model: activeModel(),
    }
  }

  const products = {
    mine: { typed: ownTyped, ...resolved.mine },
    theirs: { typed: rivalTyped, ...resolved.theirs },
    theirsInferred: Boolean(resolved.theirs_inferred) || !rivalTyped,
    comparable: resolved.comparable !== false,
    relationship: resolved.relationship || '',
    dimensions: resolved.dimensions || [],
  }

  const groups = splitByProduct(posts, resolved.mine.terms, resolved.theirs.terms)
  const coverage = {
    headToHead: groups.both.length,
    theirsOnly: groups.theirs.length,
    mineOnly: groups.mine.length,
  }

  if (!groups.both.length && !groups.mine.length && !groups.theirs.length) {
    return {
      source: 'none',
      reason: 'The collected discussions never mention either product.',
      products,
      coverage,
      comparison: null,
      model: activeModel(),
    }
  }

  const { rendered, byNumber } = numbered([
    [`Excerpts about both ${products.mine.name} and ${products.theirs.name}`, groups.both],
    [`Excerpts about ${products.theirs.name} only`, groups.theirs],
    [`Excerpts about ${products.mine.name} only`, groups.mine],
  ])

  const user =
    `Their product: ${products.mine.name} by ${products.mine.owner} — ${products.mine.what_it_is}` +
    `\nRival product: ${products.theirs.name} by ${products.theirs.owner} — ${products.theirs.what_it_is}` +
    (products.relationship ? `\nHow they relate: ${products.relationship}` : '') +
    (products.dimensions.length
      ? `\nDimensions worth checking for this pairing: ${products.dimensions.join(', ')}`
      : '') +
    `\n\n${rendered.join('\n\n')}`

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
      products,
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
      }
    })
    .filter(Boolean)

  return {
    source: 'llm',
    products,
    coverage,
    comparison: { ...read, quotes },
    model: activeModel(),
  }
}

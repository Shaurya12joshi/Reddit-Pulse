import { structured, activeModel, llmAvailable } from './client.js'

const SYSTEM = `You read Reddit discussions where people compare one brand against its competitors, and report what those people concluded.

Report only what the excerpts support. Every claim must be traceable to a passage you were given — you are summarising a corpus, not recalling what you know about these companies. Where the excerpts are thin or mixed, say so through the counts and confidence rather than inventing a verdict.

For each competitor:
- verdict: which brand the commenters lean toward overall. "brand" if they favour the searched brand, "competitor" if they favour the rival, "mixed" when opinion genuinely splits, "unclear" when the excerpts do not settle it.
- summary: one or two sentences on what the comparison turns on, in plain language.
- brand_wins / competitor_wins: the specific dimensions each side is praised for — price, support, reliability, build quality, delivery speed, and so on. Short noun phrases, lowercase. Only dimensions the excerpts raise.
- switching: what the excerpts show about people moving between the two, and in which direction. Empty string when nobody mentions switching.
- confidence: how well the excerpts support the verdict.

Be terse. Every field is consumed by code.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['comparisons'],
  properties: {
    comparisons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'competitor',
          'verdict',
          'summary',
          'brand_wins',
          'competitor_wins',
          'switching',
          'confidence',
        ],
        properties: {
          competitor: { type: 'string' },
          verdict: { type: 'string', enum: ['brand', 'competitor', 'mixed', 'unclear'] },
          summary: { type: 'string' },
          brand_wins: { type: 'array', items: { type: 'string' }, maxItems: 5 },
          competitor_wins: { type: 'array', items: { type: 'string' }, maxItems: 5 },
          switching: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
}

const MAX_EXCERPTS = 60
const MAX_PER_COMPETITOR = 10
const EXCERPT_CHARS = 420

const lower = (value) => String(value || '').trim().toLowerCase()

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function patternsFor(names = []) {
  return names
    .map((value) => String(value || '').trim())
    .filter((value) => value.length >= 2)
    .map((value) => new RegExp(`(?:^|[^\\w])${escapeRegex(value)}(?:$|[^\\w])`, 'i'))
}

export function collectEvidence(posts, brandNames, competitors = []) {
  const rivals = competitors
    .map((entry) => ({
      name: String(entry?.name || '').trim(),
      patterns: patternsFor([entry?.name, ...(entry?.aliases || [])]),
    }))
    .filter((rival) => rival.name && rival.patterns.length)

  if (!rivals.length) return new Map()

  const brandPatterns = patternsFor(
    Array.isArray(brandNames) ? brandNames : [brandNames],
  )
  if (!brandPatterns.length) return new Map()
  const buckets = new Map(rivals.map((rival) => [rival.name, []]))

  const ranked = [...posts].sort(
    (a, b) => (b.engagement ?? b.score ?? 0) - (a.engagement ?? a.score ?? 0),
  )

  for (const post of ranked) {
    const text = post.text || [post.title, post.body].filter(Boolean).join('. ')
    if (!text || !brandPatterns.some((pattern) => pattern.test(text))) continue

    for (const rival of rivals) {
      const bucket = buckets.get(rival.name)
      if (bucket.length >= MAX_PER_COMPETITOR) continue
      if (!rival.patterns.some((pattern) => pattern.test(text))) continue

      bucket.push({
        id: post.id,
        subreddit: post.subreddit,
        score: post.score ?? 0,
        text: text.slice(0, EXCERPT_CHARS),
        sentiment: post.sentimentLabel || null,
      })
    }
  }

  for (const [name, bucket] of buckets) if (!bucket.length) buckets.delete(name)
  return buckets
}

function trimToBudget(buckets) {
  const names = [...buckets.keys()]
  if (!names.length) return buckets

  const perRival = Math.max(2, Math.floor(MAX_EXCERPTS / names.length))
  const trimmed = new Map()
  for (const [name, excerpts] of buckets) trimmed.set(name, excerpts.slice(0, perRival))
  return trimmed
}

export async function compareAgainstCompetitors(brand, posts = [], identity = {}) {
  const label = identity.canonical_name || brand
  const names = [brand, identity.canonical_name, ...(identity.aliases || [])]
  const buckets = trimToBudget(collectEvidence(posts, names, identity.competitors || []))

  const coverage = [...buckets.entries()].map(([competitor, excerpts]) => ({
    competitor,
    excerpts: excerpts.length,
  }))

  if (!buckets.size) {
    return { comparisons: [], coverage, source: 'none', model: null }
  }

  if (!(await llmAvailable())) {
    return { comparisons: [], coverage, source: 'unavailable', model: null }
  }

  const sections = [...buckets.entries()].map(([competitor, excerpts]) => {
    const lines = excerpts
      .map((excerpt, index) => `  ${index + 1}. [r/${excerpt.subreddit}] ${excerpt.text}`)
      .join('\n')
    return `### ${label} vs ${competitor}\n${lines}`
  })

  const user =
    `Searched brand: ${label}` +
    (identity.category ? ` — competes in ${identity.category}` : '') +
    `\n\nExcerpts, grouped by the competitor they mention alongside ${label}:\n\n` +
    sections.join('\n\n')

  const result = await structured({
    system: SYSTEM,
    user,
    schema: SCHEMA,
    effort: 'high',
    maxTokens: 4000,
  })

  if (!result?.comparisons) {
    return { comparisons: [], coverage, source: 'failed', model: activeModel() }
  }

  const byName = new Map([...buckets.keys()].map((name) => [lower(name), name]))
  const comparisons = result.comparisons
    .map((entry) => {
      const name = byName.get(lower(entry.competitor))
      if (!name) return null
      const excerpts = buckets.get(name) || []
      return {
        ...entry,
        competitor: name,
        mentions: excerpts.length,
        evidence: excerpts.slice(0, 3).map((excerpt) => ({
          id: excerpt.id,
          subreddit: excerpt.subreddit,
          score: excerpt.score,
          quote: excerpt.text.slice(0, 220),
        })),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mentions - a.mentions)

  return { comparisons, coverage, source: 'llm', model: activeModel() }
}

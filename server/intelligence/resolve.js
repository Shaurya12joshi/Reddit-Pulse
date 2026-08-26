import { structured, activeModel, llmAvailable } from './client.js'
import { deriveBrandContext } from '../../src/analysis/buzz.js'
import { detectCompetitors } from '../../src/analysis/competitors.js'
import { STOPWORDS } from '../../src/analysis/lexicon.js'

const SYSTEM = `You identify brands for a Reddit monitoring system.

Given a brand name and a sample of Reddit post titles that matched a search for it, determine what the brand is and — critically — how to tell its mentions apart from other uses of the same word.

Rules:
- positive_markers: words that, appearing near the name, confirm the brand is meant. Prefer words specific to the brand's domain over generic business words.
- negative_markers: words that indicate a DIFFERENT sense of the same string — a common noun, an unrelated company, a fictional work, a person. Empty list if the name is unambiguous.
- Cover the brand's distinct facets, not just its most visible one. A retailer has consumer delivery AND warehouse employment AND cloud services AND a share price.
- competitors: real, current, direct competitors that a user would plausibly weigh against this brand in the same buying or usage decision. Ordered most-compared first. No parent companies, no suppliers, and no company that merely shares a broad market without being an actual alternative.
- industry: the broad sector, in the words people use, not a taxonomy code.
- category: the narrower product or service category the brand is chosen within — the level at which people actually compare options. Prefer "online marketplace" over "e-commerce", "budget airline" over "transport", "project management tool" over "software".
- category_terms: short phrases people type on Reddit when discussing this category without naming any brand — how buyers describe the need or the shortlist. No brand names in them.
- Judge from the titles given plus your own knowledge. If the titles show a sense you did not expect, include markers for it.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'canonical_name',
    'entity_type',
    'aliases',
    'positive_markers',
    'negative_markers',
    'competitors',
    'industry',
    'category',
    'category_terms',
    'expected_facets',
    'confidence',
  ],
  properties: {
    canonical_name: { type: 'string' },
    entity_type: { type: 'string', description: 'e.g. airline, saas, retailer, console' },
    aliases: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    positive_markers: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    negative_markers: { type: 'array', items: { type: 'string' }, maxItems: 15 },
    competitors: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'aliases'],
        properties: {
          name: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' }, maxItems: 4 },
        },
      },
    },
    industry: { type: 'string', description: 'broad sector, e.g. airline, grocery retail' },
    category: {
      type: 'string',
      description: 'the narrower category people compare within, e.g. online marketplace',
    },
    category_terms: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    expected_facets: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

export function mineCompetitors(posts, companyName, { limit = 8, minPosts = 3 } = {}) {
  const counts = new Map()

  for (const post of posts) {
    const text = post.text || [post.title, post.body].filter(Boolean).join('. ')
    const seen = new Set()
    for (const mention of detectCompetitors(text, companyName)) {
      if (seen.has(mention.brand)) continue
      seen.add(mention.brand)
      counts.set(mention.brand, (counts.get(mention.brand) || 0) + 1)
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minPosts)
    .filter(([name]) => !STOPWORDS.has(name.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, mentions]) => ({ name, aliases: [], mentions }))
}

export function heuristicIdentity(company, posts, communities = []) {
  const context = deriveBrandContext(posts, company, communities)
  const label = company.charAt(0).toUpperCase() + company.slice(1)

  return {
    canonical_name: label,
    entity_type: 'unknown',
    industry: '',
    category: '',
    category_terms: (context.facets || []).slice(0, 4).map((facet) => facet.label),
    aliases: (context.aliases || []).map((entry) => entry.alias),
    positive_markers: (context.contextTerms || []).slice(0, 15).map((entry) => entry.term),
    negative_markers: [],
    competitors: mineCompetitors(posts, label),
    expected_facets: (context.facets || []).map((facet) => facet.label),
    confidence: 0.4,
  }
}

export async function resolveBrand(company, posts = [], communities = []) {
  const fallback = heuristicIdentity(company, posts, communities)

  if (!(await llmAvailable())) return { identity: fallback, source: 'heuristic', model: null }

  const titles = sampleTitles(posts, 40)

  try {
    const result = await structured({
      system: SYSTEM,
      user: `Brand as searched: "${company}"\n\nReddit titles that matched:\n${titles
        .map((title, index) => `${index + 1}. ${title}`)
        .join('\n')}`,
      schema: SCHEMA,
      effort: 'high',
      maxTokens: 2000,
    })

    if (!result) return { identity: fallback, source: 'heuristic', model: null }

    return {
      identity: {
        ...result,
        category_terms: unique([
          ...(result.category_terms || []),
          ...fallback.category_terms.slice(0, 2),
        ]),
        aliases: unique([...(result.aliases || []), ...fallback.aliases]),
        positive_markers: unique([
          ...(result.positive_markers || []),
          ...fallback.positive_markers.slice(0, 8),
        ]),
      },
      source: 'llm',
      model: activeModel(),
    }
  } catch (error) {
    console.warn('[intelligence] brand resolution failed:', error.message)
    return { identity: fallback, source: 'heuristic', model: null }
  }
}

function sampleTitles(posts, count) {
  const titles = posts
    .filter((post) => post.type === 'post' && post.title)
    .map((post) => `[r/${post.subreddit}] ${post.title.slice(0, 140)}`)

  const seen = new Set()
  const unique = titles.filter((title) => {
    const key = title.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length <= count) return unique
  const step = unique.length / count
  return Array.from({ length: count }, (_, index) => unique[Math.floor(index * step)])
}

const unique = (values) => [...new Set(values.filter(Boolean))]

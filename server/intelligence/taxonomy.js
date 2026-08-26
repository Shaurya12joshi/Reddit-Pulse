import { structured, activeModel, llmAvailable } from './client.js'
import { BASE_CATEGORIES } from '../../src/analysis/classify.js'

const SYSTEM = `You design classification taxonomies for brand monitoring on Reddit.

Given a brand and a sample of thread titles, propose the categories that a brand team would actually route work by. These are ADDITIONAL to a fixed base set (complaint, praise, question, purchase_intent, competitor_comparison, misinformation_risk, neutral) — do not repeat those.

Rules:
- Propose 3 to 6 categories, each describing a distinct operational concern for THIS brand.
- Each needs: a snake_case id, a short label, a one-line definition, and 6-12 lowercase keyword hints that literally appear in such threads.
- Hints must be discriminative. "issue" and "problem" appear everywhere and are useless; "bag didn't arrive", "denied boarding", "chargeback" are not.
- If a category would only ever apply to a handful of threads, do not propose it.
- Set polarity only when the category is inherently negative or positive.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['categories'],
  properties: {
    categories: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'definition', 'hints'],
        properties: {
          id: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
          label: { type: 'string' },
          definition: { type: 'string' },
          hints: { type: 'array', minItems: 6, maxItems: 12, items: { type: 'string' } },
          polarity: { type: 'string', enum: ['negative', 'positive'] },
        },
      },
    },
  },
}

export async function induceTaxonomy(company, digests = [], identity = {}) {
  if (!(await llmAvailable()) || digests.length < 15) {
    return { categories: BASE_CATEGORIES, source: 'base', model: null }
  }

  const titles = digests.slice(0, 100).map((digest, index) => `${index + 1}. ${digest.title}`)

  try {
    const result = await structured({
      system: SYSTEM,
      user:
        `Brand: ${identity.canonical_name || company}` +
        (identity.entity_type ? ` (${identity.entity_type})` : '') +
        `\n\nThread titles:\n${titles.join('\n')}`,
      schema: SCHEMA,
      effort: 'high',
      maxTokens: 3000,
    })

    if (!result?.categories?.length) {
      return { categories: BASE_CATEGORIES, source: 'base', model: null }
    }

    const baseIds = new Set(BASE_CATEGORIES.map((category) => category.id))
    const induced = result.categories.filter((category) => !baseIds.has(category.id))

    return { categories: [...BASE_CATEGORIES, ...induced], source: 'llm', model: activeModel() }
  } catch (error) {
    console.warn('[intelligence] taxonomy induction failed:', error.message)
    return { categories: BASE_CATEGORIES, source: 'base', model: null }
  }
}

export const DRIFT_THRESHOLD = 0.3

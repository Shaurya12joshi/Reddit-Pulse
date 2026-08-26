import { structured, activeModel, llmAvailable, activeBatchSize } from './client.js'

const batchSize = activeBatchSize

const ANALYSIS_SYSTEM = `You assess Reddit threads for a brand monitoring system.

For each thread you receive a digest: title, truncated body, the top comments by score, community, age, engagement and a deterministic prescore. Judge what those numbers cannot.

importance (0-100) must reflect BUSINESS impact to the brand, not popularity. A 40-upvote thread where a buyer is choosing between two products outranks a 5,000-upvote joke. Weigh: how many people plausibly see it, whether it is unresolved, whether it looks like a recurring systemic issue rather than a one-off, whether a false claim is spreading, and whether the brand acting could change the outcome. The prescore already accounts for reach and recency — do not simply restate it.

Set participation_worthy true only where a brand response would plausibly improve the outcome. Most threads are not.

Be terse. Every field is consumed by code, not read as prose.`

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['analyses'],
  properties: {
    analyses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id', 'importance', 'drivers', 'category', 'topic',
          'sentiment', 'intensity', 'recurring', 'factual_risk', 'participation_worthy',
        ],
        properties: {
          id: { type: 'string' },
          importance: { type: 'integer', minimum: 0, maximum: 100 },
          drivers: {
            type: 'array',
            maxItems: 4,
            items: {
              type: 'string',
              enum: [
                'high_reach', 'accelerating', 'unresolved', 'recurring_issue',
                'purchase_decision', 'false_claim', 'competitor_favoured',
                'influential_community', 'staff_or_policy', 'low_impact',
              ],
            },
          },
          category: { type: 'string' },
          secondary: { type: 'array', maxItems: 2, items: { type: 'string' } },
          topic: { type: 'string', description: 'specific context, 2-6 words' },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed'] },
          intensity: { type: 'number', minimum: 0, maximum: 1 },
          competitors: {
            type: 'array',
            maxItems: 4,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'stance'],
              properties: {
                name: { type: 'string' },
                stance: {
                  type: 'string',
                  enum: ['favoured_over_brand', 'unfavourable', 'neutral_mention'],
                },
              },
            },
          },
          recurring: { type: 'boolean' },
          factual_risk: { type: 'string', enum: ['none', 'unverified_claim', 'likely_false'] },
          participation_worthy: { type: 'boolean' },
        },
      },
    },
  },
}

export async function analyseThreads({ digests = [], categories = [], identity = {}, fallbacks = new Map(), onProgress }) {
  if (!digests.length) return { analyses: new Map(), source: 'none' }

  if (!(await llmAvailable())) {
    return { analyses: deterministicAnalyses(digests, fallbacks), source: 'deterministic' }
  }

  const rivals = (identity.competitors || []).map((entry) => entry?.name).filter(Boolean)

  const system =
    `${ANALYSIS_SYSTEM}\n\nBrand: ${identity.canonical_name || 'unknown'}` +
    (identity.entity_type ? ` (${identity.entity_type})` : '') +
    (identity.category ? `\nCompetes in: ${identity.category}` : '') +
    (rivals.length
      ? `\nCompared against: ${rivals.join(', ')}. In a comparison thread, judge impact on ` +
        `THIS brand — losing a head-to-head is a negative outcome for it.`
      : '') +
    `\n\nCategories — use exactly one id for "category":\n` +
    categories.map((category) => `- ${category.id}: ${category.definition}`).join('\n')

  const analyses = new Map()
  const size = batchSize()

  for (let index = 0; index < digests.length; index += size) {
    const batch = digests.slice(index, index + size)
    onProgress?.({ done: index, total: digests.length })

    try {
      const result = await structured({
        system,
        user: JSON.stringify(batch),
        schema: ANALYSIS_SCHEMA,
        effort: 'medium',
        maxTokens: 4000,
      })

      for (const analysis of result?.analyses ?? []) analyses.set(analysis.id, analysis)
    } catch (error) {
      console.warn('[intelligence] analysis batch failed:', error.message)
    }
  }

  const succeeded = analyses.size
  const missing = digests.filter((digest) => !analyses.has(digest.id))
  if (missing.length) {
    for (const [id, analysis] of deterministicAnalyses(missing, fallbacks)) analyses.set(id, analysis)
  }

  return { analyses, source: succeeded > 0 ? 'llm' : 'deterministic', model: activeModel(), succeeded }
}

export function deterministicAnalyses(digests, fallbacks = new Map()) {
  const analyses = new Map()

  for (const digest of digests) {
    const classification = fallbacks.get(digest.id)
    const sentiment = classification?.sentiment ?? 0
    const importance = Math.round(digest.prescore ?? 0)

    analyses.set(digest.id, {
      id: digest.id,
      importance,
      drivers: [
        digest.velocity_pct >= 70 ? 'accelerating' : null,
        (digest.score ?? 0) + (digest.comments ?? 0) > 500 ? 'high_reach' : null,
        (digest.competitor_hits || []).length ? 'competitor_favoured' : null,
      ].filter(Boolean),
      category: classification?.category ?? 'neutral',
      topic: digest.title?.slice(0, 60) ?? '',
      sentiment: sentiment < -0.15 ? 'negative' : sentiment > 0.15 ? 'positive' : 'neutral',
      intensity: Math.min(1, Math.abs(sentiment)),
      competitors: (digest.competitor_hits || []).map((name) => ({ name, stance: 'neutral_mention' })),
      recurring: false,
      factual_risk: 'none',
      participation_worthy: false,
      degraded: true,
    })
  }

  return analyses
}

const ACTION_SYSTEM = `You advise a brand team on whether and how to join a Reddit conversation.

Most threads do not warrant a brand reply. Recommending one everywhere destroys the queue's usefulness and gets brands mocked. Default to monitor_only unless there is a concrete reason to act.

Reddit communities are hostile to marketing. A reply is appropriate mainly when: a customer has an unresolved problem the brand can actually fix, a factual claim about the brand is wrong, or someone is directly asking a question only the brand can answer.

"say" is 2-4 concrete points, not a script. "avoid" is the specific traps for THIS thread, not generic advice. Never propose anything that conceals who is speaking.`

const ACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendations'],
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'should_participate', 'action', 'objective', 'rationale', 'say', 'avoid', 'confidence'],
        properties: {
          id: { type: 'string' },
          should_participate: { type: 'boolean' },
          action: {
            type: 'string',
            enum: [
              'respond_directly', 'provide_information', 'address_complaint',
              'correct_misinformation', 'thank_customer', 'join_discussion',
              'monitor_only', 'escalate_internally', 'do_not_participate',
            ],
          },
          target: { type: 'string', description: 'thread id, or a comment id when replying to one person' },
          objective: { type: 'string' },
          rationale: { type: 'string' },
          say: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
          avoid: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
          disclosure_required: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
}

export async function recommendActions({ digests = [], analyses = new Map(), identity = {} }) {
  const worthy = digests.filter((digest) => analyses.get(digest.id)?.participation_worthy)
  if (!worthy.length || !(await llmAvailable())) return new Map()

  const system =
    `${ACTION_SYSTEM}\n\nBrand: ${identity.canonical_name || 'unknown'}` +
    (identity.entity_type ? ` (${identity.entity_type})` : '')

  const out = new Map()
  const size = batchSize()

  for (let index = 0; index < worthy.length; index += size) {
    const batch = worthy.slice(index, index + size)
    const payload = batch.map((digest) => ({
      ...digest,
      analysis: pick(analyses.get(digest.id), [
        'importance', 'category', 'topic', 'sentiment', 'recurring', 'factual_risk', 'drivers',
      ]),
    }))

    try {
      const result = await structured({
        system,
        user: JSON.stringify(payload),
        schema: ACTION_SCHEMA,
        effort: 'high',
        maxTokens: 6000,
      })
      for (const recommendation of result?.recommendations ?? []) out.set(recommendation.id, recommendation)
    } catch (error) {
      console.warn('[intelligence] recommendation batch failed:', error.message)
    }
  }

  return out
}

const pick = (object, keys) => {
  const out = {}
  for (const key of keys) if (object?.[key] !== undefined) out[key] = object[key]
  return out
}

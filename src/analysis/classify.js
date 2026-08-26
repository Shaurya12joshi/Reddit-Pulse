import { escapeRegex } from './topics.js'
import { analyzeSentiment } from './sentiment.js'

export const BASE_CATEGORIES = [
  {
    id: 'complaint',
    label: 'Customer complaint',
    definition: 'A customer reports a bad experience with the brand',
    hints: ['refund', 'cancelled', 'canceled', 'broken', 'terrible', 'worst', 'scam',
      'never again', 'ripped off', 'no response', 'still waiting', 'charged me',
      'leaving', 'killed', 'ruined', 'downhill', 'gone downhill', 'stopped using',
      'getting worse', 'used to be', 'don\'t put', 'do not put', 'avoid'],
    polarity: 'negative',
  },
  {
    id: 'praise',
    label: 'Positive / praise',
    definition: 'A customer reports a good experience or recommends the brand',
    hints: ['love', 'best', 'amazing', 'impressed', 'recommend', 'worth it', 'great experience',
      'thank you', 'shoutout', 'flawless'],
    polarity: 'positive',
  },
  {
    id: 'question',
    label: 'Question requiring an answer',
    definition: 'Someone asks something the brand could answer',
    hints: ['how do i', 'how can i', 'does anyone know', 'is it possible', 'anyone know',
      'any idea', 'help with', 'confused about', 'what happens if',
      'question', 'anyone else', 'quick q'],
  },
  {
    id: 'purchase_intent',
    label: 'Purchase / decision intent',
    definition: 'Someone is deciding whether to buy or adopt',
    hints: ['should i buy', 'worth buying', 'thinking of getting', 'about to order',
      'considering', 'which one should', 'looking to switch', 'before i commit'],
  },
  {
    id: 'competitor_comparison',
    label: 'Competitor comparison',
    definition: 'The brand is weighed against a named alternative',
    hints: ['vs', 'versus', 'compared to', 'better than', 'instead of', 'switched from',
      'switched to', 'alternative', 'alternatives', 'replacement for', 'moving away from'],
  },
  {
    id: 'misinformation_risk',
    label: 'Possible misinformation',
    definition: 'A factual claim about the brand that may be false or outdated',
    hints: ['i heard', 'apparently', 'someone told me', 'is it true', 'rumour', 'rumor',
      'supposedly', 'read somewhere'],
  },
  {
    id: 'neutral',
    label: 'Neutral discussion',
    definition: 'The brand is mentioned without praise, complaint or a question',
    hints: [],
  },
]

export function compileTaxonomy(categories = BASE_CATEGORIES) {
  return categories.map((category) => ({
    ...category,
    matchers: (category.hints || []).map((hint) => ({
      hint,
      regex: new RegExp(`\\b${escapeRegex(String(hint).toLowerCase())}\\b`, 'i'),
    })),
  }))
}

const QUESTION_SHAPE = /\?|^(?:how|why|what|which|is|are|does|can|should|anyone|any\s?body)\b/i

export function classifyThread(digest, compiled, { uncertainBelow = 0.35 } = {}) {
  const text = `${digest.title || ''}. ${digest.body || ''}`.toLowerCase()
  const commentText = (digest.top_comments || []).map((comment) => comment.t).join(' ').toLowerCase()
  const haystack = `${text} ${commentText}`

  const sentiment = analyzeSentiment(haystack)

  const scores = compiled.map((category) => {
    const hits = category.matchers.filter((matcher) => matcher.regex.test(haystack))
    let score = hits.length

    if (category.id === 'question' && QUESTION_SHAPE.test(digest.title || '')) score += 1.5

    if (category.id === 'competitor_comparison' && (digest.competitor_hits || []).length) {
      score += hits.length ? 1.5 : 0.5
    }

    const strong = Math.abs(sentiment.score) > 0.35
    if (category.polarity === 'negative' && sentiment.score < -0.15 && (hits.length || strong)) score += 1
    if (category.polarity === 'positive' && sentiment.score > 0.15 && (hits.length || strong)) score += 1

    return { id: category.id, label: category.label, score, hits: hits.map((hit) => hit.hint) }
  })

  const ranked = [...scores].sort((a, b) => b.score - a.score)
  const [best, second] = ranked

  if (!best || best.score === 0) {
    return {
      id: digest.id,
      category: 'neutral',
      label: 'Neutral discussion',
      confidence: 0.5,
      uncertain: false,
      evidence: [],
      sentiment: Number(sentiment.score.toFixed(3)),
    }
  }

  const margin = (best.score - (second?.score ?? 0)) / best.score
  const confidence = Number(Math.min(1, 0.4 + 0.6 * margin).toFixed(2))

  return {
    id: digest.id,
    category: best.id,
    label: best.label,
    confidence,
    uncertain: confidence < uncertainBelow + 0.4,
    runnerUp: second?.score ? second.id : null,
    evidence: best.hits.slice(0, 4),
    sentiment: Number(sentiment.score.toFixed(3)),
  }
}

export function classifyAll(digests, categories = BASE_CATEGORIES, { alwaysEscalate = 15 } = {}) {
  const compiled = compileTaxonomy(categories)
  const results = digests.map((digest) => classifyThread(digest, compiled))

  const byPrescore = [...digests].sort((a, b) => (b.prescore ?? 0) - (a.prescore ?? 0))
  const forced = new Set(byPrescore.slice(0, alwaysEscalate).map((digest) => digest.id))

  const escalate = results.filter((result) => result.uncertain || forced.has(result.id))
  const settled = results.filter((result) => !result.uncertain && !forced.has(result.id))

  return {
    results,
    settled,
    escalate,
    stats: {
      total: results.length,
      settledByCode: settled.length,
      escalated: escalate.length,
      escalatedForConfidence: escalate.filter((result) => result.uncertain).length,
      escalatedForImportance: escalate.filter((result) => !result.uncertain).length,
    },
  }
}

export function taxonomyDrift(results) {
  if (!results.length) return 0
  const neutral = results.filter((result) => result.category === 'neutral').length
  return Number((neutral / results.length).toFixed(3))
}

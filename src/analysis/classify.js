/**
 * Applying a taxonomy at volume, without paying an LLM per thread.
 *
 * The division of labour:
 *
 *   The LLM *writes* the classifier — once per brand, it induces the
 *   brand-specific categories, their definitions and the words that signal
 *   them (see server/intelligence/taxonomy.js).
 *
 *   Code *runs* the classifier — over every thread, for free, here.
 *
 *   The LLM sees only what code could not confidently place.
 *
 * That is what keeps the taxonomy extensible (it is data, not a hard-coded
 * enum) while keeping the per-thread cost at zero for the easy majority.
 */

import { escapeRegex } from './topics.js'
import { analyzeSentiment } from './sentiment.js'

/**
 * Categories every brand gets, so output stays comparable across brands.
 * Induction adds brand-specific ones on top; it never replaces these.
 */
export const BASE_CATEGORIES = [
  {
    id: 'complaint',
    label: 'Customer complaint',
    definition: 'A customer reports a bad experience with the brand',
    hints: ['refund', 'cancelled', 'canceled', 'broken', 'terrible', 'worst', 'scam',
      'never again', 'ripped off', 'no response', 'still waiting', 'charged me',
      // Churn and decline language. Added after the eval caught "Notion killed
      // the thing that made Notion good" being read as praise (for "good") and
      // "I'm leaving Notion after many years" as a comparison.
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
      // "Odd question; Slack iOS on shared devices" has no question mark and
      // does not start with a wh-word, so the structural test misses it.
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

/** Compile a taxonomy once; matching hundreds of threads then costs nothing. */
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

/**
 * Classify one thread against a compiled taxonomy.
 *
 * Returns the best category, a confidence, and the evidence behind it. Low
 * confidence is not a failure — it is the routing signal that sends this
 * thread to the LLM.
 */
export function classifyThread(digest, compiled, { uncertainBelow = 0.35 } = {}) {
  const text = `${digest.title || ''}. ${digest.body || ''}`.toLowerCase()
  const commentText = (digest.top_comments || []).map((comment) => comment.t).join(' ').toLowerCase()
  const haystack = `${text} ${commentText}`

  const sentiment = analyzeSentiment(haystack)

  const scores = compiled.map((category) => {
    const hits = category.matchers.filter((matcher) => matcher.regex.test(haystack))
    let score = hits.length

    /*
     * Structural evidence, which keywords alone miss — but never on its own.
     *
     * Both of these bonuses used to fire unsupported, and both produced
     * confident wrong answers, which is the worst failure mode here because a
     * confident answer is never escalated to the LLM:
     *   - a thread merely *naming* a competitor scored a comparison (a Bill
     *     Gates news story came back as "competitor_comparison", confidence 1.0)
     *   - weak positive sentiment alone scored praise ("Any Slack alternatives?")
     */
    if (category.id === 'question' && QUESTION_SHAPE.test(digest.title || '')) score += 1.5

    // A competitor is named *and* the language is comparative.
    if (category.id === 'competitor_comparison' && (digest.competitor_hits || []).length) {
      score += hits.length ? 1.5 : 0.5
    }

    // Sentiment corroborates a lexical hit, or must be strong to stand alone.
    const strong = Math.abs(sentiment.score) > 0.35
    if (category.polarity === 'negative' && sentiment.score < -0.15 && (hits.length || strong)) score += 1
    if (category.polarity === 'positive' && sentiment.score > 0.15 && (hits.length || strong)) score += 1

    return { id: category.id, label: category.label, score, hits: hits.map((hit) => hit.hint) }
  })

  const ranked = [...scores].sort((a, b) => b.score - a.score)
  const [best, second] = ranked

  // Nothing matched at all: that is "neutral", and it is a confident answer.
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

  // Confidence is the *margin*, not the raw score: two categories tied at four
  // hits each is exactly the case a human (or the LLM) should look at.
  const margin = (best.score - (second?.score ?? 0)) / best.score
  const confidence = Number(Math.min(1, 0.4 + 0.6 * margin).toFixed(2))

  return {
    id: digest.id,
    category: best.id,
    label: best.label,
    confidence,
    uncertain: confidence < uncertainBelow + 0.4, // margin-based, see above
    runnerUp: second?.score ? second.id : null,
    evidence: best.hits.slice(0, 4),
    sentiment: Number(sentiment.score.toFixed(3)),
  }
}

/**
 * Classify a batch, and split it into what code settled and what needs the
 * expensive layer.
 *
 * `alwaysEscalate` exists because confidence is not the only reason to want a
 * real reading: the highest-prescore threads get LLM attention regardless,
 * since those are the ones a recommendation might be built on.
 */
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

/** Share of threads landing in "neutral" — the signal that induction is stale. */
export function taxonomyDrift(results) {
  if (!results.length) return 0
  const neutral = results.filter((result) => result.category === 'neutral').length
  return Number((neutral / results.length).toFixed(3))
}

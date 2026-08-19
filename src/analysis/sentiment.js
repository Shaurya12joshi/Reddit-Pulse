import {
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
  NEGATIONS,
  INTENSIFIERS,
} from './lexicon.js'

const WORD_SCORES = { ...POSITIVE_WORDS, ...NEGATIVE_WORDS }

/** How many words back we look for a negation ("not really that great"). */
const NEGATION_WINDOW = 3

/** Anything within ±this of zero is treated as neutral. */
export const NEUTRAL_THRESHOLD = 0.08

/** Split text into lowercase word tokens, keeping apostrophes. */
export function tokenize(text) {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Split text into clauses on sentence and comma boundaries.
 *
 * Negation must not leak across a boundary: in "This never crashes, honestly
 * reliable" the "never" applies to "crashes" but emphatically not to
 * "reliable" three words later.
 */
function toClauses(text) {
  return text
    .split(/[.!?;:,—–\n]+/)
    .map((clause) => clause.trim())
    .filter(Boolean)
}

/** Split text into sentences. Good enough for Reddit prose. */
export function splitSentences(text) {
  if (!text) return []
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
}

/**
 * Score a single piece of text.
 * @returns {{score:number,label:string,positiveHits:string[],negativeHits:string[],hitCount:number}}
 */
export function analyzeSentiment(text) {
  const positiveHits = []
  const negativeHits = []
  let total = 0

  // Score clause by clause so negation and intensifiers stay in their scope.
  toClauses(text || '').forEach((clause) => {
    const tokens = tokenize(clause)

    tokens.forEach((token, index) => {
      const base = WORD_SCORES[token]
      if (base === undefined) return

      let score = base

      // "very good" / "slightly annoying"
      const previous = tokens[index - 1]
      if (previous && INTENSIFIERS[previous] !== undefined) {
        score *= INTENSIFIERS[previous]
      }

      // "not good" / "never crashes"
      for (let back = 1; back <= NEGATION_WINDOW; back += 1) {
        const candidate = tokens[index - back]
        if (candidate && NEGATIONS.has(candidate)) {
          score *= -0.85 // negation weakens as well as flips
          break
        }
      }

      if (score > 0) positiveHits.push(token)
      else if (score < 0) negativeHits.push(token)
      total += score
    })
  })

  // Emphasis: shouting and exclamation marks amplify whatever tone exists.
  if (text) {
    const exclamations = Math.min((text.match(/!/g) || []).length, 4)
    if (exclamations) total *= 1 + exclamations * 0.05
    const shouted = (text.match(/\b[A-Z]{4,}\b/g) || []).length
    if (shouted) total *= 1 + Math.min(shouted, 3) * 0.06
  }

  // Squash to -1..1. The constant controls how quickly strong texts saturate.
  const score = total / Math.sqrt(total * total + 15)

  return {
    score: Number(score.toFixed(4)),
    label: labelFor(score),
    positiveHits,
    negativeHits,
    hitCount: positiveHits.length + negativeHits.length,
  }
}

/** Turn a -1..1 score into a positive / neutral / negative label. */
export function labelFor(score) {
  if (score >= NEUTRAL_THRESHOLD) return 'positive'
  if (score <= -NEUTRAL_THRESHOLD) return 'negative'
  return 'neutral'
}

/**
 * Score every sentence in a text. Used to attribute praise and complaints to
 * specific themes — a post can praise the design and slate the price at once.
 */
export function analyzeSentences(text) {
  return splitSentences(text).map((sentence) => ({
    sentence,
    ...analyzeSentiment(sentence),
  }))
}

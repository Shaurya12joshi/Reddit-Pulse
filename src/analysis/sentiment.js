import {
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
  NEGATIONS,
  INTENSIFIERS,
} from './lexicon.js'

const WORD_SCORES = { ...POSITIVE_WORDS, ...NEGATIVE_WORDS }

const NEGATION_WINDOW = 3

export const NEUTRAL_THRESHOLD = 0.08

export function tokenize(text) {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function toClauses(text) {
  return text
    .split(/[.!?;:,—–\n]+/)
    .map((clause) => clause.trim())
    .filter(Boolean)
}

export function splitSentences(text) {
  if (!text) return []
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
}

export function analyzeSentiment(text) {
  const positiveHits = []
  const negativeHits = []
  let total = 0

  toClauses(text || '').forEach((clause) => {
    const tokens = tokenize(clause)

    tokens.forEach((token, index) => {
      const base = WORD_SCORES[token]
      if (base === undefined) return

      let score = base

      const previous = tokens[index - 1]
      if (previous && INTENSIFIERS[previous] !== undefined) {
        score *= INTENSIFIERS[previous]
      }

      for (let back = 1; back <= NEGATION_WINDOW; back += 1) {
        const candidate = tokens[index - back]
        if (candidate && NEGATIONS.has(candidate)) {
          score *= -0.85
          break
        }
      }

      if (score > 0) positiveHits.push(token)
      else if (score < 0) negativeHits.push(token)
      total += score
    })
  })

  if (text) {
    const exclamations = Math.min((text.match(/!/g) || []).length, 4)
    if (exclamations) total *= 1 + exclamations * 0.05
    const shouted = (text.match(/\b[A-Z]{4,}\b/g) || []).length
    if (shouted) total *= 1 + Math.min(shouted, 3) * 0.06
  }

  const score = total / Math.sqrt(total * total + 15)

  return {
    score: Number(score.toFixed(4)),
    label: labelFor(score),
    positiveHits,
    negativeHits,
    hitCount: positiveHits.length + negativeHits.length,
  }
}

export function labelFor(score) {
  if (score >= NEUTRAL_THRESHOLD) return 'positive'
  if (score <= -NEUTRAL_THRESHOLD) return 'negative'
  return 'neutral'
}

export function analyzeSentences(text) {
  return splitSentences(text).map((sentence) => ({
    sentence,
    ...analyzeSentiment(sentence),
  }))
}

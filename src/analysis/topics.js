import { TOPIC_TAXONOMY, STOPWORDS } from './lexicon.js'
import { tokenize } from './sentiment.js'

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const COMPILED_TOPICS = TOPIC_TAXONOMY.map((topic) => ({
  ...topic,
  matchers: topic.keywords.map((keyword) => ({
    keyword,
    regex: new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i'),
  })),
}))

export function detectTopics(text) {
  if (!text) return []
  const found = []

  COMPILED_TOPICS.forEach((topic) => {
    const matchedKeywords = topic.matchers
      .filter((m) => m.regex.test(text))
      .map((m) => m.keyword)

    if (matchedKeywords.length > 0) {
      found.push({ id: topic.id, label: topic.label, matchedKeywords })
    }
  })

  return found
}

export function topicLabel(id) {
  const topic = TOPIC_TAXONOMY.find((t) => t.id === id)
  return topic ? topic.label : id
}

export function extractTrendingPhrases(
  texts,
  { limit = 12, minCount = 3, exclude = [] } = {},
) {
  const unigrams = new Map()
  const bigrams = new Map()

  const excluded = new Set(exclude.map((word) => word.toLowerCase()))
  const isNoise = (token) =>
    !token ||
    token.length <= 2 ||
    STOPWORDS.has(token) ||
    excluded.has(token) ||
    /^\d+$/.test(token)

  texts.forEach((text) => {
    const tokens = tokenize(text)

    const seenUni = new Set()
    const seenBi = new Set()

    tokens.forEach((token, index) => {
      if (isNoise(token)) return

      if (!seenUni.has(token)) {
        seenUni.add(token)
        unigrams.set(token, (unigrams.get(token) || 0) + 1)
      }

      const next = tokens[index + 1]
      if (next && !isNoise(next)) {
        const phrase = `${token} ${next}`
        if (!seenBi.has(phrase)) {
          seenBi.add(phrase)
          bigrams.set(phrase, (bigrams.get(phrase) || 0) + 1)
        }
      }
    })
  })

  const asList = (map, type) =>
    [...map.entries()]
      .filter(([, count]) => count >= minCount)
      .map(([phrase, count]) => ({ phrase, count, type }))

  const combined = [
    ...asList(bigrams, 'phrase').map((item) => ({ ...item, weight: item.count * 1.6 })),
    ...asList(unigrams, 'word').map((item) => ({ ...item, weight: item.count })),
  ].sort((a, b) => b.weight - a.weight)

  const kept = []
  const covered = new Set()

  combined.forEach((item) => {
    if (kept.length >= limit) return
    if (item.type === 'word' && covered.has(item.phrase)) return
    kept.push(item)
    item.phrase.split(' ').forEach((word) => covered.add(word))
  })

  return kept.map(({ phrase, count, type }) => ({ phrase, count, type }))
}

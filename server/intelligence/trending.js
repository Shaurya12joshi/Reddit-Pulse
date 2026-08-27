// The trending list is mined by frequency, so it surfaces whatever repeats:
// real subjects ("diet", "zero sugar") sit next to fragments a tokenizer left
// behind ("til", "don", "it's"). Counting cannot tell those apart — it takes a
// reader. A model reads the candidate list, keeps what is genuinely about the
// brand, merges the variants that mean one thing, and says what each is about.
//
// Counts are never taken from the model. Once it has named a group, the corpus
// is counted again for that group, so every number on screen is measured.

import { structured, activeModel, llmAvailable } from './client.js'
import { STOPWORDS } from '../../src/analysis/lexicon.js'

const SYSTEM = `You clean up a list of phrases mined from Reddit discussions about one brand, keeping only the ones that name something people are actually talking about.

The list comes from raw frequency counting, so it mixes real subjects with debris: tokenizer fragments ("til", "don"), contractions ("it's", "don't"), bare modals and filler ("could", "really", "thing"), and words that carry no subject on their own ("good", "better").

Keep a phrase when it names a product, a variant, a feature, an ingredient, a place, a competitor, a recurring complaint or praise, an event, or anything else a brand team would recognise as a subject. Drop everything else — being frequent is not a reason to keep it.

- label: what to show. Use the clearest form of the phrase, in the words people use. Lowercase unless it is a proper name.
- phrases: every phrase from the given list that belongs to this theme, spelled exactly as given. Merge variants of one thing into a single theme — a brand and its abbreviation, singular and plural, a product and its nickname. Never invent a phrase that was not in the list.
- meaning: one short sentence on what people are saying about it, from the phrase alone. Say what it refers to when the phrase is opaque.
- kind: what sort of thing it is.

Order by how central the theme is to the brand's conversation, most central first. Return at most 12 themes, fewer when the list is thin. Be terse — every field is consumed by code.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['themes'],
  properties: {
    themes: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'phrases', 'meaning', 'kind'],
        properties: {
          label: { type: 'string' },
          phrases: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 },
          meaning: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['product', 'attribute', 'competitor', 'audience', 'event', 'issue', 'other'],
          },
        },
      },
    },
  },
}

// Fragments and filler that survive tokenizing but never name a subject. Used
// to trim the candidate list before it is sent, and as the whole filter when
// no model is connected.
const JUNK = new Set([
  'til', 'don', 'doesn', 'didn', 'isn', 'wasn', 'aren', 'weren', 'couldn', 'wouldn',
  'shouldn', 'won', 'ain', 'gonna', 'wanna', 'gotta', 'lol', 'lmao', 'imo', 'imho',
  'edit', 'deleted', 'removed', 'https', 'http', 'www', 'com', 'reddit', 'subreddit',
  'could', 'would', 'should', 'really', 'maybe', 'thing', 'things', 'stuff', 'guy',
  'guys', 'people', 'someone', 'anyone', 'everyone', 'nothing', 'something', 'anything',
  'good', 'bad', 'better', 'worse', 'best', 'worst', 'great', 'nice', 'sure', 'yeah',
  'actually', 'basically', 'literally', 'probably', 'definitely', 'honestly',
  'time', 'times', 'year', 'years', 'day', 'days', 'week', 'month', 'lot', 'lots',
  'way', 'ways', 'point', 'kind', 'sort', 'bit', 'part', 'place', 'yes',
])

export function looksLikeNoise(phrase) {
  const value = String(phrase || '').trim().toLowerCase()
  if (!value) return true
  if (value.includes("'")) return true

  const tokens = value.split(/\s+/)
  return tokens.every(
    (token) => token.length <= 3 || JUNK.has(token) || STOPWORDS.has(token),
  )
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Counted here rather than summed from the candidates: two phrases in one
// theme can appear in the same discussion, and adding their counts would
// invent mentions that were never there.
function countPostsMentioning(posts, phrases) {
  const patterns = phrases
    .map((phrase) => String(phrase || '').trim())
    .filter(Boolean)
    .map((phrase) => new RegExp(`(?:^|[^a-z0-9])${escapeRegex(phrase.toLowerCase())}(?:$|[^a-z0-9])`))

  if (!patterns.length) return 0

  let count = 0
  for (const post of posts) {
    const text = (post.text || [post.title, post.body].filter(Boolean).join('. ')).toLowerCase()
    if (patterns.some((pattern) => pattern.test(text))) count += 1
  }
  return count
}

function heuristicThemes(candidates) {
  return candidates
    .filter((entry) => !looksLikeNoise(entry.phrase))
    .slice(0, 12)
    .map((entry) => ({
      label: entry.phrase,
      phrases: [entry.phrase],
      meaning: '',
      kind: 'other',
      count: entry.count,
    }))
}

export async function refineTrending(brand, candidates = [], posts = [], identity = {}) {
  const usable = candidates.filter((entry) => entry?.phrase)
  if (!usable.length) return { themes: [], source: 'none', model: null }

  const cleaned = usable.filter((entry) => !looksLikeNoise(entry.phrase))

  if (!(await llmAvailable())) {
    return { themes: heuristicThemes(usable), source: 'heuristic', model: null }
  }

  const label = identity.canonical_name || brand
  const list = cleaned
    .map((entry) => `  - "${entry.phrase}" (${entry.count} discussions)`)
    .join('\n')

  const user =
    `Brand: ${label}` +
    (identity.category ? ` — ${identity.category}` : '') +
    (identity.industry ? ` (${identity.industry})` : '') +
    `\n\nPhrases mined from the collected discussions, most frequent first:\n${list}`

  const result = await structured({
    system: SYSTEM,
    user,
    schema: SCHEMA,
    effort: 'low',
    maxTokens: 2500,
  })

  if (!result?.themes?.length) {
    return { themes: heuristicThemes(usable), source: 'failed', model: activeModel() }
  }

  const known = new Map(usable.map((entry) => [entry.phrase.toLowerCase(), entry.count]))

  const themes = result.themes
    .map((theme) => {
      // Only phrases that were actually in the candidate list survive, so the
      // model cannot introduce a subject the corpus never raised.
      const phrases = (theme.phrases || [])
        .map((phrase) => String(phrase || '').trim().toLowerCase())
        .filter((phrase) => known.has(phrase))

      if (!phrases.length) return null

      const count = countPostsMentioning(posts, phrases)
      return {
        label: theme.label || phrases[0],
        phrases,
        meaning: theme.meaning || '',
        kind: theme.kind || 'other',
        count: count || Math.max(...phrases.map((phrase) => known.get(phrase) || 0)),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)

  if (!themes.length) {
    return { themes: heuristicThemes(usable), source: 'failed', model: activeModel() }
  }

  return { themes, source: 'llm', model: activeModel() }
}

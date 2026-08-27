// "What are Reddit users saying about X?" — where X is a product, a service,
// or a question the user typed, not a category the pipeline chose.
//
// The corpus is already collected and already about the brand, so the work is
// narrowing it to the subject asked about and reading it honestly. A model
// call first expands the subject into the words Reddit actually uses for it
// (people rarely type the official product name), a deterministic pass ranks
// posts against those words, and a second call reads the top excerpts.
// Excerpts are numbered so every quote traces back to its thread.

import { structured, activeModel, llmAvailable } from './client.js'
import { STOPWORDS } from '../../src/analysis/lexicon.js'

const EXPAND_SYSTEM = `You turn a user's question into the vocabulary Reddit commenters use, so a search over collected posts finds the right ones.

You are given a brand and something the user wants to know Reddit's opinion on — usually one of the brand's products or services, sometimes a broader question about it.

- subject: the thing being asked about, stated plainly in a few words.
- terms: words and short phrases that appear in posts genuinely about this subject. Include the official name, the informal names, abbreviations, model numbers, and the words people use for the activity around it (a delivery service brings up "driver", "late", "tracking"). Lowercase. No words so generic they would match any post about the brand.
- exclude: words that signal a post is about something else that shares the subject's name. Empty list when there is no such confusion.
- angles: the specific things people argue about on this subject, which a summary should be sure to cover. Short noun phrases.

Be terse. Every field is consumed by code.`

const EXPAND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'terms', 'exclude', 'angles'],
  properties: {
    subject: { type: 'string' },
    terms: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    exclude: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    angles: { type: 'array', items: { type: 'string' }, maxItems: 6 },
  },
}

const READ_SYSTEM = `You read Reddit discussions and report what the people writing them say about one subject the user asked about.

Report only what the excerpts support. Every claim must trace to a passage you were given — you are summarising a corpus, not recalling what you know about this company or product. Where the excerpts are thin or one-sided, say so through coverage, confidence and gaps rather than filling the space.

Excerpts are numbered. Cite the number for every quote, quote only text you were given, and never renumber.

- answer: two or three sentences answering the user's question directly, as the excerpts answer it.
- overall: the balance of opinion across the excerpts.
- themes: what people keep returning to. Each theme carries a stance — praise, complaint, question or mixed — a detail sentence, how many of the excerpts raise it, and the excerpt numbers behind it. Order by how much of the corpus they account for.
- praise / complaints: short lowercase noun phrases, only what the excerpts raise.
- questions: things people repeatedly ask about the subject and do not get a settled answer to. Empty when nobody asks.
- quotes: the passages that best carry each side. Include negative ones even when the balance is positive.
- gaps: what the excerpts do not cover, so a reader does not over-read the result. Empty when coverage is genuinely even.
- off_subject: true only when the excerpts turn out not to be about the subject asked about at all.
- confidence: how well the excerpts support the answer.

Be terse. Every field is consumed by code.`

const READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'answer',
    'overall',
    'themes',
    'praise',
    'complaints',
    'questions',
    'quotes',
    'gaps',
    'off_subject',
    'confidence',
  ],
  properties: {
    answer: { type: 'string' },
    overall: { type: 'string', enum: ['positive', 'mixed', 'negative', 'unclear'] },
    themes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theme', 'stance', 'detail', 'mentions', 'excerpts'],
        properties: {
          theme: { type: 'string' },
          stance: { type: 'string', enum: ['praise', 'complaint', 'question', 'mixed'] },
          detail: { type: 'string' },
          mentions: { type: 'integer', minimum: 0 },
          excerpts: { type: 'array', items: { type: 'integer', minimum: 1 }, maxItems: 6 },
        },
      },
    },
    praise: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    complaints: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    questions: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    quotes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['excerpt', 'quote', 'stance', 'point'],
        properties: {
          excerpt: { type: 'integer', minimum: 1 },
          quote: { type: 'string' },
          stance: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          point: { type: 'string' },
        },
      },
    },
    gaps: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    off_subject: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

const MAX_EXCERPTS = 40
const EXCERPT_CHARS = 480
const MIN_HITS = 1

function words(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
}

function textOf(post) {
  return post.text || [post.title, post.body].filter(Boolean).join('. ')
}

// A term of several words has to appear as a phrase; a single word is matched
// on its own. Scoring counts distinct terms hit rather than raw occurrences,
// so one post repeating a word does not outrank one covering the subject.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matcher(terms) {
  return terms
    .map((term) => String(term || '').trim().toLowerCase())
    .filter((term) => term.length > 1)
    .map((term) => ({
      term,
      pattern: term.includes(' ')
        ? null
        : new RegExp(`(?:^|[^a-z0-9])${escapeRegex(term)}(?:$|[^a-z0-9])`),
    }))
}

function scoreAgainst(text, terms, exclude) {
  const haystack = text.toLowerCase()
  for (const { term } of exclude) if (haystack.includes(term)) return 0

  let hits = 0
  for (const { term, pattern } of terms) {
    if (pattern ? pattern.test(haystack) : haystack.includes(term)) hits += 1
  }
  return hits
}

export function selectExcerpts(posts, terms, exclude = []) {
  const wanted = matcher(terms)
  const unwanted = matcher(exclude)
  if (!wanted.length) return []

  const scored = []
  for (const post of posts) {
    const text = textOf(post)
    if (!text) continue

    const hits = scoreAgainst(text, wanted, unwanted)
    if (hits < MIN_HITS) continue

    scored.push({
      hits,
      weight: hits * 10 + Math.log10(1 + Math.max(0, post.score ?? 0)),
      excerpt: {
        id: post.id,
        subreddit: post.subreddit,
        score: post.score ?? 0,
        permalink: post.permalink || null,
        title: post.title || null,
        sentiment: post.sentimentLabel || null,
        createdAt: post.createdAt ?? null,
        text: text.slice(0, EXCERPT_CHARS),
      },
    })
  }

  return scored
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_EXCERPTS)
    .map((entry) => entry.excerpt)
}

async function expandSubject(brand, subject, identity) {
  const fallback = {
    subject,
    terms: words(subject),
    exclude: [],
    angles: [],
    source: 'heuristic',
  }

  if (!(await llmAvailable())) return fallback

  const user =
    `Brand: ${identity.canonical_name || brand}` +
    (identity.category ? ` — ${identity.category}` : '') +
    (identity.industry ? ` (${identity.industry})` : '') +
    `\nWhat the user wants to know Reddit's opinion on, as typed: ${subject}`

  const result = await structured({
    system: EXPAND_SYSTEM,
    user,
    schema: EXPAND_SCHEMA,
    effort: 'low',
    maxTokens: 1200,
  })

  if (!result?.terms?.length) return fallback
  return { ...result, terms: [...new Set([...result.terms, ...words(subject)])], source: 'llm' }
}

function sentimentSplit(excerpts) {
  const split = { positive: 0, neutral: 0, negative: 0 }
  for (const excerpt of excerpts) {
    const label = excerpt.sentiment
    if (label && label in split) split[label] += 1
    else split.neutral += 1
  }
  return split
}

export async function readVoice(brand, posts = [], identity = {}, subject = '') {
  const asked = String(subject || '').trim()
  const label = identity.canonical_name || brand
  if (!asked) return { source: 'none', reason: 'no subject', reading: null, model: null }

  const expanded = await expandSubject(brand, asked, identity)
  const excerpts = selectExcerpts(posts, expanded.terms, expanded.exclude)

  const focus = {
    asked,
    subject: expanded.subject || asked,
    terms: expanded.terms,
    angles: expanded.angles || [],
    expandedBy: expanded.source,
  }

  const coverage = {
    matched: excerpts.length,
    corpus: posts.length,
    subreddits: [...new Set(excerpts.map((excerpt) => excerpt.subreddit))].length,
    sentiment: sentimentSplit(excerpts),
  }

  if (!excerpts.length) {
    return {
      source: 'none',
      reason: 'Nothing in the collected discussions mentions this.',
      focus,
      coverage,
      reading: null,
      model: null,
    }
  }

  if (!(await llmAvailable())) {
    return {
      source: 'unavailable',
      reason: 'No model is connected, so the excerpts cannot be read.',
      focus,
      coverage,
      reading: null,
      model: null,
    }
  }

  const byNumber = new Map()
  const lines = excerpts.map((excerpt, index) => {
    const number = index + 1
    byNumber.set(number, excerpt)
    return `  [${number}] (r/${excerpt.subreddit}, ${excerpt.score} points) ${excerpt.text}`
  })

  const user =
    `Brand: ${label}` +
    (identity.category ? ` — ${identity.category}` : '') +
    `\nThe user asked: ${asked}` +
    `\nSubject, as understood: ${focus.subject}` +
    (focus.angles.length ? `\nAngles worth covering: ${focus.angles.join(', ')}` : '') +
    `\n\n### Excerpts from the collected discussions\n${lines.join('\n')}`

  const read = await structured({
    system: READ_SYSTEM,
    user,
    schema: READ_SCHEMA,
    effort: 'high',
    maxTokens: 5000,
  })

  if (!read) {
    return {
      source: 'failed',
      reason: 'The model did not return a usable reading.',
      focus,
      coverage,
      reading: null,
      model: activeModel(),
    }
  }

  const quotes = (read.quotes || [])
    .map((entry) => {
      const excerpt = byNumber.get(entry.excerpt)
      if (!excerpt) return null
      return {
        quote: entry.quote,
        stance: entry.stance,
        point: entry.point,
        id: excerpt.id,
        subreddit: excerpt.subreddit,
        score: excerpt.score,
        permalink: excerpt.permalink,
        title: excerpt.title,
      }
    })
    .filter(Boolean)

  const themes = (read.themes || []).map((theme) => ({
    ...theme,
    sources: (theme.excerpts || [])
      .map((number) => byNumber.get(number))
      .filter(Boolean)
      .map((excerpt) => ({
        id: excerpt.id,
        subreddit: excerpt.subreddit,
        permalink: excerpt.permalink,
        title: excerpt.title,
      })),
  }))

  return {
    source: 'llm',
    focus,
    coverage,
    reading: { ...read, themes, quotes },
    model: activeModel(),
  }
}

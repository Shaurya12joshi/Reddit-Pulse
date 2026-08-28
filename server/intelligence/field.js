import { structured, activeModel, llmAvailable } from './client.js'

const MAP_SYSTEM = `You map a market from a few keywords, so a Reddit monitoring system knows who and what to look for.

The user gives keywords describing a field, sometimes alongside a brand they are researching. Small companies and early startups have almost no Reddit presence of their own, so the useful report is about the field they sit in: who else is there, and what people say about the category.

- field: the market in the words buyers use, not a taxonomy label. "expense management software", not "fintech".
- description: two sentences on what this field covers and who buys in it.
- companies: the companies people actually discuss on Reddit in this field, most discussed first. Include the well-known incumbents even when the user's brand is tiny, because those threads are where the field gets debated. For each: name, aliases people type, one line on what it does, and whether it is a big incumbent, a mid-size player, or a newer entrant.
- search_terms: phrases someone would search Reddit to find discussions about this field without naming any one company. How buyers describe the need, the shortlist, the switch. No brand names.
- questions: what people in this field keep asking, in their own words. These are the threads worth reading.

Return at most 10 companies and 8 search terms. Be terse; every field is consumed by code.`

const MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['field', 'description', 'companies', 'search_terms', 'questions'],
  properties: {
    field: { type: 'string' },
    description: { type: 'string' },
    companies: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'aliases', 'what_it_does', 'standing'],
        properties: {
          name: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          what_it_does: { type: 'string' },
          standing: { type: 'string', enum: ['incumbent', 'established', 'challenger', 'newcomer'] },
        },
      },
    },
    search_terms: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    questions: { type: 'array', items: { type: 'string' }, maxItems: 6 },
  },
}

const READ_SYSTEM = `You report what Reddit says about a market, for someone whose own company is too small to have much of a Reddit presence yet.

You are given the field, the companies in it, and excerpts from discussions collected about that field. Report only what the excerpts support.

- summary: three sentences on the state of the conversation in this field.
- what_buyers_want: what people say they are looking for when they shop in this field. Short noun phrases.
- common_complaints: what people in this field complain about, whoever they are complaining about.
- openings: gaps a newcomer could credibly take, each one traceable to something the excerpts actually say. Empty when the excerpts do not support any.
- where_they_talk: the kinds of communities this conversation happens in, as the excerpts show.
- confidence: how well the excerpts support this read.

Be terse. Every field is consumed by code.`

const READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'what_buyers_want',
    'common_complaints',
    'openings',
    'where_they_talk',
    'confidence',
  ],
  properties: {
    summary: { type: 'string' },
    what_buyers_want: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    common_complaints: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    openings: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    where_they_talk: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

const MAX_EXCERPTS = 36
const EXCERPT_CHARS = 420

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function patternsFor(names = []) {
  return names
    .map((value) => String(value || '').trim())
    .filter((value) => value.length >= 2)
    .map((value) => new RegExp(`(?:^|[^\\w])${escapeRegex(value)}(?:$|[^\\w])`, 'i'))
}

function textOf(post) {
  return post.text || [post.title, post.body].filter(Boolean).join('. ')
}

export function countFieldCompanies(posts, companies = []) {
  const rows = companies.map((company) => ({
    ...company,
    patterns: patternsFor([company.name, ...(company.aliases || [])]),
    mentions: 0,
    sentimentSum: 0,
    subreddits: new Set(),
    example: null,
  }))

  for (const post of posts) {
    const text = textOf(post)
    if (!text) continue

    for (const row of rows) {
      if (!row.patterns.some((pattern) => pattern.test(text))) continue
      row.mentions += 1
      row.sentimentSum += post.sentimentScore ?? 0
      if (post.subreddit) row.subreddits.add(post.subreddit)
      if (!row.example) {
        row.example = {
          id: post.id,
          subreddit: post.subreddit,
          score: post.score ?? 0,
          permalink: post.permalink || null,
          quote: text.slice(0, 220),
        }
      }
    }
  }

  const total = posts.length || 1
  return rows
    .map(({ patterns, sentimentSum, subreddits, ...row }) => ({
      ...row,
      share: Math.round((row.mentions / total) * 1000) / 10,
      avgSentiment: row.mentions ? Math.round((sentimentSum / row.mentions) * 100) / 100 : 0,
      subreddits: subreddits.size,
    }))
    .sort((a, b) => b.mentions - a.mentions)
}

export async function mapField(keywords, brand = '') {
  const typed = String(keywords || '').trim()
  if (!typed) return null

  if (!(await llmAvailable())) return null

  const user =
    `Keywords describing the field: ${typed}` +
    (brand ? `\nThe user is researching this brand within it: ${brand}` : '')

  const result = await structured({
    system: MAP_SYSTEM,
    user,
    schema: MAP_SCHEMA,
    effort: 'low',
    maxTokens: 2500,
  })

  if (!result?.companies?.length) return null
  return result
}

export async function readField(map, posts = []) {
  if (!map) return { reading: null, source: 'none', model: null }

  const terms = patternsFor([
    ...(map.search_terms || []),
    ...(map.companies || []).flatMap((company) => [company.name, ...(company.aliases || [])]),
  ])

  const relevant = [...posts]
    .filter((post) => {
      const text = textOf(post)
      return text && terms.some((pattern) => pattern.test(text))
    })
    .sort((a, b) => (b.engagement ?? b.score ?? 0) - (a.engagement ?? a.score ?? 0))
    .slice(0, MAX_EXCERPTS)

  if (!relevant.length) {
    return { reading: null, source: 'none', reason: 'Nothing collected touches this field yet.' }
  }

  if (!(await llmAvailable())) {
    return { reading: null, source: 'unavailable', reason: 'No model is connected.' }
  }

  const lines = relevant.map(
    (post, index) =>
      `  [${index + 1}] (r/${post.subreddit}, ${post.score ?? 0} points) ${textOf(post).slice(0, EXCERPT_CHARS)}`,
  )

  const user =
    `Field: ${map.field}` +
    `\n${map.description}` +
    `\nCompanies in it: ${(map.companies || []).map((company) => company.name).join(', ')}` +
    `\n\n### Excerpts from the collected discussions\n${lines.join('\n')}`

  const reading = await structured({
    system: READ_SYSTEM,
    user,
    schema: READ_SCHEMA,
    effort: 'high',
    maxTokens: 3000,
  })

  if (!reading) {
    return { reading: null, source: 'failed', reason: 'The model did not return a usable read.' }
  }

  return { reading, source: 'llm', model: activeModel(), excerpts: relevant.length }
}

export async function scanField(keywords, posts = [], brand = '') {
  const map = await mapField(keywords, brand)
  if (!map) {
    return {
      source: 'unavailable',
      reason: 'No model is connected, so the field cannot be mapped.',
      keywords: String(keywords || '').trim(),
      map: null,
      companies: [],
      reading: null,
      model: null,
    }
  }

  const companies = countFieldCompanies(posts, map.companies)
  const read = await readField(map, posts)

  return {
    source: read.source === 'llm' ? 'llm' : read.source,
    reason: read.reason || null,
    keywords: String(keywords || '').trim(),
    map: {
      field: map.field,
      description: map.description,
      searchTerms: map.search_terms || [],
      questions: map.questions || [],
    },
    companies,
    reading: read.reading,
    excerpts: read.excerpts ?? 0,
    model: activeModel(),
  }
}

import { structured, activeModel, llmAvailable } from './client.js'

const SYSTEM = `You turn whatever a user typed into the brand name a Reddit monitoring system should search for.

The input is either a company name already, or the domain of a website.

When you are given a domain, the answer is the company that OWNS that domain, and nothing else. A domain is handed to you stripped of its path for a reason: a page on that site may be about some other company's product, and that other company is never the answer. amazon.in is Amazon, whatever is being sold on it. etsy.com is Etsy, whoever made the item. Ignore any brand you happen to know sells there.

- name: what to search Reddit for. The name people actually type when discussing it, not the legal entity. Prefer "Bloomberg Tax" over "Bloomberg Industry Group LLC", "Figma" over "Figma Inc".
- input_kind: "name" when the input was already a brand name, "url" when it came from a web address, "unclear" when you cannot tell what it refers to.
- what_it_is: one short sentence on what the company does, for a reader who has never heard of it.
- confidence: how sure you are that this is the right company.

For a domain you do not recognise, read it honestly: "getharvest.com" is Harvest, "tryramp.com" is Ramp. Strip the country or generic suffix and marketing prefixes like get, try, use, join, app, my. A regional suffix does not make a different company: amazon.in, amazon.co.uk and amazon.com are all Amazon. Never invent a company for a domain that carries no readable name.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'input_kind', 'what_it_is', 'confidence'],
  properties: {
    name: { type: 'string' },
    input_kind: { type: 'string', enum: ['name', 'url', 'unclear'] },
    what_it_is: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

const URL_LIKE = /^(https?:\/\/|www\.)|^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i
const PREFIXES = ['get', 'try', 'use', 'join', 'app', 'my', 'the', 'go']

const COMPOUND_SUFFIXES = new Set([
  'co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'go', 'in', 'firm', 'gen', 'ind',
])

const PLATFORM_HOSTS = new Set([
  'myshopify.com', 'squarespace.com', 'wixsite.com', 'webflow.io', 'github.io',
  'notion.site', 'substack.com', 'wordpress.com', 'blogspot.com', 'netlify.app', 'vercel.app',
])

export function hostOf(value) {
  const input = String(value || '').trim()
  if (!input) return ''
  try {
    return new URL(input.startsWith('http') ? input : `https://${input}`).hostname.toLowerCase()
  } catch {
    return input.split('/')[0].toLowerCase()
  }
}

export function registrableLabel(host) {
  const parts = String(host || '').replace(/^www\./, '').split('.').filter(Boolean)
  if (parts.length <= 1) return parts[0] || ''

  const bare = parts.join('.')
  for (const platform of PLATFORM_HOSTS) {
    if (bare.endsWith(`.${platform}`)) return parts[0]
  }

  let end = parts.length - 1
  if (end > 0 && COMPOUND_SUFFIXES.has(parts[end - 1])) end -= 1
  return parts[end - 1] || parts[0]
}

export function looksLikeUrl(value) {
  const input = String(value || '').trim()
  if (!input || /\s/.test(input)) return false
  return URL_LIKE.test(input)
}

export function nameFromUrl(value) {
  const core = registrableLabel(hostOf(value))
  if (!core) return ''

  const words = core.split(/[-_]+/).filter(Boolean)
  while (words.length > 1 && PREFIXES.includes(words[0].toLowerCase())) words.shift()

  const single = words.join(' ')
  const stripped = words.length === 1 ? PREFIXES.reduce(
    (word, prefix) =>
      word.toLowerCase().startsWith(prefix) && word.length > prefix.length + 2
        ? word.slice(prefix.length)
        : word,
    single,
  ) : single

  return stripped
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function identifyCompany(input) {
  const typed = String(input || '').trim()
  if (!typed) return { name: '', source: 'none', model: null }

  const isUrl = looksLikeUrl(typed)

  if (!(await llmAvailable())) {
    return {
      name: isUrl ? nameFromUrl(typed) : typed,
      typed,
      inputKind: isUrl ? 'url' : 'name',
      whatItIs: '',
      confidence: isUrl ? 0.4 : 1,
      source: 'heuristic',
      model: null,
    }
  }

  const host = isUrl ? hostOf(typed) : ''
  const user = isUrl
    ? `Domain: ${host}\nReading of the domain alone: ${nameFromUrl(typed)}\n` +
      'Name the company that owns this domain. Any product or seller elsewhere in the ' +
      'original link is irrelevant.'
    : `The user typed: ${typed}`

  const result = await structured({
    system: SYSTEM,
    user,
    schema: SCHEMA,
    effort: 'low',
    maxTokens: 600,
  })

  const name = String(result?.name || '').trim()
  if (!name) {
    return {
      name: isUrl ? nameFromUrl(typed) : typed,
      typed,
      inputKind: isUrl ? 'url' : 'name',
      whatItIs: '',
      confidence: isUrl ? 0.4 : 1,
      source: 'failed',
      model: activeModel(),
    }
  }

  return {
    name,
    typed,
    inputKind: result.input_kind,
    whatItIs: result.what_it_is || '',
    confidence: result.confidence ?? 0.5,
    source: 'llm',
    model: activeModel(),
  }
}

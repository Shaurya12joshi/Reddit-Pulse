import { structured, activeModel, llmAvailable } from './client.js'

const SYSTEM = `You turn whatever a user typed into the brand name a Reddit monitoring system should search for.

The input is usually a company name already, but it may be a website address, a full URL with a path, an email domain, or a product page. Work out which company it belongs to.

- name: what to search Reddit for. The name people actually type when discussing it, not the legal entity. Prefer "Bloomberg Tax" over "Bloomberg Industry Group LLC", "Figma" over "Figma Inc".
- input_kind: "name" when the input was already a brand name, "url" when it was an address or link, "unclear" when you cannot tell what it refers to.
- what_it_is: one short sentence on what the company does, for a reader who has never heard of it.
- confidence: how sure you are that this is the right company.

When the input is a site you do not recognise, read the domain honestly: "getharvest.com" is Harvest, "tryramp.com" is Ramp. Strip www, the TLD, and marketing prefixes like get, try, use, join, app, my. Never invent a company for a domain that carries no readable name.`

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

export function looksLikeUrl(value) {
  const input = String(value || '').trim()
  if (!input || /\s/.test(input)) return false
  return URL_LIKE.test(input)
}

export function nameFromUrl(value) {
  const input = String(value || '').trim()
  if (!input) return ''

  let host = input
  try {
    host = new URL(input.startsWith('http') ? input : `https://${input}`).hostname
  } catch {
    host = input.split('/')[0]
  }

  const parts = host.replace(/^www\./i, '').split('.')
  const core = parts.length > 2 && parts[0] !== 'www' ? parts[parts.length - 2] : parts[0]

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

  const result = await structured({
    system: SYSTEM,
    user: `The user typed: ${typed}`,
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

import { llmAvailable, probe, withCredentials } from './intelligence/client.js'
import { publicCatalogue, toOverrides, validate } from './intelligence/providers.js'

export function credentialsFrom(req) {
  const provider = String(req.get('x-llm-provider') || '').trim()
  const apiKey = String(req.get('x-llm-key') || '').trim()
  const model = String(req.get('x-llm-model') || '').trim()
  const baseUrl = String(req.get('x-llm-base-url') || '').trim()
  if (!provider || !apiKey) return null
  return { provider, apiKey, model, baseUrl }
}

export function credentialContext(req, res, next) {
  const supplied = credentialsFrom(req)
  const overrides = supplied ? toOverrides(supplied) : null
  withCredentials(overrides, next)
}

export function catalogue() {
  return { providers: publicCatalogue() }
}

export async function siteReady() {
  return withCredentials(null, () => llmAvailable())
}

const FRIENDLY = [
  [/401|403|rejected|invalid.*key|unauthor/i, 'That key was rejected. Check it was copied in full and is still active.'],
  [/429|rate.?limit/i, 'That account is rate limited right now. Try again in a moment.'],
  [/credit|balance|quota|billing/i, 'The key works, but the account has no credit left.'],
  [/timeout|abort|ENOTFOUND|fetch failed|ECONNREFUSED/i, 'Could not reach that service. Check the address and your connection.'],
]

function friendly(message) {
  for (const [pattern, text] of FRIENDLY) if (pattern.test(message || '')) return text
  return message || 'That service did not respond as expected.'
}

export async function testConnection(body = {}) {
  const invalid = validate(body)
  if (invalid) return { ok: false, ...invalid }

  const overrides = toOverrides(body)
  if (!overrides) {
    return { ok: false, field: 'provider', message: 'That combination is not usable yet.' }
  }

  const result = await withCredentials(overrides, () => probe())
  if (result.ok) {
    return {
      ok: true,
      tookMs: result.tookMs,
      modelAvailable: result.modelAvailable,
      model: overrides.LLM_MODEL || null,
    }
  }
  return { ok: false, field: result.field || 'apiKey', message: friendly(result.error) }
}

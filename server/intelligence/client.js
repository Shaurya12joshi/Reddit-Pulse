import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const DEFAULT_MODELS = {
  anthropic: 'claude-opus-5',
  ollama: 'qwen2.5:7b',
  'openai-compatible': 'llama-3.3-70b-versatile',
}

const context = new AsyncLocalStorage()

function read(name, overrides) {
  const value = overrides?.[name]
  if (value !== undefined && value !== null && value !== '') return value
  return process.env[name]
}

function resolve(overrides) {
  const provider = read('LLM_PROVIDER', overrides) || 'anthropic'
  const model =
    read('CLAUDE_MODEL', overrides) ||
    read('LLM_MODEL', overrides) ||
    DEFAULT_MODELS[provider] ||
    'claude-opus-5'
  const batch = Number(read('LLM_BATCH_SIZE', overrides))

  return {
    provider,
    model,
    apiKey:
      provider === 'anthropic'
        ? read('ANTHROPIC_API_KEY', overrides) || read('ANTHROPIC_AUTH_TOKEN', overrides) || null
        : provider === 'openai-compatible'
          ? read('LLM_API_KEY', overrides) || null
          : null,
    ollamaUrl: read('OLLAMA_URL', overrides) || 'http://localhost:11434',
    openaiBaseUrl: read('OPENAI_BASE_URL', overrides) || 'https://api.groq.com/openai/v1',
    reasoningEffort: read('LLM_REASONING_EFFORT', overrides) ?? 'low',
    batchSize: Number.isFinite(batch) && batch > 0 ? batch : provider === 'anthropic' ? 10 : 3,
    maxRetries: Number(read('LLM_MAX_RETRIES', overrides)) || 5,
    minMaxTokens: Number(read('LLM_MIN_MAX_TOKENS', overrides)) || 8000,
    federated: Boolean(
      read('ANTHROPIC_FEDERATION_RULE_ID', overrides) &&
        read('ANTHROPIC_IDENTITY_TOKEN_FILE', overrides),
    ),
    supplied: Boolean(overrides),
  }
}

const siteConfig = resolve(null)

function activeConfig() {
  return context.getStore()?.config || siteConfig
}

function blankUsage() {
  return { calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0 }
}

const siteUsage = blankUsage()

function bucket() {
  return context.getStore()?.usage || siteUsage
}

export function withCredentials(overrides, fn) {
  const store = { config: resolve(overrides || null), usage: blankUsage() }
  return context.run(store, fn)
}

export function activeProvider() {
  return activeConfig().provider
}

export function activeModel() {
  return activeConfig().model
}

export function activeBatchSize() {
  return activeConfig().batchSize
}

export function usingSuppliedCredentials() {
  return activeConfig().supplied
}

export function usageSnapshot() {
  return { ...bucket() }
}

export const usage = siteUsage

function hasCredentials(config) {
  if (config.provider === 'ollama') return true
  if (config.provider === 'openai-compatible') return Boolean(config.apiKey)

  if (config.apiKey) return true
  if (config.federated) return true
  return existsSync(join(homedir(), '.config', 'anthropic'))
}

async function pingOllama(config) {
  try {
    const response = await fetch(`${config.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    })
    return response.ok
  } catch {
    return false
  }
}

let ollamaStartPromise = null

function startOllama(config) {
  if (ollamaStartPromise) return ollamaStartPromise

  ollamaStartPromise = (async () => {
    console.log('[intelligence] starting `ollama serve`...')
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, OLLAMA_NUM_PARALLEL: process.env.OLLAMA_NUM_PARALLEL || '2' },
    })
    child.unref()

    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      if (await pingOllama(config)) return true
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    console.warn('[intelligence] `ollama serve` did not come up within 15s.')
    return false
  })()

  return ollamaStartPromise
}

const clients = new Map()

function getClient() {
  const config = activeConfig()
  const cacheKey = `${config.provider}|${config.apiKey || ''}|${config.openaiBaseUrl}|${config.ollamaUrl}|${config.model}`
  const cached = clients.get(cacheKey)
  if (cached) return cached

  const promise = (async () => {
    if (config.provider === 'ollama') {
      if (!(await pingOllama(config))) await startOllama(config)

      try {
        const response = await fetch(`${config.ollamaUrl}/api/tags`, {
          signal: AbortSignal.timeout(3000),
        })
        if (!response.ok) throw new Error(`Ollama responded ${response.status}`)
        const { models = [] } = await response.json()
        const names = models.map((entry) => entry.name)
        if (
          !names.some(
            (name) => name === config.model || name.startsWith(`${config.model.split(':')[0]}:`),
          )
        ) {
          console.warn(
            `[intelligence] Ollama is running but "${config.model}" is not pulled. ` +
              `Run: ollama pull ${config.model}`,
          )
          return null
        }
        return { kind: 'ollama' }
      } catch (error) {
        console.warn(
          `[intelligence] Ollama not reachable at ${config.ollamaUrl} (${error.message}). ` +
            'Start it with `ollama serve`, or unset LLM_PROVIDER to use Claude.',
        )
        return null
      }
    }

    if (config.provider === 'openai-compatible') {
      if (!config.apiKey) {
        console.warn('[intelligence] LLM_PROVIDER=openai-compatible needs LLM_API_KEY.')
        return null
      }
      return { kind: 'openai-compatible' }
    }

    if (!hasCredentials(config)) {
      console.warn(
        '[intelligence] No Anthropic credentials found. Falling back to deterministic ' +
          'analysis. Connect an AI service, or configure one for the site.',
      )
      return null
    }

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      return new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {})
    } catch (error) {
      console.warn(
        `[intelligence] Claude unavailable (${error.message}). ` +
          'Falling back to deterministic analysis. Run `npm install @anthropic-ai/sdk` ' +
          'in server/ and configure credentials to enable the AI layer.',
      )
      return null
    }
  })()

  if (clients.size > 32) clients.delete(clients.keys().next().value)
  clients.set(cacheKey, promise)
  return promise
}

export async function llmAvailable() {
  return Boolean(await getClient())
}

const RATES = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

export function estimatedCost() {
  const config = activeConfig()
  if (config.provider === 'ollama') return 0
  const rate = RATES[config.model]
  if (!rate) return null
  const spent = bucket()
  return Number(
    ((spent.inputTokens * rate.input + spent.outputTokens * rate.output) / 1_000_000).toFixed(4),
  )
}

export async function probe() {
  const config = activeConfig()
  const started = Date.now()

  if (config.provider === 'ollama') {
    try {
      const response = await fetch(`${config.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(4000),
      })
      if (!response.ok) return { ok: false, error: `Ollama responded ${response.status}` }
      const { models = [] } = await response.json()
      const pulled = models.some(
        (entry) =>
          entry.name === config.model || entry.name.startsWith(`${config.model.split(':')[0]}:`),
      )
      return pulled
        ? { ok: true, tookMs: Date.now() - started }
        : {
            ok: false,
            error: `Ollama is up but "${config.model}" is not pulled. Run: ollama pull ${config.model}`,
          }
    } catch (error) {
      return { ok: false, error: `Ollama not reachable at ${config.ollamaUrl} (${error.message})` }
    }
  }

  if (config.provider === 'openai-compatible') {
    if (!config.apiKey) return { ok: false, error: 'No API key supplied.' }
    try {
      const response = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 4,
        }),
        signal: AbortSignal.timeout(20_000),
      })

      if (response.ok) return { ok: true, tookMs: Date.now() - started, modelAvailable: true }

      const text = await response.text()
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: `${response.status} rejected` }
      }
      if (response.status === 404 || /model/i.test(text)) {
        return {
          ok: false,
          error: `That account cannot use "${config.model}". Pick a different model.`,
          field: 'model',
        }
      }
      return { ok: false, error: `${response.status}: ${text.slice(0, 200)}` }
    } catch (error) {
      return { ok: false, error: `Could not reach ${config.openaiBaseUrl} (${error.message})` }
    }
  }

  if (!hasCredentials(config)) return { ok: false, error: 'No Anthropic credentials configured.' }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {})
    await client.messages.create({
      model: config.model,
      max_tokens: 4,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return { ok: true, tookMs: Date.now() - started, modelAvailable: true }
  } catch (error) {
    const status = error?.status
    if (status === 401 || status === 403) return { ok: false, error: `${status} rejected` }
    if (status === 404) {
      return {
        ok: false,
        error: `That account cannot use "${config.model}". Pick a different model.`,
        field: 'model',
      }
    }
    return { ok: false, error: error?.message || 'Anthropic request failed.' }
  }
}

export async function structured({ system, user, schema, effort = 'high', maxTokens = 8000 }) {
  const config = activeConfig()
  const client = await getClient()
  if (!client) return null

  if (client.kind === 'ollama') return viaOllama({ system, user, schema, maxTokens })
  if (client.kind === 'openai-compatible')
    return viaOpenAiCompatible({ system, user, schema, maxTokens })

  const response = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content: user }],
    output_config: {
      effort,
      format: { type: 'json_schema', schema },
    },
  })

  const spent = bucket()

  spent.calls += 1
  spent.inputTokens += response.usage?.input_tokens ?? 0
  spent.outputTokens += response.usage?.output_tokens ?? 0
  spent.cachedTokens += response.usage?.cache_read_input_tokens ?? 0

  if (response.stop_reason === 'refusal') {
    console.warn('[intelligence] request refused:', response.stop_details?.category)
    return null
  }

  const text = response.content.find((block) => block.type === 'text')?.text
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch (error) {
    console.warn('[intelligence] unparseable structured output:', error.message)
    return null
  }
}

function parseLoose(text, where) {
  if (!text) return null
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
      }
    }
    console.warn(`[intelligence] ${where}: could not parse model output as JSON`)
    return null
  }
}

async function viaOllama({ system, user, schema, maxTokens }) {
  const config = activeConfig()
  const response = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      format: schema,
      stream: false,
      options: { temperature: 0, num_predict: maxTokens },
    }),
    signal: AbortSignal.timeout(300_000),
  })

  if (!response.ok) {
    console.warn(`[intelligence] Ollama responded ${response.status}: ${await response.text()}`)
    return null
  }

  const data = await response.json()
  const spent = bucket()
  spent.calls += 1
  spent.inputTokens += data.prompt_eval_count ?? 0
  spent.outputTokens += data.eval_count ?? 0

  return parseLoose(data.message?.content, 'ollama')
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function retryDelayMs(response, bodyText, attempt = 0) {
  const fromBody = /try again in\s+([\d.]+)\s*s/i.exec(bodyText || '')
  if (fromBody) return Math.ceil(parseFloat(fromBody[1]) * 1000)

  const fromRetryInfo = /"retryDelay"\s*:\s*"([\d.]+)s"/i.exec(bodyText || '')
  if (fromRetryInfo) return Math.ceil(parseFloat(fromRetryInfo[1]) * 1000)

  const header = response.headers.get('retry-after')
  if (header && !Number.isNaN(Number(header))) return Number(header) * 1000

  return Math.min(15_000 * 2 ** attempt, 120_000)
}

async function viaOpenAiCompatible({ system, user, schema, maxTokens }) {
  const config = activeConfig()
  const MAX_RETRIES = config.maxRetries
  const MAX_DELAY_MS = 120_000
  const baseUrl = config.openaiBaseUrl
  const apiKey = config.apiKey

  const call = (responseFormat, systemText) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemText },
          { role: 'user', content: user },
        ],
        response_format: responseFormat,
        temperature: 0,
        max_tokens: Math.max(maxTokens, config.minMaxTokens),
        ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}),
      }),
      signal: AbortSignal.timeout(120_000),
    })

  const callWithRetry = async (responseFormat, systemText) => {
    for (let attempt = 0; ; attempt++) {
      const response = await call(responseFormat, systemText)
      if (response.status !== 429 || attempt >= MAX_RETRIES) return response

      const text = await response.text()
      const delay = Math.min(retryDelayMs(response, text, attempt), MAX_DELAY_MS)
      console.warn(
        `[intelligence] rate limited, waiting ${Math.round(delay / 1000)}s ` +
          `(attempt ${attempt + 1}/${MAX_RETRIES})`,
      )
      await sleep(delay)
    }
  }

  let response = await callWithRetry(
    { type: 'json_schema', json_schema: { name: 'result', schema, strict: true } },
    system,
  )

  if (!response.ok && response.status !== 429) {
    response = await callWithRetry(
      { type: 'json_object' },
      `${system}\n\nRespond with JSON matching exactly this schema:\n${JSON.stringify(schema)}`,
    )
  }

  if (!response.ok) {
    console.warn(`[intelligence] ${baseUrl} responded ${response.status}: ${await response.text()}`)
    return null
  }

  const data = await response.json()
  const spent = bucket()
  spent.calls += 1
  spent.inputTokens += data.usage?.prompt_tokens ?? 0
  spent.outputTokens += data.usage?.completion_tokens ?? 0

  return parseLoose(data.choices?.[0]?.message?.content, 'openai-compatible')
}

export const PROVIDERS = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    tagline: 'One key, every major model',
    blurb: 'Anthropic, OpenAI, Google, Meta and more through a single account.',
    keyHint: 'Starts with sk-or-',
    keyUrl: 'https://openrouter.ai/keys',
    recommended: true,
    models: [
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4.1-mini',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    baseUrl: null,
    tagline: 'Claude, direct',
    blurb: 'The strongest judgment on this workload.',
    keyHint: 'Starts with sk-ant-',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    tagline: 'GPT models, direct',
    blurb: 'Uses your OpenAI account.',
    keyHint: 'Starts with sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    kind: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    tagline: 'Generous free tier',
    blurb: 'Fast and cheap for high-volume classification.',
    keyHint: 'Starts with AIza',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash'],
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    tagline: 'Fastest responses',
    blurb: 'Open models at very high speed, with a free tier.',
    keyHint: 'Starts with gsk_',
    keyUrl: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    tagline: 'Low cost per token',
    blurb: 'Strong reasoning at a fraction of the price.',
    keyHint: 'Starts with sk-',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    tagline: 'European models',
    blurb: 'EU-hosted, with a free tier.',
    keyHint: '',
    keyUrl: 'https://console.mistral.ai/api-keys',
    models: ['mistral-large-latest', 'mistral-small-latest'],
  },
  {
    id: 'xai',
    label: 'xAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    tagline: 'Grok models',
    blurb: 'Uses your xAI account.',
    keyHint: 'Starts with xai-',
    keyUrl: 'https://console.x.ai',
    models: ['grok-4', 'grok-3-mini'],
  },
  {
    id: 'together',
    label: 'Together AI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    tagline: 'Open-model catalogue',
    blurb: 'Hundreds of open models on one key.',
    keyHint: '',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
    ],
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    kind: 'openai-compatible',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    tagline: 'Fast open models',
    blurb: 'Serverless open-model inference.',
    keyHint: '',
    keyUrl: 'https://fireworks.ai/account/api-keys',
    models: ['accounts/fireworks/models/llama4-maverick-instruct-basic'],
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    kind: 'openai-compatible',
    baseUrl: 'https://api.cerebras.ai/v1',
    tagline: 'Very high throughput',
    blurb: 'Open models with a free tier.',
    keyHint: 'Starts with csk-',
    keyUrl: 'https://cloud.cerebras.ai',
    models: ['llama-3.3-70b', 'qwen-3-32b'],
  },
  {
    id: 'custom',
    label: 'Something else',
    kind: 'openai-compatible',
    baseUrl: null,
    tagline: 'Any OpenAI-compatible service',
    blurb: 'Point it at your own endpoint — self-hosted, proxied, or private.',
    keyHint: '',
    keyUrl: null,
    needsBaseUrl: true,
    models: [],
  },
]

export const PROVIDERS_BY_ID = new Map(PROVIDERS.map((entry) => [entry.id, entry]))

export function publicCatalogue() {
  return PROVIDERS.map((entry) => ({ ...entry }))
}

export function toOverrides({ provider, apiKey, model, baseUrl } = {}) {
  const meta = PROVIDERS_BY_ID.get(provider)
  if (!meta || !apiKey) return null

  const endpoint = meta.needsBaseUrl ? baseUrl : meta.baseUrl
  if (meta.kind === 'openai-compatible' && !endpoint) return null

  const overrides = { LLM_PROVIDER: meta.kind }
  if (model) overrides.LLM_MODEL = model
  else if (meta.models.length) overrides.LLM_MODEL = meta.models[0]

  if (meta.kind === 'anthropic') {
    overrides.ANTHROPIC_API_KEY = apiKey
  } else {
    overrides.LLM_API_KEY = apiKey
    overrides.OPENAI_BASE_URL = endpoint
  }

  return overrides
}

export function validate({ provider, apiKey, model, baseUrl } = {}) {
  const meta = PROVIDERS_BY_ID.get(provider)
  if (!meta) return { field: 'provider', message: 'Choose a service from the list.' }

  if (!apiKey) return { field: 'apiKey', message: 'Paste your key to connect.' }

  if (meta.needsBaseUrl) {
    if (!baseUrl) return { field: 'baseUrl', message: 'Add the address of your service.' }
    if (!/^https?:\/\//.test(baseUrl)) {
      return { field: 'baseUrl', message: 'The address should start with https://' }
    }
  }

  if (meta.needsBaseUrl && !model) {
    return { field: 'model', message: 'Name the model your service should use.' }
  }

  return null
}

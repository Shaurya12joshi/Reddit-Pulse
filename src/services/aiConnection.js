const STORAGE_KEY = 'reddit-pulse.ai'
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const listeners = new Set()

function attempt(action, fallback = null) {
  try {
    return action()
  } catch {
    return fallback
  }
}

function stores() {
  return [
    attempt(() => window.localStorage),
    attempt(() => window.sessionStorage),
  ].filter(Boolean)
}

export function getConnection() {
  for (const store of stores()) {
    const stored = attempt(() => {
      const raw = store.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    })
    if (stored) return stored
  }
  return null
}

export function saveConnection({ provider, label, apiKey, model, baseUrl, remember }) {
  const value = JSON.stringify({ provider, label, apiKey, model, baseUrl, remember: Boolean(remember) })
  clearConnection({ quiet: true })
  const [local, session] = stores()
  const target = remember ? local || session : session || local
  attempt(() => target?.setItem(STORAGE_KEY, value))
  memory = remember ? null : JSON.parse(value)
  announce()
}

export function clearConnection({ quiet = false } = {}) {
  for (const store of stores()) {
    attempt(() => store.removeItem(STORAGE_KEY))
  }
  memory = null
  if (!quiet) announce()
}

let memory = null

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function announce() {
  for (const listener of listeners) listener(getConnection() || memory)
}

export function aiHeaders() {
  const connection = getConnection() || memory
  if (!connection?.apiKey) return {}
  return {
    'x-llm-provider': connection.provider,
    'x-llm-key': connection.apiKey,
    ...(connection.model ? { 'x-llm-model': connection.model } : {}),
    ...(connection.baseUrl ? { 'x-llm-base-url': connection.baseUrl } : {}),
  }
}

export function apiFetch(path, options = {}) {
  return fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...options,
    headers: { ...aiHeaders(), ...(options.headers || {}) },
  })
}

export { API }

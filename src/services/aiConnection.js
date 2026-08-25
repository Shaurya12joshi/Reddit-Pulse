const STORAGE_KEY = 'reddit-pulse.ai'
const API = 'http://localhost:3001'

const listeners = new Set()

function stores() {
  const found = []
  try {
    if (window.localStorage) found.push(window.localStorage)
  } catch {
    // Storage can be blocked entirely; the app still works without it.
  }
  try {
    if (window.sessionStorage) found.push(window.sessionStorage)
  } catch {
    // Same.
  }
  return found
}

/** The AI account this browser is using, or null when on the site default. */
export function getConnection() {
  for (const store of stores()) {
    try {
      const raw = store.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      // Corrupt or unreadable entry — treat as not connected.
    }
  }
  return null
}

export function saveConnection({ provider, label, apiKey, model, baseUrl, remember }) {
  const value = JSON.stringify({ provider, label, apiKey, model, baseUrl, remember: Boolean(remember) })
  clearConnection({ quiet: true })
  const [local, session] = stores()
  const target = remember ? local || session : session || local
  try {
    target?.setItem(STORAGE_KEY, value)
  } catch {
    // Nothing persisted; the connection still applies for this page view.
  }
  memory = remember ? null : JSON.parse(value)
  announce()
}

export function clearConnection({ quiet = false } = {}) {
  for (const store of stores()) {
    try {
      store.removeItem(STORAGE_KEY)
    } catch {
      // Ignore.
    }
  }
  memory = null
  if (!quiet) announce()
}

// Fallback for browsers where both storages are unavailable.
let memory = null

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function announce() {
  for (const listener of listeners) listener(getConnection() || memory)
}

/** Identifies the caller's AI account on a request. Empty when using the default. */
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

/** fetch for this app's API, carrying the caller's AI account when there is one. */
export function apiFetch(path, options = {}) {
  return fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...options,
    headers: { ...aiHeaders(), ...(options.headers || {}) },
  })
}

export { API }

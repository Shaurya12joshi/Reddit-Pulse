import { useCallback, useEffect, useState } from 'react'

import { apiFetch } from '../services/aiConnection.js'

// The refined trending list. Falls back to nothing on failure — the panel
// keeps showing the raw mined phrases until this arrives.
export function useTrending(company) {
  const [state, setState] = useState({ status: 'idle', key: null })
  const [attempt, setAttempt] = useState(0)

  const key = company ? `${company}::${attempt}` : null

  useEffect(() => {
    if (!key) return undefined

    const controller = new AbortController()
    const params = new URLSearchParams({ company })
    if (attempt > 0) params.set('refresh', 'true')

    apiFetch(`/api/trending?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || `Trending failed (${response.status})`)
        return body
      })
      .then(
        (data) => setState({ status: 'ready', key, ...data }),
        (error) => {
          if (error.name === 'AbortError') return
          setState({ status: 'error', key, error: error.message })
        },
      )

    return () => controller.abort()
  }, [key, company, attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])

  const current = !key ? { status: 'idle' } : state.key === key ? state : { status: 'loading' }

  return { ...current, reload }
}

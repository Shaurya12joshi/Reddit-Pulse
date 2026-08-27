import { useCallback, useEffect, useState } from 'react'

import { apiFetch } from '../services/aiConnection.js'

// The head-to-head the user asked for by name. Runs alongside useComparisons,
// which keeps reading whichever rivals the model picks on its own.
export function useNamedComparison(company, target) {
  const [state, setState] = useState({ status: 'idle', key: null })
  const [attempt, setAttempt] = useState(0)

  const key = company && target ? `${company}::${target}::${attempt}` : null

  useEffect(() => {
    if (!key) return undefined

    const controller = new AbortController()

    const params = new URLSearchParams({ company, against: target })
    if (attempt > 0) params.set('refresh', 'true')

    apiFetch(`/api/comparisons/named?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || `Comparison failed (${response.status})`)
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
  }, [key, company, target, attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])

  const current = !key
    ? { status: 'idle' }
    : state.key === key
      ? state
      : { status: 'loading' }

  return { ...current, reload }
}

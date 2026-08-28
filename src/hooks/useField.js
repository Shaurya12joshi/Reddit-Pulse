import { useCallback, useEffect, useState } from 'react'

import { apiFetch } from '../services/aiConnection.js'

export function useField(company, keywords) {
  const [state, setState] = useState({ status: 'idle', key: null })
  const [attempt, setAttempt] = useState(0)

  const key = company && keywords ? `${company}::${keywords}::${attempt}` : null

  useEffect(() => {
    if (!key) return undefined

    const controller = new AbortController()
    const params = new URLSearchParams({ company, keywords })
    if (attempt > 0) params.set('refresh', 'true')

    apiFetch(`/api/field?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || `Field scan failed (${response.status})`)
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
  }, [key, company, keywords, attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])

  const current = !key ? { status: 'idle' } : state.key === key ? state : { status: 'loading' }

  return { ...current, reload }
}

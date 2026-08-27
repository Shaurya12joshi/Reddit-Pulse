import { useCallback, useEffect, useState } from 'react'

import { apiFetch } from '../services/aiConnection.js'

export function useProductComparison(company, mine, theirs, rivalCompany) {
  const [state, setState] = useState({ status: 'idle', key: null })
  const [attempt, setAttempt] = useState(0)

  const rivalSide = theirs || rivalCompany
  const key = company && mine && rivalSide ? `${company}::${mine}::${rivalSide}::${attempt}` : null

  useEffect(() => {
    if (!key) return undefined

    const controller = new AbortController()
    const params = new URLSearchParams({ company, mine })
    if (theirs) params.set('theirs', theirs)
    else params.set('rivalCompany', rivalCompany)
    if (attempt > 0) params.set('refresh', 'true')

    apiFetch(`/api/comparisons/product?${params}`, { signal: controller.signal })
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
  }, [key, company, mine, theirs, rivalCompany, attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])

  const current = !key ? { status: 'idle' } : state.key === key ? state : { status: 'loading' }

  return { ...current, reload }
}

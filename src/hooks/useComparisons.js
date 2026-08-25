import { useEffect, useState } from 'react'

import { apiFetch } from '../services/aiConnection.js'

/**
 * Head-to-head verdicts the model drew from the collected posts. Loaded after
 * the report so the dashboard paints immediately and fills this in when ready.
 */
export function useComparisons(company) {
  const [state, setState] = useState({ status: 'loading', comparisons: [], company: null })

  // Derive the reset from props rather than an effect: a company change makes
  // any loaded verdicts stale immediately, without an extra render pass.
  const current = state.company === company ? state : { status: 'loading', comparisons: [] }

  useEffect(() => {
    if (!company) return undefined

    let cancelled = false

    apiFetch(`/api/comparisons?company=${encodeURIComponent(company)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then(
        (data) => {
          if (cancelled) return
          setState({
            status: 'ready',
            company,
            comparisons: data.comparisons || [],
            source: data.source,
          })
        },
        () => {
          if (!cancelled) setState({ status: 'error', company, comparisons: [] })
        },
      )

    return () => {
      cancelled = true
    }
  }, [company])

  return current
}

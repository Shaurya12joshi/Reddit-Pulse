import { useEffect, useState } from 'react'

import { apiFetch } from '../services/aiConnection.js'

export function useComparisons(company) {
  const [state, setState] = useState({ status: 'loading', comparisons: [], company: null })

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

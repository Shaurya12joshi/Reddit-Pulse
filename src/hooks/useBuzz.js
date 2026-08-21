/**
 * Fetches the community buzz ranking for a brand.
 *
 * Every signal behind the ranking is computed on the server from stored posts,
 * so this is one request and no client-side scoring — the same numbers the
 * collector's own vocabulary produced.
 */

import { useCallback, useEffect, useState } from 'react'

const API = 'http://localhost:3001'

export function useBuzz(company) {
  const [state, setState] = useState({ status: 'loading' })
  // Bumping this re-runs the effect; it is how "reload" works without calling
  // setState synchronously inside the effect body.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!company) return
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetch(`${API}/api/buzz?company=${encodeURIComponent(company)}`, {
          signal: controller.signal,
        })
        const body = await res.json().catch(() => ({}))

        if (!res.ok) {
          // 404 is not a failure: it means this brand has never been collected,
          // which the caller answers by running the collector.
          setState({
            status: body.needsCollection ? 'empty' : 'error',
            error: body.error || `Buzz ranking failed (${res.status})`,
          })
          return
        }
        setState({ status: 'ready', ...body })
      } catch (error) {
        if (error.name === 'AbortError') return
        setState({ status: 'error', error: error.message })
      }
    }

    load()
    return () => controller.abort()
  }, [company, attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])

  return { ...state, reload }
}

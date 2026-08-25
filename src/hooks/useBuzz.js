
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../services/aiConnection.js'



export function useBuzz(company) {
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!company) return
    const controller = new AbortController()

    async function load() {
      try {
        const res = await apiFetch(`/api/buzz?company=${encodeURIComponent(company)}`, {
          signal: controller.signal,
        })
        const body = await res.json().catch(() => ({}))

        if (!res.ok) {
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

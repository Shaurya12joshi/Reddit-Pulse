import { useCallback, useEffect, useState } from 'react'

import {
  apiFetch,
  clearConnection,
  getConnection,
  saveConnection,
  subscribe,
} from '../services/aiConnection.js'

/**
 * The list of AI services on offer, plus whichever one this browser is using.
 */
export function useAiConnection() {
  const [catalogue, setCatalogue] = useState({ status: 'loading' })
  const [connection, setConnection] = useState(() => getConnection())
  const [checking, setChecking] = useState(false)

  useEffect(() => subscribe(setConnection), [])

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/providers')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('offline'))))
      .then(
        (data) => {
          if (!cancelled) setCatalogue({ status: 'ready', ...data })
        },
        () => {
          if (!cancelled) setCatalogue({ status: 'error' })
        },
      )
    return () => {
      cancelled = true
    }
  }, [])

  /** Verify an account, then keep it only if it actually works. */
  const connect = useCallback(async (draft) => {
    setChecking(true)
    try {
      const response = await apiFetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const result = await response.json()
      if (!result.ok) return result
      saveConnection(draft)
      return result
    } catch {
      return { ok: false, field: null, message: 'Could not reach the service. Try again.' }
    } finally {
      setChecking(false)
    }
  }, [])

  const disconnect = useCallback(() => clearConnection(), [])

  return { catalogue, connection, checking, connect, disconnect }
}

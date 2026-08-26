import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../services/aiConnection.js'

function buildQuery(company, filters) {
  const params = new URLSearchParams({ company })
  if (filters.subreddit !== 'all') params.set('subreddit', filters.subreddit)
  if (filters.sentiment !== 'all') params.set('sentiment', filters.sentiment)
  if (filters.topic !== 'all') params.set('topic', filters.topic)
  if (filters.timeRange !== 'all') params.set('days', filters.timeRange)
  return params
}

export function useReport(company, filters) {
  const [state, setState] = useState({ status: 'loading' })
  const [extraPosts, setExtraPosts] = useState([])
  const requestId = useRef(0)

  useEffect(() => {
    if (!company) return

    const id = ++requestId.current
    const controller = new AbortController()
    setExtraPosts([])

    const RECHECK_MS = 8000
    const RECHECKS = 12
    let timer = null

    async function load(attempt = 0) {
      try {
        const res = await apiFetch(`/api/report?${buildQuery(company, filters)}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Report failed (${res.status})`)
        }
        const data = await res.json()
        if (id !== requestId.current) return

        setState({ status: 'ready', ...data })

        if (data.analysing && attempt < RECHECKS) {
          timer = setTimeout(() => load(attempt + 1), RECHECK_MS)
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        if (id === requestId.current) setState({ status: 'error', error: error.message })
      }
    }

    load()
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [company, filters])

  const loadMore = useCallback(async () => {
    if (!state.nextOffset) return
    const params = buildQuery(company, filters)
    params.set('offset', String(state.nextOffset))

    const res = await apiFetch(`/api/posts?${params}`)
    if (!res.ok) return

    const data = await res.json()
    setExtraPosts((prev) => [...prev, ...data.posts])
    setState((prev) => ({ ...prev, nextOffset: data.nextOffset }))
  }, [company, filters, state.nextOffset])

  const posts = state.posts ? [...state.posts, ...extraPosts] : []

  return { ...state, posts, loadMore }
}

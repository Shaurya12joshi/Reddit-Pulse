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
  const offsetRef = useRef(null)

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

        if (attempt === 0) offsetRef.current = data.nextOffset ?? null
        setState((prev) => ({
          status: 'ready',
          ...data,
          nextOffset: attempt === 0 ? data.nextOffset : offsetRef.current,
          posts: attempt === 0 ? data.posts : prev.posts,
        }))

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
    const offset = offsetRef.current
    if (offset === null || offset === undefined) return { posts: [], nextOffset: null }

    const params = buildQuery(company, filters)
    params.set('offset', String(offset))

    const res = await apiFetch(`/api/posts?${params}`)
    if (!res.ok) return { posts: [], nextOffset: offset }

    const data = await res.json()
    offsetRef.current = data.nextOffset ?? null
    setExtraPosts((prev) => [...prev, ...data.posts])
    setState((prev) => ({ ...prev, nextOffset: data.nextOffset }))
    return { posts: data.posts, nextOffset: data.nextOffset ?? null }
  }, [company, filters])

  const posts = state.posts ? [...state.posts, ...extraPosts] : []

  return { ...state, posts, loadMore }
}

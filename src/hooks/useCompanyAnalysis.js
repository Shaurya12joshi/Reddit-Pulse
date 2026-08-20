/**
 * Owns the "fetch → analyse" lifecycle for one company.
 *
 * The component tree only needs to know four things: the status, the progress
 * message, the enriched posts, and any error. Where the data came from (mock
 * generator or live Apify run) is handled entirely in here.
 */

import { useCallback, useRef, useState } from 'react'
import { enrichPosts } from '../analysis/aggregate.js'
import { generateMockPosts } from '../data/mockPosts.js'

/** Stages shown in the loading screen, in order. */
export const STAGES = [
  { id: 'starting', label: 'Connecting to source' },
  { id: 'scraping', label: 'Collecting Reddit discussions' },
  { id: 'analysing', label: 'Scoring sentiment & topics' },
  { id: 'summarising', label: 'Building insights' },
]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function useCompanyAnalysis() {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [company, setCompany] = useState('')
  const [posts, setPosts] = useState([])
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ stage: 'starting', message: '', itemCount: 0 })
  const [meta, setMeta] = useState(null)

  // Lets a new search cancel an in-flight one.
  const abortRef = useRef(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setCompany('')
    setPosts([])
    setError(null)
    setMeta(null)
  }, [])

  const analyze = useCallback(async (rawName, { source = 'mock', timeRange = 'month' } = {}) => {
    const name = rawName.trim()
    if (!name) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setCompany(name)
    setStatus('loading')
    setError(null)
    setPosts([])
    setMeta(null)
    setProgress({ stage: 'starting', message: 'Preparing analysis', itemCount: 0 })

    try {
      let rawPosts = []
      let usedSource = source

      if (source === 'live') {
        setProgress({ stage: 'scraping', message: `Loading scraped Reddit data for ${name}`, itemCount: 0 })

        const response = await fetch(
          `http://localhost:3001/api/results?company=${encodeURIComponent(name)}`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          const error = new Error(
            body.error || `No scraped data found for "${name}" (status ${response.status})`,
          )
          error.hint =
            response.status === 404
              ? 'Run the Reddit scraper extension for this company first, then reopen the dashboard from its popup.'
              : null
          throw error
        }

        const data = await response.json()
        rawPosts = data.posts
        setMeta({ source: 'live', tokenSource: 'extension', scrapedAt: data.scrapedAt })
      } else {
        // Mock path — the short waits exist so the progress UI is visible and
        // the app behaves the same way it will with a real run.
        setProgress({ stage: 'starting', message: 'Loading the sample dataset', itemCount: 0 })
        await wait(450)
        if (controller.signal.aborted) return

        setProgress({ stage: 'scraping', message: `Collecting Reddit discussions about ${name}`, itemCount: 0 })
        rawPosts = generateMockPosts(name)
        await wait(650)
        if (controller.signal.aborted) return

        setProgress({
          stage: 'scraping',
          message: `Collected ${rawPosts.length} Reddit items`,
          itemCount: rawPosts.length,
        })
        await wait(350)
        setMeta({ source: 'mock', tokenSource: 'none' })
      }

      if (controller.signal.aborted) return

      setProgress({
        stage: 'analysing',
        message: `Scoring sentiment across ${rawPosts.length} discussions`,
        itemCount: rawPosts.length,
      })
      await wait(200) // let the UI paint before the synchronous analysis pass

      const enriched = enrichPosts(rawPosts, name)
      if (controller.signal.aborted) return

      setProgress({
        stage: 'summarising',
        message: 'Extracting topics, themes and competitors',
        itemCount: enriched.length,
      })
      await wait(350)
      if (controller.signal.aborted) return

      setPosts(enriched)
      setStatus('ready')
      usedSource = source
      setMeta((prev) => ({
        ...(prev || {}),
        source: usedSource,
        count: enriched.length,
        // Anchor for relative time filters, so "last 7 days" stays stable for
        // the life of the report instead of drifting on every re-render.
        analyzedAt: Date.now(),
      }))
    } catch (caught) {
      if (caught?.name === 'AbortError') return
      setError({
        message: caught?.message || 'Something went wrong while analysing.',
        hint: caught?.hint || null,
      })
      setStatus('error')
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
  }, [])

  return { status, company, posts, error, progress, meta, analyze, reset, cancel }
}

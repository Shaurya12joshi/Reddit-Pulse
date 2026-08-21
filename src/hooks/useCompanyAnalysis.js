/**
 * Owns the "collect data for a company" lifecycle.
 *
 * The browser extension gathers from Reddit and posts to the backend, which
 * scores and stores everything. This hook only orchestrates that and confirms
 * data exists — the report itself is fetched by `useReport` once the dashboard
 * mounts, so no post data passes through here.
 */

import { useCallback, useRef, useState } from 'react'
import { isExtensionAvailable, requestScrape } from '../services/extensionBridge.js'

const API = 'http://localhost:3001'

export function useCompanyAnalysis() {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [company, setCompany] = useState('')
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ stage: 'starting', message: '' })
  const [meta, setMeta] = useState(null)

  // Lets a new search cancel an in-flight one.
  const abortRef = useRef(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setCompany('')
    setError(null)
    setMeta(null)
  }, [])

  const analyze = useCallback(async (rawName) => {
    const name = rawName.trim()
    if (!name) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setCompany(name)
    setStatus('loading')
    setError(null)
    setMeta(null)
    setProgress({ stage: 'starting', message: 'Looking for the collector extension' })

    try {
      const hasExtension = await isExtensionAvailable()
      if (controller.signal.aborted) return

      if (hasExtension) {
        setProgress({ stage: 'scraping', message: `Collecting Reddit discussions about ${name}` })

        await requestScrape(name, {
          signal: controller.signal,
          onProgress: (job) =>
            setProgress((prev) => ({ ...prev, stage: 'scraping', message: job.step || prev.message })),
        })
        if (controller.signal.aborted) return
      }

      setProgress({ stage: 'summarising', message: 'Building insights' })

      // Confirm something was actually stored before handing over to the
      // dashboard, so a failure surfaces here rather than as an empty report.
      const res = await fetch(`${API}/api/report?company=${encodeURIComponent(name)}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const err = new Error(body.error || `No Reddit data found for "${name}"`)
        if (res.status === 404) {
          err.hint = hasExtension
            ? 'The collector ran but saved nothing — make sure you are signed in to Reddit in this browser.'
            : 'The collector extension is not installed, so live data cannot be gathered. Load it from chrome://extensions, then search again.'
        }
        throw err
      }

      const data = await res.json()
      if (controller.signal.aborted) return

      setMeta({
        source: 'live',
        count: data.totalUnfiltered,
        liveScrape: hasExtension,
        analyzedAt: Date.now(),
      })
      setStatus('ready')
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

  return { status, company, error, progress, meta, analyze, reset, cancel }
}

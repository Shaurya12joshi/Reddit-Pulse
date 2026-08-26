import { useCallback, useRef, useState } from 'react'
import { isExtensionAvailable, requestScrape } from '../services/extensionBridge.js'
import { apiFetch } from '../services/aiConnection.js'

async function waitForAnalysis(company, signal, onProgress) {
  const EVERY_MS = 2000
  const DEADLINE_MS = 4 * 60 * 1000
  const until = Date.now() + DEADLINE_MS

  while (!signal.aborted && Date.now() < until) {
    const status = await apiFetch(
      `/api/analysis-status?company=${encodeURIComponent(company)}`,
      { signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)

    if (!status) return
    if (!status.analysing) return

    const judged = status.total - status.pending
    onProgress(
      status.total
        ? `Reading ${status.total} discussions, ${judged} done so far`
        : 'Reading the discussions collected',
    )

    await new Promise((settle) => setTimeout(settle, EVERY_MS))
  }
}

export function useCompanyAnalysis() {
  const [status, setStatus] = useState('idle')
  const [company, setCompany] = useState('')
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ stage: 'starting', message: '' })
  const [meta, setMeta] = useState(null)

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
    setProgress({ stage: 'starting', message: 'Checking what we already have' })

    try {
      const freshness = await apiFetch(`/api/freshness?company=${encodeURIComponent(name)}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      if (controller.signal.aborted) return

      const needsCollection = !freshness || freshness.stale

      let hasExtension = false
      if (needsCollection) {
        setProgress({ stage: 'starting', message: 'Looking for the collector extension' })
        hasExtension = await isExtensionAvailable()
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
      } else {
        setProgress({ stage: 'scraping', message: `Using ${freshness.postCount} already-collected posts` })
      }

      setProgress({ stage: 'summarising', message: 'Reading the discussions collected' })

      await waitForAnalysis(name, controller.signal, (message) =>
        setProgress({ stage: 'summarising', message }),
      )
      if (controller.signal.aborted) return

      setProgress({ stage: 'summarising', message: 'Building insights' })

      const report = () =>
        apiFetch(`/api/report?company=${encodeURIComponent(name)}`, { signal: controller.signal })

      let res = await report()

      if (res.status === 404 && hasExtension) {
        await new Promise((settle) => setTimeout(settle, 2000))
        if (controller.signal.aborted) return
        res = await report()
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const err = new Error(body.error || `No Reddit data found for "${name}"`)
        if (res.status === 404) {
          err.hint = hasExtension
            ? 'The collector ran but saved nothing. Make sure you are signed in to Reddit in this browser.'
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
        rateLimited: Boolean(caught?.rateLimited),
        retryAt: caught?.retryAt || null,
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

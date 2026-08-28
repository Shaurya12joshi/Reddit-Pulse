import { useCallback, useRef, useState } from 'react'
import { isExtensionAvailable, requestScrape } from '../services/extensionBridge.js'
import { API, apiFetch } from '../services/aiConnection.js'

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

async function waitForStoredPosts(company, signal, onProgress) {
  const EVERY_MS = 1500
  const DEADLINE_MS = 45 * 1000
  const until = Date.now() + DEADLINE_MS

  while (!signal.aborted && Date.now() < until) {
    const freshness = await apiFetch(
      `/api/freshness?company=${encodeURIComponent(company)}`,
      { signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)

    if (freshness?.postCount > 0) return freshness.postCount

    onProgress('Waiting for the collected discussions to land')
    await new Promise((settle) => setTimeout(settle, EVERY_MS))
  }

  return 0
}

function intelligenceTasks(name, extras) {
  const encoded = encodeURIComponent(name)
  const tasks = [
    { label: 'Weighing the competition', path: `/api/comparisons?company=${encoded}` },
    { label: 'Sorting the trending themes', path: `/api/trending?company=${encoded}` },
  ]

  const rival = String(extras.compareWith || '').trim()
  const subject = String(extras.subject || '').trim()
  const rivalProduct = String(extras.rivalProduct || '').trim()

  if (rival) {
    tasks.push({
      label: `Reading ${name} against ${rival}`,
      path: `/api/comparisons/named?company=${encoded}&against=${encodeURIComponent(rival)}`,
    })
  }

  if (subject) {
    tasks.push({
      label: `Answering your question about ${subject}`,
      path: `/api/voice?company=${encoded}&subject=${encodeURIComponent(subject)}`,
    })

    const other = rivalProduct || rival
    if (other) {
      const side = rivalProduct
        ? `theirs=${encodeURIComponent(rivalProduct)}`
        : `rivalCompany=${encodeURIComponent(rival)}`
      tasks.push({
        label: `Comparing ${subject} against ${other}`,
        path: `/api/comparisons/product?company=${encoded}&mine=${encodeURIComponent(subject)}&${side}`,
      })
    }
  }

  return tasks
}

async function runIntelligence(name, extras, signal, onProgress) {
  const tasks = intelligenceTasks(name, extras)
  let done = 0

  onProgress(`${tasks[0].label} (0 of ${tasks.length})`)

  await Promise.allSettled(
    tasks.map((task) =>
      apiFetch(task.path, { signal })
        .catch(() => null)
        .finally(() => {
          done += 1
          if (!signal.aborted) {
            onProgress(
              done < tasks.length
                ? `${tasks[Math.min(done, tasks.length - 1)].label} (${done} of ${tasks.length})`
                : `Reading finished (${done} of ${tasks.length})`,
            )
          }
        }),
    ),
  )
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

  const analyze = useCallback(async (rawName, extras = {}) => {
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

          await waitForStoredPosts(name, controller.signal, (message) =>
            setProgress({ stage: 'scraping', message }),
          )
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
        for (let attempt = 0; attempt < 4 && res.status === 404; attempt += 1) {
          await new Promise((settle) => setTimeout(settle, 2500))
          if (controller.signal.aborted) return
          res = await report()
        }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const err = new Error(body.error || `No Reddit data found for "${name}"`)
        if (res.status === 404) {
          const target = API || window.location.origin
          const stored = await apiFetch('/api/companies', { signal: controller.signal })
            .then((response) => (response.ok ? response.json() : null))
            .then((body) => body?.companies?.length ?? null)
            .catch(() => null)

          if (!hasExtension) {
            err.hint =
              'The collector extension is not installed, so live data cannot be gathered. Load it from chrome://extensions, then search again.'
          } else if (stored === 0) {
            err.hint = `The collector ran, but ${target} is holding no data for any company. Its database was probably reset, which happens on hosts without a persistent disk. Collect again and it should stick until the next restart.`
          } else {
            err.hint = `The collector ran, but this page found nothing at ${target}. Either it saved to a different backend, or you are not signed in to Reddit in this browser.`
          }
        }
        throw err
      }

      const data = await res.json()
      if (controller.signal.aborted) return

      await runIntelligence(name, extras, controller.signal, (message) =>
        setProgress({ stage: 'reading', message }),
      )
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

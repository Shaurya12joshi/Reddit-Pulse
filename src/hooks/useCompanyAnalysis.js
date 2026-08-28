import { useCallback, useRef, useState } from 'react'
import { probeExtension, requestScrape } from '../services/extensionBridge.js'
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
  const startedAt = Date.now()

  let emptyRuns = 0
  let lastCount = 0

  while (!signal.aborted && Date.now() < until) {
    const freshness = await apiFetch(
      `/api/freshness?company=${encodeURIComponent(company)}`,
      { signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)

    if (freshness?.postCount > 0) return { postCount: freshness.postCount, lastCount: 0 }

    if (freshness?.lastRunAt && freshness.lastRunAt >= startedAt) {
      lastCount = freshness.lastCount ?? 0
      emptyRuns += 1
      if (emptyRuns >= 3) break
    }

    onProgress('Waiting for the collected discussions to land')
    await new Promise((settle) => setTimeout(settle, EVERY_MS))
  }

  return { postCount: 0, lastCount }
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
      let collector = 'missing'
      let landed = null
      let scrapeJob = null
      if (needsCollection) {
        setProgress({ stage: 'starting', message: 'Looking for the collector extension' })
        collector = await probeExtension()
        hasExtension = collector === 'ready'
        if (controller.signal.aborted) return

        if (hasExtension) {
          setProgress({ stage: 'scraping', message: `Collecting Reddit discussions about ${name}` })

          scrapeJob = await requestScrape(name, {
            signal: controller.signal,
            onProgress: (job) =>
              setProgress((prev) => ({ ...prev, stage: 'scraping', message: job.step || prev.message })),
          })
          if (controller.signal.aborted) return

          landed = await waitForStoredPosts(name, controller.signal, (message) =>
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

          err.collector = collector
          if (collector === 'orphaned') {
            err.fix = 'Hard reload this page, then search again.'
            err.action = 'reload'
            err.hint =
              'The extension was reloaded after this tab was opened, so the page lost its connection to it. A hard reload reconnects them.'
          } else if (!hasExtension) {
            err.fix = 'Hard reload this page, then search again.'
            err.action = 'reload'
            err.hint =
              'The page got no answer from the collector. That is usually a stale tab rather than a missing extension: a tab loses contact with any extension reloaded after it. If a hard reload does not help, check the extension is switched on at chrome://extensions.'
          } else if (stored === 0) {
            err.fix = 'Search again to collect it a second time.'
            err.hint = `The collector ran, but ${target} is holding no data for any company. Its database was probably reset, which happens on hosts without a persistent disk.`
          } else if (scrapeJob?.collected > 0) {
            const stored = scrapeJob.stored ?? 0
            err.fix = `Try a name people actually type on Reddit, or the parent brand.`
            err.hint =
              `The collector read ${scrapeJob.collected} posts that matched those words, but only ` +
              `${stored} of them were about ${name} itself. Reddit matched "${name.split(' ')[0]}" ` +
              'far more often than the product. A niche B2B name often has almost no Reddit presence ' +
              'to report on.'
          } else if (landed?.lastCount > 0) {
            err.fix = 'Try the fuller name, or the name people actually type.'
            err.hint = `The collector saved ${landed.lastCount} discussions, but none of them turned out to be about ${name}. Reddit matched the words without matching the company.`
          } else {
            err.fix = 'Check you are signed in to Reddit in this browser, then search again.'
            err.hint = `The collector ran, but this page found nothing at ${target}. Either it saved to a different backend, or Reddit returned nothing for a signed-out session.`
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
        fix: caught?.fix || null,
        action: caught?.action || null,
        collector: caught?.collector || null,
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

import { API } from './aiConnection.js'

const EXT_SOURCE = 'reddit-scraper-extension'
const PAGE_SOURCE = 'reddit-dashboard'

const SCRAPE_TIMEOUT_MS = 600_000

export function isExtensionAvailable(timeoutMs = 1000) {
  return new Promise((resolve) => {
    let settled = false

    const finish = (value) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      resolve(value)
    }

    const onMessage = (event) => {
      if (event.source !== window) return
      if (event.data?.source === EXT_SOURCE && event.data.type === 'READY') finish(true)
    }

    window.addEventListener('message', onMessage)
    window.postMessage({ source: PAGE_SOURCE, type: 'PING' }, window.location.origin)

    const timer = setTimeout(() => finish(false), timeoutMs)
  })
}

const sameCompany = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

export function requestScrape(company, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', onAbort)
      clearTimeout(timer)
    }

    const settle = (fn, value) => {
      if (settled) return
      settled = true
      cleanup()
      fn(value)
    }

    const onMessage = (event) => {
      if (event.source !== window) return
      const data = event.data
      if (data?.source !== EXT_SOURCE || data.type !== 'JOB' || !data.job) return

      const job = data.job

      if (job.company && !sameCompany(job.company, company)) return

      onProgress?.(job)

      if (job.status === 'done') settle(resolve, job)
      if (job.status === 'error') {
        const error = new Error(job.step || 'The scrape failed.')
        if (job.rateLimited) {
          error.rateLimited = true
          error.retryAt = job.retryAt || null
        }
        settle(reject, error)
      }
    }

    const onAbort = () => settle(reject, new DOMException('Aborted', 'AbortError'))

    window.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort)

    const timer = setTimeout(
      () => settle(reject, new Error('The extension did not finish in time.')),
      SCRAPE_TIMEOUT_MS,
    )

    window.postMessage(
      {
        source: PAGE_SOURCE,
        type: 'SCRAPE',
        company,
        apiBase: API || window.location.origin,
      },
      window.location.origin,
    )
  })
}

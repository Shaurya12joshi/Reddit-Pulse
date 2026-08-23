/**
 * Talks to the Reddit Scraper browser extension.
 *
 * The page can't reach Reddit itself — it has no Reddit session and CORS
 * blocks it. The extension can, because it runs inside the browser and its
 * requests carry the user's cookies. The extension injects a content script
 * (`bridge.js`) into this page, and the two sides exchange window messages.
 */

const EXT_SOURCE = 'reddit-scraper-extension'
const PAGE_SOURCE = 'reddit-dashboard'

/**
 * Overall ceiling for one scrape, so a wedged run can't hang the UI forever.
 *
 * This covers the extension's own Reddit fetching *and* every /api/ingest
 * call it makes along the way — and ingest now classifies relevance before
 * it stores anything, so that an off-topic post never reaches the report at
 * all. That is an LLM round trip per batch of threads, and on a free tier
 * with a per-minute request cap it is sometimes backoff rather than work: a
 * ~300-thread corpus spent 73 of 90 seconds waiting out rate limits. Three
 * minutes was a ceiling for scraping alone and cut those runs off mid-flight.
 */
const SCRAPE_TIMEOUT_MS = 600_000

/**
 * Is the extension installed and injected into this page?
 * Resolves false after `timeoutMs` rather than hanging.
 */
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

/**
 * Ask the extension to scrape a company. Resolves once it reports done.
 *
 * @param {string} company
 * @param {{onProgress?: (job:object)=>void, signal?: AbortSignal}} options
 */
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
      onProgress?.(job)

      if (job.status === 'done') settle(resolve, job)
      if (job.status === 'error') settle(reject, new Error(job.step || 'The scrape failed.'))
    }

    const onAbort = () => settle(reject, new DOMException('Aborted', 'AbortError'))

    window.addEventListener('message', onMessage)
    signal?.addEventListener('abort', onAbort)

    const timer = setTimeout(
      () => settle(reject, new Error('The extension did not finish in time.')),
      SCRAPE_TIMEOUT_MS,
    )

    // Listener is attached first, so no progress update can be missed.
    window.postMessage({ source: PAGE_SOURCE, type: 'SCRAPE', company }, window.location.origin)
  })
}

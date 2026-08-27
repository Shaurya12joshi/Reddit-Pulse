const NEW_REDDIT = 'https://www.reddit.com'

// The collector stores permalinks as site-relative paths ("/r/sub/comments/…")
// and urls pointing at old.reddit.com. A relative href keeps the router on our
// own page instead of leaving for Reddit, so every outbound link goes through
// here: absolute, and always the current site rather than old.reddit.
export function redditUrl(...candidates) {
  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (!value) continue

    if (value.startsWith('/')) return `${NEW_REDDIT}${value}`

    try {
      const parsed = new URL(value)
      if (!/(^|\.)reddit\.com$/i.test(parsed.hostname)) return parsed.href
      parsed.hostname = 'www.reddit.com'
      parsed.protocol = 'https:'
      return parsed.href
    } catch {
      return `${NEW_REDDIT}/${value.replace(/^\/+/, '')}`
    }
  }

  return null
}

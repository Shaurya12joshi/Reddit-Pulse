const NEW_REDDIT = 'https://www.reddit.com'

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

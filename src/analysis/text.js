
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]*)\)/g
const REMOVED = /^\s*[[(]?\s*(deleted|removed|unavailable|withdrawn)\s*[\])]?\s*$/i
const QUOTE_LINE = /^\s*&gt;.*$/gm

export function readableText(value) {
  return String(value || '')
    .replace(MARKDOWN_LINK, '$1')
    .replace(QUOTE_LINE, ' ')
    .replace(URL_PATTERN, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MIN_COMMENT_WORDS = 2

export function isContentFree(post) {
  const body = String(post?.body ?? '')
  const title = String(post?.title ?? '')

  if (post?.type === 'post') {
    return !readableText(title) && !readableText(body)
  }

  if (REMOVED.test(body)) return true

  const words = readableText(body).split(' ').filter(Boolean)
  return words.length < MIN_COMMENT_WORDS
}

export function dropContentFree(posts = []) {
  return posts.filter((post) => !isContentFree(post))
}

const REPEATED_RUN = /(.)\1{7,}/

export function isQuotable(sentence) {
  const value = String(sentence || '')
  if (REPEATED_RUN.test(value)) return false

  const words = readableText(value).split(' ').filter(Boolean)
  if (words.length < 4) return false

  const stripped = readableText(value).length
  return stripped >= value.length * 0.4
}

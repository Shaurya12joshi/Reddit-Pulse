// Reddit comments are often not text at all: a bare image link, a gif, a
// deleted stub. They carry no opinion, score 0.00 neutral, and still count as
// a discussion in every total on the report. The aboutness pass cannot catch
// them either — it only reads threads, and a comment rides in on its parent.
//
// Nothing here needs a model. A comment whose body is only links, markdown
// image syntax, punctuation or a removal stub has nothing to read.

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

// A thread survives on its title alone; a comment has to say something. Two
// words is the floor — "same here" is a real reaction, a lone "lol" beside a
// link is not what the corpus is for.
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

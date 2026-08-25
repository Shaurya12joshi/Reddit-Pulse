
import { ALL_BRANDS, BRAND_GROUPS, COMPARISON_PATTERNS, STOPWORDS } from './lexicon.js'
import { analyzeSentiment, splitSentences } from './sentiment.js'
import { detectTopics, escapeRegex } from './topics.js'

const BRAND_MATCHERS = ALL_BRANDS.map((brand) => ({
  brand,
  regex: new RegExp(`(?:^|[^\\w])${escapeRegex(brand)}(?:$|[^\\w])`),
}))

const CAPTURE_PATTERNS = [
  /\b(?:vs\.?|versus)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\bswitched\s+(?:to|from)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\b(?:moved|migrated)\s+(?:to|from)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\b(?:better|worse|cheaper|faster|slower)\s+than\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\b(?:alternative|alternatives|replacement)\s+(?:to|for)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\b(?:instead\s+of|in\s+place\s+of|over)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
]

const CAPTURE_BLOCKLIST = new Set([
  'i', 'it', 'the', 'this', 'that', 'they', 'we', 'you', 'my', 'me',
  'reddit', 'google search', 'edit', 'op', 'imo', 'imho', 'tbh', 'us',
  'when', 'what', 'why', 'how', 'if', 'but', 'and', 'so', 'now', 'then',
  'their', 'there', 'here', 'honestly', 'personally', 'anyone', 'everyone',
  'looking', 'trying', 'thinking', 'switching', 'moving', 'using', 'anything',
  'nothing', 'something', 'everything', 'someone', 'nobody', 'yes', 'no',
  'pros', 'cons', 'tldr', 'psa', 'update', 'question', 'help', 'advice',
  'ui', 'ux', 'api', 'app', 'os', 'pc', 'cpu', 'gpu', 'ram', 'ssd', 'tv',
  'url', 'http', 'https', 'css', 'html', 'js', 'sdk', 'cli', 'gui', 'faq',
  'ceo', 'cto', 'usa', 'uk', 'eu', 'gdpr', 'sso', 'mfa', 'vpn', 'ai', 'llm',
  'corp', 'inc', 'ltd', 'llc', 'labs', 'co',
])

function looksLikeBrand(candidate) {
  const lower = candidate.trim().toLowerCase()
  if (lower.length < 2 || lower.length > 30) return false
  if (CAPTURE_BLOCKLIST.has(lower)) return false
  if (ALL_BRANDS.some((brand) => brand.toLowerCase() === lower)) return true
  return !STOPWORDS.has(lower)
}

export function findMarket(companyName) {
  const needle = companyName.trim().toLowerCase()
  const group = BRAND_GROUPS.find((g) =>
    g.brands.some((brand) => brand.toLowerCase() === needle),
  )

  if (!group) return { market: null, peers: [] }

  return {
    market: group.market,
    peers: group.brands.filter((brand) => brand.toLowerCase() !== needle),
  }
}

function isSelfReference(candidate, companyName) {
  const a = candidate.trim().toLowerCase()
  const b = companyName.trim().toLowerCase()
  return a === b || a.includes(b) || b.includes(a)
}

function canonicalise(candidate) {
  const trimmed = candidate.trim().replace(/[.,!?;:'"]+$/, '')
  const known = ALL_BRANDS.find(
    (brand) => brand.toLowerCase() === trimmed.toLowerCase(),
  )
  return known || trimmed
}

/**
 * The built-in brand list only covers a handful of markets. Names resolved for
 * this company — its competitors and their aliases — are matched alongside it,
 * so a brand nobody hardcoded is still recognised in a comparison.
 */
function matchersFor(extraBrands = []) {
  if (!extraBrands.length) return BRAND_MATCHERS

  const known = new Set(ALL_BRANDS.map((brand) => brand.toLowerCase()))
  const extra = []
  for (const name of extraBrands) {
    const brand = String(name || '').trim()
    if (brand.length < 2 || known.has(brand.toLowerCase())) continue
    known.add(brand.toLowerCase())
    extra.push({
      brand,
      regex: new RegExp(`(?:^|[^\\w])${escapeRegex(brand)}(?:$|[^\\w])`, 'i'),
    })
  }

  return extra.length ? [...BRAND_MATCHERS, ...extra] : BRAND_MATCHERS
}

export function detectCompetitors(text, companyName, extraBrands = []) {
  if (!text) return []

  const matchers = matchersFor(extraBrands)
  const mentions = []
  const sentences = splitSentences(text)

  sentences.forEach((sentence) => {
    const found = new Set()

    matchers.forEach(({ brand, regex }) => {
      if (regex.test(sentence) && !isSelfReference(brand, companyName)) {
        found.add(brand)
      }
    })

    CAPTURE_PATTERNS.forEach((pattern) => {
      pattern.lastIndex = 0
      let match = pattern.exec(sentence)
      while (match !== null) {
        const candidate = canonicalise(match[1])
        if (looksLikeBrand(candidate) && !isSelfReference(candidate, companyName)) {
          found.add(candidate)
        }
        match = pattern.exec(sentence)
      }
    })

    const reasons = COMPARISON_PATTERNS.filter((p) => p.regex.test(sentence)).map(
      ({ id, label }) => ({ id, label }),
    )

    if (reasons.length > 0) {
      const words = sentence.split(/\s+/)
      let run = []

      const flushRun = () => {
        if (run.length === 0) return
        const candidate = canonicalise(run.slice(0, 3).join(' '))
        run = []
        if (looksLikeBrand(candidate) && !isSelfReference(candidate, companyName)) {
          found.add(candidate)
        }
      }

      words.forEach((word, index) => {
        const cleaned = word.replace(/^[^\w]+|[^\w.+-]+$/g, '')
        if (index === 0 || !/^[A-Z][\w.+-]*$/.test(cleaned)) {
          flushRun()
          return
        }
        run.push(cleaned)
      })
      flushRun()
    }

    if (found.size === 0) return
    const topics = detectTopics(sentence).map((t) => t.id)
    const { score } = analyzeSentiment(sentence)

    found.forEach((brand) => {
      mentions.push({
        brand,
        sentence: sentence.length > 260 ? `${sentence.slice(0, 257)}…` : sentence,
        reasons,
        topics,
        sentiment: score,
        known: ALL_BRANDS.includes(brand),
      })
    })
  })

  return mentions
}

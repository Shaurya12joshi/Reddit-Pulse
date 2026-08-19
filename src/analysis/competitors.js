/**
 * Competitor detection.
 *
 * Two complementary strategies:
 *   1. Dictionary — look for brands we already know about (lexicon.js).
 *   2. Pattern    — capture whatever noun follows comparison phrasing such as
 *                   "vs X", "switched to X", "better than X". This catches
 *                   brands the dictionary has never heard of.
 *
 * Every hit records the sentence it came from, so the UI can show *why* the
 * comparison was made rather than just that it happened.
 */

import { ALL_BRANDS, BRAND_GROUPS, COMPARISON_PATTERNS, STOPWORDS } from './lexicon.js'
import { analyzeSentiment, splitSentences } from './sentiment.js'
import { detectTopics, escapeRegex } from './topics.js'

/**
 * Dictionary matching is CASE-SENSITIVE on purpose. Plenty of real brands are
 * also ordinary English words — Nothing, Slack, Target, Bear, Craft, Linear,
 * Wise — and a case-insensitive match turns "no backup, no apology, nothing"
 * into a competitor mention. Proper nouns are capitalised in practice, so
 * requiring the capital costs little and removes a whole class of nonsense.
 */
const BRAND_MATCHERS = ALL_BRANDS.map((brand) => ({
  brand,
  regex: new RegExp(`(?:^|[^\\w])${escapeRegex(brand)}(?:$|[^\\w])`),
}))

/**
 * Patterns that capture an unknown brand name directly out of the sentence.
 * The capture group must look like a product name: capitalised, or a known
 * lowercase-styled brand such as "npm".
 */
const CAPTURE_PATTERNS = [
  /\b(?:vs\.?|versus)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\bswitched\s+(?:to|from)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\b(?:moved|migrated)\s+(?:to|from)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\b(?:better|worse|cheaper|faster|slower)\s+than\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\b(?:alternative|alternatives|replacement)\s+(?:to|for)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
  /\b(?:instead\s+of|in\s+place\s+of|over)\s+([A-Z][\w.+-]*(?:\s[A-Z][\w.+-]*)?)/g,
]

/** Words that look like brands to the regex but obviously are not. */
const CAPTURE_BLOCKLIST = new Set([
  'i', 'it', 'the', 'this', 'that', 'they', 'we', 'you', 'my', 'me',
  'reddit', 'google search', 'edit', 'op', 'imo', 'imho', 'tbh', 'us',
  'when', 'what', 'why', 'how', 'if', 'but', 'and', 'so', 'now', 'then',
  'their', 'there', 'here', 'honestly', 'personally', 'anyone', 'everyone',
  'looking', 'trying', 'thinking', 'switching', 'moving', 'using', 'anything',
  'nothing', 'something', 'everything', 'someone', 'nobody', 'yes', 'no',
  'pros', 'cons', 'tldr', 'psa', 'update', 'question', 'help', 'advice',
  // technical acronyms that are capitalised but never a competitor
  'ui', 'ux', 'api', 'app', 'os', 'pc', 'cpu', 'gpu', 'ram', 'ssd', 'tv',
  'url', 'http', 'https', 'css', 'html', 'js', 'sdk', 'cli', 'gui', 'faq',
  'ceo', 'cto', 'usa', 'uk', 'eu', 'gdpr', 'sso', 'mfa', 'vpn', 'ai', 'llm',
  // generic company suffixes, which only appear as part of a longer name
  'corp', 'inc', 'ltd', 'llc', 'labs', 'co',
])

/** Is this candidate plausibly a product name rather than ordinary English? */
function looksLikeBrand(candidate) {
  const lower = candidate.trim().toLowerCase()
  if (lower.length < 2 || lower.length > 30) return false
  if (CAPTURE_BLOCKLIST.has(lower)) return false
  // A known brand is always allowed, even if it collides with a common word.
  if (ALL_BRANDS.some((brand) => brand.toLowerCase() === lower)) return true
  return !STOPWORDS.has(lower)
}

/**
 * Which market does this company sit in, and who are its known peers?
 * @returns {{market:string|null, peers:string[]}}
 */
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

/** Is this candidate string just the company we are already analysing? */
function isSelfReference(candidate, companyName) {
  const a = candidate.trim().toLowerCase()
  const b = companyName.trim().toLowerCase()
  return a === b || a.includes(b) || b.includes(a)
}

/** Normalise a captured brand string ("NOTION" and "notion" → "Notion"). */
function canonicalise(candidate) {
  const trimmed = candidate.trim().replace(/[.,!?;:'"]+$/, '')
  const known = ALL_BRANDS.find(
    (brand) => brand.toLowerCase() === trimmed.toLowerCase(),
  )
  return known || trimmed
}

/**
 * Find every competitor mention inside one piece of text.
 *
 * @param {string} text
 * @param {string} companyName
 * @returns {{brand:string, sentence:string, reasons:{id:string,label:string}[],
 *            topics:string[], sentiment:number, known:boolean}[]}
 */
export function detectCompetitors(text, companyName) {
  if (!text) return []

  const mentions = []
  const sentences = splitSentences(text)

  sentences.forEach((sentence) => {
    const found = new Set()

    // 1. Known brands anywhere in the sentence.
    BRAND_MATCHERS.forEach(({ brand, regex }) => {
      if (regex.test(sentence) && !isSelfReference(brand, companyName)) {
        found.add(brand)
      }
    })

    // 2. Unknown brands pulled out of comparison phrasing.
    CAPTURE_PATTERNS.forEach((pattern) => {
      // Reset because these regexes are global and carry lastIndex state.
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

    // 3. Inside a sentence that is explicitly making a comparison, any other
    //    capitalised word is a candidate: "Looking for an alternative to Foo,
    //    is Bar worth trying?" names Bar without a second comparison marker.
    //    Scoped to comparison sentences so ordinary proper nouns stay out.
    if (reasons.length > 0) {
      const words = sentence.split(/\s+/)
      let run = []

      const flushRun = () => {
        if (run.length === 0) return
        // Consecutive capitals belong together: "Acme Corp", not "Acme"+"Corp".
        const candidate = canonicalise(run.slice(0, 3).join(' '))
        run = []
        if (looksLikeBrand(candidate) && !isSelfReference(candidate, companyName)) {
          found.add(candidate)
        }
      }

      words.forEach((word, index) => {
        const cleaned = word.replace(/^[^\w]+|[^\w.+-]+$/g, '')
        // Skip the first word — its capital may just be sentence case.
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

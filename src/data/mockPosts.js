/**
 * MOCK DATA — no network calls, no API key required.
 *
 * This module fabricates a realistic Reddit dataset for any company name so
 * the whole dashboard can be built and demoed offline. It is deliberately kept
 * in `src/data/` and completely separate from `src/services/apify.js`, which is
 * the only place that talks to the real API.
 *
 * Both sources emit the SAME normalised shape (see `normaliseItem` in the Apify
 * service), so the rest of the app cannot tell them apart:
 *
 *   { id, type, title, body, author, subreddit, score, numComments,
 *     createdAt, permalink, url }
 */

import { findMarket } from '../analysis/competitors.js'

/* --------------------------------------------------- deterministic randomness */

/** Hash a string into a 32-bit seed so the same company always looks the same. */
function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Tiny seeded PRNG (mulberry32). Returns a function producing 0..1. */
function createRandom(seed) {
  let state = seed
  return function random() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (random, list) => list[Math.floor(random() * list.length)]

/** Pick `count` distinct items. */
function sample(random, list, count) {
  const pool = [...list]
  const out = []
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  }
  return out
}

/* ------------------------------------------------------------- communities */

const SUBREDDITS_BY_MARKET = {
  'Productivity & Notes': ['productivity', 'Notion', 'ObsidianMD', 'PKMS', 'selfhosted', 'apple'],
  'Project Management': ['projectmanagement', 'agile', 'ExperiencedDevs', 'startups', 'sysadmin'],
  'Team Communication': ['sysadmin', 'ITManagers', 'remotework', 'startups', 'technology'],
  'Design Tools': ['userexperience', 'web_design', 'graphic_design', 'FigmaDesign', 'UI_Design'],
  'Cloud & Hosting': ['devops', 'webdev', 'aws', 'selfhosted', 'ExperiencedDevs', 'sysadmin'],
  Streaming: ['cordcutters', 'television', 'movies', 'NetflixBestOf', 'technology'],
  'Consumer Tech': ['gadgets', 'technology', 'apple', 'Android', 'hardware', 'BuyItForLife'],
  Automotive: ['cars', 'electricvehicles', 'teslamotors', 'whatcarshouldIbuy'],
  'Finance & Fintech': ['personalfinance', 'fintech', 'churning', 'UKPersonalFinance', 'investing'],
  'AI Assistants': ['ArtificialInteligence', 'LocalLLaMA', 'singularity', 'ChatGPT', 'programming'],
  'E-commerce & Retail': ['ecommerce', 'smallbusiness', 'Frugal', 'BuyItForLife', 'shopify'],
  'Ride & Delivery': ['uber', 'doordash_drivers', 'personalfinance', 'nyc', 'beermoney'],
}

const GENERIC_SUBREDDITS = [
  'technology', 'business', 'AskReddit', 'consumer', 'mildlyinfuriating',
  'BuyItForLife', 'smallbusiness', 'productivity',
]

const GENERIC_COMPETITORS = [
  'Acme Corp', 'Northwind', 'Globex', 'Initech', 'Umbrella Labs', 'Contoso',
]

/* ------------------------------------------------------------- sentence pools */

const POSITIVE_SENTENCES = [
  "Honestly {company} has been rock solid for me — six months in and it hasn't crashed once.",
  'The onboarding is genuinely intuitive, I had my whole team up and running in an afternoon.',
  'What sold me is how fast it is. Everything loads instantly even with a huge workspace.',
  'Their customer support actually replied within an hour and fixed my billing issue. Rare these days.',
  'The new update is excellent — the redesigned interface is so much cleaner than before.',
  'Worth every penny for what you get. The free tier alone beats what competitors charge for.',
  'I love the keyboard shortcuts and the whole workflow feels really polished.',
  'The API is well documented and the integrations just work without any hassle.',
  'Dark mode finally looks great and the mobile app is surprisingly responsive.',
  'Been recommending {company} to everyone at work. It genuinely saved us hours every week.',
  'Their export options are generous — no lock-in, which I really appreciate.',
  'Performance improved massively after the last release. Very impressive turnaround.',
  'Customer service went above and beyond, they refunded me without any argument.',
  'The automation features are powerful and flexible once you learn them.',
  'Really solid product. Stable, reliable, and the pricing is fair for a small team.',
  'Their privacy policy is refreshingly clear and they do not sell your data.',
]

const NEGATIVE_SENTENCES = [
  'The app crashes constantly on mobile since the last update. Completely unusable for me.',
  'Support has ignored my ticket for three weeks now. Absolutely terrible service.',
  '{company} is wildly overpriced for what it actually does. The pricing keeps creeping up.',
  'It is so slow with large files, I get multi-second lag on every single action.',
  'The interface is cluttered and confusing. The learning curve is brutal for new users.',
  'They moved a feature I used daily behind a paywall. Feels predatory honestly.',
  'Sync broke and I lost two days of work. No backup, no apology, nothing.',
  'Buggy release after buggy release. Basic things are still broken months later.',
  'Their billing is misleading — got charged for a renewal I explicitly cancelled.',
  'The mobile app is a disaster. Notifications never arrive and it drains my battery.',
  'Way too many ads now and the tracking is getting genuinely creepy.',
  'The outage last week took down our whole workflow. Downtime is unacceptable at this price.',
  'Missing basic features that every competitor has shipped years ago.',
  'I regret upgrading. Going to cancel my subscription before the next renewal.',
  'Documentation is stale and half the API endpoints are undocumented. Frustrating.',
  'Performance has degraded badly over the past year. It used to be fast.',
]

const NEUTRAL_SENTENCES = [
  'Has anyone got the self-hosted setup working with a reverse proxy?',
  'Just started my trial of {company}, curious what people think long term.',
  'Does anyone know if the enterprise plan includes SSO by default?',
  'Posting my setup in case it helps someone else configure theirs.',
  'They announced a new release today, changelog is on their blog.',
  'Looking for advice on migrating our existing data across.',
  'Their pricing page changed again, here is what I could work out.',
  'What are people using for the reporting side of things?',
  'Trying to decide whether to renew for another year, gathering opinions.',
  'Anyone else notice the settings menu got reorganised?',
]

const COMPARISON_SENTENCES = [
  'I switched from {competitor} to {company} last year and have not looked back.',
  '{company} vs {competitor} — honestly {company} wins on speed but {competitor} has better integrations.',
  'Coming from {competitor}, the interface here feels much cleaner than {competitor} ever was.',
  'Still cheaper than {competitor}, which is the only reason I am staying.',
  'We evaluated {competitor} as an alternative to {company} and ended up staying put.',
  'Moved to {competitor} after the price hike. Better than {company} for our use case.',
  'Anyone compared this with {competitor}? Trying to pick between the two.',
  '{competitor} is more expensive but their support is far better than {company}.',
  'Using {company} alongside {competitor} — they solve slightly different problems.',
  'Migrated our team from {company} to {competitor} and the export was painful.',
  '{company} is slower than {competitor} on big projects, but the UI is nicer.',
  'Looking for an alternative to {company}, is {competitor} worth trying?',
]

const TITLE_TEMPLATES = {
  positive: [
    '{company} has genuinely improved my workflow',
    'Six months with {company} — my honest review',
    'Why I keep paying for {company}',
    '{company} support just earned my loyalty',
    'The new {company} update is a big step forward',
  ],
  negative: [
    'Am I the only one fed up with {company}?',
    '{company} pricing has gotten out of hand',
    'PSA: watch out for {company} auto-renewal',
    'Is {company} getting worse or is it just me?',
    '{company} lost my data and support went silent',
  ],
  neutral: [
    '{company} question — how do you handle exports?',
    'Thinking about trying {company}, worth it?',
    '{company} changelog discussion',
    'Best way to set up {company} for a small team?',
  ],
  comparison: [
    '{company} vs {competitor}: which did you pick?',
    'Switching from {competitor} to {company} — worth it?',
    'Looking for a {company} alternative, considering {competitor}',
    '{company} or {competitor} for a growing team?',
  ],
}

const AUTHORS = [
  'quietbuild', 'mx_hollow', 'terracotta_dev', 'nine_volt', 'saltandpine',
  'delta_owl', 'brack3n', 'ferrous_moth', 'lowercase_j', 'orbit_decay',
  'papercut_ui', 'ruby_finch', 'stacktrace_sam', 'tin_roof', 'umbrelladays',
  'vellum_notes', 'wiredfern', 'xenon_pl', 'yellowbrick_io', 'zephyr_ops',
  'cold_brew_dev', 'marginalia_', 'notquitehere', 'plainoats', 'signalfade',
]

/* ------------------------------------------------------------- generation */

const DAY_MS = 24 * 60 * 60 * 1000

function fill(template, company, competitor) {
  return template
    .replaceAll('{company}', company)
    .replaceAll('{competitor}', competitor || 'the alternative')
}

/**
 * Generate a mock dataset for a company.
 *
 * @param {string} companyName
 * @param {{count?:number, days?:number}} options
 * @returns {object[]} normalised Reddit items
 */
export function generateMockPosts(companyName, { count = 165, days = 90 } = {}) {
  const company = companyName.trim() || 'Acme'
  const random = createRandom(hashString(company.toLowerCase()))

  const { market, peers } = findMarket(company)
  const competitors = peers.length >= 3 ? peers : GENERIC_COMPETITORS
  const subreddits = [
    ...(SUBREDDITS_BY_MARKET[market] || []),
    ...sample(random, GENERIC_SUBREDDITS, 3),
  ]
  const activeSubs = subreddits.length ? subreddits : GENERIC_SUBREDDITS
  const authors = sample(random, AUTHORS, Math.min(AUTHORS.length, 22))

  // Give each company a distinct personality so different searches feel
  // different: some are loved, some are dragged.
  const positiveBias = 0.3 + random() * 0.35 // 0.30 .. 0.65
  const negativeBias = 0.2 + random() * 0.3 // 0.20 .. 0.50

  // A single burst of activity somewhere in the window (a launch or an outage)
  // makes the volume chart look like real life rather than white noise.
  const spikeDay = Math.floor(random() * (days - 14)) + 7
  const spikeIsNegative = random() > 0.5

  const posts = []

  for (let i = 0; i < count; i += 1) {
    // --- when ---------------------------------------------------------
    let dayOffset = Math.floor(random() * days)
    if (random() < 0.22) {
      // Cluster around the spike.
      dayOffset = Math.max(0, Math.min(days - 1, spikeDay + Math.floor((random() - 0.5) * 6)))
    }
    const createdAt = new Date(
      Date.now() - dayOffset * DAY_MS - Math.floor(random() * DAY_MS),
    )
    const nearSpike = Math.abs(dayOffset - spikeDay) <= 3

    // --- tone ---------------------------------------------------------
    const roll = random()
    let mood
    if (nearSpike) mood = spikeIsNegative ? 'negative' : 'positive'
    else if (roll < positiveBias) mood = 'positive'
    else if (roll < positiveBias + negativeBias) mood = 'negative'
    else mood = 'neutral'

    const competitor = pick(random, competitors)
    const isComparison = random() < 0.28

    // --- text ---------------------------------------------------------
    const titleKind = isComparison ? 'comparison' : mood
    const title = fill(pick(random, TITLE_TEMPLATES[titleKind]), company, competitor)

    const bodyParts = []
    const primaryPool =
      mood === 'positive'
        ? POSITIVE_SENTENCES
        : mood === 'negative'
          ? NEGATIVE_SENTENCES
          : NEUTRAL_SENTENCES

    const sentenceCount = 1 + Math.floor(random() * 3)
    sample(random, primaryPool, sentenceCount).forEach((sentence) => {
      bodyParts.push(fill(sentence, company, competitor))
    })

    if (isComparison) {
      bodyParts.splice(
        Math.floor(random() * (bodyParts.length + 1)),
        0,
        fill(pick(random, COMPARISON_SENTENCES), company, competitor),
      )
    }

    // Mixed reviews are the most realistic thing on Reddit.
    if (random() < 0.3) {
      const counterPool = mood === 'negative' ? POSITIVE_SENTENCES : NEGATIVE_SENTENCES
      bodyParts.push(fill(pick(random, counterPool), company, competitor))
    }

    // --- engagement ----------------------------------------------------
    const isPost = random() < 0.45
    const engagementBase = nearSpike ? 3 : 1
    const score = Math.floor(random() * random() * 900 * engagementBase) + 1
    const numComments = isPost ? Math.floor(random() * random() * 180 * engagementBase) : 0
    const subreddit = pick(random, activeSubs)
    const id = `mock_${hashString(`${company}${i}`).toString(36)}`
    const permalink = `https://www.reddit.com/r/${subreddit}/comments/${id}/`

    posts.push({
      id,
      type: isPost ? 'post' : 'comment',
      title: isPost ? title : '',
      body: bodyParts.join(' '),
      author: pick(random, authors),
      subreddit,
      score,
      numComments,
      createdAt: createdAt.toISOString(),
      permalink,
      url: permalink,
    })
  }

  return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

/** Companies with hand-picked peers, offered as one-click examples. */
export const EXAMPLE_COMPANIES = [
  'Notion',
  'Figma',
  'Spotify',
  'Tesla',
  'Slack',
  'Cloudflare',
]

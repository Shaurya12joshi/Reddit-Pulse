const API = process.env.API_URL || 'http://localhost:3001'
const COMPANY = process.env.PREVIEW_COMPANY || ''
const OUT = new URL('../src/data/previewSnapshot.js', import.meta.url)

const POST_KEYS = [
  'id', 'type', 'title', 'body', 'author', 'subreddit', 'score', 'numComments',
  'createdAt', 'permalink', 'url', 'sentimentLabel', 'sentimentScore',
  'sentimentHits', 'topicIds', 'topicLabels', 'competitorMentions',
  'engagement', 'timestamp',
]

const pick = (source, keys) =>
  Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]))

const trimPost = (post) => pick(post, POST_KEYS)

const capExamples = (list = [], limit) =>
  list.map((entry) => (entry.examples ? { ...entry, examples: entry.examples.slice(0, limit) } : entry))

async function json(path) {
  const response = await fetch(`${API}${path}`)
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`)
  return response.json()
}

const company =
  COMPANY || (await json('/api/companies')).companies?.[0]?.company

if (!company) throw new Error('No companies in the database to capture')

const report = await json(`/api/report?company=${encodeURIComponent(company)}`)
const insights = report.insights

const snapshot = {
  company: report.company,
  capturedAt: Date.now(),
  insights: {
    ...insights,
    timeline: {
      ...insights.timeline,
      buckets: insights.timeline.buckets.filter((bucket) => bucket.total > 0).slice(-120),
    },
    topDiscussions: Object.fromEntries(
      Object.entries(insights.topDiscussions).map(([key, list]) => [
        key,
        list.slice(0, 4).map(trimPost),
      ]),
    ),
    topics: capExamples(insights.topics, 2),
    praise: capExamples(insights.praise, 1),
    complaints: capExamples(insights.complaints, 1),
    competitors: capExamples(insights.competitors, 2).slice(0, 8),
    subreddits: insights.subreddits.slice(0, 12),
  },
  posts: report.posts.slice(0, 24).map((post) => pick(post, POST_KEYS)),
}

const body = `export const PREVIEW_SNAPSHOT = ${JSON.stringify(snapshot, null, 2)}\n`
await (await import('node:fs/promises')).writeFile(OUT, body)

console.log(
  `Captured ${snapshot.company}: ${snapshot.posts.length} posts, ` +
    `${(body.length / 1024).toFixed(0)} kB written to src/data/previewSnapshot.js`,
)

import { analyzeSentiment, analyzeSentences, labelFor, tokenize } from './sentiment.js'
import { detectTopics, extractTrendingPhrases, topicLabel } from './topics.js'
import { detectCompetitors, findMarket } from './competitors.js'
import { THEME_BUCKETS } from './lexicon.js'

const DAY_MS = 24 * 60 * 60 * 1000

function fullText(post) {
  return [post.title, post.body].filter(Boolean).join('. ')
}

export function enrichPost(post, companyName, { knownBrands = [] } = {}) {
  const text = fullText(post)
  const sentiment = analyzeSentiment(text)
  const sentences = analyzeSentences(text)
  const topics = detectTopics(text)

  const praiseThemes = new Set()
  const complaintThemes = new Set()
  const themeEvidence = []

  sentences.forEach((entry) => {
    const label = labelFor(entry.score)
    if (label === 'neutral') return

    THEME_BUCKETS.forEach((bucket) => {
      const hit = bucket.keywords.some((keyword) =>
        entry.sentence.toLowerCase().includes(keyword),
      )
      if (!hit) return

      if (label === 'positive') praiseThemes.add(bucket.id)
      else complaintThemes.add(bucket.id)

      themeEvidence.push({
        themeId: bucket.id,
        themeLabel: bucket.label,
        polarity: label,
        sentence: entry.sentence,
        score: entry.score,
      })
    })
  })

  return {
    ...post,
    text,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
    sentimentHits: {
      positive: sentiment.positiveHits,
      negative: sentiment.negativeHits,
    },
    topicIds: topics.map((t) => t.id),
    topicLabels: topics.map((t) => t.label),
    praiseThemes: [...praiseThemes],
    complaintThemes: [...complaintThemes],
    themeEvidence,
    competitorMentions: detectCompetitors(text, companyName, knownBrands),
    engagement: (post.score || 0) + (post.numComments || 0) * 2,
    timestamp: new Date(post.createdAt).getTime(),
  }
}

export function enrichPosts(posts, companyName, { knownBrands = [] } = {}) {
  return posts
    .map((post) => enrichPost(post, companyName, { knownBrands }))
    .filter((post) => Number.isFinite(post.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
}

function percent(part, whole) {
  if (!whole) return 0
  return Number(((part / whole) * 100).toFixed(1))
}

function countBy(items, getKey) {
  const map = new Map()
  items.forEach((item) => {
    const key = getKey(item)
    if (key === undefined || key === null) return
    map.set(key, (map.get(key) || 0) + 1)
  })
  return map
}

function sentimentSplit(posts) {
  const split = { positive: 0, neutral: 0, negative: 0 }
  posts.forEach((post) => {
    split[post.sentimentLabel] += 1
  })
  return split
}

function buildTimeline(posts) {
  if (posts.length === 0) return { buckets: [], granularity: 'day' }

  const times = posts.map((p) => p.timestamp)
  const min = Math.min(...times)
  const max = Math.max(...times)
  const spanDays = Math.max(1, Math.ceil((max - min) / DAY_MS))

  const granularity = spanDays > 45 ? 'week' : 'day'
  const bucketMs = granularity === 'week' ? DAY_MS * 7 : DAY_MS

  const start = new Date(min)
  start.setHours(0, 0, 0, 0)
  const startMs = start.getTime()
  const bucketCount = Math.floor((max - startMs) / bucketMs) + 1

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: startMs + index * bucketMs,
    total: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    scoreSum: 0,
  }))

  posts.forEach((post) => {
    const index = Math.floor((post.timestamp - startMs) / bucketMs)
    const bucket = buckets[index]
    if (!bucket) return
    bucket.total += 1
    bucket[post.sentimentLabel] += 1
    bucket.scoreSum += post.sentimentScore
  })

  return {
    granularity,
    buckets: buckets.map((bucket) => ({
      start: bucket.start,
      total: bucket.total,
      positive: bucket.positive,
      neutral: bucket.neutral,
      negative: bucket.negative,
      avgScore: bucket.total ? Number((bucket.scoreSum / bucket.total).toFixed(3)) : 0,
    })),
  }
}

function buildTopics(posts) {
  const map = new Map()

  posts.forEach((post) => {
    post.topicIds.forEach((id) => {
      if (!map.has(id)) {
        map.set(id, {
          id,
          label: topicLabel(id),
          count: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          scoreSum: 0,
        })
      }
      const topic = map.get(id)
      topic.count += 1
      topic[post.sentimentLabel] += 1
      topic.scoreSum += post.sentimentScore
    })
  })

  return [...map.values()]
    .map((topic) => ({
      ...topic,
      share: percent(topic.count, posts.length),
      avgScore: Number((topic.scoreSum / topic.count).toFixed(3)),
    }))
    .sort((a, b) => b.count - a.count)
}

function buildThemes(posts, polarity) {
  const map = new Map()

  posts.forEach((post) => {
    post.themeEvidence
      .filter((entry) => entry.polarity === polarity)
      .forEach((entry) => {
        if (!map.has(entry.themeId)) {
          map.set(entry.themeId, {
            id: entry.themeId,
            label: entry.themeLabel,
            count: 0,
            postIds: new Set(),
            examples: [],
          })
        }
        const theme = map.get(entry.themeId)
        if (theme.postIds.has(post.id)) return
        theme.postIds.add(post.id)
        theme.count += 1
        if (theme.examples.length < 3) {
          theme.examples.push({
            postId: post.id,
            subreddit: post.subreddit,
            score: entry.score,
            quote:
              entry.sentence.length > 200
                ? `${entry.sentence.slice(0, 197)}…`
                : entry.sentence,
          })
        }
      })
  })

  return [...map.values()]
    .map((theme) => ({
      id: theme.id,
      label: theme.label,
      count: theme.count,
      examples: theme.examples,
      share: percent(theme.count, posts.length),
    }))
    .sort((a, b) => b.count - a.count)
}

// A theme that shows up on both sides tells a reader nothing: "Design" as both
// a like and a dislike reads as noise. Whichever side the corpus leans is the
// side it belongs on, and the losing count rides along so the split stays
// visible. Ties go to the complaint, since that is the actionable read.
function splitByMajority(praise, complaints) {
  const negById = new Map(complaints.map((theme) => [theme.id, theme.count]))
  const posById = new Map(praise.map((theme) => [theme.id, theme.count]))

  return {
    praise: praise
      .filter((theme) => theme.count > (negById.get(theme.id) ?? 0))
      .map((theme) => ({ ...theme, opposing: negById.get(theme.id) ?? 0 })),
    complaints: complaints
      .filter((theme) => theme.count >= (posById.get(theme.id) ?? 0))
      .map((theme) => ({ ...theme, opposing: posById.get(theme.id) ?? 0 })),
  }
}

function competitorGate(roster = []) {
  if (!roster.length) return { allowed: null, canonical: new Map() }

  const canonical = new Map()
  for (const entry of roster) {
    const name = String(entry?.name || '').trim()
    if (!name) continue
    canonical.set(name.toLowerCase(), name)
    for (const alias of entry.aliases || []) {
      const key = String(alias || '').trim().toLowerCase()
      if (key) canonical.set(key, name)
    }
  }

  return { allowed: canonical.size > 0, canonical }
}

function buildCompetitors(posts, roster = []) {
  const map = new Map()
  const { allowed, canonical } = competitorGate(roster)

  posts.forEach((post) => {
    const seenInPost = new Set()

    post.competitorMentions.forEach((raw) => {
      const resolved = canonical.get(String(raw.brand || '').toLowerCase())
      if (allowed && !resolved) return

      const mention = resolved ? { ...raw, brand: resolved, known: true } : raw

      if (!map.has(mention.brand)) {
        map.set(mention.brand, {
          brand: mention.brand,
          known: mention.known,
          mentions: 0,
          scoreSum: 0,
          reasons: new Map(),
          topics: new Map(),
          examples: [],
        })
      }
      const entry = map.get(mention.brand)

      if (!seenInPost.has(mention.brand)) {
        seenInPost.add(mention.brand)
        entry.mentions += 1
        entry.scoreSum += mention.sentiment
      }

      mention.reasons.forEach((reason) => {
        entry.reasons.set(reason.label, (entry.reasons.get(reason.label) || 0) + 1)
      })
      mention.topics.forEach((topicId) => {
        entry.topics.set(topicId, (entry.topics.get(topicId) || 0) + 1)
      })

      if (entry.examples.length < 4) {
        entry.examples.push({
          postId: post.id,
          subreddit: post.subreddit,
          permalink: post.permalink,
          quote: mention.sentence,
          sentiment: mention.sentiment,
        })
      }
    })
  })

  const total = posts.length

  return [...map.values()]
    .filter((entry) => entry.mentions > 0)
    .map((entry) => ({
      brand: entry.brand,
      known: entry.known,
      mentions: entry.mentions,
      share: percent(entry.mentions, total),
      avgSentiment: Number((entry.scoreSum / entry.mentions).toFixed(3)),
      sentimentLabel: labelFor(entry.scoreSum / entry.mentions),
      reasons: [...entry.reasons.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      topics: [...entry.topics.entries()]
        .map(([id, count]) => ({ id, label: topicLabel(id), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      examples: entry.examples,
    }))
    .sort((a, b) => b.mentions - a.mentions)
}

function buildSubreddits(posts) {
  const map = new Map()

  posts.forEach((post) => {
    if (!map.has(post.subreddit)) {
      map.set(post.subreddit, {
        name: post.subreddit,
        count: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        scoreSum: 0,
        engagement: 0,
      })
    }
    const entry = map.get(post.subreddit)
    entry.count += 1
    entry[post.sentimentLabel] += 1
    entry.scoreSum += post.sentimentScore
    entry.engagement += post.engagement
  })

  return [...map.values()]
    .map((entry) => ({
      ...entry,
      share: percent(entry.count, posts.length),
      avgScore: Number((entry.scoreSum / entry.count).toFixed(3)),
    }))
    .sort((a, b) => b.count - a.count)
}

function buildTopDiscussions(posts) {
  const byEngagement = [...posts].sort((a, b) => b.engagement - a.engagement)
  const positives = posts.filter((p) => p.sentimentLabel === 'positive')
  const negatives = posts.filter((p) => p.sentimentLabel === 'negative')

  const weight = (post, direction) =>
    direction * post.sentimentScore * Math.log10(10 + post.engagement)

  return {
    mostEngaged: byEngagement.slice(0, 6),
    mostPositive: [...positives]
      .sort((a, b) => weight(b, 1) - weight(a, 1))
      .slice(0, 5),
    mostNegative: [...negatives]
      .sort((a, b) => weight(b, -1) - weight(a, -1))
      .slice(0, 5),
  }
}

function buildTakeaways({
  companyName,
  posts,
  sentiment,
  topics,
  praise,
  complaints,
  competitors,
  subreddits,
  timeline,
  market,
}) {
  const takeaways = []

  if (posts.length === 0) return takeaways

  const dominant =
    sentiment.positivePct >= sentiment.negativePct ? 'positive' : 'negative'
  const dominantPct =
    dominant === 'positive' ? sentiment.positivePct : sentiment.negativePct

  let mood = 'broadly mixed'
  if (sentiment.net > 20) mood = 'clearly favourable'
  else if (sentiment.net > 8) mood = 'mildly favourable'
  else if (sentiment.net < -20) mood = 'clearly negative'
  else if (sentiment.net < -8) mood = 'mildly negative'

  takeaways.push({
    id: 'tone',
    tone: dominant,
    title: `Overall reception is ${mood}`,
    body: `Across ${posts.length} Reddit ${
      posts.length === 1 ? 'discussion' : 'discussions'
    }, ${sentiment.positivePct}% read positive and ${sentiment.negativePct}% negative, for a net sentiment of ${
      sentiment.net > 0 ? '+' : ''
    }${sentiment.net}. The single largest group is ${dominant} at ${dominantPct}%.`,
  })

  if (topics.length > 0) {
    const lead = topics[0]
    const runnerUp = topics[1]
    takeaways.push({
      id: 'topics',
      tone: lead.avgScore >= 0 ? 'positive' : 'negative',
      title: `${lead.label} dominates the conversation`,
      body: `${lead.label} appears in ${lead.share}% of discussions and skews ${
        lead.avgScore >= 0 ? 'positive' : 'negative'
      }.${
        runnerUp
          ? ` ${runnerUp.label} is the next most discussed theme at ${runnerUp.share}%.`
          : ''
      }`,
    })
  }

  if (praise.length > 0) {
    const top = praise[0]
    takeaways.push({
      id: 'praise',
      tone: 'positive',
      title: `${top.label} is the strongest advocate for ${companyName}`,
      body: `${top.count} ${
        top.count === 1 ? 'discussion' : 'discussions'
      } praise ${top.label.toLowerCase()}${
        praise[1] ? `, followed by ${praise[1].label.toLowerCase()}` : ''
      }. This is the message that already lands without help.`,
    })
  }

  if (complaints.length > 0) {
    const top = complaints[0]
    takeaways.push({
      id: 'complaints',
      tone: 'negative',
      title: `${top.label} is the biggest source of friction`,
      body: `${top.count} ${
        top.count === 1 ? 'discussion' : 'discussions'
      } complain about ${top.label.toLowerCase()}${
        complaints[1] ? `, with ${complaints[1].label.toLowerCase()} close behind` : ''
      }. Fixing this would move sentiment more than anything else in the data.`,
    })
  }

  if (competitors.length > 0) {
    const top = competitors[0]
    const reason = top.reasons[0]
    takeaways.push({
      id: 'competitive',
      tone: 'neutral',
      title: `${top.brand} is the most common comparison`,
      body: `${top.brand} comes up in ${top.share}% of discussions${
        market ? ` within the ${market.toLowerCase()} space` : ''
      }${reason ? `, most often framed as "${reason.label.toLowerCase()}"` : ''}.${
        competitors[1]
          ? ` ${competitors[1].brand} and ${
              competitors[2] ? competitors[2].brand : 'others'
            } also feature.`
          : ''
      }`,
    })
  }

  const buckets = timeline.buckets
  if (buckets.length >= 4) {
    const half = Math.floor(buckets.length / 2)
    const older = buckets.slice(0, half)
    const recent = buckets.slice(half)
    const avg = (list, key) =>
      list.reduce((sum, b) => sum + b[key], 0) / (list.length || 1)

    const volumeChange = avg(recent, 'total') - avg(older, 'total')
    const scoreChange = avg(recent, 'avgScore') - avg(older, 'avgScore')
    const volumeDirection = volumeChange > 0.2 ? 'rising' : volumeChange < -0.2 ? 'falling' : 'flat'
    const toneDirection = scoreChange > 0.05 ? 'improving' : scoreChange < -0.05 ? 'deteriorating' : 'holding steady'

    takeaways.push({
      id: 'momentum',
      tone: scoreChange >= 0 ? 'positive' : 'negative',
      title: `Discussion volume is ${volumeDirection}, tone is ${toneDirection}`,
      body: `Comparing the most recent half of the period against the earlier half, mention volume is ${volumeDirection} and average sentiment is ${toneDirection} (${
        scoreChange > 0 ? '+' : ''
      }${scoreChange.toFixed(2)} shift in mean score).`,
    })
  }

  if (subreddits.length > 1) {
    const top = subreddits[0]
    const harshest = [...subreddits]
      .filter((s) => s.count >= 3)
      .sort((a, b) => a.avgScore - b.avgScore)[0]

    takeaways.push({
      id: 'communities',
      tone: 'neutral',
      title: `r/${top.name} hosts most of the conversation`,
      body: `r/${top.name} accounts for ${top.share}% of all mentions.${
        harshest && harshest.name !== top.name
          ? ` r/${harshest.name} is the toughest room, with the lowest average sentiment of any active community.`
          : ''
      }`,
    })
  }

  return takeaways
}

export function buildInsights(
  posts,
  companyName,
  { market: resolvedMarket = null, roster = [] } = {},
) {
  const split = sentimentSplit(posts)
  const total = posts.length
  const scoreSum = posts.reduce((sum, post) => sum + post.sentimentScore, 0)

  const positivePct = percent(split.positive, total)
  const negativePct = percent(split.negative, total)

  const sentiment = {
    ...split,
    total,
    positivePct,
    neutralPct: percent(split.neutral, total),
    negativePct,
    averageScore: total ? Number((scoreSum / total).toFixed(3)) : 0,
    net: Number((positivePct - negativePct).toFixed(1)),
    label: total ? labelFor(scoreSum / total) : 'neutral',
  }

  const timeline = buildTimeline(posts)
  const topics = buildTopics(posts)
  const { praise, complaints } = splitByMajority(
    buildThemes(posts, 'positive'),
    buildThemes(posts, 'negative'),
  )
  const competitors = buildCompetitors(posts, roster)
  const subreddits = buildSubreddits(posts)
  const trending = extractTrendingPhrases(
    posts.map((post) => post.text),
    {
      limit: 14,
      minCount: Math.max(2, Math.round(total * 0.03)),
      exclude: tokenize(companyName),
    },
  )
  const { market: lexiconMarket } = findMarket(companyName)
  const market = resolvedMarket || lexiconMarket

  const totals = {
    mentions: total,
    posts: posts.filter((p) => p.type === 'post').length,
    comments: posts.filter((p) => p.type === 'comment').length,
    authors: countBy(posts, (p) => p.author).size,
    subreddits: subreddits.length,
    upvotes: posts.reduce((sum, p) => sum + (p.score || 0), 0),
    replies: posts.reduce((sum, p) => sum + (p.numComments || 0), 0),
  }

  return {
    companyName,
    market,
    totals,
    sentiment,
    timeline,
    topics,
    praise,
    complaints,
    competitors,
    subreddits,
    trending,
    topDiscussions: buildTopDiscussions(posts),
    takeaways: buildTakeaways({
      companyName,
      posts,
      sentiment,
      topics,
      praise,
      complaints,
      competitors,
      subreddits,
      timeline,
      market,
    }),
  }
}

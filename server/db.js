import { DatabaseSync } from 'node:sqlite'
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DB_PATH = fileURLToPath(new URL('./reddit.db', import.meta.url))
const LEGACY_JSON = fileURLToPath(new URL('./scraped-data.json', import.meta.url))

export const db = new DatabaseSync(DB_PATH)

db.exec('PRAGMA journal_mode = WAL;')

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    company         TEXT NOT NULL,
    id              TEXT NOT NULL,
    type            TEXT NOT NULL,
    subreddit       TEXT,
    author          TEXT,
    score           INTEGER DEFAULT 0,
    num_comments    INTEGER DEFAULT 0,
    timestamp       INTEGER NOT NULL,
    sentiment_label TEXT,
    sentiment_score REAL,
    -- comma-delimited with leading/trailing commas, so ',pricing,' matches exactly
    topic_ids       TEXT DEFAULT '',
    data            TEXT NOT NULL,
    collected_at    INTEGER NOT NULL,
    PRIMARY KEY (company, id)
  );

  CREATE INDEX IF NOT EXISTS idx_posts_company    ON posts(company);
  CREATE INDEX IF NOT EXISTS idx_posts_subreddit  ON posts(company, subreddit);
  CREATE INDEX IF NOT EXISTS idx_posts_sentiment  ON posts(company, sentiment_label);
  CREATE INDEX IF NOT EXISTS idx_posts_timestamp  ON posts(company, timestamp);

  CREATE TABLE IF NOT EXISTS subreddits (
    company      TEXT NOT NULL,
    name         TEXT NOT NULL,
    subscribers  INTEGER,
    active_users INTEGER,
    title        TEXT,
    updated_at   INTEGER NOT NULL,
    PRIMARY KEY (company, name)
  );

  CREATE TABLE IF NOT EXISTS runs (
    company     TEXT PRIMARY KEY,
    last_run_at INTEGER NOT NULL,
    last_count  INTEGER DEFAULT 0
  );

  -- What the collector worked out about a brand while searching: the contexts
  -- people discuss it in and the abbreviations they use. Stored so the ranker
  -- judges relevance with the same vocabulary the search expanded on.
  CREATE TABLE IF NOT EXISTS brand_context (
    company    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Stage 0. Who the brand actually is: canonical name, abbreviations, the
  -- markers that separate it from words spelled the same, and its competitors.
  -- Written by the LLM where one is configured, by heuristics otherwise, and
  -- cached because none of it changes week to week.
  CREATE TABLE IF NOT EXISTS brand_identity (
    company    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    source     TEXT NOT NULL,          -- 'llm' | 'heuristic'
    model      TEXT,
    updated_at INTEGER NOT NULL
  );

  -- Stage 4. What the corpus says when this brand is weighed against a rival:
  -- who commenters lean toward and on which dimensions. Cached against the
  -- corpus size it was drawn from, so it is only re-read once new posts land.
  CREATE TABLE IF NOT EXISTS comparisons (
    company    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    source     TEXT NOT NULL,          -- 'llm' | 'none' | 'unavailable' | 'failed'
    model      TEXT,
    corpus     INTEGER NOT NULL,       -- post count the verdicts were drawn from
    updated_at INTEGER NOT NULL
  );

  -- Stage 4b. A head-to-head the user asked for by name, rather than one the
  -- model picked. Keyed by the rival so several named comparisons can live
  -- side by side, and cached against corpus size like the automatic read.
  CREATE TABLE IF NOT EXISTS named_comparisons (
    company    TEXT NOT NULL,
    target     TEXT NOT NULL,          -- the rival the user typed, lowercased
    data       TEXT NOT NULL,
    source     TEXT NOT NULL,          -- 'llm' | 'none' | 'unavailable' | 'failed'
    model      TEXT,
    corpus     INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (company, target)
  );

  -- What Reddit says about one product, service or question the user asked
  -- about, read out of the same corpus and grounded in numbered excerpts.
  CREATE TABLE IF NOT EXISTS voice_reads (
    company    TEXT NOT NULL,
    subject    TEXT NOT NULL,          -- the question the user typed, lowercased
    data       TEXT NOT NULL,
    source     TEXT NOT NULL,
    model      TEXT,
    corpus     INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (company, subject)
  );

  -- The trending phrase list after a model has thrown out the debris that
  -- frequency counting cannot tell from a subject.
  CREATE TABLE IF NOT EXISTS trending_reads (
    company    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    source     TEXT NOT NULL,          -- 'llm' | 'heuristic' | 'failed' | 'none'
    model      TEXT,
    corpus     INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Stage 4c. One product weighed against another, rather than one company
  -- against another. Keyed by the pair so several can coexist.
  CREATE TABLE IF NOT EXISTS product_comparisons (
    company    TEXT NOT NULL,
    mine       TEXT NOT NULL,          -- the user's product, lowercased
    theirs     TEXT NOT NULL,          -- the rival product, lowercased
    data       TEXT NOT NULL,
    source     TEXT NOT NULL,
    model      TEXT,
    corpus     INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (company, mine, theirs)
  );

  -- One row per (run, thing) so trend velocity can be a real derivative
  -- between runs instead of an inference from post dates inside one sample.
  CREATE TABLE IF NOT EXISTS snapshots (
    company   TEXT NOT NULL,
    scope     TEXT NOT NULL,           -- 'community' | 'brand'
    key       TEXT NOT NULL,           -- subreddit name, or '*' for the brand
    run_at    INTEGER NOT NULL,
    threads   INTEGER DEFAULT 0,
    comments  INTEGER DEFAULT 0,
    score_sum INTEGER DEFAULT 0,
    members   INTEGER,
    PRIMARY KEY (company, scope, key, run_at)
  );

  -- LLM analysis, keyed by a content hash so an unchanged thread is never
  -- paid for twice.
  CREATE TABLE IF NOT EXISTS analyses (
    company       TEXT NOT NULL,
    thread_id     TEXT NOT NULL,
    cache_key     TEXT NOT NULL,
    data          TEXT NOT NULL,
    model         TEXT,
    input_tokens  INTEGER,
    output_tokens INTEGER,
    analysed_at   INTEGER NOT NULL,
    PRIMARY KEY (company, thread_id)
  );

  -- The brand-specific category list. Induced once from a sample, then applied
  -- to every thread by code.
  CREATE TABLE IF NOT EXISTS taxonomies (
    company    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    source     TEXT NOT NULL,          -- 'llm' | 'base'
    updated_at INTEGER NOT NULL
  );

  -- A community's own rules, as published by its moderators. Collected by the
  -- extension (the server cannot reach Reddit) and attached to any
  -- recommendation that would post there.
  CREATE TABLE IF NOT EXISTS subreddit_rules (
    name       TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    promo_risk TEXT,                   -- 'prohibited' | 'restricted' | 'unclear'
    fetched_at INTEGER NOT NULL
  );

  -- The review gate. Nothing here is an action until a human approves it.
  CREATE TABLE IF NOT EXISTS recommendations (
    id             TEXT PRIMARY KEY,   -- company:thread_id
    company        TEXT NOT NULL,
    thread_id      TEXT NOT NULL,
    subreddit      TEXT,
    data           TEXT NOT NULL,
    rules_snapshot TEXT,
    status         TEXT NOT NULL,      -- 'pending' | 'approved' | 'rejected' | 'blocked'
    blocked_reason TEXT,
    review_note    TEXT,
    reviewed_at    INTEGER,
    created_at     INTEGER NOT NULL
  );

  -- Hand-labelled ground truth. Small on purpose; it exists so a weight change
  -- produces a number rather than an opinion.
  CREATE TABLE IF NOT EXISTS eval_labels (
    kind        TEXT NOT NULL,         -- 'community' | 'thread_category' | 'thread_important'
    company     TEXT NOT NULL,
    key         TEXT NOT NULL,
    label       TEXT NOT NULL,
    note        TEXT,
    labelled_at INTEGER NOT NULL,
    PRIMARY KEY (kind, company, key)
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_lookup ON snapshots(company, scope, key, run_at DESC);
  CREATE INDEX IF NOT EXISTS idx_recs_company     ON recommendations(company, status);
`)

function addColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  if (existing.includes(column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

const discoveryColumns = [
  ['discovered_via', "TEXT DEFAULT ''"],
  ['brand_hits', 'INTEGER'],
  ['sub_post_rate', 'REAL'],
  ['coverage_start', 'INTEGER'],
  ['sample_capped', 'INTEGER DEFAULT 0'],
]
for (const [column, definition] of discoveryColumns) {
  addColumn('subreddits', column, definition)
}

const columns = db.prepare('PRAGMA table_info(posts)').all().map((c) => c.name)
if (!columns.includes('search_text')) {
  db.exec("ALTER TABLE posts ADD COLUMN search_text TEXT DEFAULT ''")
  const rows = db.prepare('SELECT company, id, data FROM posts').all()
  const backfill = db.prepare('UPDATE posts SET search_text = ? WHERE company = ? AND id = ?')
  db.prepare('BEGIN').run()
  for (const row of rows) {
    const post = JSON.parse(row.data)
    backfill.run(`${post.title || ''} ${post.body || ''}`.toLowerCase(), row.company, row.id)
  }
  db.prepare('COMMIT').run()
  console.log(`Backfilled search text for ${rows.length} rows`)
}

addColumn('posts', 'about_checked', 'INTEGER DEFAULT 0')

const key = (company) => String(company).trim().toLowerCase()

const insertPost = db.prepare(`
  INSERT INTO posts
    (company, id, type, subreddit, author, score, num_comments, timestamp,
     sentiment_label, sentiment_score, topic_ids, data, collected_at, search_text)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(company, id) DO UPDATE SET
    score           = excluded.score,
    num_comments    = excluded.num_comments,
    sentiment_label = excluded.sentiment_label,
    sentiment_score = excluded.sentiment_score,
    topic_ids       = excluded.topic_ids,
    data            = excluded.data,
    search_text     = excluded.search_text
`)

export function savePosts(company, enrichedPosts) {
  const now = Date.now()
  const key = company.trim().toLowerCase()

  const run = db.prepare('BEGIN')
  run.run()
  try {
    for (const post of enrichedPosts) {
      insertPost.run(
        key,
        post.id,
        post.type,
        post.subreddit ?? null,
        post.author ?? null,
        post.score ?? 0,
        post.numComments ?? 0,
        post.timestamp,
        post.sentimentLabel,
        post.sentimentScore,
        `,${(post.topicIds ?? []).join(',')},`,
        JSON.stringify(post),
        now,
        `${post.title || ''} ${post.body || ''}`.toLowerCase(),
      )
    }
    db.prepare('COMMIT').run()
  } catch (error) {
    db.prepare('ROLLBACK').run()
    throw error
  }

  db.prepare(`
    INSERT INTO runs (company, last_run_at, last_count) VALUES (?,?,?)
    ON CONFLICT(company) DO UPDATE SET last_run_at = excluded.last_run_at,
                                       last_count  = excluded.last_count
  `).run(key, now, enrichedPosts.length)

  return countPosts(key)
}

export function deletePosts(company, ids) {
  if (!ids.length) return 0
  const key = company.trim().toLowerCase()
  const placeholders = ids.map(() => '?').join(',')
  const result = db
    .prepare(`DELETE FROM posts WHERE company = ? AND id IN (${placeholders})`)
    .run(key, ...ids)
  return result.changes
}

const upsertSubreddit = db.prepare(`
  INSERT INTO subreddits
    (company, name, subscribers, active_users, title, updated_at,
     discovered_via, brand_hits, sub_post_rate, coverage_start, sample_capped)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(company, name) DO UPDATE SET
    subscribers    = excluded.subscribers,
    active_users   = excluded.active_users,
    title          = excluded.title,
    updated_at     = excluded.updated_at,
    -- Channels accumulate across runs: a community found by topic expansion
    -- once should still read that way after a later run finds it by name.
    discovered_via = CASE
      WHEN subreddits.discovered_via IS NULL OR subreddits.discovered_via = ''
        THEN excluded.discovered_via
      WHEN excluded.discovered_via = '' THEN subreddits.discovered_via
      ELSE subreddits.discovered_via || ',' || excluded.discovered_via
    END,
    brand_hits     = excluded.brand_hits,
    sub_post_rate  = COALESCE(excluded.sub_post_rate, subreddits.sub_post_rate),
    coverage_start = MIN(
      COALESCE(excluded.coverage_start, subreddits.coverage_start),
      COALESCE(subreddits.coverage_start, excluded.coverage_start)
    ),
    sample_capped  = excluded.sample_capped
`)

export function saveSubreddits(company, communities = []) {
  const key = company.trim().toLowerCase()
  const now = Date.now()
  for (const c of communities) {
    if (!c?.name) continue
    upsertSubreddit.run(
      key,
      c.name,
      c.subscribers ?? null,
      c.activeUsers ?? null,
      c.title ?? null,
      now,
      c.discoveredVia ?? '',
      c.brandHits ?? null,
      c.subPostRate ?? null,
      c.coverageStart ?? null,
      c.sampleCapped ? 1 : 0,
    )
  }
}

export function saveBrandContext(company, context) {
  if (!context) return
  db.prepare(`
    INSERT INTO brand_context (company, data, updated_at) VALUES (?,?,?)
    ON CONFLICT(company) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(company.trim().toLowerCase(), JSON.stringify(context), Date.now())
}

export function brandContext(company) {
  const row = db
    .prepare('SELECT data, updated_at AS updatedAt FROM brand_context WHERE company = ?')
    .get(company.trim().toLowerCase())
  if (!row) return null
  try {
    return { ...JSON.parse(row.data), updatedAt: row.updatedAt }
  } catch {
    return null
  }
}

export function saveBrandIdentity(company, identity, { source = 'heuristic', model = null } = {}) {
  db.prepare(`
    INSERT INTO brand_identity (company, data, source, model, updated_at) VALUES (?,?,?,?,?)
    ON CONFLICT(company) DO UPDATE SET
      data = excluded.data, source = excluded.source,
      model = excluded.model, updated_at = excluded.updated_at
  `).run(key(company), JSON.stringify(identity), source, model, Date.now())
}

export function brandIdentity(company) {
  const row = db
    .prepare('SELECT data, source, model, updated_at AS updatedAt FROM brand_identity WHERE company = ?')
    .get(key(company))
  if (!row) return null
  try {
    return { ...JSON.parse(row.data), source: row.source, model: row.model, updatedAt: row.updatedAt }
  } catch {
    return null
  }
}

export function saveSnapshot(company, rows = [], runAt = Date.now()) {
  const insert = db.prepare(`
    INSERT INTO snapshots (company, scope, key, run_at, threads, comments, score_sum, members)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(company, scope, key, run_at) DO UPDATE SET
      threads = excluded.threads, comments = excluded.comments,
      score_sum = excluded.score_sum, members = excluded.members
  `)
  db.prepare('BEGIN').run()
  try {
    for (const row of rows) {
      insert.run(
        key(company),
        row.scope || 'community',
        row.key,
        runAt,
        row.threads ?? 0,
        row.comments ?? 0,
        row.scoreSum ?? 0,
        row.members ?? null,
      )
    }
    db.prepare('COMMIT').run()
  } catch (error) {
    db.prepare('ROLLBACK').run()
    throw error
  }
  return rows.length
}

export function snapshots(company, { scope = 'community', since } = {}) {
  const params = [key(company), scope]
  let clause = 'company = ? AND scope = ?'
  if (Number.isFinite(since)) {
    clause += ' AND run_at >= ?'
    params.push(since)
  }
  return db
    .prepare(`
      SELECT key, run_at AS runAt, threads, comments, score_sum AS scoreSum, members
      FROM snapshots WHERE ${clause} ORDER BY run_at ASC
    `)
    .all(...params)
}

export function snapshotRuns(company) {
  return db
    .prepare('SELECT DISTINCT run_at AS runAt FROM snapshots WHERE company = ? ORDER BY run_at DESC')
    .all(key(company))
    .map((row) => row.runAt)
}

export function saveComparisons(company, result, corpus) {
  db.prepare(`
    INSERT INTO comparisons (company, data, source, model, corpus, updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(company) DO UPDATE SET
      data = excluded.data, source = excluded.source, model = excluded.model,
      corpus = excluded.corpus, updated_at = excluded.updated_at
  `).run(
    key(company),
    JSON.stringify(result),
    result.source || 'none',
    result.model ?? null,
    corpus,
    Date.now(),
  )
}

export function cachedComparisons(company) {
  const row = db
    .prepare(
      'SELECT data, source, model, corpus, updated_at AS updatedAt FROM comparisons WHERE company = ?',
    )
    .get(key(company))
  if (!row) return null
  try {
    return { ...JSON.parse(row.data), corpus: row.corpus, updatedAt: row.updatedAt }
  } catch {
    return null
  }
}

export function saveNamedComparison(company, target, result, corpus) {
  db.prepare(`
    INSERT INTO named_comparisons (company, target, data, source, model, corpus, updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(company, target) DO UPDATE SET
      data = excluded.data, source = excluded.source, model = excluded.model,
      corpus = excluded.corpus, updated_at = excluded.updated_at
  `).run(
    key(company),
    key(target),
    JSON.stringify(result),
    result.source || 'none',
    result.model ?? null,
    corpus,
    Date.now(),
  )
}

export function cachedNamedComparison(company, target) {
  const row = db
    .prepare(
      `SELECT data, source, model, corpus, updated_at AS updatedAt
       FROM named_comparisons WHERE company = ? AND target = ?`,
    )
    .get(key(company), key(target))
  if (!row) return null
  try {
    return { ...JSON.parse(row.data), corpus: row.corpus, updatedAt: row.updatedAt }
  } catch {
    return null
  }
}

export function saveVoiceRead(company, subject, result, corpus) {
  db.prepare(`
    INSERT INTO voice_reads (company, subject, data, source, model, corpus, updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(company, subject) DO UPDATE SET
      data = excluded.data, source = excluded.source, model = excluded.model,
      corpus = excluded.corpus, updated_at = excluded.updated_at
  `).run(
    key(company),
    key(subject),
    JSON.stringify(result),
    result.source || 'none',
    result.model ?? null,
    corpus,
    Date.now(),
  )
}

export function cachedVoiceRead(company, subject) {
  const row = db
    .prepare(
      `SELECT data, source, model, corpus, updated_at AS updatedAt
       FROM voice_reads WHERE company = ? AND subject = ?`,
    )
    .get(key(company), key(subject))
  if (!row) return null
  try {
    return { ...JSON.parse(row.data), corpus: row.corpus, updatedAt: row.updatedAt }
  } catch {
    return null
  }
}

export function saveTrending(company, result, corpus) {
  db.prepare(`
    INSERT INTO trending_reads (company, data, source, model, corpus, updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(company) DO UPDATE SET
      data = excluded.data, source = excluded.source, model = excluded.model,
      corpus = excluded.corpus, updated_at = excluded.updated_at
  `).run(
    key(company),
    JSON.stringify(result),
    result.source || 'none',
    result.model ?? null,
    corpus,
    Date.now(),
  )
}

export function cachedTrending(company) {
  const row = db
    .prepare(
      'SELECT data, source, model, corpus, updated_at AS updatedAt FROM trending_reads WHERE company = ?',
    )
    .get(key(company))
  if (!row) return null
  try {
    return { ...JSON.parse(row.data), corpus: row.corpus, updatedAt: row.updatedAt }
  } catch {
    return null
  }
}

export function saveProductComparison(company, mine, theirs, result, corpus) {
  db.prepare(`
    INSERT INTO product_comparisons (company, mine, theirs, data, source, model, corpus, updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(company, mine, theirs) DO UPDATE SET
      data = excluded.data, source = excluded.source, model = excluded.model,
      corpus = excluded.corpus, updated_at = excluded.updated_at
  `).run(
    key(company),
    key(mine),
    key(theirs),
    JSON.stringify(result),
    result.source || 'none',
    result.model ?? null,
    corpus,
    Date.now(),
  )
}

export function cachedProductComparison(company, mine, theirs) {
  const row = db
    .prepare(
      `SELECT data, source, model, corpus, updated_at AS updatedAt
       FROM product_comparisons WHERE company = ? AND mine = ? AND theirs = ?`,
    )
    .get(key(company), key(mine), key(theirs))
  if (!row) return null
  try {
    return { ...JSON.parse(row.data), corpus: row.corpus, updatedAt: row.updatedAt }
  } catch {
    return null
  }
}

export function cachedAnalyses(company, threadIds = []) {
  if (!threadIds.length) return new Map()
  const placeholders = threadIds.map(() => '?').join(',')
  const rows = db
    .prepare(`
      SELECT thread_id AS threadId, cache_key AS cacheKey, data, analysed_at AS analysedAt
      FROM analyses WHERE company = ? AND thread_id IN (${placeholders})
    `)
    .all(key(company), ...threadIds)

  const map = new Map()
  for (const row of rows) {
    try {
      map.set(row.threadId, { ...JSON.parse(row.data), cacheKey: row.cacheKey, analysedAt: row.analysedAt })
    } catch {
    }
  }
  return map
}

export function saveAnalyses(company, entries = []) {
  const insert = db.prepare(`
    INSERT INTO analyses
      (company, thread_id, cache_key, data, model, input_tokens, output_tokens, analysed_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(company, thread_id) DO UPDATE SET
      cache_key = excluded.cache_key, data = excluded.data, model = excluded.model,
      input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
      analysed_at = excluded.analysed_at
  `)
  const now = Date.now()
  db.prepare('BEGIN').run()
  try {
    for (const entry of entries) {
      insert.run(
        key(company),
        entry.id,
        entry.cacheKey,
        JSON.stringify(entry.analysis),
        entry.model ?? null,
        entry.inputTokens ?? null,
        entry.outputTokens ?? null,
        now,
      )
    }
    db.prepare('COMMIT').run()
  } catch (error) {
    db.prepare('ROLLBACK').run()
    throw error
  }
  return entries.length
}

export function saveTaxonomy(company, taxonomy, source = 'base') {
  db.prepare(`
    INSERT INTO taxonomies (company, data, source, updated_at) VALUES (?,?,?,?)
    ON CONFLICT(company) DO UPDATE SET
      data = excluded.data, source = excluded.source, updated_at = excluded.updated_at
  `).run(key(company), JSON.stringify(taxonomy), source, Date.now())
}

export function taxonomy(company) {
  const row = db
    .prepare('SELECT data, source, updated_at AS updatedAt FROM taxonomies WHERE company = ?')
    .get(key(company))
  if (!row) return null
  try {
    return { categories: JSON.parse(row.data), source: row.source, updatedAt: row.updatedAt }
  } catch {
    return null
  }
}

export function saveSubredditRules(entries = []) {
  const insert = db.prepare(`
    INSERT INTO subreddit_rules (name, data, promo_risk, fetched_at) VALUES (?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET
      data = excluded.data, promo_risk = excluded.promo_risk, fetched_at = excluded.fetched_at
  `)
  const now = Date.now()
  for (const entry of entries) {
    if (!entry?.name) continue
    insert.run(entry.name, JSON.stringify(entry.rules ?? []), entry.promoRisk ?? 'unclear', now)
  }
  return entries.length
}

export function subredditRules(names = []) {
  if (!names.length) return new Map()
  const placeholders = names.map(() => '?').join(',')
  const rows = db
    .prepare(`
      SELECT name, data, promo_risk AS promoRisk, fetched_at AS fetchedAt
      FROM subreddit_rules WHERE name IN (${placeholders})
    `)
    .all(...names)

  const map = new Map()
  for (const row of rows) {
    let rules
    try {
      rules = JSON.parse(row.data)
    } catch {
      rules = []
    }
    map.set(row.name, { name: row.name, rules, promoRisk: row.promoRisk, fetchedAt: row.fetchedAt })
  }
  return map
}

export function staleRuleTargets(names = [], maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  const known = subredditRules(names)
  const cutoff = Date.now() - maxAgeMs
  return names.filter((name) => {
    const entry = known.get(name)
    return !entry || entry.fetchedAt < cutoff
  })
}

export function saveRecommendations(company, entries = []) {
  const insert = db.prepare(`
    INSERT INTO recommendations
      (id, company, thread_id, subreddit, data, rules_snapshot, status, blocked_reason, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data, rules_snapshot = excluded.rules_snapshot,
      -- A human decision is never overwritten by a later run.
      status = CASE WHEN recommendations.status = 'pending'
                    THEN excluded.status ELSE recommendations.status END,
      blocked_reason = excluded.blocked_reason
  `)
  const now = Date.now()
  for (const entry of entries) {
    insert.run(
      `${key(company)}:${entry.threadId}`,
      key(company),
      entry.threadId,
      entry.subreddit ?? null,
      JSON.stringify(entry.recommendation),
      entry.rulesSnapshot ? JSON.stringify(entry.rulesSnapshot) : null,
      entry.status || 'pending',
      entry.blockedReason ?? null,
      now,
    )
  }
  return entries.length
}

export function listRecommendations(company, { status } = {}) {
  const params = [key(company)]
  let clause = 'company = ?'
  if (status && status !== 'all') {
    clause += ' AND status = ?'
    params.push(status)
  }
  return db
    .prepare(`
      SELECT id, thread_id AS threadId, subreddit, data, rules_snapshot AS rulesSnapshot,
             status, blocked_reason AS blockedReason, review_note AS reviewNote,
             reviewed_at AS reviewedAt, created_at AS createdAt
      FROM recommendations WHERE ${clause} ORDER BY created_at DESC
    `)
    .all(...params)
    .map((row) => ({
      ...row,
      data: JSON.parse(row.data),
      rulesSnapshot: row.rulesSnapshot ? JSON.parse(row.rulesSnapshot) : null,
    }))
}

export function reviewRecommendation(id, { status, note = null }) {
  const allowed = ['approved', 'rejected', 'pending']
  if (!allowed.includes(status)) throw new Error(`Unknown review status "${status}"`)

  const existing = db.prepare('SELECT status FROM recommendations WHERE id = ?').get(id)
  if (!existing) return null
  if (existing.status === 'blocked') return { id, status: 'blocked', unchanged: true }

  db.prepare('UPDATE recommendations SET status = ?, review_note = ?, reviewed_at = ? WHERE id = ?')
    .run(status, note, Date.now(), id)
  return { id, status }
}

export function saveEvalLabels(rows = []) {
  const insert = db.prepare(`
    INSERT INTO eval_labels (kind, company, key, label, note, labelled_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(kind, company, key) DO UPDATE SET
      label = excluded.label, note = excluded.note, labelled_at = excluded.labelled_at
  `)
  const now = Date.now()
  for (const row of rows) insert.run(row.kind, key(row.company), row.key, row.label, row.note ?? null, now)
  return rows.length
}

export function evalLabels(kind, company) {
  const params = [kind]
  let clause = 'kind = ?'
  if (company) {
    clause += ' AND company = ?'
    params.push(key(company))
  }
  return db
    .prepare(`SELECT kind, company, key, label, note FROM eval_labels WHERE ${clause}`)
    .all(...params)
}

export function lastRun(company) {
  return (
    db
      .prepare('SELECT last_run_at AS lastRunAt, last_count AS lastCount FROM runs WHERE company = ?')
      .get(company.trim().toLowerCase()) ?? null
  )
}

export function countPosts(company) {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM posts WHERE company = ?')
    .get(company.trim().toLowerCase())
  return row?.n ?? 0
}

export function aboutnessProgress(company) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN about_checked = 1 THEN 1 ELSE 0 END) AS checked,
         SUM(CASE WHEN about_checked = 0 THEN 1 ELSE 0 END) AS pending
       FROM posts WHERE company = ?`,
    )
    .get(key(company))
  return { checked: row?.checked ?? 0, pending: row?.pending ?? 0 }
}

export function collectedCommentPermalinks(company) {
  return db
    .prepare(
      `SELECT DISTINCT json_extract(data, '$.permalink') AS permalink
       FROM posts WHERE company = ? AND type != 'post'`,
    )
    .all(company.trim().toLowerCase())
    .map((row) => row.permalink)
    .filter(Boolean)
}

export function knownIds(company) {
  return db
    .prepare('SELECT id FROM posts WHERE company = ?')
    .all(company.trim().toLowerCase())
    .map((row) => row.id)
}

export function listCompanies() {
  return db
    .prepare(`
      SELECT p.company                AS company,
             COUNT(*)                 AS count,
             COUNT(DISTINCT p.subreddit) AS subreddits,
             MAX(r.last_run_at)       AS scrapedAt
      FROM posts p
      LEFT JOIN runs r ON r.company = p.company
      GROUP BY p.company
      ORDER BY count DESC
    `)
    .all()
}

export function subredditMeta(company) {
  return db
    .prepare(`
      SELECT name,
             subscribers,
             active_users   AS activeUsers,
             title,
             discovered_via AS discoveredVia,
             brand_hits     AS brandHits,
             sub_post_rate  AS subPostRate,
             coverage_start AS coverageStart,
             sample_capped  AS sampleCapped
      FROM subreddits WHERE company = ?
    `)
    .all(company.trim().toLowerCase())
}

export function selectPosts(company, filters = {}) {
  const key = company.trim().toLowerCase()
  const where = ['company = ?']
  const params = [key]

  if (filters.subreddit && filters.subreddit !== 'all') {
    where.push('subreddit = ?')
    params.push(filters.subreddit)
  }
  if (filters.sentiment && filters.sentiment !== 'all') {
    where.push('sentiment_label = ?')
    params.push(filters.sentiment)
  }
  if (filters.topic && filters.topic !== 'all') {
    where.push('topic_ids LIKE ?')
    params.push(`%,${filters.topic},%`)
  }
  if (filters.type && filters.type !== 'all') {
    where.push('type = ?')
    params.push(filters.type)
  }
  if (Number.isFinite(filters.since)) {
    where.push('timestamp >= ?')
    params.push(filters.since)
  }
  if (filters.aboutChecked !== undefined) {
    where.push('about_checked = ?')
    params.push(filters.aboutChecked ? 1 : 0)
  } else if (!filters.includeUnchecked) {
    where.push('about_checked = 1')
  }

  const rows = db
    .prepare(`SELECT data FROM posts WHERE ${where.join(' AND ')} ORDER BY timestamp DESC`)
    .all(...params)

  return rows.map((row) => JSON.parse(row.data))
}

export function companiesWithPendingAboutness() {
  return db
    .prepare("SELECT DISTINCT company FROM posts WHERE type = 'post' AND about_checked = 0")
    .all()
    .map((row) => row.company)
}

export function markCommentsChecked(company) {
  return db
    .prepare("UPDATE posts SET about_checked = 1 WHERE company = ? AND type != 'post' AND about_checked = 0")
    .run(company.trim().toLowerCase()).changes
}

export function markAboutChecked(company, ids) {
  if (!ids.length) return 0
  const key = company.trim().toLowerCase()
  const placeholders = ids.map(() => '?').join(',')
  const result = db
    .prepare(`UPDATE posts SET about_checked = 1 WHERE company = ? AND id IN (${placeholders})`)
    .run(key, ...ids)
  return result.changes
}

const SORTABLE = {
  timestamp: 'timestamp',
  score: 'score',
  comments: 'num_comments',
  author: 'author',
  subreddit: 'subreddit',
  sentiment: 'sentiment_score',
}

export function selectPostsPage(company, filters = {}, options = {}) {
  const key = company.trim().toLowerCase()
  const where = ['company = ?']
  const params = [key]

  if (filters.subreddit && filters.subreddit !== 'all') {
    where.push('subreddit = ?')
    params.push(filters.subreddit)
  }
  if (filters.sentiment && filters.sentiment !== 'all') {
    where.push('sentiment_label = ?')
    params.push(filters.sentiment)
  }
  if (filters.type && filters.type !== 'all') {
    where.push('type = ?')
    params.push(filters.type)
  }
  if (filters.q) {
    where.push('search_text LIKE ?')
    params.push(`%${String(filters.q).toLowerCase()}%`)
  }

  const clause = where.join(' AND ')
  const column = SORTABLE[options.sort] || 'timestamp'
  const direction = options.order === 'asc' ? 'ASC' : 'DESC'
  const limit = Math.min(Number(options.limit) || 100, 500)
  const offset = Number(options.offset) || 0

  const total = db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE ${clause}`).get(...params).n

  const rows = db
    .prepare(
      `SELECT data FROM posts WHERE ${clause}
       ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset)

  return { posts: rows.map((row) => JSON.parse(row.data)), total, limit, offset }
}

export function collectionStats(company) {
  const key = company.trim().toLowerCase()
  return db
    .prepare(`
      SELECT COUNT(*)                                            AS items,
             SUM(CASE WHEN type = 'post' THEN 1 ELSE 0 END)      AS posts,
             SUM(CASE WHEN type = 'comment' THEN 1 ELSE 0 END)   AS comments,
             COUNT(DISTINCT subreddit)                           AS subreddits,
             COUNT(DISTINCT author)                              AS authors,
             SUM(score)                                          AS upvotes,
             MIN(timestamp)                                      AS oldest,
             MAX(timestamp)                                      AS newest,
             MAX(collected_at)                                   AS collectedAt
      FROM posts WHERE company = ?
    `)
    .get(key)
}

export function subredditBreakdown(company) {
  const key = company.trim().toLowerCase()
  return db
    .prepare(`
      SELECT p.subreddit                                            AS name,
             COUNT(*)                                               AS items,
             SUM(CASE WHEN p.type = 'post' THEN 1 ELSE 0 END)       AS posts,
             SUM(CASE WHEN p.type = 'comment' THEN 1 ELSE 0 END)    AS comments,
             SUM(p.score)                                           AS upvotes,
             ROUND(AVG(p.sentiment_score), 3)                       AS avgSentiment,
             s.subscribers                                          AS subscribers,
             s.active_users                                         AS activeUsers
      FROM posts p
      LEFT JOIN subreddits s ON s.company = p.company AND s.name = p.subreddit
      WHERE p.company = ?
      GROUP BY p.subreddit
      ORDER BY items DESC
    `)
    .all(key)
}

export function migrateLegacyJson(enrich) {
  if (!existsSync(LEGACY_JSON)) return null

  let parsed
  try {
    parsed = JSON.parse(readFileSync(LEGACY_JSON, 'utf8'))
  } catch {
    return null
  }

  const imported = []
  for (const [company, entry] of Object.entries(parsed)) {
    if (countPosts(company) > 0) continue
    const posts = entry?.posts ?? []
    if (posts.length === 0) continue
    savePosts(company, enrich(posts, company))
    imported.push(`${company} (${posts.length})`)
  }

  renameSync(LEGACY_JSON, `${LEGACY_JSON}.migrated`)
  return imported
}

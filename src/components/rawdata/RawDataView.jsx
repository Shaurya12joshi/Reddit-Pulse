import { useEffect, useState } from 'react'

const API = 'http://localhost:3001'
const PAGE_SIZE = 100

const COLUMNS = [
  { key: 'type', label: 'type', sortable: false, width: 'w-16' },
  { key: 'subreddit', label: 'subreddit', sortable: true, width: 'w-40' },
  { key: 'author', label: 'author', sortable: true, width: 'w-36' },
  { key: 'score', label: 'score', sortable: true, width: 'w-20', numeric: true },
  { key: 'comments', label: 'cmts', sortable: true, width: 'w-16', numeric: true },
  { key: 'timestamp', label: 'posted', sortable: true, width: 'w-28' },
  { key: 'sentiment', label: 'sentiment', sortable: true, width: 'w-28' },
  { key: 'topics', label: 'topics', sortable: false, width: 'w-44' },
  { key: 'text', label: 'title / body', sortable: false },
]

const nf = new Intl.NumberFormat('en-US')

function fmtDate(ts) {
  if (!Number.isFinite(ts)) return 'N/A'
  return new Date(ts).toISOString().slice(0, 10)
}

function sentimentColor(label) {
  if (label === 'positive') return 'text-emerald-700 bg-emerald-50'
  if (label === 'negative') return 'text-red-700 bg-red-50'
  return 'text-slate-500 bg-slate-100'
}

export default function RawDataView({ company }) {
  const [sort, setSort] = useState('timestamp')
  const [order, setOrder] = useState('desc')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query)
      setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    const params = new URLSearchParams({
      company,
      sort,
      order,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    if (debounced) params.set('q', debounced)
    if (typeFilter !== 'all') params.set('type', typeFilter)

    fetch(`${API}/api/raw?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Request failed'))))
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoading(false)
      })

    return () => controller.abort()
  }, [company, sort, order, debounced, typeFilter, offset])

  function toggleSort(key) {
    if (sort === key) {
      setOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(key)
      setOrder('desc')
    }
    setOffset(0)
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-xs text-slate-500">
        {loading ? 'loading collection…' : 'no data'}
      </div>
    )
  }

  const { stats, subreddits, posts, total } = data
  const spanDays =
    stats.oldest && stats.newest
      ? Math.round((stats.newest - stats.oldest) / (24 * 60 * 60 * 1000))
      : 0

  const summary = [
    ['items', nf.format(stats.items ?? 0)],
    ['posts', nf.format(stats.posts ?? 0)],
    ['comments', nf.format(stats.comments ?? 0)],
    ['subreddits', nf.format(stats.subreddits ?? 0)],
    ['authors', nf.format(stats.authors ?? 0)],
    ['upvotes', nf.format(stats.upvotes ?? 0)],
    ['span', `${nf.format(spanDays)}d`],
  ]

  return (
    <main className="min-h-screen bg-white px-4 py-6 font-mono text-slate-800 sm:px-8">
      {}
      <header className="border-b-2 border-slate-900 pb-3">
        <h1 className="text-sm font-bold uppercase tracking-wider">
          Raw collection: {data.company}
        </h1>
        <p className="mt-1 text-[11px] text-slate-500">
          Every row scraped from Reddit, straight from the database. Sorted and
          filtered in SQL · query took {data.computedInMs}ms
        </p>
      </header>

      {}
      <section className="mt-4 grid grid-cols-2 gap-px border border-slate-300 bg-slate-300 sm:grid-cols-4 lg:grid-cols-7">
        {summary.map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
            <div className="text-base font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </section>

      {}
      <section className="mt-6">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Communities found ({subreddits.length})
        </h2>
        <div className="mt-2 max-h-64 overflow-auto border border-slate-300">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-slate-900 text-white">
              <tr>
                {['subreddit', 'items', 'posts', 'cmts', 'upvotes', 'avg sent.', 'subscribers'].map(
                  (h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {subreddits.map((sub, index) => (
                <tr
                  key={sub.name}
                  className={index % 2 ? 'bg-slate-50' : 'bg-white'}
                >
                  <td className="px-2 py-1">
                    <a
                      href={`https://old.reddit.com/r/${sub.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-700 hover:underline"
                    >
                      r/{sub.name}
                    </a>
                  </td>
                  <td className="px-2 py-1 tabular-nums">{sub.items}</td>
                  <td className="px-2 py-1 tabular-nums text-slate-500">{sub.posts}</td>
                  <td className="px-2 py-1 tabular-nums text-slate-500">{sub.comments}</td>
                  <td className="px-2 py-1 tabular-nums">{nf.format(sub.upvotes ?? 0)}</td>
                  <td
                    className={`px-2 py-1 tabular-nums ${
                      sub.avgSentiment > 0
                        ? 'text-emerald-700'
                        : sub.avgSentiment < 0
                          ? 'text-red-700'
                          : 'text-slate-400'
                    }`}
                  >
                    {sub.avgSentiment ?? 'N/A'}
                  </td>
                  <td className="px-2 py-1 tabular-nums text-slate-500">
                    {sub.subscribers ? nf.format(sub.subscribers) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {}
      <section className="mt-6 flex flex-wrap items-center gap-3 border-y border-slate-300 py-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="search text…"
          className="w-56 border border-slate-300 px-2 py-1 text-[11px] focus:border-slate-900 focus:outline-none"
        />
        <div className="flex border border-slate-300">
          {['all', 'post', 'comment'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTypeFilter(value)
                setOffset(0)
              }}
              className={`px-2 py-1 text-[11px] ${
                typeFilter === value ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500">
          {nf.format(total)} rows
          {debounced ? ` matching “${debounced}”` : ''}
          {loading ? ' · loading…' : ''}
        </span>
      </section>

      {}
      <section className="mt-3 overflow-x-auto border border-slate-300">
        <table className="w-full min-w-[1100px] text-[11px]">
          <thead className="bg-slate-900 text-white">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-1.5 text-left font-medium ${col.width || ''} ${
                    col.sortable ? 'cursor-pointer select-none hover:bg-slate-700' : ''
                  }`}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  {col.label}
                  {sort === col.key ? (order === 'desc' ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((post, index) => (
              <tr
                key={post.id}
                className={`align-top ${index % 2 ? 'bg-slate-50' : 'bg-white'} hover:bg-amber-50`}
              >
                <td className="px-2 py-1.5">
                  <span
                    className={`rounded px-1 text-[10px] ${
                      post.isPost === false || post.type === 'comment'
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    {post.type}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-slate-600">r/{post.subreddit}</td>
                <td className="truncate px-2 py-1.5 text-slate-600">u/{post.author}</td>
                <td className="px-2 py-1.5 tabular-nums">{nf.format(post.score ?? 0)}</td>
                <td className="px-2 py-1.5 tabular-nums text-slate-500">
                  {post.numComments || ''}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-slate-500">
                  {fmtDate(post.timestamp)}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`rounded px-1 ${sentimentColor(post.sentimentLabel)}`}>
                    {post.sentimentLabel} {post.sentimentScore?.toFixed(2)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[10px] text-slate-500">
                  {(post.topicLabels ?? []).join(', ') || 'N/A'}
                </td>
                <td className="px-2 py-1.5">
                  <div className="max-w-2xl">
                    {post.title ? (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-indigo-800 hover:underline"
                      >
                        {post.title}
                      </a>
                    ) : null}
                    {post.body ? (
                      <p className="mt-0.5 line-clamp-2 text-slate-600">{post.body}</p>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {}
      <section className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">
          rows {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of{' '}
          {nf.format(total)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="border border-slate-300 px-3 py-1 disabled:opacity-30 enabled:hover:bg-slate-100"
          >
            ← prev
          </button>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="border border-slate-300 px-3 py-1 disabled:opacity-30 enabled:hover:bg-slate-100"
          >
            next →
          </button>
        </div>
      </section>
    </main>
  )
}

import { useMemo, useState } from 'react'
import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import PostCard from './PostCard.jsx'
import Select from '../ui/Select.jsx'
import { POST_TYPES } from './filterOptions.js'

const TABS = [
  { id: 'representative', label: 'Representative' },
  { id: 'engaged', label: 'Most engaged' },
  { id: 'positive', label: 'Most positive' },
  { id: 'negative', label: 'Most negative' },
  { id: 'recent', label: 'Newest' },
]

const PAGE_SIZE = 8
const MAX_FETCHES = 6

export default function DiscussionsPanel({
  posts,
  topDiscussions,
  onOpenPost,
  hasMore = false,
  onLoadMore,
}) {
  const [tab, setTab] = useState('representative')
  const [type, setType] = useState('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [fetching, setFetching] = useState(false)
  const [drained, setDrained] = useState(false)

  const pool = useMemo(
    () => (type === 'all' ? posts : posts.filter((post) => post.type === type)),
    [posts, type],
  )

  const list = useMemo(() => {
    switch (tab) {
      case 'engaged':
        return [...pool].sort((a, b) => b.engagement - a.engagement)
      case 'positive':
        return [...pool]
          .filter((p) => p.sentimentLabel === 'positive')
          .sort((a, b) => b.sentimentScore - a.sentimentScore)
      case 'negative':
        return [...pool]
          .filter((p) => p.sentimentLabel === 'negative')
          .sort((a, b) => a.sentimentScore - b.sentimentScore)
      case 'recent':
        return [...pool].sort((a, b) => b.timestamp - a.timestamp)
      default: {
        const seen = new Set()
        const merged = []
        const allowed = new Set(pool.map((post) => post.id))
        const sources = [
          topDiscussions.mostEngaged,
          topDiscussions.mostNegative,
          topDiscussions.mostPositive,
        ].map((source) => source.filter((post) => allowed.has(post.id)))
        const longest = Math.max(...sources.map((s) => s.length), 0)

        for (let i = 0; i < longest; i += 1) {
          sources.forEach((source) => {
            const post = source[i]
            if (post && !seen.has(post.id)) {
              seen.add(post.id)
              merged.push(post)
            }
          })
        }

        const rest = pool
          .filter((post) => !seen.has(post.id))
          .sort((a, b) => b.engagement - a.engagement)

        return [...merged, ...rest]
      }
    }
  }, [tab, pool, topDiscussions])

  const shown = list.slice(0, visible)

  const changeTab = (next) => {
    setTab(next)
    setVisible(PAGE_SIZE)
    setDrained(false)
  }

  const changeType = (next) => {
    setType(next)
    setVisible(PAGE_SIZE)
    setDrained(false)
  }

  const localLeft = list.length - visible
  const canReveal = localLeft > 0
  const canFetch = !canReveal && hasMore && !drained && Boolean(onLoadMore)

  const wouldShow = (post) => {
    if (type !== 'all' && post.type !== type) return false
    if (tab === 'positive') return post.sentimentLabel === 'positive'
    if (tab === 'negative') return post.sentimentLabel === 'negative'
    return true
  }

  const showMore = async () => {
    if (!canFetch) {
      setVisible((current) => current + PAGE_SIZE)
      return
    }

    setFetching(true)
    try {
      for (let page = 0; page < MAX_FETCHES; page += 1) {
        const result = await onLoadMore()
        const fetched = result?.posts ?? []

        if (fetched.some(wouldShow)) {
          setVisible((current) => current + PAGE_SIZE)
          return
        }
        if (!result || result.nextOffset === null || result.nextOffset === undefined) {
          setDrained(true)
          return
        }
      }
    } finally {
      setFetching(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Discussions"
        subtitle="Every insight above traces back to these threads"
        icon={<Icon name="quote" className="h-3.5 w-3.5" />}
        action={
          <div className="hidden items-center gap-2 md:flex">
            <Select
              ariaLabel="Show posts or comments"
              value={type}
              onChange={changeType}
              options={POST_TYPES}
              className="w-[168px]"
            />

            <div className="flex gap-1 rounded-lg border border-line bg-elevated p-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeTab(item.id)}
                  className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    tab === item.id ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="space-y-2 border-b border-line px-3 py-2 md:hidden">
        <Select
          ariaLabel="Show posts or comments"
          value={type}
          onChange={changeType}
          options={POST_TYPES}
        />

        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changeTab(item.id)}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                tab === item.id ? 'bg-elevated text-ink' : 'text-ink-3'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <CardBody className="p-2">
        {shown.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-ink-3">
            No discussions match the current filters.
          </p>
        ) : (
          <>
            <div className="divide-y divide-line">
              {shown.map((post) => (
                <PostCard key={post.id} post={post} onOpen={onOpenPost} />
              ))}
            </div>

            {canReveal || canFetch ? (
              <div className="flex justify-center pt-3 pb-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={fetching}
                  onClick={showMore}
                >
                  {fetching ? 'Loading…' : `Show ${Math.min(PAGE_SIZE, canReveal ? localLeft : PAGE_SIZE)} more`}
                  {canReveal ? (
                    <span className="tnum text-ink-3">({localLeft} left)</span>
                  ) : null}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  )
}

import { useMemo, useState } from 'react'
import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import PostCard from './PostCard.jsx'

const TABS = [
  { id: 'representative', label: 'Representative' },
  { id: 'engaged', label: 'Most engaged' },
  { id: 'positive', label: 'Most positive' },
  { id: 'negative', label: 'Most negative' },
  { id: 'recent', label: 'Newest' },
]

const PAGE_SIZE = 8

export default function DiscussionsPanel({ posts, topDiscussions, onOpenPost }) {
  const [tab, setTab] = useState('representative')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const list = useMemo(() => {
    switch (tab) {
      case 'engaged':
        return [...posts].sort((a, b) => b.engagement - a.engagement)
      case 'positive':
        return [...posts]
          .filter((p) => p.sentimentLabel === 'positive')
          .sort((a, b) => b.sentimentScore - a.sentimentScore)
      case 'negative':
        return [...posts]
          .filter((p) => p.sentimentLabel === 'negative')
          .sort((a, b) => a.sentimentScore - b.sentimentScore)
      case 'recent':
        return [...posts].sort((a, b) => b.timestamp - a.timestamp)
      default: {
        const seen = new Set()
        const merged = []
        const sources = [
          topDiscussions.mostEngaged,
          topDiscussions.mostNegative,
          topDiscussions.mostPositive,
        ]
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
        return merged
      }
    }
  }, [tab, posts, topDiscussions])

  const shown = list.slice(0, visible)

  const changeTab = (next) => {
    setTab(next)
    setVisible(PAGE_SIZE)
  }

  return (
    <Card>
      <CardHeader
        title="Discussions"
        subtitle="Every insight above traces back to these threads"
        icon={<Icon name="quote" className="h-3.5 w-3.5" />}
        action={
          <div className="hidden gap-1 rounded-lg border border-line bg-elevated p-1 md:flex">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeTab(item.id)}
                className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  tab === item.id
                    ? 'bg-raised text-ink'
                    : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      {}
      <div className="border-b border-line px-3 py-2 md:hidden">
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

            {visible < list.length ? (
              <div className="flex justify-center pt-3 pb-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setVisible((current) => current + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, list.length - visible)} more
                  <span className="tnum text-ink-3">
                    ({list.length - visible} left)
                  </span>
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  )
}

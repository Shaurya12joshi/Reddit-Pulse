import { useMemo } from 'react'
import Modal from '../ui/Modal.jsx'
import Icon from '../ui/Icon.jsx'
import { Badge, SentimentBadge } from '../ui/Badge.jsx'
import {
  formatCompact,
  formatLongDate,
  formatSigned,
  sentimentStyle,
} from '../../utils/format.js'
import { escapeRegex } from '../../analysis/topics.js'

export default function PostDetailModal({ post, open, onClose }) {
  const highlighted = useMemo(() => {
    if (!post) return null
    return highlight(post.text, post.sentimentHits)
  }, [post])

  if (!post) return null

  const style = sentimentStyle(post.sentimentLabel)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={post.title || `Comment in r/${post.subreddit}`}
      subtitle={`r/${post.subreddit} · u/${post.author} · ${formatLongDate(post.createdAt)}`}
      width="max-w-2xl"
    >
      {}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-elevated px-4 py-3">
        <SentimentBadge label={post.sentimentLabel} />
        <span className={`tnum text-[13px] font-semibold ${style.text}`}>
          {formatSigned(post.sentimentScore)}
        </span>
        <span className="text-[12px] text-ink-3">sentiment score</span>

        <span className="ml-auto flex items-center gap-3 text-[12px] text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Icon name="arrowUp" className="h-3.5 w-3.5" />
            {formatCompact(post.score)}
          </span>
          {post.numComments > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="chat" className="h-3.5 w-3.5" />
              {formatCompact(post.numComments)}
            </span>
          ) : null}
        </span>
      </div>

      {}
      <div className="mt-4 max-h-[38vh] overflow-y-auto pr-1">
        <p className="text-[14px] leading-relaxed whitespace-pre-line text-ink-2">
          {highlighted}
        </p>
      </div>

      {}
      <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <DetailBlock title="Topics">
          {post.topicLabels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {post.topicLabels.map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
          ) : (
            <Empty>No taxonomy topics matched.</Empty>
          )}
        </DetailBlock>

        <DetailBlock title="Competitors mentioned">
          {post.competitorMentions.length ? (
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(post.competitorMentions.map((m) => m.brand))].map((brand) => (
                <Badge key={brand} className="border-accent/30 bg-accent-dim text-accent-ink">
                  {brand}
                </Badge>
              ))}
            </div>
          ) : (
            <Empty>None detected.</Empty>
          )}
        </DetailBlock>

        <DetailBlock title="Positive signals">
          {post.sentimentHits.positive.length ? (
            <p className="text-[12px] leading-relaxed text-positive-ink">
              {[...new Set(post.sentimentHits.positive)].join(', ')}
            </p>
          ) : (
            <Empty>None.</Empty>
          )}
        </DetailBlock>

        <DetailBlock title="Negative signals">
          {post.sentimentHits.negative.length ? (
            <p className="text-[12px] leading-relaxed text-negative-ink">
              {[...new Set(post.sentimentHits.negative)].join(', ')}
            </p>
          ) : (
            <Empty>None.</Empty>
          )}
        </DetailBlock>
      </div>

      {post.permalink ? (
        <a
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-accent-ink hover:text-accent"
        >
          Open on Reddit
          <Icon name="arrowOut" className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </Modal>
  )
}

function DetailBlock({ title, children }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[11px] tracking-wide text-ink-3 uppercase">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p className="text-[12px] text-ink-3">{children}</p>
}

function highlight(text, hits) {
  const positive = new Set(hits.positive)
  const negative = new Set(hits.negative)
  const words = [...positive, ...negative]

  if (words.length === 0) return text

  const pattern = new RegExp(
    `\\b(${words.map(escapeRegex).join('|')})\\b`,
    'gi',
  )

  const parts = text.split(pattern)

  return parts.map((part, index) => {
    const lower = part.toLowerCase()
    if (positive.has(lower)) {
      return (
        <mark
          key={index}
          className="rounded bg-positive/15 px-0.5 text-positive-ink"
        >
          {part}
        </mark>
      )
    }
    if (negative.has(lower)) {
      return (
        <mark
          key={index}
          className="rounded bg-negative/15 px-0.5 text-negative-ink"
        >
          {part}
        </mark>
      )
    }
    return part
  })
}

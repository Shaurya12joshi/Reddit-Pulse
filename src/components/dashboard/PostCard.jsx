import { Badge, SentimentBadge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import { formatCompact, formatRelative, truncate } from '../../utils/format.js'

/** One Reddit item in a list. Clicking opens the full detail view. */
export default function PostCard({ post, onOpen }) {
  const heading = post.title || truncate(post.body, 110)

  return (
    <article>
      <button
        type="button"
        onClick={() => onOpen(post)}
        className="w-full rounded-lg px-4 py-3.5 text-left transition-colors hover:bg-elevated"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] leading-snug font-medium text-ink">
              {heading}
            </h3>

            {post.title && post.body ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
                {truncate(post.body, 170)}
              </p>
            ) : null}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-3">
              <span className="font-medium text-ink-2">r/{post.subreddit}</span>
              <span>u/{post.author}</span>
              <span className="inline-flex items-center gap-1">
                <Icon name="arrowUp" className="h-3 w-3" />
                {formatCompact(post.score)}
              </span>
              {post.numComments > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Icon name="chat" className="h-3 w-3" />
                  {formatCompact(post.numComments)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" className="h-3 w-3" />
                {formatRelative(post.createdAt)}
              </span>
              <span className="rounded border border-line px-1 py-0.5 text-[9px] tracking-wide uppercase">
                {post.type}
              </span>
            </div>

            {post.topicLabels.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {post.topicLabels.slice(0, 3).map((label) => (
                  <Badge key={label}>{label}</Badge>
                ))}
                {post.topicLabels.length > 3 ? (
                  <Badge>+{post.topicLabels.length - 3}</Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <SentimentBadge label={post.sentimentLabel} className="shrink-0" />
        </div>
      </button>
    </article>
  )
}

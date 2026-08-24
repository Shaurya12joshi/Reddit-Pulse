import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import StackedShareBar from '../charts/StackedShareBar.jsx'
import { formatPercent, formatSigned } from '../../utils/format.js'

export default function SubredditPanel({ subreddits, activeSubreddit, onSelect }) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Subreddit breakdown"
        subtitle="Volume and tone per community"
        icon={<Icon name="users" className="h-3.5 w-3.5" />}
      />
      <CardBody className="p-0">
        <ul className="divide-y divide-line">
          {subreddits.slice(0, 8).map((sub) => {
            const isActive = activeSubreddit === sub.name
            return (
              <li key={sub.name}>
                <button
                  type="button"
                  onClick={() => onSelect(isActive ? 'all' : sub.name)}
                  aria-pressed={isActive}
                  className={`w-full px-5 py-3 text-left transition-colors hover:bg-elevated ${
                    isActive ? 'bg-elevated' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-ink">
                      r/{sub.name}
                    </span>
                    <span className="tnum shrink-0 text-[12px] text-ink-3">
                      {sub.count} · {formatPercent(sub.share, 0)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <StackedShareBar
                        positive={sub.positive}
                        neutral={sub.neutral}
                        negative={sub.negative}
                        height={5}
                      />
                    </div>
                    <span
                      className={`tnum w-11 shrink-0 text-right text-[11px] font-medium ${
                        sub.avgScore > 0.08
                          ? 'text-positive-ink'
                          : sub.avgScore < -0.08
                            ? 'text-negative-ink'
                            : 'text-ink-3'
                      }`}
                    >
                      {formatSigned(sub.avgScore)}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

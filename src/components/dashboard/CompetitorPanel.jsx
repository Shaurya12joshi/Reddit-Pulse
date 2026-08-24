import { useState } from 'react'
import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import { Badge, SentimentBadge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import { formatPercent, formatSigned, sentimentStyle } from '../../utils/format.js'
import { labelFor } from '../../analysis/sentiment.js'

export default function CompetitorPanel({ competitors, company, market }) {
  const [expanded, setExpanded] = useState(null)

  const peak = Math.max(...competitors.map((c) => c.mentions), 1)

  return (
    <Card>
      <CardHeader
        title="Competitive comparisons"
        subtitle={
          market
            ? `Brands mentioned alongside ${company} in the ${market.toLowerCase()} space`
            : `Brands mentioned alongside ${company}`
        }
        icon={<Icon name="scale" className="h-3.5 w-3.5" />}
        action={
          competitors.length ? (
            <Badge>{competitors.length} detected</Badge>
          ) : null
        }
      />

      <CardBody className="p-0">
        {competitors.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-3">
            No competitor comparisons found in this selection. Try widening the
            filters.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {competitors.slice(0, 8).map((competitor) => {
              const isOpen = expanded === competitor.brand
              const style = sentimentStyle(competitor.sentimentLabel)

              return (
                <li key={competitor.brand}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : competitor.brand)}
                    aria-expanded={isOpen}
                    className="grid w-full grid-cols-[1.4fr_1fr] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-elevated md:grid-cols-[minmax(140px,1.1fr)_minmax(120px,1fr)_minmax(180px,1.4fr)_auto]"
                  >
                    {}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon
                          name="chevronRight"
                          className={`h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform ${
                            isOpen ? 'rotate-90' : ''
                          }`}
                        />
                        <span className="truncate text-[14px] font-medium text-ink">
                          {competitor.brand}
                        </span>
                        {!competitor.known ? (
                          <span
                            title="Discovered from comparison phrasing rather than the known-brand list"
                            className="rounded border border-line px-1 py-0.5 text-[9px] tracking-wide text-ink-3 uppercase"
                          >
                            found
                          </span>
                        ) : null}
                      </div>
                      <p className="tnum mt-1 pl-5.5 text-[12px] text-ink-3">
                        {competitor.mentions} mentions ·{' '}
                        {formatPercent(competitor.share, 1)} of discussions
                      </p>
                    </div>

                    {}
                    <div className="hidden md:block">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
                        <div
                          className="h-full rounded-full bg-secondary transition-[width] duration-500 ease-out"
                          style={{ width: `${(competitor.mentions / peak) * 100}%` }}
                        />
                      </div>
                    </div>

                    {}
                    <div className="hidden flex-wrap gap-1.5 md:flex">
                      {competitor.reasons.slice(0, 2).map((reason) => (
                        <Badge key={reason.label}>
                          {reason.label}
                          <span className="tnum text-ink-3">{reason.count}</span>
                        </Badge>
                      ))}
                      {competitor.topics.slice(0, 1).map((topic) => (
                        <Badge key={topic.id} className="border-accent/30 bg-accent-dim text-accent-ink">
                          {topic.label}
                        </Badge>
                      ))}
                      {competitor.reasons.length === 0 &&
                      competitor.topics.length === 0 ? (
                        <span className="text-[12px] text-ink-3">
                          Mentioned without explicit framing
                        </span>
                      ) : null}
                    </div>

                    {}
                    <div className="flex items-center justify-end gap-2">
                      <span className={`tnum text-[12px] font-medium ${style.text}`}>
                        {formatSigned(competitor.avgSentiment)}
                      </span>
                      <SentimentBadge
                        label={competitor.sentimentLabel}
                        showDot={false}
                        className="hidden lg:inline-flex"
                      />
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="animate-fade space-y-3 bg-elevated/50 px-5 pt-1 pb-5">
                      <div className="flex flex-wrap gap-1.5 md:hidden">
                        {competitor.reasons.map((reason) => (
                          <Badge key={reason.label}>
                            {reason.label} <span className="tnum">{reason.count}</span>
                          </Badge>
                        ))}
                      </div>

                      <p className="text-[11px] tracking-wide text-ink-3 uppercase">
                        Why people compare them
                      </p>

                      {competitor.examples.map((example, index) => {
                        const exampleStyle = sentimentStyle(labelFor(example.sentiment))
                        return (
                          <blockquote
                            key={`${example.postId}-${index}`}
                            className="rounded-lg border border-line bg-surface p-3.5"
                          >
                            <p className="text-[13px] leading-relaxed text-ink-2 italic">
                              “{example.quote}”
                            </p>
                            <footer className="mt-2 flex items-center gap-2 text-[11px] text-ink-3">
                              <span>r/{example.subreddit}</span>
                              <span className="h-1 w-1 rounded-full bg-line-strong" />
                              <span className={exampleStyle.text}>
                                {exampleStyle.label} sentence
                              </span>
                              {example.permalink ? (
                                <a
                                  href={example.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="ml-auto inline-flex items-center gap-1 text-ink-3 hover:text-accent-ink"
                                >
                                  Open thread
                                  <Icon name="arrowOut" className="h-3 w-3" />
                                </a>
                              ) : null}
                            </footer>
                          </blockquote>
                        )
                      })}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

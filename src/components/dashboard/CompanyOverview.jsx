import { SentimentBadge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import StackedShareBar from '../charts/StackedShareBar.jsx'
import { formatNumber, formatSigned } from '../../utils/format.js'

/** Report header: who we analysed, from what, and the single headline number. */
export default function CompanyOverview({ company, insights, meta, onRefresh }) {
  const { sentiment, totals, market } = insights

  return (
    <div className="flex flex-col gap-6 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] tracking-wide text-ink-3 uppercase">
            Reddit intelligence report
          </span>
          {market ? (
            <span className="rounded-full border border-line bg-elevated px-2 py-0.5 text-[11px] text-ink-2">
              {market}
            </span>
          ) : null}
        </div>

        <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-tight text-ink">
          {company}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-3">
          <span className="tnum">
            {formatNumber(totals.mentions)} discussions analysed
          </span>
          <span className="h-1 w-1 rounded-full bg-line-strong" />
          <span className="tnum">{totals.subreddits} subreddits</span>
          <span className="h-1 w-1 rounded-full bg-line-strong" />
          <span className="tnum">{formatNumber(totals.authors)} unique authors</span>
          <span className="h-1 w-1 rounded-full bg-line-strong" />
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                meta?.source === 'live' ? 'bg-positive' : 'bg-ink-3'
              }`}
            />
            {meta?.source === 'live' ? 'Live scraped data' : 'Sample dataset'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 text-ink-3 transition-colors hover:text-ink"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" />
            Re-run
          </button>
        </div>
      </div>

      {/* headline sentiment */}
      <div className="w-full shrink-0 rounded-[14px] border border-line bg-surface p-5 lg:w-[330px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">
              Net sentiment
            </p>
            <p
              className={`tnum mt-1 text-[34px] leading-none font-semibold ${
                sentiment.net > 0
                  ? 'text-positive-ink'
                  : sentiment.net < 0
                    ? 'text-negative-ink'
                    : 'text-ink'
              }`}
            >
              {formatSigned(sentiment.net, 1)}
            </p>
          </div>
          <SentimentBadge label={sentiment.label} />
        </div>

        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
          Positive share minus negative share. Mean score{' '}
          <span className="tnum text-ink-2">{formatSigned(sentiment.averageScore)}</span>
          .
        </p>

        <div className="mt-4">
          <StackedShareBar
            positive={sentiment.positive}
            neutral={sentiment.neutral}
            negative={sentiment.negative}
            height={7}
            showLabels
          />
        </div>
      </div>
    </div>
  )
}

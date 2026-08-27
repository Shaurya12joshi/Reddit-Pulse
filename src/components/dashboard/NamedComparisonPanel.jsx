import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import { Badge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import { redditUrl } from '../../utils/reddit.js'

// The comparison the user asked for by name, shown above the automatic
// competitor read rather than in place of it.

const VERDICT = {
  brand: { label: 'Commenters lean toward', tone: 'positive' },
  competitor: { label: 'Commenters lean toward', tone: 'negative' },
  mixed: { label: 'Opinion splits', tone: 'neutral' },
  unclear: { label: 'Not settled by the discussions', tone: 'neutral' },
}

const TONE = {
  positive: 'border-positive/30 bg-positive/10 text-positive-ink',
  negative: 'border-negative/25 bg-negative/10 text-negative-ink',
  neutral: 'border-line bg-elevated text-ink-2',
}

const RECEPTION = {
  positive: 'text-positive-ink',
  negative: 'text-negative-ink',
  mixed: 'text-neutral-ink',
  unclear: 'text-ink-3',
}

const RELATIONSHIP = {
  direct: 'People genuinely choose between these two.',
  adjacent: 'These two overlap, but are not usually a straight either/or.',
  unrelated: 'These two are not normally weighed against each other.',
}

const SWITCHING = {
  to_brand: 'Movement toward',
  to_competitor: 'Movement away, toward',
  both: 'Movement in both directions with',
  none: null,
}

function EdgeMark({ edge, company, competitor }) {
  if (edge === 'tie') return <span className="text-[11px] text-ink-3">Level</span>
  if (edge === 'unclear') return <span className="text-[11px] text-ink-3">Unclear</span>
  const winner = edge === 'brand' ? company : competitor
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        edge === 'brand' ? TONE.positive : TONE.negative
      }`}
    >
      <Icon name="check" className="h-3 w-3" />
      {winner}
    </span>
  )
}

function WinList({ title, items, tone }) {
  if (!items?.length) return null
  return (
    <div>
      <p className="text-[11px] tracking-wide text-ink-3 uppercase">{title}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item} className={`rounded-full border px-2.5 py-1 text-[11px] ${TONE[tone]}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Quote({ quote, company, competitor }) {
  const side =
    quote.side === 'brand' ? company : quote.side === 'competitor' ? competitor : 'both'

  return (
    <blockquote className="rounded-lg border border-line bg-surface p-3.5">
      <p className="text-[13px] leading-relaxed text-ink-2 italic">“{quote.quote}”</p>
      {quote.point ? (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{quote.point}</p>
      ) : null}
      <footer className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
        <span>r/{quote.subreddit}</span>
        <span className="h-1 w-1 rounded-full bg-line-strong" />
        <span>on {side}</span>
        {quote.permalink ? (
          <a
            href={redditUrl(quote.permalink)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-ink-3 hover:text-accent-ink"
          >
            Open thread
            <Icon name="arrowOut" className="h-3 w-3" />
          </a>
        ) : null}
      </footer>
    </blockquote>
  )
}

function Empty({ children, onRetry }) {
  return (
    <CardBody>
      <p className="text-[13px] leading-relaxed text-ink-3">{children}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </CardBody>
  )
}

export default function NamedComparisonPanel({ company, requested, result }) {
  const rival = result?.target?.name || requested
  const header = (
    <CardHeader
      title={`${company} vs ${rival}`}
      subtitle="The head-to-head you asked for, read from the collected discussions"
      icon={<Icon name="scale" className="h-3.5 w-3.5" />}
      action={
        result?.coverage ? (
          <Badge title="Excerpts naming both companies">
            {result.coverage.headToHead} head-to-head
          </Badge>
        ) : null
      }
    />
  )

  if (result?.status === 'loading') {
    return (
      <Card>
        {header}
        <CardBody className="space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-elevated" />
          <div className="h-20 animate-pulse rounded-lg bg-elevated" />
          <div className="h-20 animate-pulse rounded-lg bg-elevated" />
        </CardBody>
      </Card>
    )
  }

  if (result?.status === 'error') {
    return (
      <Card>
        {header}
        <Empty onRetry={result.reload}>{result.error}</Empty>
      </Card>
    )
  }

  const comparison = result?.comparison
  if (!comparison) {
    return (
      <Card>
        {header}
        <Empty onRetry={result?.source === 'failed' ? result.reload : null}>
          {result?.reason || `Nothing in the collected discussions weighs ${company} against ${rival}.`}
        </Empty>
      </Card>
    )
  }

  const meta = VERDICT[comparison.verdict] || VERDICT.unclear
  const winner =
    comparison.verdict === 'brand'
      ? company
      : comparison.verdict === 'competitor'
        ? rival
        : null
  const switching = SWITCHING[comparison.switching?.direction]

  return (
    <Card>
      {header}

      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE[meta.tone]}`}
          >
            <Icon
              name={winner ? 'check' : 'scale'}
              className="h-3 w-3"
            />
            {winner ? `${meta.label} ${winner}` : meta.label}
          </span>
          <Badge title="How well the excerpts support this verdict">
            {Math.round((comparison.confidence ?? 0) * 100)}% confidence
          </Badge>
          {result.target?.relationship ? (
            <Badge>{RELATIONSHIP[result.target.relationship]}</Badge>
          ) : null}
          {result.reload ? (
            <button
              type="button"
              onClick={result.reload}
              className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-ink-3 transition-colors hover:text-ink"
            >
              <Icon name="refresh" className="h-3 w-3" />
              Re-read
            </button>
          ) : null}
        </div>

        <div>
          <p className="text-[15px] leading-snug font-medium text-ink">{comparison.headline}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{comparison.summary}</p>
        </div>

        {comparison.dimensions?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-wide text-ink-3 uppercase">
                  <th className="py-2 pr-3 font-medium">Dimension</th>
                  <th className="py-2 pr-3 font-medium">{company}</th>
                  <th className="py-2 pr-3 font-medium">{rival}</th>
                  <th className="py-2 font-medium">Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {comparison.dimensions.map((row) => (
                  <tr key={row.dimension} className="align-top">
                    <td className="py-2.5 pr-3 text-[12.5px] font-medium text-ink">
                      {row.dimension}
                    </td>
                    <td className="py-2.5 pr-3 text-[12.5px] leading-relaxed text-ink-2">
                      {row.brand_view}
                    </td>
                    <td className="py-2.5 pr-3 text-[12.5px] leading-relaxed text-ink-2">
                      {row.competitor_view}
                    </td>
                    <td className="py-2.5">
                      <EdgeMark edge={row.edge} company={company} competitor={rival} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <WinList title={`${company} wins on`} items={comparison.brand_wins} tone="positive" />
          <WinList title={`${rival} wins on`} items={comparison.competitor_wins} tone="negative" />
        </div>

        <div className="grid gap-3 text-[12.5px] sm:grid-cols-2">
          <p className="rounded-lg border border-line bg-elevated/60 p-3 text-ink-3">
            {company} is spoken about{' '}
            <span className={`font-medium ${RECEPTION[comparison.brand_reception]}`}>
              {comparison.brand_reception}ly
            </span>{' '}
            across these excerpts.
          </p>
          <p className="rounded-lg border border-line bg-elevated/60 p-3 text-ink-3">
            {rival} is spoken about{' '}
            <span className={`font-medium ${RECEPTION[comparison.competitor_reception]}`}>
              {comparison.competitor_reception}ly
            </span>{' '}
            across these excerpts.
          </p>
        </div>

        {switching ? (
          <p className="flex items-start gap-2 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-2">
            <Icon name="arrowOut" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
            <span>
              <span className="font-medium text-ink">
                {switching}{' '}
                {comparison.switching.direction === 'to_brand'
                  ? company
                  : comparison.switching.direction === 'to_competitor'
                    ? rival
                    : 'both'}
                .
              </span>{' '}
              {comparison.switching.detail}
            </span>
          </p>
        ) : null}

        {comparison.quotes?.length ? (
          <div className="space-y-3">
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">What people actually wrote</p>
            {comparison.quotes.map((quote, index) => (
              <Quote
                key={`${quote.id}-${index}`}
                quote={quote}
                company={company}
                competitor={rival}
              />
            ))}
          </div>
        ) : null}

        {comparison.gaps?.length ? (
          <div className="rounded-lg border border-line bg-elevated/60 p-3.5">
            <p className="flex items-center gap-2 text-[11px] tracking-wide text-ink-3 uppercase">
              <Icon name="alert" className="h-3.5 w-3.5" />
              What these discussions do not cover
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-3">
              {comparison.gaps.map((gap) => (
                <li key={gap}>· {gap}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-[11px] text-ink-3">
          <span>
            Read from {result.coverage.headToHead} head-to-head,{' '}
            {result.coverage.competitorOnly} {rival}-only and {result.coverage.brandOnly}{' '}
            {company}-only excerpts.
          </span>
          {result.target?.alsoWorthComparing?.length ? (
            <span className="flex flex-wrap items-center gap-1.5">
              Also worth comparing:
              {result.target.alsoWorthComparing.map((name) => (
                <Badge key={name}>{name}</Badge>
              ))}
            </span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )
}

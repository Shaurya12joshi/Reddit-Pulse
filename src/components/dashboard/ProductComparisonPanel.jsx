import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import { Badge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import { redditUrl } from '../../utils/reddit.js'
import { TONE_CLASSES, evidenceOf, evidenceTitle } from '../../utils/evidence.js'

const VERDICT = {
  mine: { label: 'Commenters lean toward', tone: 'positive' },
  theirs: { label: 'Commenters lean toward', tone: 'negative' },
  mixed: { label: 'Opinion splits', tone: 'caution' },
  unclear: { label: 'Not settled by the discussions', tone: 'neutral' },
}

const TONE = TONE_CLASSES

const RECEPTION = {
  positive: 'text-positive-ink',
  negative: 'text-negative-ink',
  mixed: 'text-neutral-ink',
  unclear: 'text-ink-3',
}

const SWITCHING = {
  to_mine: 'Movement toward',
  to_theirs: 'Movement away, toward',
  both: 'Movement in both directions with',
  none: null,
}

function EdgeMark({ edge, mine, theirs }) {
  if (edge === 'tie') return <span className="text-[11px] text-ink-3">Level</span>
  if (edge === 'unclear') return <span className="text-[11px] text-ink-3">Unclear</span>
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        edge === 'mine' ? TONE.positive : TONE.negative
      }`}
    >
      <Icon name="check" className="h-3 w-3" />
      {edge === 'mine' ? mine : theirs}
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

export default function ProductComparisonPanel({ requested, result }) {
  const mine = result?.products?.mine?.name || requested?.mine
  const theirs = result?.products?.theirs?.name || requested?.theirs

  const header = (
    <CardHeader
      title={`${mine} vs ${theirs}`}
      subtitle="The product-level comparison you asked for, read from the collected discussions"
      icon={<Icon name="layers" className="h-3.5 w-3.5" />}
      action={
        result?.coverage ? (
          <Badge title="Excerpts covering both products">
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
          {result?.reason || 'Nothing in the collected discussions weighs these two against each other.'}
        </Empty>
      </Card>
    )
  }

  const meta = VERDICT[comparison.verdict] || VERDICT.unclear
  const winner =
    comparison.verdict === 'mine' ? mine : comparison.verdict === 'theirs' ? theirs : null
  const switching = SWITCHING[comparison.switching?.direction]
  const products = result.products

  return (
    <Card>
      {header}

      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE[meta.tone]}`}
          >
            <Icon name={winner ? 'check' : 'scale'} className="h-3 w-3" />
            {winner ? `${meta.label} ${winner}` : meta.label}
          </span>
          <span
            title={evidenceTitle(comparison.confidence)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              TONE[evidenceOf(comparison.confidence).tone]
            }`}
          >
            {evidenceOf(comparison.confidence).label}
          </span>
          {products?.theirsInferred ? (
            <span
              title="No rival product was named, so the counterpart was chosen for you"
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE.caution}`}
            >
              Counterpart chosen for you
            </span>
          ) : null}
          {products?.comparable === false ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE.negative}`}
            >
              Not straight alternatives
            </span>
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

        <div className="grid gap-3 sm:grid-cols-2">
          {[products?.mine, products?.theirs].map((product, index) =>
            product?.name ? (
              <div key={product.name} className="rounded-lg border border-line bg-elevated/60 p-3">
                <p className="text-[12.5px] font-semibold text-ink">
                  {product.name}
                  {product.owner ? (
                    <span className="ml-1.5 font-normal text-ink-3">by {product.owner}</span>
                  ) : null}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
                  {product.what_it_is}
                </p>
                <p className="mt-1.5 text-[11px] text-ink-3">
                  {index === 0 ? 'Yours' : 'Theirs'}
                </p>
              </div>
            ) : null,
          )}
        </div>

        <div>
          <p className="text-[15px] leading-snug font-medium text-ink">{comparison.headline}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{comparison.summary}</p>
          {products?.relationship ? (
            <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{products.relationship}</p>
          ) : null}
        </div>

        {comparison.dimensions?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-wide text-ink-3 uppercase">
                  <th className="py-2 pr-3 font-medium">Dimension</th>
                  <th className="py-2 pr-3 font-medium">{mine}</th>
                  <th className="py-2 pr-3 font-medium">{theirs}</th>
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
                      {row.mine_view}
                    </td>
                    <td className="py-2.5 pr-3 text-[12.5px] leading-relaxed text-ink-2">
                      {row.theirs_view}
                    </td>
                    <td className="py-2.5">
                      <EdgeMark edge={row.edge} mine={mine} theirs={theirs} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <WinList title={`${mine} wins on`} items={comparison.mine_wins} tone="positive" />
          <WinList title={`${theirs} wins on`} items={comparison.theirs_wins} tone="negative" />
        </div>

        {comparison.best_for_mine || comparison.best_for_theirs ? (
          <div className="grid gap-3 text-[12.5px] sm:grid-cols-2">
            {comparison.best_for_mine ? (
              <p className="rounded-lg border border-line bg-elevated/60 p-3 text-ink-3">
                <span className="font-medium text-ink">{mine}</span> suits{' '}
                {comparison.best_for_mine}
              </p>
            ) : null}
            {comparison.best_for_theirs ? (
              <p className="rounded-lg border border-line bg-elevated/60 p-3 text-ink-3">
                <span className="font-medium text-ink">{theirs}</span> suits{' '}
                {comparison.best_for_theirs}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 text-[12.5px] sm:grid-cols-2">
          <p className="rounded-lg border border-line bg-elevated/60 p-3 text-ink-3">
            {mine} is spoken about{' '}
            <span className={`font-medium ${RECEPTION[comparison.mine_reception]}`}>
              {comparison.mine_reception}ly
            </span>
            .
          </p>
          <p className="rounded-lg border border-line bg-elevated/60 p-3 text-ink-3">
            {theirs} is spoken about{' '}
            <span className={`font-medium ${RECEPTION[comparison.theirs_reception]}`}>
              {comparison.theirs_reception}ly
            </span>
            .
          </p>
        </div>

        {switching ? (
          <p className="flex items-start gap-2 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-2">
            <Icon name="arrowOut" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
            <span>
              <span className="font-medium text-ink">
                {switching}{' '}
                {comparison.switching.direction === 'to_mine'
                  ? mine
                  : comparison.switching.direction === 'to_theirs'
                    ? theirs
                    : 'both'}
                .
              </span>{' '}
              {comparison.switching.detail}
            </span>
          </p>
        ) : null}

        {comparison.quotes?.length ? (
          <div className="space-y-3">
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">
              What people actually wrote
            </p>
            {comparison.quotes.map((quote, index) => (
              <blockquote
                key={`${quote.id}-${index}`}
                className="rounded-lg border border-line bg-surface p-3.5"
              >
                <p className="text-[13px] leading-relaxed text-ink-2 italic [overflow-wrap:anywhere]">
                  “{quote.quote}”
                </p>
                {quote.point ? (
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{quote.point}</p>
                ) : null}
                <footer className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
                  <span>r/{quote.subreddit}</span>
                  <span className="h-1 w-1 rounded-full bg-line-strong" />
                  <span>
                    on {quote.side === 'mine' ? mine : quote.side === 'theirs' ? theirs : 'both'}
                  </span>
                  {redditUrl(quote.permalink) ? (
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

        <p className="border-t border-line pt-4 text-[11px] text-ink-3">
          Read from {result.coverage.headToHead} excerpts covering both, {result.coverage.theirsOnly}{' '}
          about {theirs} alone and {result.coverage.mineOnly} about {mine} alone.
        </p>
      </CardBody>
    </Card>
  )
}

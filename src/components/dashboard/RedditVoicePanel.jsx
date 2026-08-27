import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import { Badge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import { formatPercent } from '../../utils/format.js'
import { redditUrl } from '../../utils/reddit.js'

// The answer to the one question the user typed, read out of the same corpus
// the rest of the report is built from.

const OVERALL = {
  positive: { label: 'Mostly positive', className: 'border-positive/30 bg-positive/10 text-positive-ink' },
  negative: { label: 'Mostly negative', className: 'border-negative/25 bg-negative/10 text-negative-ink' },
  mixed: { label: 'Split opinion', className: 'border-neutral/25 bg-neutral/10 text-neutral-ink' },
  unclear: { label: 'Not settled', className: 'border-line bg-elevated text-ink-2' },
}

const STANCE = {
  praise: { label: 'Praise', className: 'border-positive/30 bg-positive/10 text-positive-ink' },
  complaint: { label: 'Complaint', className: 'border-negative/25 bg-negative/10 text-negative-ink' },
  question: { label: 'Question', className: 'border-accent/30 bg-accent-dim text-accent-ink' },
  mixed: { label: 'Mixed', className: 'border-line bg-elevated text-ink-2' },
}

const QUOTE_STANCE = {
  positive: 'text-positive-ink',
  negative: 'text-negative-ink',
  neutral: 'text-ink-3',
}

function Chips({ title, items, className }) {
  if (!items?.length) return null
  return (
    <div>
      <p className="text-[11px] tracking-wide text-ink-3 uppercase">{title}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item} className={`rounded-full border px-2.5 py-1 text-[11px] ${className}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SentimentBar({ split, total }) {
  if (!total) return null
  const parts = [
    { key: 'positive', value: split.positive, className: 'bg-positive' },
    { key: 'neutral', value: split.neutral, className: 'bg-neutral' },
    { key: 'negative', value: split.negative, className: 'bg-negative' },
  ].filter((part) => part.value > 0)

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-raised">
      {parts.map((part) => (
        <span
          key={part.key}
          className={part.className}
          style={{ width: `${(part.value / total) * 100}%` }}
          title={`${part.key}: ${formatPercent((part.value / total) * 100, 0)}`}
        />
      ))}
    </div>
  )
}

function Theme({ theme }) {
  const stance = STANCE[theme.stance] || STANCE.mixed

  return (
    <li className="rounded-lg border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${stance.className}`}>
          {stance.label}
        </span>
        <span className="text-[13.5px] font-medium text-ink">{theme.theme}</span>
        <span className="tnum ml-auto text-[11px] text-ink-3">
          {theme.mentions} discussion{theme.mentions === 1 ? '' : 's'}
        </span>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{theme.detail}</p>

      {theme.sources?.length ? (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
          {theme.sources.map((source, index) =>
            source.permalink ? (
              <a
                key={`${source.id}-${index}`}
                href={redditUrl(source.permalink)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-accent-ink"
              >
                r/{source.subreddit}
                <Icon name="arrowOut" className="h-3 w-3" />
              </a>
            ) : (
              <span key={`${source.id}-${index}`}>r/{source.subreddit}</span>
            ),
          )}
        </div>
      ) : null}
    </li>
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

export default function RedditVoicePanel({ company, asked, result }) {
  const subject = result?.focus?.subject || asked

  const header = (
    <CardHeader
      title="What Reddit says about it"
      subtitle={`Your question, answered from the ${company} discussions collected: “${asked}”`}
      icon={<Icon name="quote" className="h-3.5 w-3.5" />}
      action={
        result?.coverage?.matched ? (
          <Badge title="Discussions that matched the subject">
            {result.coverage.matched} matched
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
          <div className="h-4 w-3/4 animate-pulse rounded bg-elevated" />
          <div className="h-16 animate-pulse rounded-lg bg-elevated" />
          <div className="h-16 animate-pulse rounded-lg bg-elevated" />
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

  const reading = result?.reading
  if (!reading) {
    return (
      <Card>
        {header}
        <Empty onRetry={result?.source === 'failed' ? result.reload : null}>
          {result?.reason || 'Nothing in the collected discussions covers this.'}
        </Empty>
      </Card>
    )
  }

  const overall = OVERALL[reading.overall] || OVERALL.unclear
  const split = result.coverage?.sentiment || { positive: 0, neutral: 0, negative: 0 }
  const total = split.positive + split.neutral + split.negative

  return (
    <Card>
      {header}

      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${overall.className}`}
          >
            <Icon name="chat" className="h-3 w-3" />
            {overall.label}
          </span>
          <Badge title="How well the excerpts support this answer">
            {Math.round((reading.confidence ?? 0) * 100)}% confidence
          </Badge>
          {result.coverage?.subreddits ? (
            <Badge>
              {result.coverage.subreddits} subreddit{result.coverage.subreddits === 1 ? '' : 's'}
            </Badge>
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

        {reading.off_subject ? (
          <p className="flex items-start gap-2 rounded-lg border border-negative/25 bg-negative/10 p-3 text-[12.5px] leading-relaxed text-negative-ink">
            <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The matching discussions turned out not to be about {subject}. Treat the answer below
            with care, and try wording the question differently.
          </p>
        ) : null}

        <p className="text-[14px] leading-relaxed text-ink">{reading.answer}</p>

        {total ? (
          <div className="space-y-1.5">
            <SentimentBar split={split} total={total} />
            <p className="tnum text-[11px] text-ink-3">
              {split.positive} positive · {split.neutral} neutral · {split.negative} negative,
              across the discussions that matched
            </p>
          </div>
        ) : null}

        {reading.themes?.length ? (
          <div>
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">
              What people keep coming back to
            </p>
            <ul className="mt-2 space-y-2.5">
              {reading.themes.map((theme) => (
                <Theme key={theme.theme} theme={theme} />
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Chips
            title="Praised for"
            items={reading.praise}
            className="border-positive/30 bg-positive/10 text-positive-ink"
          />
          <Chips
            title="Complained about"
            items={reading.complaints}
            className="border-negative/25 bg-negative/10 text-negative-ink"
          />
        </div>

        {reading.questions?.length ? (
          <div>
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">
              Asked repeatedly, never settled
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-2">
              {reading.questions.map((question) => (
                <li key={question}>· {question}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {reading.quotes?.length ? (
          <div className="space-y-3">
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">In their words</p>
            {reading.quotes.map((quote, index) => (
              <blockquote
                key={`${quote.id}-${index}`}
                className="rounded-lg border border-line bg-surface p-3.5"
              >
                <p className="text-[13px] leading-relaxed text-ink-2 italic">“{quote.quote}”</p>
                {quote.point ? (
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{quote.point}</p>
                ) : null}
                <footer className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
                  <span>r/{quote.subreddit}</span>
                  <span className="h-1 w-1 rounded-full bg-line-strong" />
                  <span className={QUOTE_STANCE[quote.stance] || QUOTE_STANCE.neutral}>
                    {quote.stance}
                  </span>
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
            ))}
          </div>
        ) : null}

        {reading.gaps?.length ? (
          <div className="rounded-lg border border-line bg-elevated/60 p-3.5">
            <p className="flex items-center gap-2 text-[11px] tracking-wide text-ink-3 uppercase">
              <Icon name="alert" className="h-3.5 w-3.5" />
              What these discussions do not cover
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-3">
              {reading.gaps.map((gap) => (
                <li key={gap}>· {gap}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

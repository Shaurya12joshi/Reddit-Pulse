import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import { Badge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import { formatPercent, formatSigned, sentimentStyle } from '../../utils/format.js'
import { labelFor } from '../../analysis/sentiment.js'
import { TONE_CLASSES, evidenceOf, evidenceTitle } from '../../utils/evidence.js'
import { redditUrl } from '../../utils/reddit.js'

const STANDING = {
  incumbent: { label: 'Incumbent', tone: 'info' },
  established: { label: 'Established', tone: 'info' },
  challenger: { label: 'Challenger', tone: 'caution' },
  newcomer: { label: 'Newcomer', tone: 'positive' },
}

function Chips({ title, items, tone }) {
  if (!items?.length) return null
  return (
    <div>
      <p className="text-[11px] tracking-wide text-ink-3 uppercase">{title}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${TONE_CLASSES[tone]}`}
          >
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

export default function FieldPanel({ keywords, result }) {
  const field = result?.map?.field || keywords

  const header = (
    <CardHeader
      title={`Companies in ${field}`}
      subtitle="The field you named, mapped and then read from the collected discussions"
      icon={<Icon name="layers" className="h-3.5 w-3.5" />}
      action={
        result?.companies?.length ? (
          <Badge>{result.companies.length} in the field</Badge>
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
          <div className="h-24 animate-pulse rounded-lg bg-elevated" />
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

  if (!result?.companies?.length) {
    return (
      <Card>
        {header}
        <Empty onRetry={result?.reload}>
          {result?.reason || 'The field could not be mapped from those keywords.'}
        </Empty>
      </Card>
    )
  }

  const reading = result.reading
  const discussed = result.companies.filter((company) => company.mentions > 0)
  const quiet = result.companies.filter((company) => company.mentions === 0)

  return (
    <Card>
      {header}

      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {reading ? (
            <span
              title={evidenceTitle(reading.confidence)}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                TONE_CLASSES[evidenceOf(reading.confidence).tone]
              }`}
            >
              {evidenceOf(reading.confidence).label}
            </span>
          ) : null}
          {result.excerpts ? (
            <Badge title="Discussions about the field that were read">
              {result.excerpts} field discussions
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

        {result.map?.description ? (
          <p className="text-[13px] leading-relaxed text-ink-2">{result.map.description}</p>
        ) : null}

        {reading?.summary ? (
          <p className="text-[14px] leading-relaxed text-ink">{reading.summary}</p>
        ) : null}

        {discussed.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-wide text-ink-3 uppercase">
                  <th className="py-2 pr-3 font-medium">Company</th>
                  <th className="py-2 pr-3 font-medium">What it does</th>
                  <th className="py-2 pr-3 font-medium">Mentions</th>
                  <th className="py-2 font-medium">Tone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {discussed.map((company) => {
                  const standing = STANDING[company.standing] || STANDING.established
                  const style = sentimentStyle(labelFor(company.avgSentiment))
                  return (
                    <tr key={company.name} className="align-top">
                      <td className="py-2.5 pr-3">
                        <span className="text-[13px] font-medium text-ink">{company.name}</span>
                        <span
                          className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] ${
                            TONE_CLASSES[standing.tone]
                          }`}
                        >
                          {standing.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[12.5px] leading-relaxed text-ink-2">
                        {company.what_it_does}
                      </td>
                      <td className="tnum py-2.5 pr-3 text-[12.5px] text-ink-2">
                        {company.mentions}
                        <span className="text-ink-3"> · {formatPercent(company.share, 1)}</span>
                      </td>
                      <td className={`tnum py-2.5 text-[12.5px] font-medium ${style.text}`}>
                        {formatSigned(company.avgSentiment)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {quiet.length ? (
          <p className="text-[12px] leading-relaxed text-ink-3">
            In the field but absent from what was collected:{' '}
            {quiet.map((company) => company.name).join(', ')}.
          </p>
        ) : null}

        {reading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Chips title="What buyers want" items={reading.what_buyers_want} tone="positive" />
            <Chips title="What they complain about" items={reading.common_complaints} tone="negative" />
          </div>
        ) : null}

        {reading?.openings?.length ? (
          <div className="rounded-lg border border-line bg-elevated/60 p-3.5">
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">
              Openings the discussions point at
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-2">
              {reading.openings.map((opening) => (
                <li key={opening}>· {opening}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.map?.questions?.length ? (
          <div>
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">
              What people in this field keep asking
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-2">
              {result.map.questions.map((question) => (
                <li key={question}>· {question}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {discussed.some((company) => company.example) ? (
          <div className="space-y-3">
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">From the field</p>
            {discussed
              .filter((company) => company.example)
              .slice(0, 3)
              .map((company) => (
                <blockquote
                  key={company.name}
                  className="rounded-lg border border-line bg-surface p-3.5"
                >
                  <p className="text-[13px] leading-relaxed text-ink-2 italic [overflow-wrap:anywhere]">
                    “{company.example.quote}”
                  </p>
                  <footer className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
                    <span>on {company.name}</span>
                    <span className="h-1 w-1 rounded-full bg-line-strong" />
                    <span>r/{company.example.subreddit}</span>
                    {redditUrl(company.example.permalink) ? (
                      <a
                        href={redditUrl(company.example.permalink)}
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

        {reading?.where_they_talk?.length ? (
          <p className="border-t border-line pt-4 text-[11px] text-ink-3">
            This conversation happens in {reading.where_they_talk.join(', ')}.
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}

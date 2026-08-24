import { useState } from 'react'
import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import { Badge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import { formatCompact, formatNumber, formatRelative } from '../../utils/format.js'
import { useBuzz } from '../../hooks/useBuzz.js'

const TABLE_PREVIEW = 12

function SubredditLink({ name, className = '' }) {
  return (
    <a
      href={`https://old.reddit.com/r/${name}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-medium text-ink hover:underline ${className}`}
    >
      r/{name}
    </a>
  )
}

function Section({ title, subtitle, icon, children, action }) {
  return (
    <Card className="mt-5">
      <CardHeader title={title} subtitle={subtitle} icon={icon} action={action} />
      <CardBody>{children}</CardBody>
    </Card>
  )
}

function RankedTable({ rows }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? rows : rows.slice(0, TABLE_PREVIEW)

  return (
    <>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-3">
              <th className="w-10 py-2 pr-3 font-medium">#</th>
              <th className="w-44 py-2 pr-3 font-medium">Subreddit</th>
              <th className="py-2 pr-3 font-medium">Why it matters</th>
              <th className="w-52 py-2 pr-3 font-medium">Discussion type</th>
              <th className="w-32 py-2 pr-3 font-medium">Buzz status</th>
              <th className="w-64 py-2 font-medium">Key signals</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.name} className="border-b border-line/70 align-top">
                <td className="tnum py-3 pr-3 text-ink-3">{row.rank}</td>
                <td className="py-3 pr-3">
                  <SubredditLink name={row.name} />
                  <div className="tnum mt-0.5 text-[11px] text-ink-3">score {row.score}</div>
                </td>
                <td className="py-3 pr-3 text-ink-2">{row.why}</td>
                <td className="py-3 pr-3 text-ink-2">{row.discussionType}</td>
                <td className="py-3 pr-3 whitespace-nowrap">{row.buzzStatus}</td>
                <td className="tnum py-3 text-[11px] leading-relaxed text-ink-3">{row.keySignals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > TABLE_PREVIEW ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 text-[12px] text-accent-ink underline underline-offset-2"
        >
          {expanded ? 'Show fewer' : `Show all ${rows.length} ranked communities`}
        </button>
      ) : null}
    </>
  )
}

function TopCommunity({ row }) {
  const { signals } = row

  return (
    <li className="rounded-[12px] border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SubredditLink name={row.name} className="text-[15px]" />
        <span className="tnum text-[12px] text-ink-3">
          {row.buzzStatus} · score {row.score}
        </span>
      </div>

      {row.title ? (
        <p className="mt-1 line-clamp-2 text-[12px] text-ink-3">{row.title}</p>
      ) : null}

      <p className="mt-2 text-[13px] text-ink-2">{row.why}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.badges.map((badge) => (
          <Badge key={badge.id} title={badge.why}>
            {badge.label}
          </Badge>
        ))}
      </div>

      <dl className="tnum mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-3 sm:grid-cols-4">
        <div>
          <dt className="text-ink-3">Threads</dt>
          <dd className="text-ink-2">{formatNumber(signals.threads)}</dd>
        </div>
        <div>
          <dt>Last 30d</dt>
          <dd className="text-ink-2">{formatNumber(signals.recent30)}</dd>
        </div>
        <div>
          <dt>Trend</dt>
          <dd className="text-ink-2">
            {signals.velocity === null ? 'not measurable' : `×${signals.velocity}`}
          </dd>
        </div>
        <div>
          <dt>Members</dt>
          <dd className="text-ink-2">
            {signals.subscribers ? formatCompact(signals.subscribers) : 'unknown'}
          </dd>
        </div>
      </dl>

      {row.examples?.length ? (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {row.examples.slice(0, 2).map((example) => (
            <li key={example.id} className="truncate text-[12px]">
              <a
                href={example.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-3 hover:text-ink hover:underline"
              >
                {example.title || '(no title)'}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function BuzzView({ company, onRefresh }) {
  const buzz = useBuzz(company)

  if (buzz.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-[13px] text-ink-3">
        Ranking communities…
      </div>
    )
  }

  if (buzz.status === 'empty' || buzz.status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] font-medium text-ink">
          {buzz.status === 'empty' ? `Nothing collected for ${company} yet` : 'Ranking failed'}
        </p>
        <p className="max-w-md text-[13px] text-ink-3">{buzz.error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[13px] text-accent-ink underline underline-offset-2"
        >
          Run a collection
        </button>
      </div>
    )
  }

  const { ranked, top, emerging, excluded, discovery, context, coverage } = buzz
  const spanDays = Math.round((coverage.newest - coverage.oldest) / 86_400_000)

  return (
    <main className="mx-auto min-h-screen max-w-[1180px] px-4 py-8 sm:px-8">
      <header className="border-b border-line pb-5">
        <h1 className="text-[20px] font-semibold text-ink">
          Where {buzz.brand} is discussed on Reddit
        </h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-3">
          {formatNumber(coverage.items)} collected items across {coverage.communities} communities,
          spanning {formatNumber(spanDays)} days. {coverage.ranked} communities ranked,{' '}
          {coverage.excluded} set aside as the wrong sense of the word. Ranked in{' '}
          {buzz.computedInMs}ms.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          <span>
            Collected {buzz.lastRunAt ? formatRelative(buzz.lastRunAt) : 'at an unknown time'}
          </span>
          {buzz.stale ? (
            <Badge className="border-amber-300 bg-amber-50 text-amber-800">
              may be out of date
            </Badge>
          ) : null}
          {buzz.contextSource === 'derived' ? (
            <Badge title="This dataset predates context-driven collection. The vocabulary was recovered from the stored posts, so ranking is sound, but the search itself never expanded along these contexts.">
              vocabulary re-derived from stored posts
            </Badge>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="text-accent-ink underline underline-offset-2"
          >
            Collect again
          </button>
        </div>
      </header>

      {}
      <Section
        title="Ranked communities"
        subtitle="Ordered by measured buzz, gated on whether the brand is genuinely the subject"
        icon={<Icon name="scale" className="h-3.5 w-3.5" />}
      >
        <RankedTable rows={ranked} />
      </Section>

      {}
      <Section
        title="Top communities"
        subtitle="Monitor these first"
        icon={<Icon name="flame" className="h-3.5 w-3.5" />}
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {top.map((row) => (
            <TopCommunity key={row.name} row={row} />
          ))}
        </ul>
      </Section>

      {}
      <Section
        title="Emerging communities"
        subtitle="Rising or newly active, worth watching before they matter"
        icon={<Icon name="spark" className="h-3.5 w-3.5" />}
      >
        {emerging.length ? (
          <ul className="divide-y divide-line">
            {emerging.map((row) => (
              <li key={row.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                <SubredditLink name={row.name} />
                <span className="tnum text-[12px] text-ink-3">
                  {row.signals.velocity !== null
                    ? `×${row.signals.velocity} vs the previous 30 days`
                    : `${row.signals.items} items, median age ${row.signals.medianAgeDays}d`}
                </span>
                <span className="text-[12px] text-ink-3">· {row.discussionType}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">
            Nothing is accelerating in this dataset. With a single collection run that is expected:
            trend velocity needs a sample reaching back past the previous 30 days, and re-running
            weekly is what makes this section meaningful.
          </p>
        )}
      </Section>

      {}
      <Section
        title="Discovery insights"
        subtitle="What a plain search for the brand name would have missed"
        icon={<Icon name="search" className="h-3.5 w-3.5" />}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
              Sides of the brand people discuss
            </h3>
            <p className="mt-1 text-[12px] text-ink-3">
              Mined from the posts themselves, then grouped by which words appear in the same
              threads. Each group got its own search, so one loud subject cannot spend the whole
              budget.
            </p>

            {context.facets?.length ? (
              <dl className="mt-3 space-y-2">
                {context.facets.map((facet) => (
                  <div key={facet.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <dt className="text-[12px] font-medium text-ink-2">{facet.label}</dt>
                    <dd className="text-[12px] text-ink-3">{facet.terms.join(' · ')}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {context.contextTerms.map((term) => (
                  <Badge
                    key={term.term}
                    title={`${term.posts} posts${
                      term.collocation !== null && term.collocation !== undefined
                        ? ` · ${Math.round(term.collocation * 100)}% of uses sit beside the brand name`
                        : ''
                    }`}
                  >
                    {term.term}
                  </Badge>
                ))}
              </div>
            )}

            {context.aliases?.length ? (
              <p className="mt-3 text-[12px] text-ink-3">
                Abbreviations found in use:{' '}
                {context.aliases.map((entry) => entry.alias).join(', ')}
              </p>
            ) : null}

            {context.geoTerms?.length ? (
              <p className="mt-2 text-[12px] text-ink-3">
                Places that came up: {context.geoTerms.join(', ')}
              </p>
            ) : null}
          </div>

          <div>
            {discovery.viaExpansion.length ? (
              <>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
                  Found only by expansion
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {discovery.viaExpansion.map((row) => (
                    <li key={row.name} className="text-[13px]">
                      <SubredditLink name={row.name} />
                      <span className="text-[12px] text-ink-3">
                        {' '}
                        - reached via {row.via.join(', ')} · rank {row.rank}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
                  Communities not named after the brand
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {discovery.nonObvious.map((row) => (
                    <li key={row.name} className="text-[13px]">
                      <SubredditLink name={row.name} />
                      <span className="text-[12px] text-ink-3">
                        {' '}
                        - rank {row.rank} · {row.discussionType}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {discovery.geographic.length ? (
              <p className="mt-3 text-[12px] text-ink-3">
                Geographic communities: {discovery.geographic.map((row) => `r/${row.name}`).join(', ')}
              </p>
            ) : null}
          </div>
        </div>
      </Section>

      {}
      {excluded.length ? (
        <Section
          title="Set aside"
          subtitle="The brand name appears, but the conversation is about something else"
          icon={<Icon name="alert" className="h-3.5 w-3.5" />}
        >
          <ul className="space-y-2">
            {excluded.map((row) => (
              <li key={row.name} className="text-[13px]">
                <SubredditLink name={row.name} />
                <span className="text-[12px] text-ink-3"> - {row.reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {}
      <Section
        title="Methodology"
        subtitle="How the ranking was produced"
        icon={<Icon name="layers" className="h-3.5 w-3.5" />}
      >
        <div className="space-y-3 text-[13px] leading-relaxed text-ink-2">
          <p>
            <strong className="font-medium text-ink">Discovery.</strong> The brand is searched by
            name (by relevance and by recency), by any abbreviation found in use, and then by
            brand × context for each mined term. Communities are also hunted by context term alone,
            and each such candidate has to prove the brand is actually discussed inside it before it
            is measured at all.
          </p>
          <p>
            <strong className="font-medium text-ink">Relevance</strong> is a gate, not a score
            component. It multiplies the result, so a large community where the name merely appears
            cannot climb. It combines two tests: whether threads use the brand's own vocabulary, and
            whether the word is written as a name rather than as an ordinary word.
          </p>
          <p>
            <strong className="font-medium text-ink">Signals are measured separately</strong> and
            combined last: volume of brand threads ({Math.round(buzz.weights.volume * 100)}%),
            recency ({Math.round(buzz.weights.recency * 100)}%), share of the community's own output
            ({Math.round(buzz.weights.brandShare * 100)}%), engagement (
            {Math.round(buzz.weights.engagement * 100)}%), trend velocity (
            {Math.round(buzz.weights.velocity * 100)}%), month-to-month consistency (
            {Math.round(buzz.weights.consistency * 100)}%), discussion depth (
            {Math.round(buzz.weights.depth * 100)}%) and community size (
            {Math.round(buzz.weights.size * 100)}%). Size is deliberately the smallest weight:
            members are not buzz.
          </p>
          <p>
            <strong className="font-medium text-ink">Unmeasurable signals are dropped</strong>,
            not guessed. Trend velocity needs a sample reaching past the previous 30 days; where it
            does not, the weights are renormalised over what is known and the table says so.
            Comments are used for depth only: they come from a sampled set of threads, so counting
            them as volume would rank whichever thread the collector happened to open.
          </p>
        </div>
      </Section>
    </main>
  )
}

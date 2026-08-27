import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'

export default function ThemesPanel({ themes, polarity, total }) {
  const isPraise = polarity === 'positive'
  const accent = isPraise ? 'text-positive-ink' : 'text-negative-ink'
  const barColor = isPraise ? 'bg-positive' : 'bg-negative'

  const peak = Math.max(...themes.map((theme) => theme.count), 1)

  return (
    <Card className="h-full">
      <CardHeader
        title={isPraise ? 'What people like' : 'What people dislike'}
        subtitle={
          isPraise
            ? 'Subjects the discussions lean positive on'
            : 'Subjects the discussions lean negative on'
        }
        icon={
          <Icon name={isPraise ? 'trendUp' : 'trendDown'} className="h-3.5 w-3.5" />
        }
      />
      <CardBody className="space-y-4">
        {themes.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-3">
            No {isPraise ? 'praise' : 'complaint'} themes in this selection.
          </p>
        ) : (
          themes.slice(0, 5).map((theme) => (
            <div key={theme.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] font-medium text-ink">{theme.label}</h3>
                <span className="tnum shrink-0 text-[12px] text-ink-3">
                  <span className={`font-semibold ${accent}`}>{theme.count}</span> of{' '}
                  {total}
                </span>
              </div>

              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className={`h-full rounded-full ${barColor} transition-[width] duration-500 ease-out`}
                  style={{ width: `${(theme.count / peak) * 100}%` }}
                />
              </div>

              {theme.opposing > 0 ? (
                <p className="tnum mt-1.5 text-[11px] text-ink-3">
                  {theme.opposing} discussion{theme.opposing === 1 ? '' : 's'} take the
                  other side
                </p>
              ) : null}

              {theme.examples[0] ? (
                <blockquote className="mt-2.5 border-l-2 border-line pl-3 text-[12px] leading-relaxed text-ink-3 italic">
                  “{theme.examples[0].quote}”
                  <cite className="mt-1 block text-[11px] not-italic text-ink-3/70">
                    r/{theme.examples[0].subreddit}
                  </cite>
                </blockquote>
              ) : null}
            </div>
          ))
        )}
      </CardBody>
    </Card>
  )
}

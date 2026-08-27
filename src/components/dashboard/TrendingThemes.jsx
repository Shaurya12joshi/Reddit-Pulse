import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import { Badge } from '../ui/Badge.jsx'

const KIND = {
  product: 'Product',
  attribute: 'Experience',
  competitor: 'Rival',
  audience: 'People',
  event: 'Event',
  issue: 'Issue',
  other: null,
}

// Frequency alone cannot tell a subject from a fragment, so the refined list
// arrives from the server. Until it does, the raw mined phrases stand in.
export default function TrendingThemes({ phrases, refined }) {
  const themes = refined?.themes?.length
    ? refined.themes
    : phrases.map((item) => ({
        label: item.phrase,
        count: item.count,
        meaning: '',
        kind: 'other',
      }))

  const pending = !refined?.themes?.length && refined?.status === 'loading'

  if (themes.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader title="Trending themes" icon={<Icon name="flame" className="h-3.5 w-3.5" />} />
        <CardBody>
          <p className="py-8 text-center text-[13px] text-ink-3">
            Not enough repeated language in this selection to detect themes.
          </p>
        </CardBody>
      </Card>
    )
  }

  const peak = Math.max(...themes.map((theme) => theme.count), 1)

  return (
    <Card className="h-full">
      <CardHeader
        title="Trending themes"
        subtitle={
          refined?.source === 'llm'
            ? 'The subjects people keep returning to, read from the discussions'
            : 'Repeated phrases mined from the raw text'
        }
        icon={<Icon name="flame" className="h-3.5 w-3.5" />}
        action={
          pending ? (
            <Badge>
              <span className="h-3 w-3 animate-spin rounded-full border border-line border-t-ink-2" />
              Refining
            </Badge>
          ) : null
        }
      />

      <CardBody>
        <ul className="space-y-3.5">
          {themes.map((theme) => (
            <li key={theme.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-medium text-ink">{theme.label}</span>
                <span className="tnum shrink-0 text-[12px] text-ink-3">{theme.count}</span>
              </div>

              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-secondary transition-[width] duration-500 ease-out"
                  style={{ width: `${(theme.count / peak) * 100}%` }}
                />
              </div>

              {theme.meaning ? (
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
                  {KIND[theme.kind] ? (
                    <span className="mr-1.5 text-ink-2">{KIND[theme.kind]}.</span>
                  ) : null}
                  {theme.meaning}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}

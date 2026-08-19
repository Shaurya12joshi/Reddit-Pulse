import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'

/**
 * Repeated words and phrases mined straight from the text — the themes the
 * fixed taxonomy would never have predicted. Size encodes frequency.
 */
export default function TrendingThemes({ phrases }) {
  if (phrases.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader
          title="Trending themes"
          icon={<Icon name="flame" className="h-3.5 w-3.5" />}
        />
        <CardBody>
          <p className="py-8 text-center text-[13px] text-ink-3">
            Not enough repeated language in this selection to detect themes.
          </p>
        </CardBody>
      </Card>
    )
  }

  const peak = phrases[0].count
  const floor = phrases[phrases.length - 1].count

  /** Map frequency onto a small, deliberate type scale. */
  const sizeFor = (count) => {
    if (peak === floor) return 'text-[13px]'
    const t = (count - floor) / (peak - floor)
    if (t > 0.75) return 'text-[16px] font-semibold'
    if (t > 0.5) return 'text-[15px] font-medium'
    if (t > 0.25) return 'text-[14px]'
    return 'text-[13px]'
  }

  return (
    <Card className="h-full">
      <CardHeader
        title="Trending themes"
        subtitle="Repeated phrases mined from the raw text"
        icon={<Icon name="flame" className="h-3.5 w-3.5" />}
      />
      <CardBody>
        <ul className="flex flex-wrap gap-2">
          {phrases.map((item) => (
            <li key={item.phrase}>
              <span
                className={`inline-flex items-center gap-2 rounded-lg border border-line bg-elevated px-3 py-1.5 text-ink-2 transition-colors hover:border-line-strong hover:text-ink ${sizeFor(
                  item.count,
                )}`}
              >
                {item.phrase}
                <span className="tnum rounded bg-raised px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
                  {item.count}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}

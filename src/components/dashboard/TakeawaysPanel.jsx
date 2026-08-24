import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'

const TONE_STYLES = {
  positive: { icon: 'trendUp', className: 'text-positive-ink bg-positive/10 border-positive/20' },
  negative: { icon: 'trendDown', className: 'text-negative-ink bg-negative/10 border-negative/20' },
  neutral: { icon: 'layers', className: 'text-ink-2 bg-elevated border-line' },
}

export default function TakeawaysPanel({ takeaways }) {
  return (
    <Card>
      <CardHeader
        title="Key takeaways"
        subtitle="Generated from the aggregates below"
        icon={<Icon name="spark" className="h-3.5 w-3.5" />}
      />
      <CardBody className="space-y-3">
        {takeaways.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-3">
            Not enough data in the current selection to summarise.
          </p>
        ) : (
          takeaways.map((item) => {
            const tone = TONE_STYLES[item.tone] || TONE_STYLES.neutral
            return (
              <div key={item.id} className="flex gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${tone.className}`}
                >
                  <Icon name={tone.icon} className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                    {item.body}
                  </p>
                </div>
              </div>
            )
          })
        )}

        <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-ink-3">
          These statements are assembled deterministically from the counts and
          scores in this report, so every claim traces back to the data on this
          page.
        </p>
      </CardBody>
    </Card>
  )
}

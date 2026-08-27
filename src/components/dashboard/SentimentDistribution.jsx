import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import DonutChart from '../charts/DonutChart.jsx'
import { SENTIMENT_SERIES } from '../../utils/chartColors.js'

export default function SentimentDistribution({ sentiment }) {
  return (
    <Card>
      <CardHeader
        title="Sentiment distribution"
        subtitle="Share of all analysed discussions"
        icon={<Icon name="spark" className="h-3.5 w-3.5" />}
      />
      <CardBody>
        <DonutChart
          total={sentiment.total}
          centerLabel="discussions"
          segments={SENTIMENT_SERIES.map((series) => ({
            ...series,
            value: sentiment[series.key],
          }))}
        />
      </CardBody>
    </Card>
  )
}

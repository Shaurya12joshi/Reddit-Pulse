import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import DivergingBars from '../charts/DivergingBars.jsx'

/** Topic taxonomy view. Clicking a row filters the whole dashboard by it. */
export default function TopicPanel({ topics, activeTopic, onSelectTopic }) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Topic analysis"
        subtitle="Click a topic to filter the entire report"
        icon={<Icon name="layers" className="h-3.5 w-3.5" />}
      />
      <CardBody>
        <DivergingBars
          items={topics.slice(0, 9).map((topic) => ({
            id: topic.id,
            label: topic.label,
            positive: topic.positive,
            negative: topic.negative,
          }))}
          activeId={activeTopic === 'all' ? null : activeTopic}
          onSelect={(id) => onSelectTopic(id || 'all')}
        />
      </CardBody>
    </Card>
  )
}

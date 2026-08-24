import Select from '../ui/Select.jsx'
import Icon from '../ui/Icon.jsx'
import { formatNumber } from '../../utils/format.js'
import { DEFAULT_FILTERS, TIME_RANGES } from './filterOptions.js'

export default function FilterBar({
  filters,
  onChange,
  subredditOptions,
  topicOptions,
  resultCount,
  totalCount,
}) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value })
  const isFiltered = Object.keys(DEFAULT_FILTERS).some(
    (key) => filters[key] !== DEFAULT_FILTERS[key],
  )

  return (
    <div className="sticky top-14 z-20 -mx-5 border-b border-line bg-canvas/85 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Period"
          value={filters.timeRange}
          onChange={set('timeRange')}
          options={TIME_RANGES}
          className="w-[132px]"
        />
        <Select
          label="Subreddit"
          value={filters.subreddit}
          onChange={set('subreddit')}
          options={[
            { value: 'all', label: 'All subreddits' },
            ...subredditOptions.map((sub) => ({
              value: sub.name,
              label: `r/${sub.name} (${sub.count})`,
            })),
          ]}
          className="w-[178px]"
        />
        <Select
          label="Sentiment"
          value={filters.sentiment}
          onChange={set('sentiment')}
          options={[
            { value: 'all', label: 'All sentiment' },
            { value: 'positive', label: 'Positive only' },
            { value: 'neutral', label: 'Neutral only' },
            { value: 'negative', label: 'Negative only' },
          ]}
          className="w-[150px]"
        />
        <Select
          label="Topic"
          value={filters.topic}
          onChange={set('topic')}
          options={[
            { value: 'all', label: 'All topics' },
            ...topicOptions.map((topic) => ({
              value: topic.id,
              label: `${topic.label} (${topic.count})`,
            })),
          ]}
          className="w-[196px]"
        />

        <div className="ml-auto flex items-center gap-3 pb-0.5">
          <span className="tnum text-[12px] text-ink-3">
            <span className="font-semibold text-ink">{formatNumber(resultCount)}</span>{' '}
            of {formatNumber(totalCount)} discussions
          </span>
          {isFiltered ? (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              <Icon name="close" className="h-3 w-3" />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

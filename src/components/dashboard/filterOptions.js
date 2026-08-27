export const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export const POST_TYPES = [
  { value: 'all', label: 'Posts & comments' },
  { value: 'post', label: 'Posts only' },
  { value: 'comment', label: 'Comments only' },
]

export const DEFAULT_FILTERS = {
  timeRange: 'all',
  subreddit: 'all',
  sentiment: 'all',
  topic: 'all',
}

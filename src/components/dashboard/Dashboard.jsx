import { useState } from 'react'
import { useReport } from '../../hooks/useReport.js'

import FilterBar from './FilterBar.jsx'
import { DEFAULT_FILTERS } from './filterOptions.js'
import CompanyOverview from './CompanyOverview.jsx'
import StatTiles from './StatTiles.jsx'
import TakeawaysPanel from './TakeawaysPanel.jsx'
import SentimentDistribution from './SentimentDistribution.jsx'
import TopicPanel from './TopicPanel.jsx'
import TrendingThemes from './TrendingThemes.jsx'
import ThemesPanel from './ThemesPanel.jsx'
import CompetitorPanel from './CompetitorPanel.jsx'
import SubredditPanel from './SubredditPanel.jsx'
import DiscussionsPanel from './DiscussionsPanel.jsx'
import PostDetailModal from './PostDetailModal.jsx'

import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import SentimentTrendChart from '../charts/SentimentTrendChart.jsx'
import VolumeChart from '../charts/VolumeChart.jsx'

/**
 * The report.
 *
 * Filtering and aggregation happen on the server — this component asks for a
 * finished report whenever the filters change and renders the result. Nothing
 * is scored in the browser, so it stays responsive however large the dataset
 * grows.
 */
export default function Dashboard({ company, meta, onRefresh }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedPost, setSelectedPost] = useState(null)

  const report = useReport(company, filters)

  if (report.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
      </main>
    )
  }

  if (report.status === 'error') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] font-medium text-ink">Couldn't build the report</p>
        <p className="max-w-sm text-[13px] text-ink-3">{report.error}</p>
      </main>
    )
  }

  const { insights, filterOptions, posts, total, totalUnfiltered, nextOffset, loadMore } = report
  const hasResults = total > 0

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-20 sm:px-8">
      <div className="pt-8">
        <CompanyOverview
          company={company}
          insights={insights}
          meta={meta}
          onRefresh={onRefresh}
        />
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        subredditOptions={filterOptions.subreddits}
        topicOptions={filterOptions.topics}
        resultCount={total}
        totalCount={totalUnfiltered}
      />

      {!hasResults ? (
        <div className="animate-fade-up mt-16 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-3">
            <Icon name="filter" className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-ink">
            No discussions match these filters
          </h2>
          <p className="mt-1.5 max-w-sm text-[13px] text-ink-3">
            Try widening the time period or clearing the subreddit, sentiment
            and topic filters.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-5"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            Clear all filters
          </Button>
        </div>
      ) : (
        <div className="animate-fade-up mt-7 space-y-4">
          <StatTiles insights={insights} />

          {/* summary + distribution */}
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <TakeawaysPanel takeaways={insights.takeaways} />
            </div>
            <div className="xl:col-span-5">
              <SentimentDistribution sentiment={insights.sentiment} />
            </div>
          </div>

          {/* time series */}
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <Card className="h-full">
                <CardHeader
                  title="Sentiment over time"
                  subtitle={`Average score per ${insights.timeline.granularity}`}
                  icon={<Icon name="trendUp" className="h-3.5 w-3.5" />}
                />
                <CardBody className="px-2 pb-3">
                  <SentimentTrendChart
                    buckets={insights.timeline.buckets}
                    granularity={insights.timeline.granularity}
                  />
                </CardBody>
              </Card>
            </div>
            <div className="xl:col-span-5">
              <Card className="h-full">
                <CardHeader
                  title="Discussion volume"
                  subtitle="Mentions per period, stacked by sentiment"
                  icon={<Icon name="chat" className="h-3.5 w-3.5" />}
                />
                <CardBody className="px-2 pb-3">
                  <VolumeChart
                    buckets={insights.timeline.buckets}
                    granularity={insights.timeline.granularity}
                  />
                </CardBody>
              </Card>
            </div>
          </div>

          {/* topics */}
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <TopicPanel
                topics={insights.topics}
                activeTopic={filters.topic}
                onSelectTopic={(topic) => setFilters({ ...filters, topic })}
              />
            </div>
            <div className="xl:col-span-5">
              <TrendingThemes phrases={insights.trending} />
            </div>
          </div>

          {/* praise vs complaints */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ThemesPanel
              themes={insights.praise}
              polarity="positive"
              total={insights.totals.mentions}
            />
            <ThemesPanel
              themes={insights.complaints}
              polarity="negative"
              total={insights.totals.mentions}
            />
          </div>

          {/* competitors + communities */}
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <CompetitorPanel
                competitors={insights.competitors}
                company={company}
                market={insights.market}
              />
            </div>
            <div className="xl:col-span-4">
              <SubredditPanel
                subreddits={insights.subreddits}
                activeSubreddit={filters.subreddit}
                onSelect={(subreddit) => setFilters({ ...filters, subreddit })}
              />
            </div>
          </div>

          {/* raw discussions — paged in from the server rather than all at once */}
          <DiscussionsPanel
            posts={posts}
            topDiscussions={insights.topDiscussions}
            onOpenPost={setSelectedPost}
          />

          {nextOffset ? (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" size="sm" onClick={loadMore}>
                Load more — {posts.length} of {total}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <PostDetailModal
        post={selectedPost}
        open={Boolean(selectedPost)}
        onClose={() => setSelectedPost(null)}
      />
    </main>
  )
}

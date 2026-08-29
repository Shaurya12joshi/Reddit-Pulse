import { useState } from 'react'
import { useReport } from '../../hooks/useReport.js'

import FilterBar from './FilterBar.jsx'
import Section from './Section.jsx'
import { DEFAULT_FILTERS } from './filterOptions.js'
import CompanyOverview from './CompanyOverview.jsx'
import StatTiles from './StatTiles.jsx'
import TakeawaysPanel from './TakeawaysPanel.jsx'
import TopicPanel from './TopicPanel.jsx'
import TrendingThemes from './TrendingThemes.jsx'
import ThemesPanel from './ThemesPanel.jsx'
import CompetitorPanel from './CompetitorPanel.jsx'
import NamedComparisonPanel from './NamedComparisonPanel.jsx'
import ProductComparisonPanel from './ProductComparisonPanel.jsx'
import FieldPanel from './FieldPanel.jsx'
import RedditVoicePanel from './RedditVoicePanel.jsx'
import SubredditPanel from './SubredditPanel.jsx'
import DiscussionsPanel from './DiscussionsPanel.jsx'
import PostDetailModal from './PostDetailModal.jsx'

import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import SentimentTrendChart from '../charts/SentimentTrendChart.jsx'
import VolumeChart from '../charts/VolumeChart.jsx'
import { useComparisons } from '../../hooks/useComparisons.js'
import { useNamedComparison } from '../../hooks/useNamedComparison.js'
import { useProductComparison } from '../../hooks/useProductComparison.js'
import { useField } from '../../hooks/useField.js'
import { useVoice } from '../../hooks/useVoice.js'
import { useTrending } from '../../hooks/useTrending.js'

export default function Dashboard({
  company,
  meta,
  onRefresh,
  compareWith = '',
  askedSubject = '',
  rivalProduct = '',
  keywords = '',
}) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedPost, setSelectedPost] = useState(null)

  const report = useReport(company, filters)
  const comparisons = useComparisons(company)
  const named = useNamedComparison(company, compareWith)
  const productPair = useProductComparison(company, askedSubject, rivalProduct, compareWith)
  const field = useField(company, keywords)
  const voice = useVoice(company, askedSubject)
  const trending = useTrending(company)

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

  const { insights, filterOptions, posts, total, totalUnfiltered, fieldOnly, loadMore } = report
  const hasResults = total > 0

  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 pb-24 sm:px-8">
      <div className="pt-16">
        {fieldOnly ? (
          <div className="mb-5 flex items-start gap-2.5 rounded-[12px] border border-highlight/40 bg-highlight/15 px-4 py-3">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-highlight-ink" />
            <p className="text-[13px] leading-relaxed text-highlight-ink">
              No Reddit thread mentions {company} itself yet. Everything below is the field around
              it, collected from your keywords: the numbers describe the market, not the company.
            </p>
          </div>
        ) : null}

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
        <div className="animate-fade-up mt-8 space-y-12">
          <Section
            title="At a glance"
            description="The headline numbers, and what the discussions add up to."
          >
            <StatTiles insights={insights} />

            <TakeawaysPanel takeaways={insights.takeaways} />
          </Section>

          {keywords ? (
            <Section
              title={field?.map?.field ? `The ${field.map.field} field` : 'Your field'}
              description="Mapped from your keywords, then read from the discussions collected about it."
            >
              <FieldPanel keywords={keywords} result={field} />
            </Section>
          ) : null}

          {askedSubject ? (
            <Section
              title={`Your product: ${voice?.focus?.subject || askedSubject}`}
              description="What the collected discussions say about the product or service you named."
            >
              <RedditVoicePanel company={company} asked={askedSubject} result={voice} />
            </Section>
          ) : null}

          <Section
            title="Movement over time"
            description={`Tone and volume per ${insights.timeline.granularity}.`}
          >
            <div className="grid items-start gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <Card>
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
                <Card>
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
          </Section>

          <Section
            title="What people talk about"
            description="The subjects that keep coming back, and what is said about them."
          >
            <div className="grid items-start gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <TopicPanel
                  topics={insights.topics}
                  activeTopic={filters.topic}
                  onSelectTopic={(topic) => setFilters({ ...filters, topic })}
                />
              </div>
              <div className="xl:col-span-5">
                <TrendingThemes phrases={insights.trending} refined={trending} />
              </div>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-2">
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
          </Section>

          <Section
            title="Competition"
            description="Who gets named alongside you, and where the talk happens."
          >

            {compareWith ? (
              <NamedComparisonPanel company={company} requested={compareWith} result={named} />
            ) : null}

            {askedSubject && (rivalProduct || compareWith) ? (
              <ProductComparisonPanel
                requested={{ mine: askedSubject, theirs: rivalProduct || compareWith }}
                result={productPair}
              />
            ) : null}

            <div className="grid items-start gap-4 xl:grid-cols-12">
              <div className="xl:col-span-8">
                <CompetitorPanel
                  competitors={insights.competitors}
                  company={company}
                  market={insights.market}
                  comparisons={comparisons}
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
          </Section>

          <Section
            title="The discussions themselves"
            description="Every number above traces back to these threads."
          >
            <DiscussionsPanel
              key={`${filters.timeRange}-${filters.subreddit}-${filters.sentiment}-${filters.topic}`}
              posts={posts}
              topDiscussions={insights.topDiscussions}
              onOpenPost={setSelectedPost}
              hasMore={posts.length < total}
              onLoadMore={loadMore}
            />
          </Section>
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

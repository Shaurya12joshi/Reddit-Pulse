import { lazy, Suspense, useState } from 'react'
import Reveal from './Reveal.jsx'
import Icon from '../ui/Icon.jsx'
import { Card, CardBody, CardHeader } from '../ui/Card.jsx'
import SentimentDistribution from '../dashboard/SentimentDistribution.jsx'
import TopicPanel from '../dashboard/TopicPanel.jsx'
import ThemesPanel from '../dashboard/ThemesPanel.jsx'
import CompetitorPanel from '../dashboard/CompetitorPanel.jsx'
import PostCard from '../dashboard/PostCard.jsx'
import PostDetailModal from '../dashboard/PostDetailModal.jsx'
import VolumeChart from '../charts/VolumeChart.jsx'
import { usePreviewReport } from '../../data/previewReport.js'
import useInView from '../../hooks/useInView.js'
import useEnvironment from '../../experience/useEnvironment.js'

const ReportCanvas = lazy(() => import('../../experience/report/ReportCanvas.jsx'))

export default function ProductPreviewSection() {
  const [activeTopic, setActiveTopic] = useState('all')
  const [selectedPost, setSelectedPost] = useState(null)
  const preview = usePreviewReport()
  const [sceneRef, sceneInView] = useInView({ threshold: 0.12 })
  const { ready, webgl, reducedMotion, mobile } = useEnvironment()

  if (preview.status !== 'ready') return null

  const { company, insights, posts } = preview
  const { sentiment, topics, praise, complaints, competitors, market, timeline, totals } =
    insights

  const filteredTopics =
    activeTopic === 'all'
      ? topics
      : topics.filter((topic) => topic.id === activeTopic)

  const spotlightPosts = posts.slice(0, 2)
  const immersive = ready && webgl && !reducedMotion && !mobile

  return (
    <section id="preview" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 sm:px-10">
      <Reveal className="grid gap-8 border-t border-line pt-14 lg:grid-cols-[1fr_1fr] lg:items-end">
        <div>
          <span className="eyebrow flex items-center gap-2 text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Live report: {company}
          </span>
          <h2 className="display mt-6 text-[11vw] text-ink sm:text-5xl lg:text-[3.6vw]">
            The end of the journey is a <em className="display-serif">real</em>{' '}
            report.
          </h2>
        </div>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-2 lg:pb-3">
          Everything below is a real report built from real Reddit threads,
          not a screenshot, not sample data.{' '}
          {immersive
            ? 'Every bar is a measurement: column height is share of mentions, colour is how that subject is going, and distance from the centre is how often a rival gets named alongside.'
            : 'Click a topic to filter it, open a competitor to read why people compared them, or open a discussion to see exactly which words drove its score.'}
        </p>
      </Reveal>

      {immersive ? (
        <>
          <div
            ref={sceneRef}
            className="relative mt-12 h-[70vh] min-h-[460px] w-full lg:h-[78vh]"
          >
            <Suspense fallback={null}>
              <ReportCanvas
                insights={insights}
                company={company}
                active={sceneInView}
              />
            </Suspense>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas via-transparent to-canvas"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Reveal>
              <ThemesPanel themes={praise} polarity="positive" total={totals.mentions} />
            </Reveal>
            <Reveal delayMs={60}>
              <ThemesPanel themes={complaints} polarity="negative" total={totals.mentions} />
            </Reveal>
          </div>

          <Reveal className="mt-4">
            <Card>
              <CardHeader
                title="Representative discussions"
                subtitle="Every measurement above traces back to real threads like these"
                icon={<Icon name="quote" className="h-3.5 w-3.5" />}
              />
              <CardBody className="grid gap-1 p-2 sm:grid-cols-2 sm:divide-x sm:divide-line">
                {spotlightPosts.map((post) => (
                  <PostCard key={post.id} post={post} onOpen={setSelectedPost} />
                ))}
              </CardBody>
            </Card>
          </Reveal>
        </>
      ) : (
        <div className="mt-12 space-y-4">
          <div className="grid gap-4 xl:grid-cols-12">
            <Reveal className="xl:col-span-7">
              <TopicPanel
                topics={filteredTopics.length ? filteredTopics : topics}
                activeTopic={activeTopic}
                onSelectTopic={setActiveTopic}
              />
            </Reveal>
            <Reveal delayMs={60} className="xl:col-span-5">
              <SentimentDistribution sentiment={sentiment} />
            </Reveal>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal>
              <ThemesPanel themes={praise} polarity="positive" total={totals.mentions} />
            </Reveal>
            <Reveal delayMs={60}>
              <ThemesPanel themes={complaints} polarity="negative" total={totals.mentions} />
            </Reveal>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <Reveal className="xl:col-span-8">
              <CompetitorPanel
                competitors={competitors}
                company={company}
                market={market}
              />
            </Reveal>
            <Reveal delayMs={60} className="xl:col-span-4">
              <Card className="h-full">
                <CardHeader
                  title="Discussion volume"
                  subtitle="Mentions per period, stacked by sentiment"
                  icon={<Icon name="chat" className="h-3.5 w-3.5" />}
                />
                <CardBody className="px-2 pb-3">
                  <VolumeChart
                    buckets={timeline.buckets}
                    granularity={timeline.granularity}
                  />
                </CardBody>
              </Card>
            </Reveal>
          </div>

          <Reveal>
            <Card>
              <CardHeader
                title="Representative discussions"
                subtitle="Every insight above traces back to real threads like these"
                icon={<Icon name="quote" className="h-3.5 w-3.5" />}
              />
              <CardBody className="grid gap-1 p-2 sm:grid-cols-2 sm:divide-x sm:divide-line">
                {spotlightPosts.map((post) => (
                  <PostCard key={post.id} post={post} onOpen={setSelectedPost} />
                ))}
              </CardBody>
            </Card>
          </Reveal>
        </div>
      )}

      <PostDetailModal
        post={selectedPost}
        open={Boolean(selectedPost)}
        onClose={() => setSelectedPost(null)}
      />
    </section>
  )
}

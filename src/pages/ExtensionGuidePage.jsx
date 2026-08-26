import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import Icon from '../components/ui/Icon.jsx'
import Celebrate from '../components/extension/Celebrate.jsx'
import CopyLine from '../components/extension/CopyLine.jsx'
import VoteRail from '../components/extension/VoteRail.jsx'
import PinnedActs from '../components/extension/PinnedActs.jsx'
import ScatterText from '../components/extension/ScatterText.jsx'
import RunThread from '../components/extension/RunThread.jsx'
import Stage from '../components/extension/Stage.jsx'
import SceneBoundary from '../experience/SceneBoundary.jsx'
import useEnvironment from '../experience/useEnvironment.js'
import { EXTENSION_REPO_URL, EXTENSION_ZIP_URL } from '../services/links.js'

const FeedScene = lazy(() => import('../components/extension/FeedScene.jsx'))

const DONE_KEY = 'reddit-pulse.install-steps'

function attemptRead() {
  try {
    const raw = window.localStorage.getItem(DONE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function attemptWrite(value) {
  try {
    window.localStorage.setItem(DONE_KEY, JSON.stringify([...value]))
  } catch {
    return
  }
}

const STEP_COUNT = 10

const ORANGE = '#ff4500'
const ORANGE_INK = '#c23a06'


function useSceneDrivers(active) {
  const progress = useRef(0)
  const pointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!active) return undefined

    let frame = null

    const read = () => {
      frame = null
      const travel = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      progress.current = Math.min(1, Math.max(0, window.scrollY / travel))
    }

    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(read)
    }

    const onPointerMove = (event) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      }
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('pointermove', onPointerMove)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [active])

  return { progress, pointer }
}

function Step({ number, title, children, immersive, done, onToggle }) {
  return (
    <li className="relative pb-4 last:pb-0">
      <Stage variant="flat" active={immersive} parallax={0.5}>
        <div
          className={`relative flex gap-3 rounded-[10px] border bg-surface/85 p-3.5 backdrop-blur-sm transition-colors ${
            done ? 'border-[#ff4500]/45' : 'border-line hover:border-line-strong'
          }`}
        >
          <VoteRail
            score={done ? number * 7 + 12 : number * 7 + 11}
            voted={done}
            onVote={onToggle}
            label={`step ${number}`}
          />

          <div className={`min-w-0 flex-1 transition-opacity ${done ? 'opacity-55' : ''}`}>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
              <span className="font-semibold text-ink-2">u/collector</span>
              <span aria-hidden="true">·</span>
              <span>step {number} of {STEP_COUNT}</span>
              {done ? (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
                  style={{ backgroundColor: '#ffe9df', color: ORANGE_INK }}
                >
                  Done
                </span>
              ) : null}
            </p>
            <h3 className="mt-1 text-[15.5px] font-semibold text-ink">{title}</h3>
            <div className="mt-2 space-y-2.5 text-[14px] leading-relaxed text-ink-2">{children}</div>
          </div>
        </div>
      </Stage>
    </li>
  )
}

function Code({ children }) {
  return (
    <code className="rounded-md border border-line bg-elevated/85 px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
      {children}
    </code>
  )
}

function Block({ children }) {
  return (
    <pre className="overflow-x-auto rounded-[10px] border border-ink bg-ink/95 px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-canvas">
      {children}
    </pre>
  )
}

function Arrows({ count = 3 }) {
  const shades = ['#ffb199', '#ff8352', '#ff4500']
  return (
    <span className="inline-flex items-end gap-0.5 align-middle">
      {shades.slice(0, count).map((shade, index) => (
        <svg
          key={shade}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-3 w-3"
          style={{ color: shade, transform: `translateY(${index * -1.5}px)` }}
          fill="currentColor"
        >
          <path d="M12 3.5 21 13h-5v7.5H8V13H3z" />
        </svg>
      ))}
    </span>
  )
}

function ActTitle({ eyebrow, children }) {
  return (
    <>
      <p className="enter enter-pop eyebrow flex items-center gap-2.5 text-ink-3" style={{ '--i': 0 }}>
        {eyebrow}
        <Arrows count={3} />
      </p>
      <h2
        className="enter enter-drop display mt-4 max-w-[16ch] text-[10vw] text-ink sm:text-[6.4vw] lg:text-[4.2vw]"
        style={{ '--i': 1, '--stagger': 0.12 }}
      >
        {children}
      </h2>
    </>
  )
}

function Bullet({ index, title, body, order = 0, dir = 1 }) {
  return (
    <li
      style={{ '--i': order, '--dir': dir }}
      className="enter enter-side flex gap-4 rounded-[14px] border border-line bg-surface/80 p-4 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 motion-reduce:hover:translate-y-0"
    >
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-medium"
        style={{ backgroundColor: '#ffe9df', color: ORANGE_INK }}
      >
        {index}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-[13.5px] leading-relaxed text-ink-3">{body}</span>
      </span>
    </li>
  )
}

export default function ExtensionGuidePage() {
  const { ready, webgl, reducedMotion, mobile } = useEnvironment()
  const [sceneFailed, setSceneFailed] = useState(false)
  const immersive = ready && webgl && !reducedMotion && !sceneFailed
  const { progress, pointer } = useSceneDrivers(immersive)
  const [done, setDone] = useState(() => {
    const stored = attemptRead()
    return stored instanceof Set ? stored : new Set()
  })

  const [party, setParty] = useState(0)

  const stepProps = (number) => ({
    immersive,
    done: done.has(number),
    onToggle: () =>
      setDone((current) => {
        const next = new Set(current)
        if (next.has(number)) next.delete(number)
        else next.add(number)
        attemptWrite(next)
        if (next.size === STEP_COUNT && current.size < STEP_COUNT) setParty(Date.now())
        return next
      }),
  })

  const acts = [
    {
      id: 'intro',
      label: 'The collector',
      render: (
        <div>
          <p className="eyebrow flex items-center gap-2.5 text-ink-3">
            Browser extension
            <Arrows />
          </p>
          <h1 className="display mt-4 max-w-[14ch] text-[13vw] text-ink sm:text-[8vw] lg:text-[5.4vw]">
            <ScatterText text="The " />
            <ScatterText text="collector" serif="display-serif" start={4} />
          </h1>
          <p
            className="enter enter-drop mt-6 max-w-md text-[16px] leading-relaxed text-ink-2"
            style={{ '--i': 7 }}
          >
            A small add-on for your browser. It reads public Reddit discussions about the company
            you search for and hands them to Reddit Pulse, which does the analysis. Two minutes to
            install, no account needed.
          </p>
          <div className="enter enter-drop mt-8 flex flex-wrap gap-2.5" style={{ '--i': 9 }}>
            <a
              href={EXTENSION_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: ORANGE }}
            >
              <Icon name="github" className="h-4 w-4" strokeWidth={1.7} />
              Get the files
            </a>
            <a
              href="#install"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface/80 px-4 py-2.5 text-[14px] font-medium text-ink backdrop-blur transition-colors hover:border-ink"
            >
              Jump to the steps
            </a>
          </div>
        </div>
      ),
    },
    {
      id: 'why',
      label: 'Why',
      render: (
        <div>
          <ActTitle eyebrow="Why it exists">
            Reddit will not let a website read <em className="display-serif">for you</em>
          </ActTitle>
          <p
            className="enter enter-drop mt-6 max-w-lg text-[15.5px] leading-relaxed text-ink-2"
            style={{ '--i': 2 }}
          >
            So the collector reads from your own browser instead, using the session you are already
            signed in with.
          </p>
          <ul className="mt-8 grid max-w-3xl gap-2.5 sm:grid-cols-3">
            <Bullet index="01" title="No account" body="No API keys, no signup, no payment." order={0} dir={-1} />
            <Bullet index="02" title="Public only" body="What anyone can see. It never posts or votes." order={1} dir={1} />
            <Bullet index="03" title="Polite" body="Watches Reddit's limits and slows down instead." order={2} dir={-1} />
          </ul>
        </div>
      ),
    },
    {
      id: 'flow',
      label: 'How',
      render: (
        <div>
          <ActTitle eyebrow="How it works">
            You search. It <em className="display-serif">fetches</em>.
          </ActTitle>
          <ol className="mt-8 grid gap-2.5 sm:grid-cols-5">
            {[
              ['You search', 'Type a company and press Analyze.'],
              ['The site asks', 'The page signals the collector.'],
              ['It reads Reddit', 'Discussions, and the replies underneath.'],
              ['It sends back', 'To Reddit Pulse. Nowhere else.'],
              ['You get a report', 'Filtered, scored and charted.'],
            ].map(([title, copy], index) => (
              <li
                key={title}
                style={{ '--i': index }}
                className="enter enter-strip rounded-[14px] border border-line bg-surface/80 p-4 backdrop-blur-sm"
              >
                <span className="font-mono text-[11px] font-medium" style={{ color: ORANGE }}>
                  0{index + 1}
                </span>
                <h3 className="mt-1.5 text-[14px] font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      ),
    },
    {
      id: 'scale',
      label: 'One run',
      render: (
        <div>
          <ActTitle eyebrow="One collection">
            About thirty discussions, <em className="display-serif">read properly</em>
          </ActTitle>
          <div className="mt-8 max-w-3xl">
            <RunThread assemble />
          </div>
        </div>
      ),
    },
  ]


  return (
    <div className="relative min-h-dvh bg-canvas text-ink">
      <Celebrate token={party} />
      {immersive ? (
        <div className="pointer-events-none fixed inset-0 z-0">
          <SceneBoundary onFail={() => setSceneFailed(true)}>
            <Suspense fallback={null}>
              <FeedScene progress={progress} pointer={pointer} />
            </Suspense>
          </SceneBoundary>
          <div className="absolute inset-0 bg-canvas/60" />
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Icon name="chevronRight" className="h-3.5 w-3.5 rotate-180 text-ink-3" />
            Reddit Pulse
          </Link>
          <a
            href={EXTENSION_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-canvas transition-colors hover:bg-ink-2"
          >
            <Icon name="github" className="h-4 w-4" strokeWidth={1.7} />
            View source
          </a>
        </div>
      </header>

      {immersive ? (
        <PinnedActs acts={acts} mobile={mobile} />
      ) : (
        <section className="relative z-10 border-b border-line">
          <div className="mx-auto w-full max-w-5xl space-y-16 px-5 pt-20 pb-20">
            {acts.map((act) => (
              <div key={act.id}>{act.render}</div>
            ))}
          </div>
        </section>
      )}

      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-24">
        <Stage variant="swing" active={immersive} className="mt-24">
          <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">
            Why it exists
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Reddit does not let a website read discussions on a visitor&rsquo;s behalf. The
            collector solves that by reading Reddit from your own browser, using the session you are
            already signed in with. Nothing else changes: you search on the website, and the
            collector fetches in the background.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ['check', 'No account needed', 'No API keys, no signup, no payment. Your existing Reddit login is enough.'],
              ['eye', 'Public posts only', 'It reads what anyone can see on Reddit. It never posts, votes or comments.'],
              ['clock', 'Polite by design', 'It watches Reddit’s limits and slows down instead of getting your browser blocked.'],
            ].map(([icon, title, body]) => (
              <div key={title} className="rounded-[14px] border border-line bg-surface/80 p-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 motion-reduce:hover:translate-y-0">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: '#ffe9df', color: ORANGE_INK }}
                >
                  <Icon name={icon} className="h-4 w-4" />
                </span>
                <h3 className="mt-3 text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{body}</p>
              </div>
            ))}
          </div>
        </Stage>

        <Stage variant="lift" active={immersive} className="mt-24">
          <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">
            How it works
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            You never open the collector yourself. The website asks it to work when you search.
          </p>

          <ol className="mt-7 grid gap-2.5 sm:grid-cols-5">
            {[
              ['You search', 'Type a company on Reddit Pulse and press Analyze.'],
              ['The site asks', 'The page signals the collector that it needs data.'],
              ['It reads Reddit', 'Searches, opens discussions, reads the replies underneath.'],
              ['It sends back', 'Collected posts go to Reddit Pulse. Nowhere else.'],
              ['You get a report', 'The site filters, scores and charts what came back.'],
            ].map(([title, body], index) => (
              <li key={title} className="rounded-[14px] border border-line bg-surface/80 p-4 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 motion-reduce:hover:translate-y-0">
                <span
                  className="font-mono text-[11px] font-medium"
                  style={{ color: index === 4 ? ORANGE_INK : ORANGE }}
                >
                  0{index + 1}
                </span>
                <h3 className="mt-1.5 text-[14px] font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6">
            <RunThread />
          </div>
        </Stage>

        <Stage variant="deck" active={immersive} className="mt-24 scroll-mt-24">
          <div id="install">
            <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">
              Install it
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
              Works in Chrome, Edge, Brave and other Chromium browsers. Not Safari or Firefox.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4 rounded-[14px] border border-line bg-surface/80 px-5 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <Icon name="arrowUp" className="h-4 w-4" strokeWidth={2.4} style={{ color: ORANGE }} />
                <p className="text-[13.5px] text-ink-2">
                  <span className="font-medium text-ink">Upvote each step</span> as you finish it.
                  This device remembers where you got to.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-raised">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${(done.size / STEP_COUNT) * 100}%`,
                      backgroundColor: ORANGE,
                    }}
                  />
                </div>
                <span className="tnum text-[12px] font-medium text-ink-3">
                  {done.size} / {STEP_COUNT}
                </span>
              </div>
            </div>

            {done.size === STEP_COUNT ? (
              <div
                className="animate-fade-up mt-4 flex flex-wrap items-center gap-3 rounded-[14px] border px-5 py-4"
                style={{ borderColor: ORANGE, backgroundColor: '#ffe9df' }}
              >
                <Icon name="check" className="h-5 w-5" style={{ color: ORANGE_INK }} />
                <p className="text-[14px] font-medium" style={{ color: ORANGE_INK }}>
                  Installed, and every step upvoted. Go and search a company.
                </p>
                <Link
                  to="/#analyze"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-white"
                  style={{ backgroundColor: ORANGE }}
                >
                  Open Reddit Pulse
                  <Icon name="chevronRight" className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : null}

            <ol className="mt-9">
              <Step {...stepProps('1')} number="1" title="Download the files">
                <p>
                  Open the{' '}
                  <a
                    href={EXTENSION_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2"
                    style={{ color: ORANGE_INK }}
                  >
                    extension page on GitHub
                  </a>
                  . Click the green <strong className="font-semibold text-ink">Code</strong> button
                  near the top right, then{' '}
                  <strong className="font-semibold text-ink">Download ZIP</strong>. Or use the{' '}
                  <a
                    href={EXTENSION_ZIP_URL}
                    className="font-medium underline underline-offset-2"
                    style={{ color: ORANGE_INK }}
                  >
                    direct download link
                  </a>
                  .
                </p>
              </Step>

              <Step {...stepProps('2')} number="2" title="Unzip it">
                <p>
                  Double-click the downloaded file. You get a folder called{' '}
                  <Code>Reddit-Scraper-Extension-main</Code>. Keep it somewhere you will not delete
                  by accident, such as Documents.
                </p>
              </Step>

              <Step {...stepProps('3')} number="3" title="Know which folder to pick">
                <p>
                  That unzipped folder <em>is</em> the extension. You will select the folder itself
                  in a moment, not anything inside it.
                </p>
                <Block>{`Downloads/
└── Reddit-Scraper-Extension-main/   ← this folder
    ├── manifest.json
    ├── background.js
    └── popup.html`}</Block>
              </Step>

              <Step {...stepProps('4')} number="4" title="Open your browser's extensions page">
                <p className="flex flex-wrap items-center gap-2">
                  Paste this into the address bar and press Enter:
                  <CopyLine value="chrome://extensions" label="the extensions address" />
                </p>
                <p>
                  In Edge it is <Code>edge://extensions</Code>; in Brave,{' '}
                  <Code>brave://extensions</Code>.
                </p>
              </Step>

              <Step {...stepProps('5')} number="5" title="Turn on Developer mode">
                <p>
                  There is a switch labelled{' '}
                  <strong className="font-semibold text-ink">Developer mode</strong> in the top
                  right of that page. Turn it on. Three new buttons appear.
                </p>
                <p>
                  This only lets you install an extension from a folder instead of the store. It
                  changes nothing else about your browser.
                </p>
              </Step>

              <Step {...stepProps('6')} number="6" title="Click Load unpacked">
                <p>It is the first of the new buttons, on the top left. A file picker opens.</p>
              </Step>

              <Step {...stepProps('7')} number="7" title="Select the extension folder">
                <p>
                  Navigate to <Code>Reddit-Scraper-Extension-main</Code> from step 3, select it, and
                  confirm. Select the folder itself, not a file inside it.
                </p>
              </Step>

              <Step {...stepProps('8')} number="8" title="Check it appeared">
                <p>
                  A card titled{' '}
                  <strong className="font-semibold text-ink">Reddit Company Scraper</strong> should
                  now be on the page. Click the puzzle-piece icon in your browser toolbar and pin it
                  so you can see what it is doing.
                </p>
              </Step>

              <Step {...stepProps('9')} number="9" title="Sign in to Reddit">
                <p className="flex flex-wrap items-center gap-2">
                  Open <CopyLine value="https://www.reddit.com" label="the Reddit address" /> in the
                  same browser and sign in if you are not already.
                </p>
                <p>The collector uses that session to read.</p>
              </Step>

              <Step {...stepProps('10')} number="10" title="Go back and search">
                <p>
                  Return to Reddit Pulse, type a company and press Analyze. The status will say it
                  is collecting. First run takes a couple of minutes.
                </p>
              </Step>
            </ol>
          </div>
        </Stage>

        <Stage variant="deck" active={immersive} className="mt-24">
          <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">
            Using it day to day
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ['There is nothing to open', 'Once installed it stays out of the way. Searching on the website is the only thing you do.'],
              ['The popup shows progress', 'Click its toolbar icon to see what it last did, and to open the dashboard.'],
              ['Site address', 'The popup has a field for which Reddit Pulse to send data to. It is already set. Only change it if you run your own copy.'],
              ['Updating', 'Download the ZIP again, replace the folder, then press Reload on its card in the extensions page.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[14px] border border-line bg-surface/80 p-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 motion-reduce:hover:translate-y-0">
                <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{body}</p>
              </div>
            ))}
          </div>
        </Stage>

        <Stage variant="swing" active={immersive} className="mt-24">
          <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">
            If something goes wrong
          </h2>

          <dl className="mt-6 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface/80 backdrop-blur-sm">
            {[
              ['“Sign in to Reddit in this browser”', 'The collector has no Reddit session to read with. Open reddit.com, sign in, then search again.'],
              ['It says it is pausing', 'Reddit limits how fast anyone can read. The collector waits rather than getting blocked. Nothing is lost; it carries on by itself.'],
              ['“The collector extension was reloaded”', 'You reloaded it while the page was open. Refresh the Reddit Pulse tab to reconnect them.'],
              ['Nothing happens when I search', 'Check the extension is switched on at chrome://extensions, and that the site you are using matches the Site address in its popup.'],
              ['The site is slow to load first time', 'The server sleeps when unused and takes up to a minute to wake. That is the hosting, not the collector.'],
              ['The report says no data was saved', 'Usually the Reddit session expired mid-run. Sign in to Reddit again and re-run the search.'],
            ].map(([question, answer]) => (
              <div key={question} className="p-5">
                <dt className="text-[14.5px] font-semibold text-ink">{question}</dt>
                <dd className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{answer}</dd>
              </div>
            ))}
          </dl>
        </Stage>

        <Stage variant="lift" active={immersive} className="mt-24">
          <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">
            What it can and cannot see
          </h2>
          <div className="mt-6 overflow-hidden rounded-[14px] border border-line bg-surface/80 backdrop-blur-sm">
            {[
              ['Reads', 'Public Reddit posts and comments, on old.reddit.com only.'],
              ['Sends', 'Those posts to Reddit Pulse, so it can build your report.'],
              ['Stores', 'A small cache of community details, and the status of the last run.'],
              ['Never does', 'Post, vote, comment, message, or touch your password.'],
              ['Never reads', 'Other websites, your history, your bookmarks, or private messages.'],
            ].map(([label, body], index) => (
              <div
                key={label}
                className={`grid grid-cols-[6rem_minmax(0,1fr)] gap-4 p-5 ${
                  index ? 'border-t border-line' : ''
                }`}
              >
                <span className="eyebrow text-ink-3">{label}</span>
                <span className="text-[13.5px] leading-relaxed text-ink-2">{body}</span>
              </div>
            ))}
          </div>
          <p className="mt-3.5 text-[13px] leading-relaxed text-ink-3">
            The code is short and readable. If you want to check any of this yourself, it is all in
            the{' '}
            <a
              href={EXTENSION_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2"
              style={{ color: ORANGE_INK }}
            >
              extension repository
            </a>
            .
          </p>
        </Stage>

        <footer className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-7">
          <p className="text-[13px] text-ink-3">
            Reads public Reddit posts and comments. Not affiliated with Reddit, Inc.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:underline"
          >
            Back to Reddit Pulse
            <Icon name="chevronRight" className="h-3.5 w-3.5" />
          </Link>
        </footer>
      </main>
    </div>
  )
}

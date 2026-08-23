import Reveal from './Reveal.jsx'
import { ACTS, actAnchor } from '../../experience/acts.js'
import { scrollToProgress } from '../../experience/scrollDriver.js'

/**
 * The foot of the page.
 *
 * Built from the same parts as the sections above it: hairline rules, an
 * eyebrow, tabular numerals and a single accent chip — the editorial index
 * treatment the audience act uses, not a card grid.
 *
 * Every link here goes somewhere real. The chapter column drives the same
 * `scrollToProgress` the rail uses, so the journey is navigable from the
 * bottom of the page as well as from inside it.
 */

const SCROLL_TOP = { top: 0 }

function goTop() {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ ...SCROLL_TOP, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
}

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-16 sm:px-10">
      <Reveal className="border-t border-line pt-14">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-10">
          <div>
            <button
              type="button"
              onClick={goTop}
              className="group flex items-center gap-2.5 text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
              <span className="text-[15px] font-semibold tracking-tight text-ink">
                Reddit Pulse
              </span>
            </button>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-ink-3">
              Reads what Reddit already says about a company — sentiment,
              topics, competitors and the communities worth watching — from
              public threads, with the off-topic ones filtered out.
            </p>
          </div>

          <nav aria-labelledby="footer-journey">
            <h2 id="footer-journey" className="eyebrow text-ink-3">
              The journey
            </h2>
            <ul className="mt-5 space-y-2.5">
              {ACTS.map((act, index) => (
                <li key={act.id}>
                  <button
                    type="button"
                    onClick={() => scrollToProgress(actAnchor(index))}
                    className="text-[14px] text-ink-2 transition-colors hover:text-ink"
                  >
                    {act.eyebrow}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-product">
            <h2 id="footer-product" className="eyebrow text-ink-3">
              This page
            </h2>
            <ul className="mt-5 space-y-2.5">
              <li>
                <a
                  href="#preview"
                  className="text-[14px] text-ink-2 transition-colors hover:text-ink"
                >
                  Live report
                </a>
              </li>
              <li>
                <a
                  href="#analyze"
                  className="text-[14px] text-ink-2 transition-colors hover:text-ink"
                >
                  Analyse a company
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={goTop}
                  className="text-[14px] text-ink-2 transition-colors hover:text-ink"
                >
                  Back to top
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="tnum text-[12px] text-ink-3">© {year} Reddit Pulse</p>
          {/* Stated plainly rather than buried: the data is other people's
              public writing, and the name is not ours to imply endorsement
              from. */}
          <p className="max-w-md text-[12px] leading-relaxed text-ink-3 sm:text-right">
            Built on public Reddit posts and comments. Not affiliated with,
            endorsed by, or connected to Reddit, Inc.
          </p>
        </div>
      </Reveal>
    </footer>
  )
}

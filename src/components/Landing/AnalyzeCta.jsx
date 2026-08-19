import SearchBar from './SearchBar.jsx'
import { EXAMPLE_COMPANIES } from '../../data/mockPosts.js'

/**
 * The destination of the whole journey: the search itself.
 *
 * Rendered inside the final act of the 3D experience *and* at the foot of the
 * page, so the same component is the payoff either route the visitor took.
 */
export default function AnalyzeCta({ onAnalyze, dataSource, onOpenSettings, id }) {
  return (
    <div id={id} className="w-full max-w-xl scroll-mt-24">
      <SearchBar onSubmit={onAnalyze} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1 text-ink-3">Try</span>
        {EXAMPLE_COMPANIES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onAnalyze(name)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            {name}
          </button>
        ))}
      </div>

      <p className="mt-5 text-[12px] leading-relaxed text-ink-3">
        {dataSource === 'apify' ? (
          <>
            Live mode — results are scraped from Reddit via Apify.{' '}
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-accent-ink underline underline-offset-2 hover:text-ink"
            >
              Change data source
            </button>
          </>
        ) : (
          <>
            Running on a realistic sample dataset — no API key needed.{' '}
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-accent-ink underline underline-offset-2 hover:text-ink"
            >
              Connect Apify for live data
            </button>
          </>
        )}
      </p>
    </div>
  )
}

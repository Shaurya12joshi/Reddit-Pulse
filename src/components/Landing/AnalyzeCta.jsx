import SearchBar from './SearchBar.jsx'
import { EXAMPLE_COMPANIES } from '../../data/exampleCompanies.js'

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
        {dataSource === 'live' ? (
          <>Live mode: results are loaded from whatever the Reddit scraper extension most recently collected.</>
        ) : (
          <>Running on a realistic sample dataset, no scrape needed.</>
        )}
      </p>
    </div>
  )
}

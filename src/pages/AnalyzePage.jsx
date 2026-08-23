import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import Dashboard from '../components/dashboard/Dashboard.jsx'
import RawDataView from '../components/rawdata/RawDataView.jsx'
import BuzzView from '../components/buzz/BuzzView.jsx'
import { useCompanyAnalysis } from '../hooks/useCompanyAnalysis.js'
import { fromSlug } from '../utils/slug.js'

/** Switches between the finished report, the community ranking and the raw rows. */
function ViewToggle({ view, onChange }) {
  return (
    <div className="fixed right-4 top-4 z-50 flex overflow-hidden rounded-full border border-line bg-surface/90 text-[11px] shadow-sm backdrop-blur">
      {[
        { id: 'report', label: 'Report' },
        { id: 'buzz', label: 'Where to watch' },
        { id: 'raw', label: 'Raw data' },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`px-3 py-1.5 transition-colors ${
            view === option.id ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The `/analyze/:company` route.
 *
 * The URL is the input. Everything this page needs comes from `:company`,
 * which is why a refresh, a shared link and a back/forward step all land in
 * the same place — there is no prior interaction to have missed.
 */
export default function AnalyzePage() {
  const { company: slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const { status, company, error, meta, progress, analyze } = useCompanyAnalysis()
  const [view, setView] = useState('report')

  // Slugs are lossy, so the name the visitor typed is preferred when we still
  // have it (an in-app navigation from the landing page). On a cold load only
  // the URL is left, and the slug is unpacked back into something readable.
  const name = location.state?.companyName || fromSlug(slug)

  // Run once per company. The ref guard keeps StrictMode's double-mount in dev
  // — and any unrelated re-render — from firing a second scrape.
  const startedFor = useRef(null)
  useEffect(() => {
    if (!name || startedFor.current === slug) return
    startedFor.current = slug
    analyze(name)
  }, [slug, name, analyze])

  const goHome = () => navigate('/')

  // The name displayed while work is in flight comes from the hook once it has
  // one, so it matches whatever was actually queried.
  const label = company || name

  if (status === 'ready') {
    return (
      <>
        <ViewToggle view={view} onChange={setView} />
        {view === 'report' ? <Dashboard company={company} meta={meta} onRefresh={goHome} /> : null}
        {view === 'buzz' ? <BuzzView company={company} onRefresh={goHome} /> : null}
        {view === 'raw' ? <RawDataView company={company} /> : null}
      </>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] font-medium text-ink">Couldn't analyse {label}</p>
        <p className="max-w-sm text-[13px] text-ink-3">{error?.message}</p>
        {error?.hint ? (
          <p className="max-w-md text-[13px] text-ink-3">{error.hint}</p>
        ) : null}
        <button
          type="button"
          onClick={goHome}
          className="mt-2 text-[13px] text-accent-ink underline underline-offset-2"
        >
          Try another company
        </button>
      </div>
    )
  }

  // `idle` and `loading` look the same here: the analysis starts on mount, so
  // idle is only ever the single frame before the effect runs.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
      <div>
        <p className="text-[15px] font-medium text-ink">Analysing {label}</p>
        <p className="mt-1 text-[13px] text-ink-3">{progress.message}</p>
      </div>
    </div>
  )
}

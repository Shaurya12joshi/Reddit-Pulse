import { useEffect, useState } from 'react'
import Landing from './components/Landing/LandingPage'
import Dashboard from './components/dashboard/Dashboard.jsx'
import RawDataView from './components/rawdata/RawDataView.jsx'
import BuzzView from './components/buzz/BuzzView.jsx'
import { useCompanyAnalysis } from './hooks/useCompanyAnalysis.js'

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

function App() {
  const { status, company, error, meta, progress, analyze, reset } = useCompanyAnalysis()
  const [view, setView] = useState('report')

  // Deep link: /?company=<name> runs the analysis straight away.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('company')
    if (fromUrl) analyze(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'ready') {
    return (
      <>
        <ViewToggle view={view} onChange={setView} />
        {view === 'report' ? <Dashboard company={company} meta={meta} onRefresh={reset} /> : null}
        {view === 'buzz' ? <BuzzView company={company} onRefresh={reset} /> : null}
        {view === 'raw' ? <RawDataView company={company} /> : null}
      </>
    )
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
        <div>
          <p className="text-[15px] font-medium text-ink">Analysing {company}</p>
          <p className="mt-1 text-[13px] text-ink-3">{progress.message}</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] font-medium text-ink">Couldn't analyse {company}</p>
        <p className="max-w-sm text-[13px] text-ink-3">{error?.message}</p>
        {error?.hint ? (
          <p className="max-w-md text-[13px] text-ink-3">{error.hint}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-2 text-[13px] text-accent-ink underline underline-offset-2"
        >
          Try another company
        </button>
      </div>
    )
  }

  return <Landing onAnalyze={analyze} dataSource="live" onOpenSettings={() => {}} />
}

export default App

import { useEffect } from 'react'
import Landing from './components/Landing/LandingPage'
import Dashboard from './components/dashboard/Dashboard.jsx'
import { useCompanyAnalysis } from './hooks/useCompanyAnalysis.js'
import Search from './components/myOwn/Search.jsx'

function App() {
  const { status, company, posts, error, meta, analyze, reset } = useCompanyAnalysis()

  // Handoff from the browser extension: it opens
  // http://localhost:5173/?company=<name> once a scrape is saved.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('company')
    if (fromUrl) analyze(fromUrl, { source: 'live' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAnalyze = (name) => analyze(name, { source: 'live' })

  if (status === 'ready') {
    return <Dashboard company={company} posts={posts} meta={meta} onRefresh={reset} />
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-[15px] text-ink-2">Loading Reddit data for {company}…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] font-medium text-ink">Couldn't load data for {company}</p>
        <p className="max-w-sm text-[13px] text-ink-3">{error?.message}</p>
        {error?.hint ? (
          <p className="max-w-sm text-[13px] text-ink-3">{error.hint}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-2 text-[13px] text-accent-ink underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    )
  }

  return( 
  <>
  <Landing onAnalyze={handleAnalyze} dataSource="live" onOpenSettings={() => {}} />
  <Search/>
  </>
)
}

export default App

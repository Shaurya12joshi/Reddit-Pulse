import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'

import Dashboard from '../components/dashboard/Dashboard.jsx'
import RawDataView from '../components/rawdata/RawDataView.jsx'
import BuzzView from '../components/buzz/BuzzView.jsx'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'
import { useCompanyAnalysis } from '../hooks/useCompanyAnalysis.js'
import { fromSlug } from '../utils/slug.js'

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

function RateLimitWait({ company, retryAt, onRetry }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, (retryAt ?? 0) - Date.now()))

  const retried = useRef(false)
  useEffect(() => {
    retried.current = !retryAt || retryAt <= Date.now()
  }, [retryAt])

  useEffect(() => {
    if (!retryAt) return undefined

    const tick = () => {
      const left = Math.max(0, retryAt - Date.now())
      setRemaining(left)
      if (left === 0 && !retried.current) {
        retried.current = true
        onRetry()
      }
    }

    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [retryAt, onRetry])

  const seconds = Math.ceil(remaining / 1000)
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[15px] font-medium text-ink">Reddit asked us to slow down</p>

      {retryAt ? (
        <>
          <p className="tnum text-[32px] font-medium tabular-nums text-ink">{clock}</p>
          <p className="max-w-sm text-[13px] text-ink-3">
            Collecting {company} resumes automatically when the wait is over.
            Nothing already collected was lost.
          </p>
        </>
      ) : (
        <p className="max-w-sm text-[13px] text-ink-3">
          Wait a few minutes and try again. Nothing already collected was lost.
        </p>
      )}

      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={onRetry}
          disabled={remaining > 0}
          className="text-[13px] text-accent-ink underline underline-offset-2 disabled:cursor-not-allowed disabled:text-ink-3 disabled:no-underline"
        >
          {remaining > 0 ? 'Waiting…' : 'Try now'}
        </button>
        <Link to="/" className="text-[13px] text-ink-3 underline underline-offset-2">
          Another company
        </Link>
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  const { company: slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [params] = useSearchParams()

  const { status, company, error, meta, progress, analyze } = useCompanyAnalysis()
  const [view, setView] = useState('report')

  const name = location.state?.companyName || fromSlug(slug)
  const compareWith = (params.get('vs') || '').trim()
  const askedSubject = (params.get('ask') || '').trim()
  const rivalProduct = (params.get('theirs') || '').trim()
  const keywords = (params.get('field') || '').trim()
  const fieldOnly = params.get('mode') === 'field'

  const extras = useMemo(
    () => ({ compareWith, subject: askedSubject, rivalProduct, keywords, fieldOnly }),
    [compareWith, askedSubject, rivalProduct, keywords, fieldOnly],
  )

  const runKey = `${slug}|${compareWith}|${askedSubject}|${rivalProduct}|${keywords}|${fieldOnly}`
  const startedFor = useRef(null)
  useEffect(() => {
    if (!name || startedFor.current === runKey) return
    startedFor.current = runKey
    analyze(name, extras)
  }, [runKey, name, extras, analyze])

  const retry = useCallback(() => {
    if (name) analyze(name, extras)
  }, [name, extras, analyze])

  const goHome = () => navigate('/')

  const label = company || name

  if (status === 'ready') {
    return (
      <>
        <ViewToggle view={view} onChange={setView} />
        {view === 'report' ? (
          <Dashboard
            company={company}
            meta={meta}
            onRefresh={goHome}
            compareWith={compareWith}
            askedSubject={askedSubject}
            rivalProduct={rivalProduct}
            keywords={keywords}
          />
        ) : null}
        {view === 'buzz' ? <BuzzView company={company} onRefresh={goHome} /> : null}
        {view === 'raw' ? <RawDataView company={company} /> : null}
      </>
    )
  }

  if (status === 'error') {
    if (error?.rateLimited) {
      return <RateLimitWait company={label} retryAt={error.retryAt} onRetry={retry} />
    }

    const shortcut = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
      ? 'Cmd + Shift + R'
      : 'Ctrl + Shift + R'

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] font-medium text-ink">Couldn't analyse {label}</p>
        <p className="max-w-sm text-[13px] text-ink-3">{error?.message}</p>

        {error?.fix ? (
          <div className="w-full max-w-md rounded-[12px] border border-accent/30 bg-accent-dim px-4 py-3.5">
            <p className="text-[13.5px] font-medium text-accent-ink">{error.fix}</p>
            {error.action === 'reload' ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-ink transition-colors hover:bg-primary-hover"
                >
                  Reload the page
                </button>
                <span className="text-[12px] text-accent-ink/80">
                  or press <span className="font-medium">{shortcut}</span> for a hard reload
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={retry}
                className="mt-3 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-ink transition-colors hover:bg-primary-hover"
              >
                Try again
              </button>
            )}
          </div>
        ) : null}

        {error?.hint ? (
          <p className="max-w-md text-[13px] leading-relaxed text-ink-3">{error.hint}</p>
        ) : null}

        <button
          type="button"
          onClick={goHome}
          className="text-[13px] text-accent-ink underline underline-offset-2"
        >
          Try another company
        </button>

        {error?.collector ? (
          <p className="mt-1 font-mono text-[11px] text-ink-3/70">
            collector probe: {error.collector}
          </p>
        ) : null}
      </div>
    )
  }

  return <LoadingScreen company={label} progress={progress} />
}

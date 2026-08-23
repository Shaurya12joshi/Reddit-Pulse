import { useNavigate } from 'react-router'
import LandingPage from '../components/Landing/LandingPage.jsx'
import { toSlug } from '../utils/slug.js'

/**
 * The `/` route.
 *
 * A thin adapter, nothing more. `LandingPage` already takes an `onAnalyze`
 * callback and knows nothing about how the analysis is reached — so the only
 * change routing needs is to hand it a function that changes the URL instead
 * of one that kicks off a fetch in place.
 *
 * The typed name rides along in router state so `/analyze/apple-inc` can show
 * "Apple Inc." rather than the de-slugged "Apple Inc"; the slug alone is
 * enough to work after a refresh, just less exact.
 */
export default function LandingRoute() {
  const navigate = useNavigate()

  const handleAnalyze = (rawName) => {
    const name = String(rawName ?? '').trim()
    const slug = toSlug(name)
    // Nothing usable survived normalisation (e.g. "!!!") — stay put.
    if (!slug) return

    navigate(`/analyze/${slug}`, { state: { companyName: name } })
  }

  return (
    <LandingPage
      onAnalyze={handleAnalyze}
      dataSource="live"
      onOpenSettings={() => {}}
    />
  )
}

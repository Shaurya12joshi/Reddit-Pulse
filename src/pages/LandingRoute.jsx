import { useNavigate } from 'react-router'
import LandingPage from '../components/Landing/LandingPage.jsx'
import { toSlug } from '../utils/slug.js'

export default function LandingRoute() {
  const navigate = useNavigate()

  const handleAnalyze = (rawName) => {
    const name = String(rawName ?? '').trim()
    const slug = toSlug(name)
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

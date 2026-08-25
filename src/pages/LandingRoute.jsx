import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

import LandingPage from '../components/Landing/LandingPage.jsx'
import { SEARCH_ANCHOR, goToSearch } from '../experience/goToSearch.js'
import { toSlug } from '../utils/slug.js'

export default function LandingRoute() {
  const navigate = useNavigate()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash !== `#${SEARCH_ANCHOR}`) return
    goToSearch()
  }, [hash])

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
    />
  )
}

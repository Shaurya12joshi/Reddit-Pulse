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

  const handleAnalyze = (rawName, extras = {}) => {
    const name = String(rawName ?? '').trim()
    const slug = toSlug(name)
    if (!slug) return

    const params = new URLSearchParams()
    const compareWith = String(extras.compareWith ?? '').trim()
    const subject = String(extras.subject ?? '').trim()
    const rivalProduct = String(extras.rivalProduct ?? '').trim()

    if (compareWith) params.set('vs', compareWith)
    if (subject) params.set('ask', subject)
    if (rivalProduct) params.set('theirs', rivalProduct)

    const query = params.toString()
    navigate(`/analyze/${slug}${query ? `?${query}` : ''}`, { state: { companyName: name } })
  }

  return (
    <LandingPage onAnalyze={handleAnalyze} />
  )
}

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useState } from 'react'

import LandingPage from '../components/Landing/LandingPage.jsx'
import { apiFetch } from '../services/aiConnection.js'
import { SEARCH_ANCHOR, goToSearch } from '../experience/goToSearch.js'
import { toSlug } from '../utils/slug.js'

const URL_LIKE = /^(https?:\/\/|www\.)|^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i

export default function LandingRoute() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (hash !== `#${SEARCH_ANCHOR}`) return
    goToSearch()
  }, [hash])

  // A website address names a company just as well as its name does, so the
  // box takes either. Anything that looks like an address goes to the model
  // first, and the report is built from the name it comes back with.
  const handleAnalyze = async (rawInput, extras = {}) => {
    const typed = String(rawInput ?? '').trim()
    if (!typed) return

    let name = typed
    if (URL_LIKE.test(typed) && !/\s/.test(typed)) {
      setResolving(true)
      const resolved = await apiFetch(`/api/identify?input=${encodeURIComponent(typed)}`)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
        .finally(() => setResolving(false))

      if (resolved?.name) name = resolved.name
    }

    const slug = toSlug(name)
    if (!slug) return

    const params = new URLSearchParams()
    const compareWith = String(extras.compareWith ?? '').trim()
    const subject = String(extras.subject ?? '').trim()
    const rivalProduct = String(extras.rivalProduct ?? '').trim()
    const keywords = String(extras.keywords ?? '').trim()

    if (compareWith) params.set('vs', compareWith)
    if (subject) params.set('ask', subject)
    if (rivalProduct) params.set('theirs', rivalProduct)
    if (keywords) params.set('field', keywords)

    const query = params.toString()
    navigate(`/analyze/${slug}${query ? `?${query}` : ''}`, { state: { companyName: name } })
  }

  return (
    <LandingPage onAnalyze={handleAnalyze} resolving={resolving} />
  )
}

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
    goToSearch({ graceMs: 1400 })
  }, [hash])

  const handleAnalyze = async (rawInput, extras = {}) => {
    const typed = String(rawInput ?? '').trim()
    const keywords = String(extras.keywords ?? '').trim()

    if (!typed && !keywords) return

    let name = typed || keywords
    if (typed && URL_LIKE.test(typed) && !/\s/.test(typed)) {
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

    if (compareWith) params.set('vs', compareWith)
    if (subject) params.set('ask', subject)
    if (rivalProduct) params.set('theirs', rivalProduct)
    if (keywords) params.set('field', keywords)
    if (!typed && keywords) params.set('mode', 'field')

    const query = params.toString()
    navigate(`/analyze/${slug}${query ? `?${query}` : ''}`, { state: { companyName: name } })
  }

  return (
    <LandingPage onAnalyze={handleAnalyze} resolving={resolving} />
  )
}

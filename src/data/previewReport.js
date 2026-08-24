
import { useEffect, useState } from 'react'

const API = 'http://localhost:3001'

export function usePreviewReport() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const listRes = await fetch(`${API}/api/companies`)
        if (!listRes.ok) throw new Error('Could not list companies')

        const { companies } = await listRes.json()
        const featured = companies?.[0]?.company
        if (!featured) {
          if (!cancelled) setState({ status: 'empty' })
          return
        }

        const reportRes = await fetch(
          `${API}/api/report?company=${encodeURIComponent(featured)}`,
        )
        if (!reportRes.ok) throw new Error('Could not load the featured report')

        const data = await reportRes.json()
        if (cancelled) return

        setState({
          status: 'ready',
          company: data.company,
          insights: data.insights,
          posts: data.posts,
        })
      } catch {
        if (!cancelled) setState({ status: 'empty' })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

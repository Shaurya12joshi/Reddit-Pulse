const DEFAULTS = {
  competitors: 3,
  categoryTerms: 2,
  market: 2,
  limit: 6,
}

const clean = (value) => String(value || '').trim()
const lower = (value) => clean(value).toLowerCase()

function searchName(name, aliases = []) {
  const full = clean(name)
  if (!full) return clean(aliases.find(Boolean))

  const shorter = aliases
    .map(clean)
    .filter((alias) => alias.length >= 4 && alias.length < full.length)
    .filter((alias) => full.toLowerCase().startsWith(`${alias.toLowerCase()} `))
    .sort((a, b) => a.length - b.length)

  return shorter[0] || full
}

export function buildSearchPlan(brand, identity = {}, options = {}) {
  const { competitors, categoryTerms, market, limit } = { ...DEFAULTS, ...options }
  const alreadySearched = new Set((options.alreadySearched || []).map(lower))

  const label = searchName(identity.canonical_name || brand, identity.aliases)
  if (!label) return []

  const rivals = (identity.competitors || [])
    .map((entry) => searchName(entry?.name, entry?.aliases))
    .filter(Boolean)
    .filter((name) => lower(name) !== lower(label))
    .slice(0, competitors)

  const category = clean(identity.category) || clean(identity.industry)
  const terms = (identity.category_terms || [])
    .map(clean)
    .filter(Boolean)
    .filter((term) => lower(term) !== lower(label))
    .slice(0, categoryTerms)

  const comparison = rivals.map((rival) => pick(`${label} vs ${rival}`, 'comparison', rival))

  const categorised = terms.map((term) => pick(`${label} ${term}`, 'category', term))
  if (category) categorised.push(pick(`${label} ${category}`, 'category', category))

  const openMarket = rivals
    .slice(0, market)
    .map((rival) => pick(`${rival} alternatives`, 'market', rival))
  if (category && openMarket.length < market) {
    openMarket.push(pick(`best ${category}`, 'market', category))
  }

  const queues = [comparison, categorised, openMarket.slice(0, market)]
  const seen = new Set()
  const chosen = []

  for (let round = 0; chosen.length < limit; round += 1) {
    if (!queues.some((queue) => queue.length > round)) break
    for (const queue of queues) {
      if (chosen.length >= limit) break
      const entry = queue[round]
      if (!entry) continue
      const key = lower(entry.term)
      if (!key || seen.has(key) || alreadySearched.has(key)) continue
      seen.add(key)
      chosen.push(entry)
    }
  }

  return chosen
}

function pick(term, kind, facet) {
  return { term: term.replace(/\s+/g, ' ').trim(), kind, facet }
}

export function mergeQueries(planned = [], corpus = [], { limit = 10, identityShare = 3 } = {}) {
  const seen = new Set()
  const merged = []

  const take = (entry, kind) => {
    const term = clean(entry?.term)
    const key = lower(term)
    if (!term || seen.has(key)) return
    seen.add(key)
    merged.push({ ...entry, term, kind: entry.kind || kind })
  }

  const share = Math.min(planned.length, identityShare)
  for (const entry of planned.slice(0, share)) take(entry, 'identity')
  for (const entry of corpus) {
    if (merged.length >= limit) break
    take(entry, 'corpus')
  }
  for (const entry of planned.slice(share)) {
    if (merged.length >= limit) break
    take(entry, 'identity')
  }

  return merged.slice(0, limit)
}

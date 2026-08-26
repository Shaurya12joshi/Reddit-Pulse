import { enrichPosts, buildInsights } from '../src/analysis/aggregate.js'
import {
  deriveBrandContext,
  filterRelevantPosts,
  rankCommunities,
  threadIdFromPermalink,
} from '../src/analysis/buzz.js'
import { makeRelevanceTest } from '../src/analysis/importance.js'

export {
  enrichPosts,
  buildInsights,
  deriveBrandContext,
  filterRelevantPosts,
  makeRelevanceTest,
  rankCommunities,
  threadIdFromPermalink,
}

export function displayName(company) {
  const trimmed = company.trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

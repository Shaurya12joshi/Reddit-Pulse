/**
 * Landing-page preview data.
 *
 * The landing page shows a "what you get" preview using the exact same
 * analysis pipeline and dashboard components as a real report — nothing here
 * is hand-authored copy pretending to be a chart. It runs the mock generator
 * for one representative brand, once, at module load, and every landing
 * section reads from the result.
 *
 * This is presentational only: it never touches Apify and is unrelated to the
 * user's own search.
 */

import { generateMockPosts } from './mockPosts.js'
import { enrichPosts, buildInsights } from '../analysis/aggregate.js'

export const PREVIEW_COMPANY = 'Notion'

const rawPosts = generateMockPosts(PREVIEW_COMPANY, { count: 130, days: 90 })
const enrichedPosts = enrichPosts(rawPosts, PREVIEW_COMPANY)

export const PREVIEW_INSIGHTS = buildInsights(enrichedPosts, PREVIEW_COMPANY)
export const PREVIEW_POSTS = enrichedPosts

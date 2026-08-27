import { PREVIEW_SNAPSHOT } from './previewSnapshot.js'

const PREVIEW = {
  status: 'ready',
  company: PREVIEW_SNAPSHOT.company,
  insights: PREVIEW_SNAPSHOT.insights,
  posts: PREVIEW_SNAPSHOT.posts,
  capturedAt: PREVIEW_SNAPSHOT.capturedAt,
}

export function usePreviewReport() {
  return PREVIEW
}

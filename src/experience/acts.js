/**
 * The narrative spine.
 *
 * Eight acts, each owning a slice of scroll progress and a corresponding 3D
 * layout. The four "How it works" steps are woven into the same timeline
 * rather than living in a separate section — walking the journey *is* reading
 * how the product works.
 */

export const ACTS = [
  {
    id: 'raw',
    eyebrow: 'Raw conversations',
    step: null,
    title: ['Your customers are', 'already talking.'],
    serifWord: 'already',
    body: 'Discover what Reddit really thinks about your company, your competitors, and everything in between.',
    align: 'center',
    start: 0.0,
    end: 0.13,
  },
  {
    id: 'enter',
    eyebrow: 'Raw conversations',
    step: '01',
    title: ['Enter a company.'],
    body: 'Thousands of unstructured posts and comments exist for almost every brand. Scattered across hundreds of subreddits, none of it is organised, and none of it was written for you.',
    align: 'left',
    start: 0.13,
    end: 0.26,
  },
  {
    id: 'signals',
    eyebrow: 'Signals',
    step: '02',
    title: ['Collect Reddit', 'conversations.'],
    body: 'Relevant threads are gathered through Apify and connected to each other. What looked like noise starts to show structure.',
    align: 'right',
    start: 0.26,
    end: 0.4,
  },
  {
    id: 'sentiment',
    eyebrow: 'Sentiment',
    step: '03',
    title: ['Analyze the', 'conversation.'],
    body: 'Every sentence is scored, with negation and intensifiers handled properly, then split into positive, neutral and negative.',
    align: 'left',
    start: 0.4,
    end: 0.53,
  },
  {
    id: 'topics',
    eyebrow: 'Topics',
    step: null,
    title: ['Subjects emerge.'],
    serifWord: 'emerge',
    body: 'Pricing, reliability, support, design. Discussions organise into the subjects people actually keep returning to.',
    align: 'right',
    start: 0.53,
    end: 0.65,
  },
  {
    id: 'competitors',
    eyebrow: 'Competitors',
    step: null,
    title: ['Rivals take shape.'],
    body: 'The brands people mention in the same breath form a relationship network — and the reason behind each comparison comes with it.',
    align: 'left',
    start: 0.65,
    end: 0.78,
  },
  {
    id: 'insights',
    eyebrow: 'Insights',
    step: '04',
    title: ['Discover the signal.'],
    serifWord: 'signal',
    body: 'The chaos resolves into structure: sentiment shares, ranked topics, praise and complaints, competitor mentions, momentum over time.',
    align: 'center',
    start: 0.78,
    end: 0.9,
  },
  {
    id: 'action',
    eyebrow: 'Action',
    step: null,
    title: ['See what Reddit', 'is saying.'],
    serifWord: 'Reddit',
    body: 'Pick any company and read its Reddit reputation in a couple of minutes.',
    align: 'center',
    start: 0.9,
    end: 1.0001,
  },
]

export const LAST_ACT = ACTS.length - 1

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

export const easeOutCubic = (t) => 1 - (1 - t) ** 3

/** Index of the act containing this progress value. */
export function actIndexAt(progress) {
  for (let i = 0; i < ACTS.length; i += 1) {
    if (progress < ACTS[i].end) return i
  }
  return LAST_ACT
}

/** 0..1 position within a given act. */
export function actLocalProgress(progress, index) {
  const act = ACTS[index]
  return clamp01((progress - act.start) / (act.end - act.start))
}

/**
 * Which two layouts to interpolate, and how far between them.
 *
 * Each act *holds* its shape for the first stretch, then transforms into the
 * next one. That hold-then-move rhythm is what makes the world feel authored
 * rather than continuously sliding.
 */
const HOLD = 0.4

export function layoutBlend(progress) {
  const index = actIndexAt(progress)
  const local = actLocalProgress(progress, index)

  if (local <= HOLD || index === LAST_ACT) {
    return { from: index, to: index, t: 0 }
  }
  return {
    from: index,
    to: index + 1,
    t: easeInOutCubic((local - HOLD) / (1 - HOLD)),
  }
}

/**
 * Visibility envelope for a piece of act copy: rises, holds, falls.
 * Returns { opacity, reveal, exit } so the overlay can drive masked reveals on
 * the way in and a distinct exit transform on the way out.
 */
export function copyEnvelope(progress, index) {
  const local = actLocalProgress(progress, index)
  const inT = clamp01(local / 0.3)
  const outT = clamp01((local - 0.72) / 0.28)
  return {
    local,
    reveal: easeOutCubic(inT),
    exit: easeInOutCubic(outT),
    opacity: easeOutCubic(inT) * (1 - outT),
  }
}

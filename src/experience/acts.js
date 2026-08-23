/**
 * The narrative spine.
 *
 * Twelve acts, each owning a slice of scroll progress and a corresponding 3D
 * layout. This is the whole landing page, not an intro to it: the report, the
 * evidence behind it, who it is for and the call to action are all acts of the
 * same timeline, so the visitor travels through one continuous world instead
 * of a 3D section followed by a website.
 *
 * The four "How it works" steps are woven into the same timeline rather than
 * living in a separate section — walking the journey *is* reading how the
 * product works.
 */

export const ACTS = [
  {
    id: 'raw',
    eyebrow: 'Noise',
    step: null,
    title: ['Your customers are', 'already talking.'],
    serifWord: 'already',
    body: 'Discover what Reddit really thinks about your company, your competitors, and everything in between.',
    align: 'center',
    start: 0.0,
    end: 0.085,
  },
  {
    id: 'enter',
    eyebrow: 'Search',
    step: '01',
    title: ['Enter a company.'],
    body: 'Thousands of unstructured posts and comments exist for almost every brand. Scattered across hundreds of subreddits, none of it is organised, and none of it was written for you.',
    align: 'left',
    start: 0.085,
    end: 0.17,
  },
  {
    id: 'signals',
    eyebrow: 'Collect',
    step: '02',
    title: ['Collect Reddit', 'conversations.'],
    body: 'Relevant threads are gathered straight from Reddit and connected to each other. What looked like noise starts to show structure.',
    align: 'right',
    start: 0.17,
    end: 0.26,
  },
  {
    id: 'sentiment',
    eyebrow: 'Sentiment',
    step: '03',
    title: ['Analyze the', 'conversation.'],
    body: 'Every sentence is scored, with negation and intensifiers handled properly, then split into positive, neutral and negative.',
    align: 'left',
    start: 0.26,
    end: 0.35,
  },
  {
    id: 'topics',
    eyebrow: 'Topics',
    step: null,
    title: ['Subjects emerge.'],
    serifWord: 'emerge',
    body: 'Pricing, reliability, support, design. Discussions organise into the subjects people actually keep returning to.',
    align: 'right',
    start: 0.35,
    end: 0.44,
  },
  {
    id: 'competitors',
    eyebrow: 'Rivals',
    step: null,
    title: ['Rivals take shape.'],
    body: 'The brands people mention in the same breath form a relationship network — and the reason behind each comparison comes with it.',
    align: 'left',
    start: 0.44,
    end: 0.53,
  },
  {
    id: 'insights',
    eyebrow: 'Signal',
    step: '04',
    title: ['Discover the signal.'],
    serifWord: 'signal',
    body: 'The chaos resolves into structure: sentiment shares, ranked topics, praise and complaints, competitor mentions, momentum over time.',
    align: 'center',
    start: 0.53,
    end: 0.62,
  },
  {
    id: 'report',
    eyebrow: 'Report',
    step: null,
    title: ['The end of the journey', 'is a real report.'],
    serifWord: 'real',
    body: 'Not a mockup. Column height is share of mentions, colour is how a subject is going, and distance from the centre is how often a rival gets named alongside you.',
    align: 'left',
    start: 0.62,
    end: 0.71,
  },
  {
    id: 'evidence',
    eyebrow: 'Evidence',
    step: null,
    title: ['Every number traces', 'back to a thread.'],
    serifWord: 'thread',
    body: 'Nothing here is inferred from a summary. Open any measurement and the actual Reddit conversations behind it are still there, with the words that drove the score.',
    align: 'right',
    start: 0.71,
    end: 0.79,
  },
  {
    id: 'audience',
    eyebrow: 'Audience',
    step: null,
    title: ['For anyone who needs', 'the truth, not a survey.'],
    serifWord: 'truth',
    body: 'Founders validating an idea, product teams hunting complaints, marketers borrowing the language customers already use, researchers who would rather not read threads by hand.',
    align: 'left',
    start: 0.79,
    end: 0.87,
  },
  {
    id: 'rest',
    eyebrow: 'Rest',
    step: null,
    title: ['The conversation', "doesn't stop."],
    serifWord: 'stop',
    body: 'It carries on after you close the tab. Come back and the world has moved — new threads, new complaints, new comparisons.',
    align: 'center',
    start: 0.87,
    end: 0.94,
  },
  {
    id: 'start',
    eyebrow: 'Start',
    step: null,
    title: ['See what Reddit', 'is saying.'],
    serifWord: 'Reddit',
    body: 'Pick any company and read its Reddit reputation in a couple of minutes.',
    align: 'center',
    start: 0.94,
    end: 1.0001,
  },
]

export const LAST_ACT = ACTS.length - 1

/** Act ids that mount their own data-driven scene contents. */
export const ACT_INDEX = Object.fromEntries(ACTS.map((act, index) => [act.id, index]))

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

/**
 * Where to land when jumping to an act.
 *
 * Not the act's `start`: `copyEnvelope` ramps its text in over the first 30%
 * of an act and begins fading it out at 72%, so the boundary itself is the
 * one place the copy is invisible. 35% in is past the reveal and well before
 * the exit — the act at rest, showing what it says.
 */
export function actAnchor(index) {
  const act = ACTS[index]
  if (!act) return 0
  return act.start + 0.35 * (act.end - act.start)
}

/** 0..1 position within a given act. */
export function actLocalProgress(progress, index) {
  const act = ACTS[index]
  return clamp01((progress - act.start) / (act.end - act.start))
}

/**
 * How present a stage is at this progress — 0 outside its act, 1 through the
 * middle of it, easing at both edges.
 *
 * Data-driven scene contents (the report, the evidence panels) use this to
 * fade themselves in and out, so only the stage that belongs to the current
 * moment is ever drawing.
 */
export function stagePresence(progress, index, { lead = 0.35, tail = 0.35 } = {}) {
  const act = ACTS[index]
  if (!act) return 0
  const span = act.end - act.start
  const from = act.start - span * lead
  const to = act.end + span * tail
  if (progress <= from || progress >= to) return 0

  const rampIn = clamp01((progress - from) / (span * lead + span * 0.25))
  const rampOut = clamp01((to - progress) / (span * tail + span * 0.25))
  return easeInOutCubic(Math.min(rampIn, rampOut))
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

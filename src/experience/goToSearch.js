import { ACTS, actAnchor } from './acts.js'
import { isDriverActive, scrollToProgress } from './scrollDriver.js'

export const SEARCH_ANCHOR = 'analyze'
const SEARCH_INPUT_ID = 'company-search'
const START_ACT = ACTS.findIndex((act) => act.id === 'start')

function focusInput() {
  document.getElementById(SEARCH_INPUT_ID)?.focus({ preventScroll: true })
}

export function goToSearch({ focus = true, graceMs = 600 } = {}) {
  if (typeof window === 'undefined') return

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const toElement = () => {
    document.getElementById(SEARCH_ANCHOR)?.scrollIntoView({
      block: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    })
    if (focus) focusInput()
  }

  if (reduced) {
    requestAnimationFrame(toElement)
    return
  }

  const deadline = Date.now() + graceMs

  const attempt = () => {
    if (isDriverActive()) {
      scrollToProgress(actAnchor(START_ACT))
      if (focus) focusInput()
      return
    }

    if (Date.now() >= deadline) {
      toElement()
      return
    }

    requestAnimationFrame(attempt)
  }

  attempt()
}

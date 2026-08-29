const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

export const driver = {
  progress: 0,
  damped: 0,
  velocity: 0,
  pointerX: 0,
  pointerY: 0,
  moved: false,
}

const subscribers = new Set()
let targetEl = null
let rafId = null
let lastTime = 0
let rawPointerX = 0
let rawPointerY = 0

export function setScrollTarget(element) {
  targetEl = element
}

export function subscribe(callback) {
  subscribers.add(callback)
  callback(driver)
  return () => subscribers.delete(callback)
}

function readProgress() {
  if (!targetEl) return 0
  const total = targetEl.offsetHeight - window.innerHeight
  if (total <= 0) return 0
  const scrolled = -targetEl.getBoundingClientRect().top
  return clamp01(scrolled / total)
}

function onPointerMove(event) {
  rawPointerX = (event.clientX / window.innerWidth) * 2 - 1
  rawPointerY = (event.clientY / window.innerHeight) * 2 - 1
}

function frame(time) {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016
  lastTime = time

  const next = readProgress()
  if (Math.abs(next - driver.progress) > 0.0002) driver.moved = true
  driver.progress = next

  const ease = 1 - Math.exp(-4.2 * dt)
  const previousDamped = driver.damped
  driver.damped += (driver.progress - driver.damped) * ease
  driver.velocity = dt > 0 ? (driver.damped - previousDamped) / dt : 0

  const pointerEase = 1 - Math.exp(-4 * dt)
  driver.pointerX += (rawPointerX - driver.pointerX) * pointerEase
  driver.pointerY += (rawPointerY - driver.pointerY) * pointerEase

  subscribers.forEach((callback) => callback(driver))
  rafId = requestAnimationFrame(frame)
}

export function isDriverActive() {
  return Boolean(targetEl)
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

let tweenId = null

function stopTween() {
  if (tweenId === null) return
  cancelAnimationFrame(tweenId)
  tweenId = null
  window.removeEventListener('wheel', stopTween)
  window.removeEventListener('touchstart', stopTween)
  window.removeEventListener('keydown', stopTween)
}

// The browser's own smooth scroll takes about the same time whatever the
// distance, so jumping several acts flings the whole scene past in one blink.
// This paces the travel by how far it actually is.
export function scrollToProgress(progress) {
  if (!targetEl || typeof window === 'undefined') return

  const total = targetEl.offsetHeight - window.innerHeight
  if (total <= 0) return

  const sectionTop = targetEl.getBoundingClientRect().top + window.scrollY
  const to = sectionTop + clamp01(progress) * total
  const from = window.scrollY
  const distance = to - from

  stopTween()

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion || Math.abs(distance) < 4) {
    window.scrollTo({ top: to, behavior: 'auto' })
    return
  }

  const screens = Math.abs(distance) / Math.max(1, window.innerHeight)
  const duration = Math.min(4200, Math.max(560, 420 + screens * 520))
  const started = performance.now()

  window.addEventListener('wheel', stopTween, { passive: true, once: true })
  window.addEventListener('touchstart', stopTween, { passive: true, once: true })
  window.addEventListener('keydown', stopTween, { once: true })

  const step = (now) => {
    const t = Math.min(1, (now - started) / duration)
    window.scrollTo({ top: from + distance * easeInOutCubic(t), behavior: 'auto' })

    if (t < 1) {
      tweenId = requestAnimationFrame(step)
      return
    }
    stopTween()
  }

  tweenId = requestAnimationFrame(step)
}

export function startDriver() {
  if (rafId !== null || typeof window === 'undefined') return () => {}
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  rafId = requestAnimationFrame(frame)

  return () => {
    window.removeEventListener('pointermove', onPointerMove)
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    lastTime = 0
  }
}

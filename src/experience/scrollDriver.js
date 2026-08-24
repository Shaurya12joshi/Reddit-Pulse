
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

  const ease = 1 - Math.exp(-7.5 * dt)
  const previousDamped = driver.damped
  driver.damped += (driver.progress - driver.damped) * ease
  driver.velocity = dt > 0 ? (driver.damped - previousDamped) / dt : 0

  const pointerEase = 1 - Math.exp(-4 * dt)
  driver.pointerX += (rawPointerX - driver.pointerX) * pointerEase
  driver.pointerY += (rawPointerY - driver.pointerY) * pointerEase

  subscribers.forEach((callback) => callback(driver))
  rafId = requestAnimationFrame(frame)
}

export function scrollToProgress(progress) {
  if (!targetEl || typeof window === 'undefined') return

  const total = targetEl.offsetHeight - window.innerHeight
  if (total <= 0) return

  const sectionTop = targetEl.getBoundingClientRect().top + window.scrollY
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  window.scrollTo({
    top: sectionTop + clamp01(progress) * total,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  })
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

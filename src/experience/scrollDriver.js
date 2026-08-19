/**
 * The single source of truth for the whole experience.
 *
 * One rAF loop reads scroll position and pointer, applies frame-rate
 * independent damping, and notifies subscribers. Both the WebGL scene and the
 * HTML typography read from this same object, which is what keeps the text and
 * the 3D world locked to each other — they are not two animations that happen
 * to look synchronised, they are one value rendered twice.
 *
 * Nothing here touches React state: subscribers write to the DOM or to
 * three.js objects imperatively, so scrolling never triggers a re-render.
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

export const driver = {
  /** Raw 0..1 progress through the pinned section. */
  progress: 0,
  /** Damped progress — what almost everything should read. */
  damped: 0,
  /** Signed scroll velocity, useful for lean/stretch effects. */
  velocity: 0,
  /** Pointer in -1..1 space, damped. */
  pointerX: 0,
  pointerY: 0,
  /** True once the user has scrolled at all (hides the scroll cue). */
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
  // Push the current value immediately so a late subscriber is never blank.
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

  // Frame-rate independent exponential smoothing. The 1 - e^(-k·dt) form keeps
  // the feel identical on 60Hz and 120Hz displays.
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

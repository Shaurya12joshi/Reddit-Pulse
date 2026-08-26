const entries = new Set()

let frame = null
let pointerX = 0
let pointerY = 0

function measure() {
  frame = null
  const height = window.innerHeight

  for (const entry of entries) {
    const node = entry.node
    if (!node) continue

    const rect = node.getBoundingClientRect()
    const centre = rect.top + rect.height / 2
    const offset = (centre - height / 2) / (height / 2 + rect.height / 2)

    entry.callback({
      offset: Math.max(-1.6, Math.min(1.6, offset)),
      pointerX,
      pointerY,
    })
  }
}

function schedule() {
  if (frame !== null) return
  frame = requestAnimationFrame(measure)
}

function onPointerMove(event) {
  pointerX = (event.clientX / window.innerWidth) * 2 - 1
  pointerY = (event.clientY / window.innerHeight) * 2 - 1
  schedule()
}

function listen() {
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
}

function stopListening() {
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
  window.removeEventListener('pointermove', onPointerMove)
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
}

export function registerStage(node, callback) {
  const entry = { node, callback }
  if (entries.size === 0) listen()
  entries.add(entry)
  schedule()

  return () => {
    entries.delete(entry)
    if (entries.size === 0) stopListening()
  }
}

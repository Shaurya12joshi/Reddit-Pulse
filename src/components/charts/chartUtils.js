export function scale(value, domainMin, domainMax, rangeMin, rangeMax) {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2
  const t = (value - domainMin) / (domainMax - domainMin)
  return rangeMin + t * (rangeMax - rangeMin)
}

export function niceScale(min, max, tickCount = 4) {
  if (min === max) {
    const pad = Math.abs(min) || 1
    min -= pad
    max += pad
  }

  const range = max - min
  const rawStep = range / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalised = rawStep / magnitude

  let step
  if (normalised <= 1) step = magnitude
  else if (normalised <= 2) step = 2 * magnitude
  else if (normalised <= 5) step = 5 * magnitude
  else step = 10 * magnitude

  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step

  const ticks = []
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(Number(value.toFixed(6)))
  }

  return { min: niceMin, max: niceMax, ticks }
}

export function smoothPath(points) {
  if (points.length === 0) return ''
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  }

  const commands = [`M${points[0].x},${points[0].y}`]
  const tension = 0.28

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension

    commands.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`)
  }

  return commands.join(' ')
}

export function areaPath(linePath, points, baselineY) {
  if (!linePath || points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${linePath} L${last.x},${baselineY} L${first.x},${baselineY} Z`
}

export function nearestIndex(points, x) {
  let best = 0
  let bestDistance = Infinity
  points.forEach((point, index) => {
    const distance = Math.abs(point.x - x)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

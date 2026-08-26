export const PAPER_3D = {
  bg: '#f7f5ef',
  card: '#fffdf8',
  card2: '#f0eee7',
  ink: '#171717',
  muted: '#66645e',
  rule: '#d9d6cc',
}

export const ACCENT_3D = {
  orange: '#f26b38',
  yellow: '#e7b93c',
  green: '#5d9b72',
  blue: '#6e9fb5',
  purple: '#8b7bb8',
}

export function hexToRgbTriplet(hex) {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value

  const toLinear = (channel) => {
    const s = parseInt(channel, 16) / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }

  return [
    toLinear(full.slice(0, 2)),
    toLinear(full.slice(2, 4)),
    toLinear(full.slice(4, 6)),
  ]
}

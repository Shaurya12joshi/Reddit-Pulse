/**
 * The 3D palette.
 *
 * These are the *object* colours — the exact display hues from the art
 * direction. They are intentionally the vivid versions: a physical object lit
 * in a scene reads differently from a glyph on paper, and the UI keeps its own
 * darkened `-ink` variants for anything that has to be read as text.
 *
 * Kept as plain hex strings so three.js can consume them directly and so the
 * values stay greppable against the CSS tokens they mirror.
 */

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

/**
 * Hex → linear-ish RGB triplet in 0..1.
 *
 * three.js works in linear space with the default colour management, and
 * instanceColor buffers bypass Color's conversion, so the sRGB→linear step has
 * to happen here or every object comes out washed out.
 */
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

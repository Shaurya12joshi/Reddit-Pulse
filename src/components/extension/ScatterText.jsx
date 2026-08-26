import { useMemo } from 'react'

function drift(seed) {
  const value = Math.sin(seed * 91.7) * 10000
  return value - Math.floor(value)
}

export default function ScatterText({ text, className = '', serif = '', start = 0 }) {
  const characters = useMemo(() => {
    return Array.from(text).map((character, index) => {
      const a = drift(index + 1)
      const b = drift(index + 41)
      const c = drift(index + 97)
      return {
        character,
        index,
        dx: `${(a * 2 - 1) * 260}px`,
        dy: `${(b * 2 - 1) * 200}px`,
        rot: `${(c * 2 - 1) * 90}deg`,
      }
    })
  }, [text])

  return (
    <span className={className}>
      {characters.map((entry) => (
        <span
          key={`${entry.character}-${entry.index}`}
          aria-hidden="true"
          className={`enter enter-scatter char ${serif && entry.character !== ' ' ? serif : ''}`}
          style={{
            '--i': start + entry.index * 0.35,
            '--stagger': 0.05,
            '--dx': entry.dx,
            '--dy': entry.dy,
            '--rot': entry.rot,
          }}
        >
          {entry.character === ' ' ? ' ' : entry.character}
        </span>
      ))}
      <span className="sr-only">{text}</span>
    </span>
  )
}

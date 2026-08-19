import { useEffect, useRef, useState } from 'react'

/**
 * Measure an element so SVG charts can be drawn at real pixel size.
 * Drawing at true size (rather than scaling a fixed viewBox) keeps text crisp
 * and stops labels stretching on wide screens.
 *
 * @returns {[React.RefObject, {width:number, height:number}]}
 */
export default function useElementSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((prev) =>
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width, height },
      )
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}

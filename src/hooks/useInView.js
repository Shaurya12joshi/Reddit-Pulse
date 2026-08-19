import { useEffect, useRef, useState } from 'react'

/**
 * True once the element has scrolled into view, and stays true afterwards —
 * sections should reveal once, not flicker every time they cross the
 * viewport edge on a fast scroll.
 */
export default function useInView({ threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null)
  // Respect reduced-motion users by starting already "in view" — content
  // simply appears rather than being gated behind a scroll trigger.
  const [inView, setInView] = useState(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  )

  useEffect(() => {
    const element = ref.current
    if (!element || inView) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, rootMargin, inView])

  return [ref, inView]
}

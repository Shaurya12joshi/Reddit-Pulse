import { useEffect, useRef } from 'react'

/**
 * Adds `is-in` to every `.reveal` (and to the root, if it carries one) the
 * first time it scrolls into view. One observer for the whole subtree.
 */
export default function useReveal(threshold = 0.18) {
  const ref = useRef(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return undefined

    const targets = [...root.querySelectorAll('.reveal')]
    if (root.classList.contains('reveal') || root.classList.contains('install-panel')) {
      targets.push(root)
    }

    if (typeof IntersectionObserver !== 'function') {
      targets.forEach((node) => node.classList.add('is-in'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    )

    targets.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [threshold])

  return ref
}

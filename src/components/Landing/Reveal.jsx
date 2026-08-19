import useInView from '../../hooks/useInView.js'

/**
 * Fades a section up into place the first time it enters the viewport.
 * Wraps the same `animate-fade-up` keyframe already used for the hero, so
 * scroll-triggered and on-mount reveals look identical.
 */
export default function Reveal({ children, delayMs = 0, className = '', as: Tag = 'div' }) {
  const [ref, inView] = useInView()

  return (
    <Tag
      ref={ref}
      className={`${inView ? 'animate-fade-up' : 'opacity-0'} ${className}`}
      style={inView ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}

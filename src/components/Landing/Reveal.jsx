import useInView from '../../hooks/useInView.js'

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

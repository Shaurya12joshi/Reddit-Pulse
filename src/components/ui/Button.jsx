const VARIANTS = {
  primary:
    'bg-primary text-primary-ink hover:bg-primary-hover border border-transparent disabled:bg-primary/40',
  secondary:
    'bg-elevated text-ink border border-line hover:border-line-strong hover:bg-raised',
  ghost:
    'bg-transparent text-ink-2 border border-transparent hover:text-ink hover:bg-elevated',
  danger:
    'bg-negative/10 text-negative-ink border border-negative/25 hover:bg-negative/15',
}

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
}

export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

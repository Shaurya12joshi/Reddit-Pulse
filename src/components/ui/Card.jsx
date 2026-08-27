export function Card({ children, className = '', as: Tag = 'section', ...props }) {
  return (
    <Tag
      className={`rounded-[14px] border border-line bg-surface ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ title, subtitle, icon, action, className = '' }) {
  return (
    <header
      className={`flex items-start justify-between gap-4 border-b border-line px-5 py-4 ${className}`}
    >
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.01em] text-ink">
          {icon ? <span className="text-ink-3">{icon}</span> : null}
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 text-[13px] leading-snug text-ink-3">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-5 ${className}`}>{children}</div>
}

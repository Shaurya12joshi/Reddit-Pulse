import Icon from './Icon.jsx'

export default function Select({ label, ariaLabel, value, onChange, options, className = '' }) {
  return (
    <label className={`group relative block ${className}`}>
      {label ? (
        <span className="mb-1.5 block text-[11px] font-medium tracking-wide text-ink-3 uppercase">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <select
          aria-label={ariaLabel || label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-line bg-elevated pr-8 pl-3 text-[13px] text-ink transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-elevated">
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
        />
      </div>
    </label>
  )
}

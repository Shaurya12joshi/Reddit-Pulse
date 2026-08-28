import { useState } from 'react'
import Icon from '../ui/Icon.jsx'

export default function SearchBar({
  onSubmit,
  id,
  disabled = false,
  pending = false,
  allowEmpty = false,
  initialValue = '',
  size = 'lg',
  placeholder = 'Company name or website',
}) {
  const [value, setValue] = useState(initialValue)

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = value.trim()
    if ((trimmed || allowEmpty) && !disabled && !pending) onSubmit(trimmed)
  }

  const large = size === 'lg'

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`group flex items-center gap-3 border-b border-ink/25 transition-colors focus-within:border-ink ${
          large ? 'pb-3' : 'pb-1.5'
        }`}
      >
        <Icon
          name="search"
          className={`shrink-0 text-ink-3 ${large ? 'h-5 w-5' : 'h-4 w-4'}`}
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          disabled={disabled || pending}
          aria-label="Company or brand name"
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-3/70 focus:outline-none ${
            large ? 'text-[20px] sm:text-[24px]' : 'text-[14px]'
          }`}
        />
        <button
          type="submit"
          disabled={disabled || pending || (!value.trim() && !allowEmpty)}
          className={`shrink-0 rounded-full bg-primary font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-raised disabled:text-ink-3 ${
            large ? 'h-11 px-6 text-[14px]' : 'h-8 px-4 text-[12px]'
          }`}
        >
          {pending ? 'Reading…' : 'Analyze'}
        </button>
      </div>
    </form>
  )
}

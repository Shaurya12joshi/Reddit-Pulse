import { useEffect, useState } from 'react'

import Icon from '../ui/Icon.jsx'

export default function CopyLine({ value, label }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    const done = await navigator.clipboard
      ?.writeText(value)
      .then(() => true)
      .catch(() => false)
    setCopied(Boolean(done))
  }

  return (
    <span className="inline-flex items-center overflow-hidden rounded-md border border-line bg-elevated/85 align-middle">
      <code className="px-2 py-1 font-mono text-[12.5px] text-ink">{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        className="flex h-7 w-7 items-center justify-center border-l border-line text-ink-3 transition-colors hover:bg-raised hover:text-ink"
      >
        <Icon name={copied ? 'check' : 'layers'} className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

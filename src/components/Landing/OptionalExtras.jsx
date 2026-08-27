import { useId } from 'react'

import Icon from '../ui/Icon.jsx'

// Two things the report cannot guess at: a rival the user specifically wants
// weighed, and a product or question they specifically want Reddit's answer
// on. Both are shown open, because a fold hid them well enough that nobody
// found them. The copy carries the caveat people miss — rivals are already
// found automatically, so this field is for forcing one in particular.

function Field({ icon, title, hint, id, value, placeholder, onChange }) {
  return (
    <div className="rounded-[12px] border border-line bg-canvas/70 p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-elevated text-ink-2">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-ink">{title}</span>
      </div>

      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-3/70 transition-colors focus:border-ink focus:outline-none"
      />

      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">{hint}</p>
    </div>
  )
}

export default function OptionalExtras({ compareWith, subject, onChange }) {
  const compareId = useId()
  const subjectId = useId()

  return (
    <div className="mt-7 rounded-[16px] border border-line bg-surface/95 p-4 text-left shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent-ink uppercase">
          Optional
        </span>
        <p className="text-[12.5px] text-ink-2">
          Want something specific in the report? Fill either in, or leave both empty.
        </p>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        <Field
          icon="scale"
          title="Compare against a company"
          id={compareId}
          placeholder="e.g. Samsung"
          value={compareWith}
          onChange={(value) => onChange({ compareWith: value, subject })}
          hint="Rivals are found and compared automatically already. Name one here and it gets its own full head-to-head: dimension by dimension, with quotes."
        />

        <Field
          icon="quote"
          title="Ask about a product or service"
          id={subjectId}
          placeholder="e.g. the iPhone 17 camera"
          value={subject}
          onChange={(value) => onChange({ compareWith, subject: value })}
          hint="One product, service or question, and the collected discussions are read for an answer: themes, praise, complaints, and the threads behind each."
        />
      </div>
    </div>
  )
}

import { useId } from 'react'

import Icon from '../ui/Icon.jsx'

function Field({ icon, title, hint, id, value, placeholder, onChange, badge }) {
  return (
    <div className="rounded-[12px] border border-line bg-canvas/70 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-elevated text-ink-2">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        {badge ? (
          <span className="rounded-full bg-accent-dim px-1.5 py-0.5 text-[10px] font-medium text-accent-ink">
            {badge}
          </span>
        ) : null}
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

export default function OptionalExtras({ compareWith, subject, rivalProduct, onChange }) {
  const compareId = useId()
  const subjectId = useId()
  const rivalId = useId()

  const set = (patch) => onChange({ compareWith, subject, rivalProduct, ...patch })

  const pairReady = Boolean(subject.trim()) && Boolean(rivalProduct.trim() || compareWith.trim())

  return (
    <div className="mt-7 rounded-[16px] border border-line bg-surface/95 p-4 text-left shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent-ink uppercase">
          Optional
        </span>
        <p className="text-[12.5px] text-ink-2">
          Want something specific in the report? Fill in what you have, and leave the rest.
        </p>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        <Field
          icon="scale"
          title="Compare against a company"
          id={compareId}
          placeholder="e.g. Spotify"
          value={compareWith}
          onChange={(value) => set({ compareWith: value })}
          hint="Rivals are found and compared automatically already. Name one here and it gets its own full head-to-head: dimension by dimension, with quotes."
        />

        <Field
          icon="quote"
          title="Your product or service"
          id={subjectId}
          placeholder="e.g. Apple Music"
          value={subject}
          onChange={(value) => set({ subject: value })}
          hint="Read out of the discussions for you: themes, praise, complaints and the threads behind each. Name a company alongside it and it is weighed against their equivalent too."
        />
      </div>

      <div className="mt-3">
        <Field
          icon="layers"
          title="Their product, if you have one in mind"
          id={rivalId}
          placeholder="e.g. Spotify Premium, or leave empty"
          value={rivalProduct}
          onChange={(value) => set({ rivalProduct: value })}
          badge={pairReady ? 'Product comparison on' : null}
          hint="Leave it empty and the counterpart is worked out from the company above. Either way the two products get their own read: dimension by dimension, who each suits, and the quotes behind it."
        />
      </div>
    </div>
  )
}

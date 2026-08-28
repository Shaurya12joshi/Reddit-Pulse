import { useId } from 'react'

import Icon from '../ui/Icon.jsx'

function Field({ icon, title, hint, id, value, placeholder, onChange, badge }) {
  return (
    <div className="rounded-[10px] border border-line bg-canvas/70 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Icon name={icon} className="h-3.5 w-3.5 shrink-0 text-ink-3" />
        <label htmlFor={id} className="text-[12px] font-semibold text-ink">
          {title}
        </label>
        {badge ? (
          <span className="rounded-full bg-accent-dim px-1.5 py-0.5 text-[9.5px] font-medium text-accent-ink">
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
        className="mt-2 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-3/70 transition-colors focus:border-ink focus:outline-none"
      />

      <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{hint}</p>
    </div>
  )
}

export default function OptionalExtras({
  compareWith,
  subject,
  rivalProduct,
  onChange,
}) {
  const compareId = useId()
  const subjectId = useId()
  const rivalId = useId()

  const set = (patch) => onChange({ compareWith, subject, rivalProduct, ...patch })

  const pairReady = Boolean(subject.trim()) && Boolean(rivalProduct.trim() || compareWith.trim())

  return (
    <div className="mt-4 rounded-[14px] border border-line bg-surface/95 p-3 text-left shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-accent-dim px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide text-accent-ink uppercase">
          Optional
        </span>
        <p className="text-[11.5px] text-ink-2">Fill in what you have, leave the rest.</p>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        <Field
          icon="scale"
          title="A rival company"
          id={compareId}
          placeholder="e.g. Spotify"
          value={compareWith}
          onChange={(value) => set({ compareWith: value })}
          hint="Gets its own head-to-head. Rivals are found automatically either way."
        />

        <Field
          icon="quote"
          title="Your product"
          id={subjectId}
          placeholder="e.g. Apple Music"
          value={subject}
          onChange={(value) => set({ subject: value })}
          hint="Read for themes, praise and complaints, with the threads behind each."
        />

        <Field
          icon="layers"
          title="Their product"
          id={rivalId}
          placeholder="e.g. Spotify Premium"
          value={rivalProduct}
          onChange={(value) => set({ rivalProduct: value })}
          badge={pairReady ? 'On' : null}
          hint="Blank is fine: the counterpart is worked out from the rival company."
        />
      </div>
    </div>
  )
}

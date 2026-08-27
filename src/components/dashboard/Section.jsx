// The report is a long wall of cards. Grouping them under one small label
// each gives the page a second level of hierarchy, so a reader scans six
// sections instead of thirteen equally loud panels.
export default function Section({ title, description, children }) {
  return (
    <section>
      <div className="mb-4 border-b border-line pb-2.5">
        <h2 className="text-[11px] font-semibold tracking-[0.09em] text-ink-2 uppercase">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{description}</p>
        ) : null}
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  )
}

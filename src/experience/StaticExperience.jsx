import { ACTS } from './acts.js'

/**
 * The no-WebGL / reduced-motion route.
 *
 * Not a degraded stub — the same twelve acts, the same words, the same order,
 * laid out as an editorial page instead of a camera move. Someone who never
 * sees the 3D still gets the whole argument, which is the actual requirement
 * behind "provide a usable fallback".
 *
 * `fallbackSections` carries the content that exists as geometry on the
 * immersive route — the report panels and the discussion list. Those are
 * measurements and quotations, and a reader on this route needs them just as
 * much; they simply arrive as charts and cards instead of as objects.
 */
export default function StaticExperience({ children, fallbackSections }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pt-24 pb-16 sm:px-10">
      {ACTS.map((act, index) => {
        const isFirst = index === 0
        const isLast = index === ACTS.length - 1

        return (
          <article
            key={act.id}
            className={`border-line py-16 ${index > 0 ? 'border-t' : ''}`}
          >
            <div className="mb-6 flex items-center gap-3">
              {act.step ? (
                <span className="tnum flex h-8 w-8 items-center justify-center rounded-full border border-ink text-[12px] font-semibold text-ink">
                  {act.step}
                </span>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              )}
              <span className="eyebrow text-ink-3">{act.eyebrow}</span>
            </div>

            <h2
              className={`display text-ink ${
                isFirst ? 'text-[11vw] sm:text-6xl lg:text-7xl' : 'text-[8vw] sm:text-4xl lg:text-5xl'
              }`}
            >
              {act.title.map((line, lineIndex) => (
                <span key={lineIndex} className="block">
                  {renderLine(line, act.serifWord)}
                </span>
              ))}
            </h2>

            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-2">
              {act.body}
            </p>

            {isLast && children ? <div className="mt-9">{children}</div> : null}

            {/* The report's own numbers, shown where the immersive route
                builds them out of geometry. */}
            {act.id === 'report' && fallbackSections ? (
              <div className="mt-10">{fallbackSections}</div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}

function renderLine(line, serifWord) {
  if (!serifWord || !line.includes(serifWord)) return line
  const [before, after] = line.split(serifWord)
  return (
    <>
      {before}
      <em className="display-serif">{serifWord}</em>
      {after}
    </>
  )
}

import Reveal from './Reveal.jsx'

const AUDIENCE = [
  {
    n: '01',
    title: 'Founders',
    body: 'Validate an idea, or read how your product is actually landing, before you ask anyone directly.',
    accent: 'bg-accent',
  },
  {
    n: '02',
    title: 'Product teams',
    body: 'Find which features get praised, which get complained about, and what people keep wishing existed.',
    accent: 'bg-info',
  },
  {
    n: '03',
    title: 'Marketing teams',
    body: 'Borrow the language customers already use, and see which comparisons come up unprompted.',
    accent: 'bg-highlight',
  },
  {
    n: '04',
    title: 'Researchers',
    body: 'Pull a structured, sourced view of public opinion instead of reading threads by hand.',
    accent: 'bg-positive',
  },
  {
    n: '05',
    title: 'Brand monitoring',
    body: 'Catch shifting sentiment and emerging complaints while they are still small.',
    accent: 'bg-secondary',
  },
]

/**
 * An editorial index rather than a card grid — numbered rows on hairlines,
 * with a single colour chip per entry as the only ornament.
 */
export default function WhoItsFor() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-28 sm:px-10">
      <Reveal className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <span className="eyebrow text-ink-3">Who it&apos;s for</span>
          <h2 className="display mt-6 text-[11vw] text-ink sm:text-5xl lg:text-[3.6vw]">
            For anyone who needs the <em className="display-serif">truth</em>,
            not a survey.
          </h2>
        </div>

        <ul className="lg:pt-4">
          {AUDIENCE.map((item, index) => (
            <Reveal
              key={item.title}
              as="li"
              delayMs={index * 60}
              className="group border-t border-line last:border-b"
            >
              <div className="flex items-baseline gap-5 py-6 transition-[padding] duration-300 group-hover:pl-2">
                <span className="tnum eyebrow shrink-0 text-ink-3">{item.n}</span>
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.accent}`}
                />
                <div className="min-w-0">
                  <h3 className="text-[18px] font-semibold tracking-tight text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-ink-3">
                    {item.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}

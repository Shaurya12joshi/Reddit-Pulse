import AnalyzeCta from './AnalyzeCta.jsx'
import Reveal from './Reveal.jsx'

export default function FinalCta({ onAnalyze, dataSource, onOpenSettings }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pt-10 pb-32 sm:px-10">
      <Reveal className="border-t border-line pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <span className="eyebrow text-ink-3">Start here</span>
            <h2 className="display mt-6 text-[13vw] text-ink sm:text-6xl lg:text-[5.2vw]">
              See what <em className="display-serif">Reddit</em>
              <br />
              is saying.
            </h2>
          </div>

          <AnalyzeCta
            id="analyze"
            onAnalyze={onAnalyze}
            dataSource={dataSource}
            onOpenSettings={onOpenSettings}
          />
        </div>
      </Reveal>
    </section>
  )
}

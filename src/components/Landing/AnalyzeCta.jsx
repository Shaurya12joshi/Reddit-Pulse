import { useId, useState } from 'react'

import AiConnectionNote from './AiConnectionNote.jsx'
import ExtensionNote from './ExtensionNote.jsx'
import OptionalExtras from './OptionalExtras.jsx'
import { SEARCH_ANCHOR } from '../../experience/goToSearch.js'
import SearchBar from './SearchBar.jsx'
import Icon from '../ui/Icon.jsx'
import { EXAMPLE_COMPANIES } from '../../data/exampleCompanies.js'

export default function AnalyzeCta({ onAnalyze, resolving = false, id = SEARCH_ANCHOR }) {
  const fieldId = useId()
  const [extras, setExtras] = useState({
    compareWith: '',
    subject: '',
    rivalProduct: '',
    keywords: '',
  })

  const keywords = (extras.keywords ?? '').trim()

  const start = (name) => {
    const company = String(name || '').trim()
    if (!company && !keywords) return

    onAnalyze(company, {
      compareWith: extras.compareWith.trim(),
      subject: extras.subject.trim(),
      rivalProduct: extras.rivalProduct.trim(),
      keywords,
      fieldOnly: !company,
    })
  }

  return (
    <div id={id} className="w-full max-w-2xl scroll-mt-24">
      <SearchBar
        onSubmit={start}
        id="company-search"
        pending={resolving}
        allowEmpty={Boolean(keywords)}
      />

      <div className="mt-3.5 flex items-center gap-3 border-b border-ink/15 pb-2 transition-colors focus-within:border-ink/50">
        <Icon name="layers" className="h-4 w-4 shrink-0 text-ink-3" />
        <input
          id={fieldId}
          type="text"
          value={extras.keywords ?? ''}
          placeholder="Your field, if Reddit barely mentions you yet"
          onChange={(event) =>
            setExtras((current) => ({ ...current, keywords: event.target.value }))
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              start(document.getElementById('company-search')?.value ?? '')
            }
          }}
          aria-label="Your field, in keywords"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3/70 focus:outline-none"
        />
        {keywords ? (
          <span className="shrink-0 rounded-full bg-accent-dim px-2 py-0.5 text-[10px] font-medium text-accent-ink">
            Field scan on
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-left text-[11.5px] leading-relaxed text-ink-3">
        A startup or a quiet brand has little on Reddit to read. Name the field instead, for example
        <span className="text-ink-2"> expense management software</span>, and the report covers the
        market: who is in it, what buyers ask for, and where the gaps are. The company name is
        optional once a field is named.
      </p>

      <OptionalExtras
        compareWith={extras.compareWith}
        subject={extras.subject}
        rivalProduct={extras.rivalProduct}
        keywords={extras.keywords}
        onChange={(patch) => setExtras((current) => ({ ...current, ...patch }))}
      />

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <AiConnectionNote />
        <ExtensionNote />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="eyebrow mr-1 text-ink-3">Try</span>
        {EXAMPLE_COMPANIES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => start(name)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            {name}
          </button>
        ))}
      </div>

    </div>
  )
}

import { useState } from 'react'

import AiConnectionNote from './AiConnectionNote.jsx'
import ExtensionNote from './ExtensionNote.jsx'
import OptionalExtras from './OptionalExtras.jsx'
import { SEARCH_ANCHOR } from '../../experience/goToSearch.js'
import SearchBar from './SearchBar.jsx'
import { EXAMPLE_COMPANIES } from '../../data/exampleCompanies.js'

export default function AnalyzeCta({ onAnalyze, id = SEARCH_ANCHOR }) {
  const [extras, setExtras] = useState({ compareWith: '', subject: '', rivalProduct: '' })

  const start = (name) =>
    onAnalyze(name, {
      compareWith: extras.compareWith.trim(),
      subject: extras.subject.trim(),
      rivalProduct: extras.rivalProduct.trim(),
    })

  return (
    <div id={id} className="w-full max-w-xl scroll-mt-24">
      <SearchBar onSubmit={start} id="company-search" />

      <OptionalExtras
        compareWith={extras.compareWith}
        subject={extras.subject}
        rivalProduct={extras.rivalProduct}
        onChange={setExtras}
      />

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <AiConnectionNote />
        <ExtensionNote />
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
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

import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import { useAiConnection } from '../hooks/useAiConnection.js'

function ProviderCard({ provider, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(provider.id)}
      aria-pressed={selected}
      className={`flex min-h-[5.5rem] w-full flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors ${
        selected
          ? 'border-accent bg-accent-dim/60'
          : 'border-line bg-elevated hover:border-line-strong hover:bg-raised'
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">{provider.label}</span>
        {selected ? <Icon name="check" className="h-4 w-4 shrink-0 text-accent-ink" /> : null}
      </span>
      <span className="text-[12px] leading-snug text-ink-3">{provider.tagline}</span>
    </button>
  )
}

export default function ConnectAiPage() {
  const { catalogue, connection, checking, connect, disconnect } = useAiConnection()

  const [chosen, setChosen] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [remember, setRemember] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [problem, setProblem] = useState(null)
  const [done, setDone] = useState(null)

  const keyRef = useRef(null)
  const modelRef = useRef(null)
  const baseUrlRef = useRef(null)

  const ids = useId()
  const keyId = `${ids}-key`
  const keyHelpId = `${ids}-key-help`
  const keyErrorId = `${ids}-key-error`
  const modelId = `${ids}-model`
  const modelErrorId = `${ids}-model-error`
  const baseUrlId = `${ids}-base`
  const baseUrlErrorId = `${ids}-base-error`
  const rememberId = `${ids}-remember`

  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => setDone(null), 6000)
    return () => clearTimeout(timer)
  }, [done])

  if (catalogue.status === 'loading') {
    return (
      <main className="mx-auto min-h-dvh max-w-3xl px-6 py-12">
        <div className="h-9 w-56 animate-pulse rounded bg-elevated" />
        <div className="mt-8 h-72 animate-pulse rounded-[14px] bg-elevated" />
      </main>
    )
  }

  if (catalogue.status === 'error') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-[17px] font-semibold text-ink">Something went wrong</h1>
        <p className="text-[13px] leading-relaxed text-ink-3">
          The list of AI services could not be loaded. Refresh the page to try again.
        </p>
        <div className="flex justify-center">
          <Button onClick={() => window.location.reload()}>
            <Icon name="refresh" className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </main>
    )
  }

  const providers = catalogue.providers
  const recommended = providers.find((entry) => entry.recommended)
  const others = providers.filter((entry) => !entry.recommended)

  const activeId = chosen ?? connection?.provider ?? recommended?.id
  const selected = providers.find((entry) => entry.id === activeId) || recommended
  const connected = providers.find((entry) => entry.id === connection?.provider) || null
  const currentModel = model ?? (connection?.provider === selected?.id ? connection.model : '') ?? ''

  const pick = (id) => {
    setChosen(id)
    setModel(null)
    setProblem(null)
    if (id !== connection?.provider) setApiKey('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setProblem(null)

    const draft = {
      provider: selected.id,
      label: selected.label,
      apiKey: apiKey.trim(),
      model: currentModel.trim() || selected.models[0] || '',
      baseUrl: baseUrl.trim(),
      remember,
    }

    const result = await connect(draft)
    if (!result.ok) {
      setProblem(result)
      const target =
        result.field === 'model'
          ? modelRef.current
          : result.field === 'baseUrl'
            ? baseUrlRef.current
            : keyRef.current
      target?.focus()
      return
    }

    setApiKey('')
    setRevealed(false)
    setDone(`Connected to ${selected.label}. Every report you run now uses your account.`)
  }

  const handleDisconnect = () => {
    disconnect()
    setApiKey('')
    setChosen(null)
    setModel(null)
    setDone('Disconnected. Reports go back to the built-in setup.')
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 py-10">
      <Link
        to="/#analyze"
        className="inline-flex items-center gap-1.5 py-1 text-[12px] text-ink-3 transition-colors hover:text-ink"
      >
        <Icon name="chevronRight" className="h-3.5 w-3.5 rotate-180" />
        Back to search
      </Link>

      <header className="mt-4">
        <p className="eyebrow text-ink-3">AI</p>
        <h1 className="mt-1.5 max-w-[20ch] text-[26px] font-semibold tracking-tight text-balance text-ink">
          Use your own AI account
        </h1>
        <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-2">
          Reports are read and written by an AI model. Connect an account and every report you run
          goes through it: your models, your usage, your control.
        </p>
      </header>

      <div
        className={`mt-6 flex flex-wrap items-center gap-2.5 rounded-xl border px-4 py-3 ${
          connected
            ? 'border-positive/30 bg-positive/10'
            : 'border-line bg-elevated'
        }`}
      >
        <Icon
          name={connected ? 'check' : 'spark'}
          className={`h-4 w-4 shrink-0 ${connected ? 'text-positive-ink' : 'text-ink-3'}`}
        />
        <p className="text-[13px] leading-relaxed text-ink-2">
          {connected ? (
            <>
              Connected to <span className="font-semibold text-ink">{connected.label}</span>
              {connection.model ? (
                <span className="text-ink-3"> · {connection.model}</span>
              ) : null}
            </>
          ) : catalogue.siteReady ? (
            'You are on the built-in setup. It works, but it is shared with everyone else here.'
          ) : (
            'No AI connected yet. Reports fall back to basic analysis until you connect one.'
          )}
        </p>
        {connected ? (
          <Button variant="ghost" size="sm" onClick={handleDisconnect} className="ml-auto">
            Disconnect
          </Button>
        ) : null}
      </div>

      <div aria-live="polite" className="mt-4 empty:mt-0">
        {done ? (
          <p className="flex items-start gap-2 rounded-lg border border-positive/30 bg-positive/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-positive-ink">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
            {done}
          </p>
        ) : null}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <fieldset>
          <legend className="mb-2.5 text-[11px] font-medium tracking-wide text-ink-3 uppercase">
            Choose a service
          </legend>

          {recommended ? (
            <button
              type="button"
              onClick={() => pick(recommended.id)}
              aria-pressed={activeId === recommended.id}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                activeId === recommended.id
                  ? 'border-accent bg-accent-dim/60'
                  : 'border-line bg-elevated hover:border-line-strong hover:bg-raised'
              }`}
            >
              <Icon name="layers" className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{recommended.label}</span>
                  <span className="rounded-full border border-accent/40 bg-surface px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent-ink uppercase">
                    Easiest
                  </span>
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-ink-2">
                  {recommended.blurb}
                </span>
              </span>
              {activeId === recommended.id ? (
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
              ) : null}
            </button>
          ) : null}

          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                selected={activeId === provider.id}
                onSelect={pick}
              />
            ))}
          </div>
        </fieldset>

        {selected ? (
          <Card>
            <CardHeader
              title={selected.label}
              subtitle={selected.blurb}
              icon={<Icon name="key" className="h-4 w-4" />}
              action={
                selected.keyUrl ? (
                  <a
                    href={selected.keyUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-2 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                  >
                    Get a key
                    <Icon name="arrowOut" className="h-3.5 w-3.5" />
                  </a>
                ) : null
              }
            />
            <CardBody className="space-y-5">
              <div>
                <label
                  htmlFor={keyId}
                  className="mb-1.5 block text-[11px] font-medium tracking-wide text-ink-3 uppercase"
                >
                  Your key
                </label>
                <div className="relative">
                  <input
                    id={keyId}
                    ref={keyRef}
                    type={revealed ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(event) => {
                      setApiKey(event.target.value)
                      if (problem) setProblem(null)
                    }}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="Paste it here"
                    aria-describedby={problem?.field === 'apiKey' ? keyErrorId : keyHelpId}
                    aria-invalid={problem?.field === 'apiKey' || undefined}
                    className={`h-11 w-full rounded-lg border bg-elevated pr-12 pl-3 font-mono text-[13px] text-ink transition-colors focus:border-accent focus:outline-none ${
                      problem?.field === 'apiKey' ? 'border-negative' : 'border-line'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setRevealed((value) => !value)}
                    aria-pressed={revealed}
                    aria-label={revealed ? 'Hide your key' : 'Show your key'}
                    className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-raised hover:text-ink"
                  >
                    <Icon name={revealed ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                  </button>
                </div>
                {problem?.field === 'apiKey' || (problem && !problem.field) ? (
                  <p
                    id={keyErrorId}
                    role="alert"
                    className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-negative-ink"
                  >
                    <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {problem.message}
                  </p>
                ) : (
                  <p id={keyHelpId} className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
                    {selected.keyHint
                      ? `${selected.keyHint}. It stays in this browser and is never shown to anyone else.`
                      : 'It stays in this browser and is never shown to anyone else.'}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={modelId}
                    className="mb-1.5 block text-[11px] font-medium tracking-wide text-ink-3 uppercase"
                  >
                    Model
                  </label>
                  <input
                    id={modelId}
                    ref={modelRef}
                    list={`${modelId}-options`}
                    value={currentModel}
                    onChange={(event) => {
                      setModel(event.target.value)
                      if (problem?.field === 'model') setProblem(null)
                    }}
                    spellCheck="false"
                    placeholder={selected.models[0] || 'Model name'}
                    aria-describedby={problem?.field === 'model' ? modelErrorId : undefined}
                    aria-invalid={problem?.field === 'model' || undefined}
                    className={`h-11 w-full rounded-lg border bg-elevated px-3 font-mono text-[13px] text-ink transition-colors focus:border-accent focus:outline-none ${
                      problem?.field === 'model' ? 'border-negative' : 'border-line'
                    }`}
                  />
                  <datalist id={`${modelId}-options`}>
                    {selected.models.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {problem?.field === 'model' ? (
                    <p
                      id={modelErrorId}
                      role="alert"
                      className="mt-1.5 text-[12px] leading-relaxed text-negative-ink"
                    >
                      {problem.message}
                    </p>
                  ) : null}
                </div>

                {selected.needsBaseUrl ? (
                  <div>
                    <label
                      htmlFor={baseUrlId}
                      className="mb-1.5 block text-[11px] font-medium tracking-wide text-ink-3 uppercase"
                    >
                      Address
                    </label>
                    <input
                      id={baseUrlId}
                      ref={baseUrlRef}
                      type="url"
                      value={baseUrl}
                      onChange={(event) => {
                        setBaseUrl(event.target.value)
                        if (problem?.field === 'baseUrl') setProblem(null)
                      }}
                      spellCheck="false"
                      placeholder="https://…"
                      aria-describedby={problem?.field === 'baseUrl' ? baseUrlErrorId : undefined}
                      aria-invalid={problem?.field === 'baseUrl' || undefined}
                      className={`h-11 w-full rounded-lg border bg-elevated px-3 font-mono text-[13px] text-ink transition-colors focus:border-accent focus:outline-none ${
                        problem?.field === 'baseUrl' ? 'border-negative' : 'border-line'
                      }`}
                    />
                    {problem?.field === 'baseUrl' ? (
                      <p
                        id={baseUrlErrorId}
                        role="alert"
                        className="mt-1.5 text-[12px] leading-relaxed text-negative-ink"
                      >
                        {problem.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <label htmlFor={rememberId} className="flex cursor-pointer items-start gap-2.5">
                <input
                  id={rememberId}
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent-ink"
                />
                <span>
                  <span className="block text-[13px] font-medium text-ink">Stay connected</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-3">
                    Keeps you connected next time you visit on this device. Turn it off on a shared
                    computer and the connection ends when you close the tab.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-5">
                <Button type="submit" variant="primary" disabled={checking || !apiKey.trim()}>
                  {checking ? (
                    <Icon
                      name="refresh"
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <Icon name="plug" className="h-4 w-4" />
                  )}
                  {checking ? 'Checking' : 'Connect'}
                </Button>
                <p className="text-[12px] text-ink-3">We check the key works before saving it.</p>
              </div>
            </CardBody>
          </Card>
        ) : null}
      </form>
    </main>
  )
}

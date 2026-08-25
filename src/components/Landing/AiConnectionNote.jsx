import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import Icon from '../ui/Icon.jsx'
import { getConnection, subscribe } from '../../services/aiConnection.js'

/**
 * Sits under the search field as a pill, matching the example chips below it.
 * Says which AI account the next report runs on and leads to changing it —
 * present, but never competing with the Analyze button.
 */
export default function AiConnectionNote() {
  const [connection, setConnection] = useState(() => getConnection())

  useEffect(() => subscribe(setConnection), [])

  const connected = Boolean(connection?.apiKey)
  const name = connection?.label || connection?.provider

  return (
    <Link
      to="/connect"
      aria-label={
        connected
          ? `Reports are using your ${name} account. Change your AI connection`
          : 'Connect your own AI account'
      }
      className={`group mt-5 inline-flex items-center gap-2.5 rounded-full border py-2.5 pr-3.5 pl-3 text-[13px] transition-colors ${
        connected
          ? 'border-positive/30 bg-positive/8 hover:border-positive/60'
          : 'border-line bg-surface hover:border-ink'
      }`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {connected ? null : (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/60 motion-reduce:hidden" />
        )}
        <span
          className={`relative h-2 w-2 rounded-full ${connected ? 'bg-positive' : 'bg-accent'}`}
        />
      </span>

      <span className="text-ink-3">
        {connected ? (
          <>
            Using your <span className="font-medium text-ink">{name}</span>
            {connection.model ? (
              <span className="hidden text-ink-3 sm:inline"> · {connection.model}</span>
            ) : null}
          </>
        ) : (
          <>
            Shared AI · <span className="font-medium text-ink">use your own key</span>
          </>
        )}
      </span>

      <Icon
        name="chevronRight"
        className="h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"
      />
    </Link>
  )
}

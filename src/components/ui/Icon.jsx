
const PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  spark: (
    <path d="M12 3v4m0 10v4m9-9h-4M7 12H3m13.5-5.5-2.8 2.8m-3.4 3.4-2.8 2.8m9 0-2.8-2.8m-3.4-3.4L7.5 6.5" />
  ),
  trendUp: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 7h-5m5 0v5" />
    </>
  ),
  trendDown: (
    <>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M21 17h-5m5 0v-5" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 1 1 21 12Z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2A3.2 3.2 0 0 1 16 11m1 2.4a5.5 5.5 0 0 1 4 5.3" />
    </>
  ),
  arrowUp: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  arrowOut: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14a1.6 1.6 0 0 0 .33 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.33 1.6 1.6 0 0 0-1 1.47V20a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9.1 18.4a1.6 1.6 0 0 0-1.77.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.83 14a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.9a1.6 1.6 0 0 0-.33-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 3.63 1.6 1.6 0 0 0 10 2.16V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 8v.09a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m4 12 5 5L20 6" />,
  alert: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17.4" r="0.6" fill="currentColor" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 6.3" />
      <path d="M20 5v6h-6" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  flame: (
    <path d="M12 21c3.9 0 6.5-2.5 6.5-6 0-4.5-4.5-6-4-12-3 2-5 4.5-5 7 0 1.2.4 2 .4 2S8 11 7 9.5C6 11 5.5 12.9 5.5 15c0 3.5 2.6 6 6.5 6Z" />
  ),
  reddit: (
    <>
      <circle cx="12" cy="13" r="8" />
      <circle cx="9" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <path d="M9 16c1.8 1.2 4.2 1.2 6 0" />
      <path d="m13.5 5.5.8-3 3 .7" />
      <circle cx="18.4" cy="3.6" r="1.3" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10" />
      <path d="M4 9h6l-3 5-3-5Zm10 0h6l-3 5-3-5Z" />
      <path d="M12 5 5 8m7-3 7 3" />
    </>
  ),
  quote: (
    <path d="M9 7c-2.5 1-4 3.2-4 6v4h5v-5H7c0-1.8.8-3.2 2.4-4L9 7Zm9 0c-2.5 1-4 3.2-4 6v4h5v-5h-3c0-1.8.8-3.2 2.4-4L18 7Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
}

export default function Icon({ name, className = 'h-4 w-4', strokeWidth = 1.6 }) {
  const path = PATHS[name]
  if (!path) return null

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  )
}

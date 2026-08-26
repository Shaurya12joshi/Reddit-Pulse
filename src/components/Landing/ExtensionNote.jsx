import Icon from '../ui/Icon.jsx'
import { EXTENSION_GUIDE_PATH, EXTENSION_REPO_URL } from '../../services/links.js'

export default function ExtensionNote() {
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-full border border-line bg-surface text-[13px]">
      <a
        href={EXTENSION_GUIDE_PATH}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2.5 py-2.5 pr-3 pl-3.5 transition-colors hover:bg-elevated"
      >
        <Icon name="puzzle" className="h-4 w-4 shrink-0 text-ink" strokeWidth={1.6} />
        <span className="text-ink-3">
          Collector <span className="font-medium text-ink">install guide</span>
        </span>
      </a>
      <a
        href={EXTENSION_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the collector's GitHub repository"
        title="View on GitHub"
        className="inline-flex items-center border-l border-line px-3 text-ink-3 transition-colors hover:bg-elevated hover:text-ink"
      >
        <Icon name="github" className="h-4 w-4" strokeWidth={1.7} />
      </a>
    </span>
  )
}

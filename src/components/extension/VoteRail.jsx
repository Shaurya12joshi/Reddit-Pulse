import Icon from '../ui/Icon.jsx'

export default function VoteRail({ score, voted, onVote, label, size = 'md' }) {
  const compact = size === 'sm'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onVote}
        aria-pressed={voted}
        title={voted ? 'Undo' : 'Upvote when done'}
        aria-label={voted ? `${label} done, undo` : `Mark ${label} as done`}
        className={`flex items-center justify-center rounded-md transition-all hover:scale-110 motion-reduce:hover:scale-100 ${
          compact ? 'h-6 w-6' : 'h-8 w-8'
        } ${voted ? 'text-[#ff4500]' : 'text-ink-3 hover:bg-elevated hover:text-[#ff4500]'}`}
      >
        <Icon
          name="arrowUp"
          className={compact ? 'h-4 w-4' : 'h-5 w-5'}
          strokeWidth={voted ? 2.6 : 1.9}
        />
      </button>
      <span
        className={`tnum font-semibold ${compact ? 'text-[11px]' : 'text-[12px]'} ${
          voted ? 'text-[#ff4500]' : 'text-ink-2'
        }`}
      >
        {score}
      </span>
      <span
        aria-hidden="true"
        className={`flex items-center justify-center text-line-strong ${compact ? 'h-4' : 'h-5'}`}
      >
        <Icon name="arrowUp" className={compact ? 'h-3.5 w-3.5 rotate-180' : 'h-4 w-4 rotate-180'} />
      </span>
    </div>
  )
}

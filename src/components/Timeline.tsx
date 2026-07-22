import { phaseFromRank, shortPhaseLabel } from '../projections'

type Props = {
  /** Rank of the game's current (live) phase. */
  currentRank: number
  /** Rank currently being viewed. */
  viewRank: number
  onSelect: (rank: number) => void
}

/**
 * A pill per phase from Night 1 up to now. Tapping one reviews the diagram/log as
 * of that phase; the last pill is live. Discrete pills beat a slider on a phone —
 * easier to hit, and phases are naturally discrete.
 */
export function Timeline({ currentRank, viewRank, onSelect }: Props) {
  const FIRST = 2 // Night 1
  const ranks: number[] = []
  for (let r = FIRST; r <= currentRank; r++) ranks.push(r)

  const reviewing = viewRank < currentRank

  return (
    <div className="mt-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {ranks.map((r) => {
          const { round, phase } = phaseFromRank(r)
          const isView = r === viewRank
          const isLive = r === currentRank
          return (
            <button
              key={r}
              onClick={() => onSelect(r)}
              className={[
                'min-w-9 shrink-0 rounded-lg border px-2 py-1.5 text-xs font-medium tabular-nums',
                isView
                  ? 'border-info bg-info/20 text-ink'
                  : 'border-line bg-surface text-muted active:bg-raised',
                isLive && !isView ? 'ring-1 ring-line' : '',
              ].join(' ')}
              aria-current={isView ? 'true' : undefined}
            >
              {shortPhaseLabel(round, phase)}
            </button>
          )
        })}
      </div>

      {reviewing && (
        <button
          onClick={() => onSelect(currentRank)}
          className="mt-1 w-full rounded-lg border border-info/40 bg-info/10 py-1.5 text-xs text-info active:bg-info/20"
        >
          Reviewing the past · tap to return to live
        </button>
      )}
    </div>
  )
}

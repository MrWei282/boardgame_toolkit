import { phaseFromRank, shortPhaseLabel } from '../projections'

type Props = {
  /** Rank of the game's current (live) phase. */
  currentRank: number
  /** Rank currently being viewed. */
  viewRank: number
  onSelect: (rank: number) => void
  /** Advance the game to the next phase. */
  onAdvance: () => void
  /** Step the live phase back — only offered when it is empty (see canRetract). */
  onRetract: () => void
  /** True when the latest phase has nothing logged, so undoing it loses nothing. */
  canRetract: boolean
}

/**
 * The single time control. A pill per phase from Night 1 up to now; tapping one
 * reviews the diagram/log as of that phase. The trailing + advances the game.
 * There is no rewind that removes a phase with content — the game clock only
 * moves forward, and stepping back is offered only to undo an empty advance.
 */
export function Timeline({ currentRank, viewRank, onSelect, onAdvance, onRetract, canRetract }: Props) {
  const FIRST = 2 // Night 1
  const ranks: number[] = []
  for (let r = FIRST; r <= currentRank; r++) ranks.push(r)

  const reviewing = viewRank < currentRank

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
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

        <button
          onClick={onAdvance}
          className="min-w-9 shrink-0 rounded-lg border border-dashed border-line bg-surface px-2 py-1.5 text-xs font-medium text-muted active:bg-raised"
          aria-label="Advance to next phase"
        >
          ＋
        </button>
      </div>

      {reviewing ? (
        <button
          onClick={() => onSelect(currentRank)}
          className="mt-1 w-full rounded-lg border border-info/40 bg-info/10 py-1.5 text-xs text-info active:bg-info/20"
        >
          Reviewing the past · new entries record into this phase · tap to return to live
        </button>
      ) : (
        canRetract && (
          <button
            onClick={onRetract}
            className="mt-1 text-[11px] text-muted underline decoration-dotted active:text-ink"
          >
            Undo last phase
          </button>
        )
      )}
    </div>
  )
}

import { phaseLabel, useStore } from '../store'
import type { Phase } from '../types'

type Props = {
  round: number
  phase: Phase
  alive: number
  total: number
  /** True when the header reflects a past phase being reviewed. */
  reviewing: boolean
}

/**
 * Status header for whatever phase is on screen — live or under review. Moving
 * through time lives in the Timeline below, not here, so there are no rewind
 * arrows that would appear to delete the current phase.
 */
export function RoundBar({ round, phase, alive, total, reviewing }: Props) {
  const closeSession = useStore((s) => s.closeSession)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            {phaseLabel(round, phase)}
            {reviewing && (
              <span className="rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-medium text-info">
                reviewing
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted">
            {alive} of {total} alive
          </div>
        </div>

        <button
          onClick={closeSession}
          className="h-10 shrink-0 rounded-lg border border-line bg-raised px-3 text-xs text-muted active:bg-line"
        >
          Exit
        </button>
      </div>
    </header>
  )
}

import { useState } from 'react'
import { phaseLabel, useStore } from '../store'
import type { Phase } from '../types'
import { Sheet } from './Sheet'

type Props = {
  round: number
  phase: Phase
  alive: number
  total: number
  /** True when the header reflects a past phase being reviewed. */
  reviewing: boolean
  /** True once the game has been marked finished. */
  ended: boolean
}

/**
 * Status header for whatever phase is on screen — live or under review. Moving
 * through time lives in the Timeline below, not here, so there are no rewind
 * arrows that would appear to delete the current phase.
 */
export function RoundBar({ round, phase, alive, total, reviewing, ended }: Props) {
  const closeSession = useStore((s) => s.closeSession)
  const endSession = useStore((s) => s.endSession)
  const [menu, setMenu] = useState(false)

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
            {ended && (
              <span className="rounded bg-neutral/15 px-1.5 py-0.5 text-[10px] font-medium text-neutral">
                finished
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted">
            {alive} of {total} alive
          </div>
        </div>

        <button
          onClick={() => setMenu(true)}
          className="h-10 shrink-0 rounded-lg border border-line bg-raised px-3 text-xs text-muted active:bg-line"
        >
          Menu
        </button>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Game">
        <div className="space-y-1.5">
          <button
            onClick={() => {
              setMenu(false)
              closeSession()
            }}
            className="w-full rounded-xl border border-line px-3 py-3 text-left text-sm text-ink active:bg-raised"
          >
            Leave — keep playing
            <span className="mt-0.5 block text-xs text-muted">Back to your games; this one stays open.</span>
          </button>
          {!ended && (
            <button
              onClick={() => {
                setMenu(false)
                endSession()
              }}
              className="w-full rounded-xl border border-line px-3 py-3 text-left text-sm text-ink active:bg-raised"
            >
              End game
              <span className="mt-0.5 block text-xs text-muted">Mark it finished. You can reopen it later.</span>
            </button>
          )}
        </div>
      </Sheet>
    </header>
  )
}

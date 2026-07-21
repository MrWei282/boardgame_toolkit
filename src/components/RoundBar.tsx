import { phaseLabel, useStore } from '../store'
import type { Session } from '../types'

export function RoundBar({ session }: { session: Session }) {
  const nextPhase = useStore((s) => s.nextPhase)
  const prevPhase = useStore((s) => s.prevPhase)
  const closeSession = useStore((s) => s.closeSession)

  const atStart = session.round <= 1 && session.phase === 'night'

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          onClick={prevPhase}
          disabled={atStart}
          className="h-10 w-10 shrink-0 rounded-lg border border-line bg-raised active:bg-line disabled:opacity-30"
          aria-label="Previous phase"
        >
          ‹
        </button>

        <div className="flex-1 text-center">
          <div className="text-base font-semibold">{phaseLabel(session.round, session.phase)}</div>
          <div className="text-[11px] text-muted">
            {session.players.filter((p) => p.alive).length} of {session.players.length} alive
          </div>
        </div>

        <button
          onClick={nextPhase}
          className="h-10 w-10 shrink-0 rounded-lg border border-line bg-raised active:bg-line"
          aria-label="Next phase"
        >
          ›
        </button>

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

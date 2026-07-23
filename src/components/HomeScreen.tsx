import { useState } from 'react'
import { getScript } from '../config'
import { phaseLabel, useSessions, useStore } from '../store'
import type { Session } from '../types'
import { Sheet } from './Sheet'

type Props = {
  /** Open the new-session form. */
  onNewGame: () => void
}

/** Today / Yesterday / a short date, so the list reads as game-nights. */
function dayLabel(ts: number): string {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function HomeScreen({ onNewGame }: Props) {
  const sessions = useSessions()
  const openSession = useStore((s) => s.openSession)

  // Group consecutive sessions (already newest-first) by day into game-nights.
  const groups: { label: string; items: Session[] }[] = []
  for (const s of sessions) {
    const label = dayLabel(s.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(s)
    else groups.push({ label, items: [s] })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Games</h1>
        <button
          onClick={onNewGame}
          className="rounded-xl bg-info px-4 py-2.5 text-sm font-semibold text-bg active:opacity-80"
        >
          + New game
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-16 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          No games yet. Start one to begin tracking.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-1.5 text-[11px] tracking-wide text-muted uppercase">{group.label}</h2>
              <ul className="space-y-1.5">
                {group.items.map((s) => (
                  <GameRow key={s.id} session={s} onOpen={() => openSession(s.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function GameRow({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const setEnded = useStore((s) => s.setEnded)
  const deleteSession = useStore((s) => s.deleteSession)
  const [menu, setMenu] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const script = getScript(session.scriptId)
  const ended = session.endedAt !== undefined

  return (
    <li className="flex items-stretch overflow-hidden rounded-xl border border-line bg-surface">
      <button onClick={onOpen} className="min-h-14 flex-1 px-3 py-2.5 text-left active:bg-raised">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{script.name}</span>
          <span
            className={[
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
              ended ? 'bg-neutral/15 text-neutral' : 'bg-good/15 text-good',
            ].join(' ')}
          >
            {ended ? 'finished' : 'ongoing'}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {session.players.length} players · {phaseLabel(session.round, session.phase)} · {timeLabel(session.createdAt)}
        </div>
      </button>

      <button
        onClick={() => setMenu(true)}
        aria-label="Game actions"
        className="w-11 shrink-0 border-l border-line text-muted active:bg-raised"
      >
        ⋯
      </button>

      <Sheet open={menu} onClose={() => setMenu(false)} title={script.name}>
        <div className="space-y-1.5">
          <button
            onClick={() => {
              setMenu(false)
              setEnded(session.id, !ended)
            }}
            className="w-full rounded-xl border border-line px-3 py-3 text-left text-sm text-ink active:bg-raised"
          >
            {ended ? 'Reopen as ongoing' : 'Mark finished'}
          </button>
          <button
            onClick={() => {
              setMenu(false)
              setConfirming(true)
            }}
            className="w-full rounded-xl border border-evil/40 px-3 py-3 text-left text-sm text-evil active:bg-raised"
          >
            Delete
          </button>
        </div>
      </Sheet>

      {confirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-line bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm">Delete this game? This can't be undone.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-line bg-raised py-2.5 text-sm active:bg-line"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirming(false)
                  deleteSession(session.id)
                }}
                className="flex-1 rounded-xl border border-evil/50 bg-evil/20 py-2.5 text-sm font-semibold text-evil active:bg-evil/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

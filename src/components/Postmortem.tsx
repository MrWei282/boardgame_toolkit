import { getRole } from '../config'
import { scoreGuess, scoreRead } from '../review'
import { currentReadValue, currentRoleIds } from '../store'
import type { ScriptConfig, Session } from '../types'

/**
 * Read-vs-reality scorecard: for each player, my final alignment read and role
 * guess against the truth entered in the review. The read history is stored
 * append-only, so a later stage can show *when* a read turned right; v1 compares
 * the final state only.
 */
export function Postmortem({
  session,
  script,
  onEdit,
}: {
  session: Session
  script: ScriptConfig
  onEdit: () => void
}) {
  const truth = session.truth ?? []

  let readsMade = 0
  let readsRight = 0
  let guessesMade = 0
  let guessesRight = 0

  const rows = session.players.map((p) => {
    const t = truth.find((x) => x.playerId === p.id)
    const actualAlign = t?.alignment ?? 'good'
    // null when never read or cleared — distinct from a deliberate neutral read (0).
    const lean = currentReadValue(session, p.id)
    const guessed = currentRoleIds(session, p.id)
    const rs = scoreRead(lean, actualAlign)
    const gs = scoreGuess(guessed, t?.roleId)
    if (rs.made) {
      readsMade++
      if (rs.correct) readsRight++
    }
    if (gs.made) {
      guessesMade++
      if (gs.correct) guessesRight++
    }
    return { p, actualAlign, roleId: t?.roleId, lean, guessed, rs, gs }
  })

  return (
    <div>
      {/* Summary tiles. */}
      <div className="flex gap-2">
        <ScoreTile label="Reads right" right={readsRight} made={readsMade} />
        <ScoreTile label="Roles right" right={guessesRight} made={guessesMade} />
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map(({ p, actualAlign, roleId, lean, guessed, rs, gs }) => {
          const role = roleId ? getRole(script, roleId)?.name : null
          return (
            <li key={p.id} className="rounded-xl border border-line bg-surface px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-muted tabular-nums">{p.seat + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                {/* The truth. */}
                <span
                  className={[
                    'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium',
                    actualAlign === 'evil'
                      ? 'bg-evil/15 text-evil'
                      : actualAlign === 'neutral'
                        ? 'bg-neutral/15 text-neutral'
                        : 'bg-good/15 text-good',
                  ].join(' ')}
                >
                  {role ?? actualAlign}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-7 text-xs">
                <span className="text-muted">
                  read:{' '}
                  <span className={rs.made ? '' : 'text-muted/60'}>{readLabel(lean)}</span>{' '}
                  <Mark result={rs} />
                </span>
                <span className="text-muted">
                  guess:{' '}
                  <span className={gs.made ? '' : 'text-muted/60'}>
                    {guessed.length ? guessed.map((id) => getRole(script, id)?.name ?? id).join(' / ') : '—'}
                  </span>{' '}
                  <Mark result={gs} />
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <button
        onClick={onEdit}
        className="mt-4 w-full rounded-xl border border-line bg-raised py-3 text-sm text-muted active:bg-line"
      >
        Edit results
      </button>
    </div>
  )
}

function readLabel(lean: number | null): string {
  if (lean === null) return 'no read'
  if (lean === 0) return 'neutral'
  const side = lean > 0 ? 'good' : 'evil'
  return Math.abs(lean) >= 2 ? `sure ${side}` : side
}

function Mark({ result }: { result: { made: boolean; correct: boolean } }) {
  if (!result.made) return <span className="text-muted/60">—</span>
  return result.correct ? (
    <span className="font-semibold text-good">✓</span>
  ) : (
    <span className="font-semibold text-evil">✗</span>
  )
}

function ScoreTile({ label, right, made }: { label: string; right: number; made: number }) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-center">
      <div className="text-lg font-semibold tabular-nums">
        {right}
        <span className="text-muted">/{made}</span>
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}

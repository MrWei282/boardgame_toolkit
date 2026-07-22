import { useState } from 'react'
import { getRole, getTeam } from '../config'
import { assertionParts } from '../describe'
import { currentRoleIds, useStore } from '../store'
import { toneChip, toneText } from '../tone'
import type { GameConfig, PlayerId, ScriptConfig, Session } from '../types'
import { AssertionText } from './AssertionText'
import { SeatCircle } from './SeatCircle'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  onTagPlayer: (id: PlayerId) => void
}

export function DiagramView({ session, game, script, onTagPlayer }: Props) {
  const deleteAssertion = useStore((s) => s.deleteAssertion)

  // Focus mode is the working view: tap a token to isolate it, tap empty space
  // to clear. A full 15-player arrow graph is unreadable on a phone.
  const [focusedId, setFocusedId] = useState<PlayerId | null>(null)

  const focused = focusedId ? session.players.find((p) => p.id === focusedId) : null

  const involving = focusedId
    ? [...session.assertions]
        .filter((a) => a.speaker === focusedId || a.targets.includes(focusedId))
        .sort((a, b) => b.createdAt - a.createdAt)
    : []

  const guessedRoleIds = focusedId ? currentRoleIds(session, focusedId) : []

  return (
    <div>
      <SeatCircle
        session={session}
        game={game}
        script={script}
        focusedId={focusedId}
        onTokenTap={(id) => setFocusedId((cur) => (cur === id ? null : id))}
        onBackgroundTap={() => setFocusedId(null)}
      />

      {focused ? (
        <div className="mt-2 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              {focused.name}
              {!focused.alive && <span className="ml-2 text-xs text-evil">†dead</span>}
            </div>
            <button
              onClick={() => onTagPlayer(focused.id)}
              className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs active:bg-line"
            >
              Edit guess
            </button>
          </div>

          {/* Current role guesses, so you don't have to open the editor to read them. */}
          <div className="mt-2">
            {guessedRoleIds.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {guessedRoleIds.map((id) => {
                  const role = getRole(script, id)
                  const tone = role ? getTeam(game, role.team)?.tone : undefined
                  return (
                    <span
                      key={id}
                      className={[
                        'rounded border px-1.5 py-0.5 text-[11px] leading-none',
                        tone ? toneChip[tone] : 'border-line text-muted',
                      ].join(' ')}
                    >
                      {role?.name ?? id}
                    </span>
                  )
                })}
              </div>
            ) : (
              <span className="text-xs text-muted/70">no guess</span>
            )}
          </div>

          {involving.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {involving.map((a) => {
                const parts = assertionParts(a, session, game, script)
                return (
                  <li key={a.id} className="flex items-start gap-2 text-sm leading-snug">
                    <span className="min-w-0 flex-1">
                      <AssertionText parts={parts} />
                      {parts.note && (
                        <span className="mt-0.5 block text-xs text-muted">“{parts.note}”</span>
                      )}
                    </span>
                    {/* Delete a claim that turned out to be a lie, right where you
                        review it. */}
                    <button
                      onClick={() => deleteAssertion(a.id)}
                      aria-label="Delete this entry"
                      className="shrink-0 rounded-lg px-2 py-0.5 text-xs text-muted active:bg-raised"
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted">Nothing logged about them yet.</p>
          )}
        </div>
      ) : (
        <Legend game={game} />
      )}
    </div>
  )
}

function Legend({ game }: { game: GameConfig }) {
  const edgeRelations = game.relations.filter((r) => r.edge)
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {edgeRelations.map((r) => (
          <span key={r.id} className="flex items-center gap-1.5 text-xs">
            <span className={`text-base leading-none ${toneText[r.tone]}`}>→</span>
            {r.label}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">Tap a token to focus. Info shows there too.</p>
    </div>
  )
}

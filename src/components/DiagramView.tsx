import { useState } from 'react'
import { getRole, getTeam } from '../config'
import { assertionParts } from '../describe'
import { isAlive } from '../projections'
import { currentRead, currentRoleIds, useStore } from '../store'
import { toneChip, toneText } from '../tone'
import type { GameConfig, GameEvent, Phase, PlayerId, ScriptConfig, Session } from '../types'
import { AssertionText } from './AssertionText'
import { DeleteButton } from './DeleteButton'
import { LeanControl } from './LeanControl'
import { SeatCircle } from './SeatCircle'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  onTagPlayer: (id: PlayerId) => void
  /** Phase to stamp a new read into — the phase currently in view. */
  at: { round: number; phase: Phase }
}

export function DiagramView({ session, game, script, onTagPlayer, at }: Props) {
  const deleteAssertion = useStore((s) => s.deleteAssertion)
  const deleteEvent = useStore((s) => s.deleteEvent)
  const setRead = useStore((s) => s.setRead)

  // Focus mode is the working view: tap a token to isolate it, tap empty space
  // to clear. A full 15-player arrow graph is unreadable on a phone.
  const [focusedId, setFocusedId] = useState<PlayerId | null>(null)

  const focused = focusedId ? session.players.find((p) => p.id === focusedId) : null

  // Everything about the focused player, newest first: claims they made or were
  // named in, plus events that happened to them (where info also surfaces).
  const involving = focusedId
    ? [
        ...session.assertions
          .filter((a) => a.speaker === focusedId || a.targets.includes(focusedId))
          .map((a) => ({ at: a.createdAt, node: assertionNode(a) })),
        ...session.events
          .filter((e) => e.subjects.includes(focusedId))
          .map((e) => ({ at: e.createdAt, node: eventNode(e) })),
      ].sort((x, y) => y.at - x.at)
    : []

  const guessedRoleIds = focusedId ? currentRoleIds(session, focusedId) : []

  function assertionNode(a: Session['assertions'][number]) {
    const parts = assertionParts(a, session, game, script)
    return (
      <li key={a.id} className="flex items-start gap-2 text-sm leading-snug">
        <span className="min-w-0 flex-1">
          <AssertionText parts={parts} />
          {parts.note && <span className="mt-0.5 block text-xs text-muted">“{parts.note}”</span>}
        </span>
        <DeleteButton onConfirm={() => deleteAssertion(a.id)} />
      </li>
    )
  }

  function eventNode(e: GameEvent) {
    const lifeTone = e.setsAlive === false ? 'text-evil' : e.setsAlive === true ? 'text-good' : 'text-muted'
    return (
      <li key={e.id} className="flex items-start gap-2 text-sm leading-snug">
        <span className="min-w-0 flex-1">
          <span className={`mr-1 ${lifeTone}`}>◆</span>
          <span className="font-medium">{e.label || 'Event'}</span>
          {e.setsAlive === false && <span className="text-evil"> · died</span>}
          {e.setsAlive === true && <span className="text-good"> · revived</span>}
          {e.note && <span className="mt-0.5 block text-xs text-muted">“{e.note}”</span>}
        </span>
        <DeleteButton onConfirm={() => deleteEvent(e.id)} message="Delete this event?" />
      </li>
    )
  }

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
              {!isAlive(session, focused.id) && (
                <span className="ml-2 rounded bg-evil/15 px-1.5 py-0.5 text-[11px] font-medium text-evil">
                  💀 Dead
                </span>
              )}
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

          {/* My alignment read — a gut call, distinct from the role guess above. */}
          <div className="mt-2.5">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] text-muted">My read</span>
              <div className="flex-1">
                <LeanControl
                  value={currentRead(session, focused.id)}
                  onChange={(lean) => setRead(focused.id, lean, at)}
                  endpoints
                />
              </div>
            </div>
            <p className="mt-1 text-[10px] text-muted/70">
              −− ++ certain · − + leaning · · no read
            </p>
          </div>

          {involving.length > 0 ? (
            <ul className="mt-2.5 space-y-1">{involving.map((x) => x.node)}</ul>
          ) : (
            <p className="mt-2.5 text-xs text-muted">Nothing logged about them yet.</p>
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

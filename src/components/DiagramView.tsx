import { useState } from 'react'
import { createPortal } from 'react-dom'
import { getRole, getTeam } from '../config'
import { assertionParts } from '../describe'
import { isAlive } from '../projections'
import { currentReadValue, currentRoleIds, useStore } from '../store'
import { toneChip, toneText } from '../tone'
import type { GameConfig, GameEvent, Phase, PlayerId, ScriptConfig, Session } from '../types'
import type { Assertion } from '../types'
import { AssertionText } from './AssertionText'
import { EntryActions } from './EntryActions'
import { LeanControl } from './LeanControl'
import { SeatCircle } from './SeatCircle'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  onTagPlayer: (id: PlayerId) => void
  onEditAssertion: (a: Assertion) => void
  onEditEvent: (e: GameEvent) => void
  /** Quick-record from the focused player's card: start an entry with them preset. */
  onQuickAssertion: (speaker: PlayerId, relation: string) => void
  onQuickNominate?: (nominator: PlayerId) => void
  onQuickEvent: (subject: PlayerId) => void
  /** Phase to stamp a new read into — the phase currently in view. */
  at: { round: number; phase: Phase }
}

export function DiagramView({
  session,
  game,
  script,
  onTagPlayer,
  onEditAssertion,
  onEditEvent,
  onQuickAssertion,
  onQuickNominate,
  onQuickEvent,
  at,
}: Props) {
  const deleteAssertion = useStore((s) => s.deleteAssertion)
  const deleteEvent = useStore((s) => s.deleteEvent)
  const updateAssertion = useStore((s) => s.updateAssertion)
  const updateEvent = useStore((s) => s.updateEvent)
  const setRead = useStore((s) => s.setRead)

  // Focus mode is the working view: tap a token to isolate it, tap empty space
  // to clear. A full 15-player arrow graph is unreadable on a phone.
  const [focusedId, setFocusedId] = useState<PlayerId | null>(null)
  // Relations toggled off the diagram — a declutter for when several colours fly.
  const [hiddenRelations, setHiddenRelations] = useState<Set<string>>(new Set())
  function toggleRelation(id: string) {
    setHiddenRelations((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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

  function assertionNode(a: Assertion) {
    const parts = assertionParts(a, session, game, script)
    const struck = !!a.hidden
    return (
      <li key={a.id} className="flex items-start gap-2 text-sm leading-snug">
        {/* Dim the content, not the row — the row holds EntryActions' portal trigger
            and the delete confirm; only the words are struck. */}
        <span className={['min-w-0 flex-1', struck ? 'opacity-45 line-through decoration-muted' : ''].join(' ')}>
          <AssertionText parts={parts} />
          {parts.note && <span className="mt-0.5 block text-xs text-muted">“{parts.note}”</span>}
        </span>
        <EntryActions
          pinned={!!a.pinned}
          hidden={struck}
          onEdit={() => onEditAssertion(a)}
          onTogglePin={() => updateAssertion(a.id, { pinned: !a.pinned })}
          onToggleStrike={() => updateAssertion(a.id, { hidden: !a.hidden })}
          onDelete={() => deleteAssertion(a.id)}
        />
      </li>
    )
  }

  function eventNode(e: GameEvent) {
    const lifeTone = e.setsAlive === false ? 'text-evil' : e.setsAlive === true ? 'text-good' : 'text-muted'
    const struck = !!e.hidden
    return (
      <li key={e.id} className="flex items-start gap-2 text-sm leading-snug">
        <span className={['min-w-0 flex-1', struck ? 'opacity-45 line-through decoration-muted' : ''].join(' ')}>
          <span className={`mr-1 ${lifeTone}`}>◆</span>
          <span className="font-medium">{e.label || 'Event'}</span>
          {e.setsAlive === false && <span className="text-evil"> · died</span>}
          {e.setsAlive === true && <span className="text-good"> · revived</span>}
          {e.note && <span className="mt-0.5 block text-xs text-muted">“{e.note}”</span>}
        </span>
        <EntryActions
          pinned={!!e.pinned}
          hidden={struck}
          deleteMessage="Delete this event?"
          onEdit={() => onEditEvent(e)}
          onTogglePin={() => updateEvent(e.id, { pinned: !e.pinned })}
          onToggleStrike={() => updateEvent(e.id, { hidden: !e.hidden })}
          onDelete={() => deleteEvent(e.id)}
        />
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
        hiddenRelations={hiddenRelations}
      />

      <Legend game={game} hidden={hiddenRelations} onToggle={toggleRelation} />

      {/* Tapping a token opens a centered card (tap outside to dismiss), so the
          detail is where the thumb is instead of below the fold. It leads with
          quick-record so the intuitive "tap the player, then the action" works. */}
      {focused &&
        createPortal(
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            onClick={() => setFocusedId(null)}
          >
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="relative flex max-h-[82vh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">
                  {focused.name}
                  {!isAlive(game, session, focused.id) && (
                    <span className="ml-2 rounded bg-evil/15 px-1.5 py-0.5 text-[11px] font-medium text-evil">
                      💀 Dead
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setFocusedId(null)}
                  aria-label="Close"
                  className="rounded-lg border border-line bg-raised px-2.5 py-1 text-sm text-muted active:bg-line"
                >
                  ✕
                </button>
              </div>

              {/* Quick record — start an entry with this player already the speaker. */}
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] tracking-wide text-muted uppercase">Quick record</div>
                <div className="flex flex-wrap gap-1.5">
                  {game.relations
                    .filter((r) => !r.internal && !r.collectsVotesAs)
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          onQuickAssertion(focused.id, r.id)
                          setFocusedId(null)
                        }}
                        className={['rounded-lg border px-3 py-1.5 text-sm font-medium', toneChip[r.tone]].join(' ')}
                      >
                        {r.label}
                      </button>
                    ))}
                  {onQuickNominate && (
                    <button
                      onClick={() => {
                        onQuickNominate(focused.id)
                        setFocusedId(null)
                      }}
                      className={['rounded-lg border px-3 py-1.5 text-sm font-medium', toneChip.neutral].join(' ')}
                    >
                      Nominate
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onQuickEvent(focused.id)
                      setFocusedId(null)
                    }}
                    className="rounded-lg border border-line bg-raised px-3 py-1.5 text-sm font-medium text-ink active:bg-line"
                  >
                    Event
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] tracking-wide text-muted uppercase">Role guess</span>
                <button
                  onClick={() => onTagPlayer(focused.id)}
                  className="rounded-lg border border-line bg-raised px-3 py-1 text-xs active:bg-line"
                >
                  Edit guess
                </button>
              </div>
              <div className="mt-1.5">
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

              <div className="mt-3 flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-muted">My read</span>
                <div className="flex-1">
                  <LeanControl
                    value={currentReadValue(session, focused.id)}
                    onChange={(lean) => setRead(focused.id, lean, at)}
                  />
                </div>
              </div>

              {involving.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-line pt-3">{involving.map((x) => x.node)}</ul>
              ) : (
                <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Nothing logged about them yet.</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function Legend({
  game,
  hidden,
  onToggle,
}: {
  game: GameConfig
  hidden: Set<string>
  onToggle: (id: string) => void
}) {
  const edgeRelations = game.relations.filter((r) => r.edge)
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap gap-2">
        {edgeRelations.map((r) => {
          const off = hidden.has(r.id)
          return (
            <button
              key={r.id}
              onClick={() => onToggle(r.id)}
              aria-pressed={!off}
              className={[
                'flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs',
                off ? 'bg-raised text-muted/50 line-through' : 'bg-raised text-ink',
              ].join(' ')}
            >
              <span className={`text-base leading-none ${off ? 'text-muted/40' : toneText[r.tone]}`}>→</span>
              {r.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">Tap a relation to hide its arrows · tap a token to focus.</p>
    </div>
  )
}

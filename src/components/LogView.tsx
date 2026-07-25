import { useState } from 'react'
import { assertionParts } from '../describe'
import { FIRST_RANK, phaseFromRank, phaseLabel, rankOf } from '../projections'
import { useStore } from '../store'
import type { Assertion, GameConfig, GameEvent, ScriptConfig, Session } from '../types'
import { AssertionText } from './AssertionText'
import { EntryActions } from './EntryActions'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  /** When reviewing a past phase, entries from that phase are highlighted. */
  highlightRank?: number
  onEditAssertion: (a: Assertion) => void
  onEditEvent: (e: GameEvent) => void
}

type LogItem =
  | { kind: 'assertion'; at: number; rank: number; pinned: boolean; data: Assertion }
  | { kind: 'event'; at: number; rank: number; pinned: boolean; data: GameEvent }

export function LogView({ session, game, script, highlightRank, onEditAssertion, onEditEvent }: Props) {
  const updateAssertion = useStore((s) => s.updateAssertion)
  const updateEvent = useStore((s) => s.updateEvent)
  const deleteAssertion = useStore((s) => s.deleteAssertion)
  const deleteEvent = useStore((s) => s.deleteEvent)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Roll votes up under their nomination: a vote points at its nomination by
  // parentId, so a re-nomination of the same nominee keeps its own votes instead
  // of pooling them by nominee+phase. Rolled-up votes are hidden from the top
  // level and shown on the nomination instead.
  const nominationRel = game.relations.find((r) => r.collectsVotesAs)
  const voteRelId = nominationRel?.collectsVotesAs
  const votesByNomination = new Map<string, Assertion[]>()
  const rolledVoteIds = new Set<string>()
  if (nominationRel && voteRelId) {
    for (const v of session.assertions) {
      if (v.relation !== voteRelId || !v.parentId) continue
      const group = votesByNomination.get(v.parentId)
      if (group) group.push(v)
      else votesByNomination.set(v.parentId, [v])
      rolledVoteIds.add(v.id)
    }
  }

  const items: LogItem[] = [
    ...session.assertions
      .filter((a) => !rolledVoteIds.has(a.id))
      .map((a): LogItem => ({ kind: 'assertion', at: a.createdAt, rank: rankOf(game, a.round, a.phase), pinned: !!a.pinned, data: a })),
    ...session.events.map(
      (e): LogItem => ({ kind: 'event', at: e.createdAt, rank: rankOf(game, e.round, e.phase), pinned: !!e.pinned, data: e }),
    ),
  ]

  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? '?'

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
        Nothing logged yet.
      </p>
    )
  }

  // Group by phase and render a section per phase from Night 1 up to the phase in
  // view — including empty ones — so the log reads uniformly and never jumps a
  // phase (e.g. a quiet Day 2 still shows between Night 2 and Night 3).
  const maxRank = Math.max(highlightRank ?? FIRST_RANK, ...items.map((i) => i.rank), FIRST_RANK)
  const byRank = new Map<number, LogItem[]>()
  for (const it of items) {
    const arr = byRank.get(it.rank)
    if (arr) arr.push(it)
    else byRank.set(it.rank, [it])
  }
  // Within a phase, pinned entries float to the top, then newest first.
  for (const arr of byRank.values()) {
    arr.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at)
  }
  const ranks: number[] = []
  for (let r = maxRank; r >= FIRST_RANK; r--) ranks.push(r)

  function renderRow(item: LogItem, highlight: boolean) {
    const struck = !!item.data.hidden
    return (
      <li key={item.data.id}>
        <div
          className={[
            'flex items-start gap-2 rounded-xl border px-3 py-2.5',
            highlight ? 'border-info/60 bg-info/5' : 'border-line bg-surface',
          ].join(' ')}
        >
          {/* Dim the struck content only — not the row — so the entry menu it
              contains is not trapped under a new stacking context (which would
              drop its popover behind the fixed log buttons). */}
          <div className={['min-w-0 flex-1', struck ? 'opacity-45' : ''].join(' ')}>
            <div className={struck ? 'line-through decoration-muted' : ''}>
              {item.kind === 'assertion' ? (
                <AssertionRow
                  assertion={item.data}
                  session={session}
                  game={game}
                  script={script}
                  pinned={item.pinned}
                  votes={votesByNomination.get(item.data.id)}
                  expanded={expanded.has(item.data.id)}
                  onToggleExpand={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(item.data.id)) next.delete(item.data.id)
                      else next.add(item.data.id)
                      return next
                    })
                  }
                  nameOf={nameOf}
                />
              ) : (
                <EventRow event={item.data} pinned={item.pinned} nameOf={nameOf} />
              )}
            </div>
          </div>

          <EntryActions
            pinned={item.pinned}
            hidden={struck}
            deleteMessage={item.kind === 'assertion' ? 'Delete this entry?' : 'Delete this event?'}
            onEdit={() =>
              item.kind === 'assertion' ? onEditAssertion(item.data) : onEditEvent(item.data)
            }
            onTogglePin={() =>
              item.kind === 'assertion'
                ? updateAssertion(item.data.id, { pinned: !item.data.pinned })
                : updateEvent(item.data.id, { pinned: !item.data.pinned })
            }
            onToggleStrike={() =>
              item.kind === 'assertion'
                ? updateAssertion(item.data.id, { hidden: !item.data.hidden })
                : updateEvent(item.data.id, { hidden: !item.data.hidden })
            }
            onDelete={() =>
              item.kind === 'assertion' ? deleteAssertion(item.data.id) : deleteEvent(item.data.id)
            }
          />
        </div>
      </li>
    )
  }

  return (
    <div>
      {ranks.map((rank) => {
        const { round, phase } = phaseFromRank(game, rank)
        const group = byRank.get(rank) ?? []
        const highlight = highlightRank === rank
        return (
          <section key={rank} className="mt-3 first:mt-0">
            <div className="mb-1.5 text-[11px] tracking-wide text-muted uppercase">
              {phaseLabel(game, round, phase)}
            </div>
            {group.length > 0 ? (
              <ul className="space-y-1.5">{group.map((item) => renderRow(item, highlight))}</ul>
            ) : (
              <p className="pl-1 text-xs text-muted/40">—</p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function AssertionRow({
  assertion,
  session,
  game,
  script,
  pinned,
  votes,
  expanded,
  onToggleExpand,
  nameOf,
}: {
  assertion: Assertion
  session: Session
  game: GameConfig
  script: ScriptConfig
  pinned: boolean
  votes?: Assertion[]
  expanded: boolean
  onToggleExpand: () => void
  nameOf: (id: string) => string
}) {
  const parts = assertionParts(assertion, session, game, script)
  const voteCount = votes?.length ?? 0

  return (
    <p className="text-sm leading-snug">
      {pinned && <span className="mr-1 text-neutral">★</span>}
      <AssertionText parts={parts} />
      {voteCount > 0 && (
        <button onClick={onToggleExpand} className="ml-1 text-xs text-info underline decoration-dotted">
          · {voteCount} vote{voteCount === 1 ? '' : 's'}
        </button>
      )}
      {parts.note && <span className="mt-0.5 block text-xs text-muted">“{parts.note}”</span>}
      {expanded && voteCount > 0 && (
        <span className="mt-0.5 block text-xs text-muted">
          Voted: {votes!.map((v) => nameOf(v.speaker)).join(', ')}
        </span>
      )}
    </p>
  )
}

function EventRow({
  event,
  pinned,
  nameOf,
}: {
  event: GameEvent
  pinned: boolean
  nameOf: (id: string) => string
}) {
  const who = event.subjects.map(nameOf).join(' & ')
  const lifeTone =
    event.setsAlive === false ? 'text-evil' : event.setsAlive === true ? 'text-good' : 'text-muted'

  return (
    <p className="text-sm leading-snug">
      {pinned && <span className="mr-1 text-neutral">★</span>}
      {/* An event reads differently from a claim — mark it so the two don't blur. */}
      <span className={`mr-1 ${lifeTone}`}>◆</span>
      <span className="font-medium">{event.label || 'Event'}</span>
      {who && <span className="text-muted"> — {who}</span>}
      {event.setsAlive === false && <span className="text-evil"> · died</span>}
      {event.setsAlive === true && <span className="text-good"> · revived</span>}
      {event.note && <span className="mt-0.5 block text-xs text-muted">“{event.note}”</span>}
    </p>
  )
}

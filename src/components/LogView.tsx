import { assertionParts } from '../describe'
import { rankOf } from '../projections'
import { phaseLabel, useStore } from '../store'
import type { Assertion, GameConfig, GameEvent, ScriptConfig, Session } from '../types'
import { AssertionText } from './AssertionText'
import { DeleteButton } from './DeleteButton'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  /** When reviewing a past phase, entries from that phase are highlighted. */
  highlightRank?: number
}

type LogItem =
  | { kind: 'assertion'; at: number; rank: number; data: Assertion }
  | { kind: 'event'; at: number; rank: number; data: GameEvent }

export function LogView({ session, game, script, highlightRank }: Props) {
  const deleteAssertion = useStore((s) => s.deleteAssertion)
  const deleteEvent = useStore((s) => s.deleteEvent)

  const items: LogItem[] = [
    ...session.assertions.map(
      (a): LogItem => ({ kind: 'assertion', at: a.createdAt, rank: rankOf(a.round, a.phase), data: a }),
    ),
    ...session.events.map(
      (e): LogItem => ({ kind: 'event', at: e.createdAt, rank: rankOf(e.round, e.phase), data: e }),
    ),
  ]

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
        Nothing logged yet.
      </p>
    )
  }

  // Newest first — during play you check what just happened, not the game top-down.
  items.sort((a, b) => b.at - a.at)

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => {
        const prev = items[i - 1]
        const startsPhase = !prev || prev.rank !== item.rank
        const highlight = highlightRank !== undefined && item.rank === highlightRank
        const { round, phase } = item.data

        return (
          <li key={item.data.id}>
            {startsPhase && (
              <div className="mt-3 mb-1.5 text-[11px] tracking-wide text-muted uppercase">
                {phaseLabel(round, phase)}
              </div>
            )}
            <div
              className={[
                'flex items-start gap-2 rounded-xl border px-3 py-2.5',
                highlight ? 'border-info/60 bg-info/5' : 'border-line bg-surface',
              ].join(' ')}
            >
              {item.kind === 'assertion' ? (
                <AssertionRow assertion={item.data} session={session} game={game} script={script} />
              ) : (
                <EventRow event={item.data} session={session} />
              )}
              <DeleteButton
                onConfirm={() =>
                  item.kind === 'assertion' ? deleteAssertion(item.data.id) : deleteEvent(item.data.id)
                }
                message={item.kind === 'event' ? 'Delete this event?' : 'Delete this entry?'}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function AssertionRow({
  assertion,
  session,
  game,
  script,
}: {
  assertion: Assertion
  session: Session
  game: GameConfig
  script: ScriptConfig
}) {
  const parts = assertionParts(assertion, session, game, script)
  return (
    <p className="min-w-0 flex-1 text-sm leading-snug">
      <AssertionText parts={parts} />
      {parts.note && <span className="mt-0.5 block text-xs text-muted">“{parts.note}”</span>}
    </p>
  )
}

function EventRow({ event, session }: { event: GameEvent; session: Session }) {
  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? '?'
  const who = event.subjects.map(nameOf).join(' & ')
  const lifeTone =
    event.setsAlive === false ? 'text-evil' : event.setsAlive === true ? 'text-good' : 'text-muted'

  return (
    <p className="min-w-0 flex-1 text-sm leading-snug">
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

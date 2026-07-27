import { useEffect, useState, type ReactNode } from 'react'
import { isAlive } from '../projections'
import { useStore } from '../store'
import type { Assertion, GameConfig, Phase, PlayerId, Session } from '../types'
import { SeatGrid } from './SeatGrid'
import { Sheet } from './Sheet'

type Props = {
  open: boolean
  onClose: () => void
  session: Session
  game: GameConfig
  /** Phase to record into — the phase currently being viewed. */
  at: { round: number; phase: Phase }
  /** The nomination being edited, or null to create a new one. */
  editing?: Assertion | null
  /** Pre-selected nominator (from a token's quick-record). */
  presetNominator?: PlayerId | null
}

/**
 * Nomination is its own entry category — used constantly and structurally richer
 * than a plain relation (a nominator, one or more nominees, and a vote tally).
 * The votes are editable here, which the generic assertion editor never allowed.
 */
export function NominationSheet({ open, onClose, session, game, at, editing, presetNominator }: Props) {
  const addNomination = useStore((s) => s.addNomination)
  const updateNomination = useStore((s) => s.updateNomination)

  // The game's nomination relation and the relation its votes are recorded as —
  // config-driven, so this stays generic (BotC lynch, Avalon team proposal, …).
  const nominationRel = game.relations.find((r) => r.collectsVotesAs) ?? null
  const voteRelation = nominationRel?.collectsVotesAs ?? ''

  const [nominator, setNominator] = useState<PlayerId | null>(null)
  const [nominees, setNominees] = useState<PlayerId[]>([])
  const [voters, setVoters] = useState<PlayerId[]>([])
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setNominator(editing?.speaker ?? presetNominator ?? null)
    setNominees(editing?.targets ?? [])
    setNote(editing?.note ?? '')
    setVoters(
      editing
        ? session.assertions
            .filter((a) => a.parentId === editing.id && a.relation === voteRelation)
            .map((a) => a.speaker)
        : [],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, presetNominator])

  const deadIds = new Set(session.players.filter((p) => !isAlive(game, session, p.id)).map((p) => p.id))
  const canSave = Boolean(nominator && nominees.length > 0 && nominationRel)

  function toggleIn(list: PlayerId[], id: PlayerId): PlayerId[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  function save() {
    if (!nominator || !nominationRel) return
    if (editing) {
      updateNomination(editing.id, { nominator, nominees, voteRelation, voters, note })
    } else {
      addNomination({ nominator, nominees, relation: nominationRel.id, voteRelation, voters, note }, at)
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit nomination' : 'Log a nomination'}
      footer={
        <button
          onClick={save}
          disabled={!canSave}
          className="w-full rounded-xl bg-info py-3 font-semibold text-bg active:opacity-80 disabled:opacity-30"
        >
          Save
        </button>
      }
    >
      {nominationRel ? (
        <div className="space-y-5">
          <section>
            <Label n={1}>Nominator</Label>
            <SeatGrid
              players={session.players}
              selected={nominator ? [nominator] : []}
              onSelect={(id) => setNominator((cur) => (cur === id ? null : id))}
              deadIds={deadIds}
            />
          </section>

          <section>
            <Label n={2}>Nominee{nominees.length !== 1 ? 's' : ''}</Label>
            <SeatGrid
              players={session.players}
              selected={nominees}
              onSelect={(id) => setNominees((prev) => toggleIn(prev, id))}
              deadIds={deadIds}
            />
          </section>

          <section>
            <Label>Who voted (optional)</Label>
            <SeatGrid
              players={session.players}
              selected={voters}
              onSelect={(id) => setVoters((prev) => toggleIn(prev, id))}
              deadIds={deadIds}
            />
            <p className="mt-2 text-xs text-muted">
              Votes roll up under the nomination instead of drawing their own arrows.
            </p>
          </section>

          <section>
            <Label>Note (optional)</Label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything worth remembering"
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-raised px-3 py-2.5 placeholder:text-muted/60 focus:border-info focus:outline-none"
            />
          </section>
        </div>
      ) : (
        <p className="text-sm text-muted">This game has no nomination relation configured.</p>
      )}
    </Sheet>
  )
}

function Label({ n, children }: { n?: number; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs tracking-wide text-muted uppercase">
      {n !== undefined && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-line text-[10px] text-ink">
          {n}
        </span>
      )}
      {children}
    </div>
  )
}

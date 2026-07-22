import { useEffect, useState, type ReactNode } from 'react'
import { isAlive } from '../projections'
import { useStore } from '../store'
import type { GameEvent, Phase, PlayerId, Session } from '../types'
import { SeatGrid } from './SeatGrid'
import { Sheet } from './Sheet'

type Props = {
  open: boolean
  onClose: () => void
  session: Session
  /** Optional player to pre-select as the subject (from the Players tab). */
  presetSubject?: PlayerId | null
  /** Phase to record into — the phase currently being viewed. */
  at: { round: number; phase: Phase }
  /** When set, the sheet edits this event in place instead of creating one. */
  editing?: GameEvent | null
}

type LifeEffect = 'none' | 'died' | 'revived'

// Kept out of config on purpose: aliveness is a property of the event instance,
// not a per-game vocabulary. undefined = no effect, false = dies, true = revives.
const toSetsAlive: Record<LifeEffect, boolean | undefined> = {
  none: undefined,
  died: false,
  revived: true,
}

function effectOf(setsAlive: boolean | undefined): LifeEffect {
  return setsAlive === false ? 'died' : setsAlive === true ? 'revived' : 'none'
}

export function EventSheet({ open, onClose, session, presetSubject, at, editing }: Props) {
  const addEvent = useStore((s) => s.addEvent)
  const updateEvent = useStore((s) => s.updateEvent)

  const [label, setLabel] = useState('')
  const [subjects, setSubjects] = useState<PlayerId[]>([])
  const [effect, setEffect] = useState<LifeEffect>('none')
  const [note, setNote] = useState('')

  // Seed from the edited event, or from a tapped player (defaulting to the effect
  // that flips their state), or blank for a fresh event.
  useEffect(() => {
    if (!open) return
    if (editing) {
      setLabel(editing.label)
      setSubjects(editing.subjects)
      setEffect(effectOf(editing.setsAlive))
      setNote(editing.note ?? '')
    } else if (presetSubject) {
      setSubjects([presetSubject])
      setEffect(isAlive(session, presetSubject) ? 'died' : 'revived')
      setLabel('')
      setNote('')
    } else {
      setSubjects([])
      setEffect('none')
      setLabel('')
      setNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetSubject, editing])

  const deadIds = new Set(session.players.filter((p) => !isAlive(session, p.id)).map((p) => p.id))

  function toggleSubject(id: PlayerId) {
    setSubjects((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  function save() {
    if (editing) {
      updateEvent(editing.id, {
        label: label.trim(),
        subjects,
        setsAlive: toSetsAlive[effect],
        note: note.trim() || undefined,
      })
    } else {
      addEvent({ label, subjects, setsAlive: toSetsAlive[effect], note }, at)
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit event' : 'Log what happened'}
      footer={
        <button
          onClick={save}
          className="w-full rounded-xl bg-info py-3 font-semibold text-bg active:opacity-80"
        >
          Save
        </button>
      }
    >
      <div className="space-y-5">
        <section>
          <Label>What happened</Label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Executed, Died at night, Slayer shot, Quest failed"
            autoComplete="off"
            className="w-full rounded-xl border border-line bg-raised px-3 py-2.5 placeholder:text-muted/60 focus:border-info focus:outline-none"
          />
        </section>

        <section>
          <Label>Who it involves</Label>
          <SeatGrid players={session.players} selected={subjects} onSelect={toggleSubject} deadIds={deadIds} />
        </section>

        <section>
          <Label>Effect on life</Label>
          <div className="flex gap-2">
            <EffectButton active={effect === 'none'} onClick={() => setEffect('none')} tone="line">
              No change
            </EffectButton>
            <EffectButton active={effect === 'died'} onClick={() => setEffect('died')} tone="evil">
              Died
            </EffectButton>
            <EffectButton active={effect === 'revived'} onClick={() => setEffect('revived')} tone="good">
              Revived
            </EffectButton>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Applies to everyone selected above. Alive/dead is worked out from these.
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
    </Sheet>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs tracking-wide text-muted uppercase">{children}</div>
}

function EffectButton({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean
  onClick: () => void
  tone: 'line' | 'evil' | 'good'
  children: ReactNode
}) {
  const activeCls =
    tone === 'evil'
      ? 'border-evil bg-evil/25 text-evil'
      : tone === 'good'
        ? 'border-good bg-good/25 text-good'
        : 'border-info bg-info/20 text-ink'
  return (
    <button
      onClick={onClick}
      className={[
        'min-h-11 flex-1 rounded-xl border px-3 py-2 text-sm font-medium',
        active ? activeCls : 'border-line bg-raised text-muted active:bg-line',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

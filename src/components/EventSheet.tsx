import { useEffect, useState, type ReactNode } from 'react'
import { isAlive } from '../projections'
import { useStore } from '../store'
import type { Phase, PlayerId, Session } from '../types'
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
}

type LifeEffect = 'none' | 'died' | 'revived'

// Kept out of config on purpose: aliveness is a property of the event instance,
// not a per-game vocabulary. undefined = no effect, false = dies, true = revives.
const toSetsAlive: Record<LifeEffect, boolean | undefined> = {
  none: undefined,
  died: false,
  revived: true,
}

export function EventSheet({ open, onClose, session, presetSubject, at }: Props) {
  const addEvent = useStore((s) => s.addEvent)

  const [label, setLabel] = useState('')
  const [subjects, setSubjects] = useState<PlayerId[]>([])
  const [effect, setEffect] = useState<LifeEffect>('none')
  const [note, setNote] = useState('')

  // Seed from the tapped player: pre-select them and default to the effect that
  // flips their current state, so "mark dead" / "bring back" is one confirm away.
  useEffect(() => {
    if (!open) return
    if (presetSubject) {
      setSubjects([presetSubject])
      setEffect(isAlive(session, presetSubject) ? 'died' : 'revived')
    } else {
      setSubjects([])
      setEffect('none')
    }
    setLabel('')
    setNote('')
    // Only re-seed when the sheet opens or the preset changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetSubject])

  const deadIds = new Set(session.players.filter((p) => !isAlive(session, p.id)).map((p) => p.id))

  function toggleSubject(id: PlayerId) {
    setSubjects((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  function save() {
    addEvent({ label, subjects, setsAlive: toSetsAlive[effect], note }, at)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log what happened"
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

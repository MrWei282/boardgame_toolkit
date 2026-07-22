import { useState, type ReactNode } from 'react'
import { isAlive } from '../projections'
import { useStore } from '../store'
import { toneSolid } from '../tone'
import type { GameConfig, Phase, PlayerId, RoleId, ScriptConfig, Session } from '../types'
import { RolePicker } from './RolePicker'
import { SeatGrid } from './SeatGrid'
import { Sheet } from './Sheet'

type Props = {
  open: boolean
  onClose: () => void
  session: Session
  game: GameConfig
  script: ScriptConfig
  /** Phase to record into — the phase currently being viewed. */
  at: { round: number; phase: Phase }
}

export function AssertionSheet({ open, onClose, session, game, script, at }: Props) {
  const addAssertion = useStore((s) => s.addAssertion)

  const [speaker, setSpeaker] = useState<PlayerId | null>(null)
  const [relationId, setRelationId] = useState<string | null>(null)
  const [targets, setTargets] = useState<PlayerId[]>([])
  const [roles, setRoles] = useState<RoleId[]>([])
  const [note, setNote] = useState('')

  const relation = game.relations.find((r) => r.id === relationId) ?? null
  const deadIds = new Set(session.players.filter((p) => !isAlive(session, p.id)).map((p) => p.id))

  function reset() {
    setSpeaker(null)
    setRelationId(null)
    setTargets([])
    setRoles([])
    setNote('')
  }

  function close() {
    reset()
    onClose()
  }

  function pickRelation(id: string) {
    setRelationId(id)
    // Switching from a multi-target relation to a single-target one would
    // otherwise leave several targets selected.
    const next = game.relations.find((r) => r.id === id)
    if (next?.targets === 'one') setTargets((prev) => (prev.length > 1 ? prev.slice(0, 1) : prev))
    if (next?.roles === 'none') setRoles([])
  }

  // Functional updates throughout: at a table these get tapped faster than React
  // re-renders, and reading state from the render closure would drop taps.
  function toggleTarget(id: PlayerId) {
    if (!relation) return
    if (relation.targets === 'one') {
      setTargets((prev) => (prev[0] === id ? [] : [id]))
    } else {
      setTargets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
    }
  }

  const targetsValid = relation ? (relation.targets === 'one' ? targets.length === 1 : true) : false
  const canSave = Boolean(speaker && relation && targetsValid)

  function save() {
    if (!speaker || !relation) return
    addAssertion({ speaker, relation: relation.id, targets, roles, note }, at)
    close()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Log what was said"
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
      <div className="space-y-5">
        <section>
          <SectionLabel n={1}>Who spoke</SectionLabel>
          <SeatGrid
            players={session.players}
            selected={speaker ? [speaker] : []}
            onSelect={(id) => setSpeaker(speaker === id ? null : id)}
            deadIds={deadIds}
          />
        </section>

        <section>
          <SectionLabel n={2}>What they did</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {game.relations.map((r) => (
              <button
                key={r.id}
                onClick={() => pickRelation(r.id)}
                className={[
                  'min-h-11 flex-1 rounded-xl border px-3 py-2 text-sm font-medium',
                  relationId === r.id
                    ? toneSolid[r.tone]
                    : 'border-line bg-raised text-muted active:bg-line',
                ].join(' ')}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>

        {relation && (
          <section>
            <SectionLabel n={3}>
              {relation.targets === 'one' ? 'About whom' : 'About whom (any number)'}
            </SectionLabel>
            <SeatGrid
              players={session.players}
              selected={targets}
              onSelect={toggleTarget}
              deadIds={deadIds}
            />
            {relation.id === 'info' && (
              <p className="mt-2 text-xs text-muted">
                A player claiming their own role is themself as both speaker and target.
              </p>
            )}
          </section>
        )}

        {relation && relation.roles !== 'none' && (
          <section>
            <SectionLabel n={4}>Roles named (optional)</SectionLabel>
            <RolePicker
              game={game}
              script={script}
              selected={roles}
              onToggle={(id) =>
                setRoles((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
              }
            />
          </section>
        )}

        {relation && (
          <section>
            <SectionLabel>Note (optional)</SectionLabel>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Exact words, numbers, anything odd"
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-raised px-3 py-2.5 placeholder:text-muted/60 focus:border-info focus:outline-none"
            />
          </section>
        )}
      </div>
    </Sheet>
  )
}

function SectionLabel({ n, children }: { n?: number; children: ReactNode }) {
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

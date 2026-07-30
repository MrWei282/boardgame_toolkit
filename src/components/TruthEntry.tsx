import { useState } from 'react'
import { getRole } from '../config'
import { useT } from '../i18n'
import { roleAlignment } from '../review'
import { useStore } from '../store'
import type { Alignment, GameConfig, PlayerId, Reveal, RoleId, ScriptConfig, Session } from '../types'
import { RolePicker } from './RolePicker'
import { Sheet } from './Sheet'

type Draft = { roleId?: RoleId; alignment: Alignment }

// good | neutral | evil — neutral sits in the middle, mirroring the read scale.
const ALIGN_OPTIONS: { id: Alignment; on: string }[] = [
  { id: 'good', on: 'bg-good/25 text-good' },
  { id: 'neutral', on: 'bg-neutral/25 text-neutral' },
  { id: 'evil', on: 'bg-evil/25 text-evil' },
]

/**
 * Post-game ground truth: each player's actual alignment (the core input) and,
 * optionally, their role. Alignment leads because it's the quick, always-known
 * fact and what the read is scored against; role is a tap-to-set extra. Picking a
 * role prefills alignment from its team but never locks it — swaps stay editable.
 */
export function TruthEntry({
  session,
  game,
  script,
  onSaved,
}: {
  session: Session
  game: GameConfig
  script: ScriptConfig
  onSaved: () => void
}) {
  const setTruth = useStore((s) => s.setTruth)
  const { t } = useT()

  const [draft, setDraft] = useState<Record<PlayerId, Draft>>(() => {
    const init: Record<PlayerId, Draft> = {}
    for (const p of session.players) {
      const existing = session.truth?.find((t) => t.playerId === p.id)
      init[p.id] = existing
        ? { roleId: existing.roleId, alignment: existing.alignment }
        : { alignment: 'good' }
    }
    return init
  })
  const [pickingFor, setPickingFor] = useState<PlayerId | null>(null)

  function setAlignment(id: PlayerId, alignment: Alignment) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], alignment } }))
  }
  function setRole(id: PlayerId, roleId: RoleId | undefined) {
    setDraft((d) => ({
      ...d,
      [id]: { roleId, alignment: roleId ? roleAlignment(game, script, roleId) : d[id].alignment },
    }))
  }

  function save() {
    const truth: Reveal[] = session.players.map((p) => ({
      playerId: p.id,
      roleId: draft[p.id].roleId,
      alignment: draft[p.id].alignment,
    }))
    setTruth(truth)
    onSaved()
  }

  const pickingName = pickingFor
    ? session.players.find((p) => p.id === pickingFor)?.name
    : ''

  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t('review.truthHint')}</p>

      <ul className="space-y-1.5">
        {session.players.map((p) => {
          const d = draft[p.id]
          const roleName = d.roleId ? getRole(script, d.roleId)?.name : null
          return (
            <li key={p.id} className="rounded-xl border border-line bg-surface px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-muted tabular-nums">{p.seat + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-line">
                  {ALIGN_OPTIONS.map((opt, i) => (
                    <button
                      key={opt.id}
                      onClick={() => setAlignment(p.id, opt.id)}
                      className={[
                        'px-2.5 py-1 text-xs font-semibold',
                        i > 0 ? 'border-l border-line' : '',
                        d.alignment === opt.id ? opt.on : 'text-muted active:bg-raised',
                      ].join(' ')}
                    >
                      {t(`tone.${opt.id}`)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setPickingFor(p.id)}
                className="mt-1.5 w-full rounded-lg border border-line bg-raised px-2.5 py-1.5 text-left text-xs active:bg-line"
              >
                {roleName ? (
                  <span className="text-ink">{roleName}</span>
                ) : (
                  <span className="text-muted">{t('review.rolePrompt')}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <button
        onClick={save}
        className="mt-4 w-full rounded-xl bg-info py-3 font-semibold text-bg active:opacity-80"
      >
        {t('review.saveResults')}
      </button>

      <Sheet
        open={pickingFor !== null}
        onClose={() => setPickingFor(null)}
        title={pickingName ? t('review.roleTitle', { name: pickingName }) : t('review.role')}
        footer={
          pickingFor && draft[pickingFor].roleId ? (
            <button
              onClick={() => {
                setRole(pickingFor, undefined)
                setPickingFor(null)
              }}
              className="w-full rounded-xl border border-line bg-raised py-3 text-sm text-muted active:bg-line"
            >
              {t('review.clearRole')}
            </button>
          ) : undefined
        }
      >
        {pickingFor && (
          <RolePicker
            game={game}
            script={script}
            selected={draft[pickingFor].roleId ? [draft[pickingFor].roleId!] : []}
            // Single-select here: tapping a role sets it and closes; tapping the
            // current one clears it. (RolePicker itself is multi-select for guesses.)
            onToggle={(id) => {
              setRole(pickingFor, draft[pickingFor].roleId === id ? undefined : id)
              setPickingFor(null)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

import { useState } from 'react'
import { createScriptConfig, getGame } from '../config'
import { useT } from '../i18n'
import { resolveTeamColor, teamChipStyle } from '../tone'

type Role = { name: string; team: string }

type Props = {
  gameId: string
  /** Pre-fill (a fresh copy of an existing script — "duplicate"). Absent = blank. */
  initial?: { name: string; roles: Role[] }
  onCancel: () => void
  onCreated: (id: string) => void
}

/**
 * Create a new script (a role list) for a game — never edits an existing one in
 * place (see createScriptConfig). "Duplicate" seeds it from an existing script.
 */
export function ScriptEditor({ gameId, initial, onCancel, onCreated }: Props) {
  const { t } = useT()
  const game = getGame(gameId)
  const firstTeam = game.teams[0]?.id ?? ''

  const [name, setName] = useState(initial?.name ?? '')
  const [roles, setRoles] = useState<Role[]>(initial?.roles?.length ? initial.roles : [{ name: '', team: firstTeam }])
  const [errors, setErrors] = useState<string[]>([])

  function setRole(i: number, patch: Partial<Role>) {
    setRoles((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function addRole() {
    setRoles((prev) => [...prev, { name: '', team: firstTeam }])
  }
  function removeRole(i: number) {
    setRoles((prev) => prev.filter((_, j) => j !== i))
  }

  const namedRoles = roles.filter((r) => r.name.trim())
  const canCreate = name.trim().length > 0 && namedRoles.length > 0

  function create() {
    const local: string[] = []
    if (!name.trim()) local.push(t('editor.needName'))
    if (namedRoles.length === 0) local.push(t('editor.needRole'))
    if (local.length) return setErrors(local)
    const res = createScriptConfig({ name, gameId, roles: namedRoles })
    if (res.ok) onCreated(res.id)
    else setErrors(res.errors)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{initial ? t('editor.duplicateScript') : t('editor.newScript')}</h1>
        <button
          onClick={onCancel}
          className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-muted active:bg-line"
        >
          {t('common.cancel')}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">{t('editor.forGame', { game: game.name })}</p>

      <label className="mt-5 block text-sm font-medium">{t('editor.scriptName')}</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-line bg-raised px-3 py-2.5 text-ink placeholder:text-muted/60 focus:border-info focus:outline-none"
      />

      <div className="mt-5 flex-1">
        <label className="text-sm font-medium">{t('editor.roles')}</label>
        <ul className="mt-2 space-y-2">
          {roles.map((role, i) => (
            <li key={i} className="rounded-xl border border-line bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={role.name}
                  onChange={(e) => setRole(i, { name: e.target.value })}
                  placeholder={t('editor.roleName')}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-raised px-2.5 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-info focus:outline-none"
                />
                <button
                  onClick={() => removeRole(i)}
                  aria-label={t('common.remove')}
                  className="shrink-0 rounded-lg border border-line px-2 py-2 text-xs text-muted active:bg-raised"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {game.teams.map((team) => {
                  const sel = role.team === team.id
                  return (
                    <button
                      key={team.id}
                      onClick={() => setRole(i, { team: team.id })}
                      aria-pressed={sel}
                      style={sel ? teamChipStyle(team.color) : undefined}
                      className={[
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs',
                        sel ? '' : 'border-line bg-raised text-muted active:bg-line',
                      ].join(' ')}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: resolveTeamColor(team.color) }}
                      />
                      {team.name}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={addRole}
          className="mt-2 w-full rounded-xl border border-dashed border-line py-2.5 text-sm text-muted active:bg-raised"
        >
          {t('editor.addRole')}
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl border border-evil/40 bg-evil/10 px-3 py-2 text-xs text-evil">
          {errors.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      )}

      <button
        onClick={create}
        disabled={!canCreate}
        className="sticky bottom-4 mt-6 w-full rounded-xl bg-info py-3.5 font-semibold text-bg active:opacity-80 disabled:opacity-30"
      >
        {t('common.create')}
      </button>
    </div>
  )
}

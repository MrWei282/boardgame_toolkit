import { useState } from 'react'
import { createGameConfig } from '../config'
import { useT } from '../i18n'
import { useSettings } from '../settings'
import { effectiveColor } from '../theme'
import type { Alignment, Tone } from '../types'

type Team = { name: string; alignment: Alignment; color: string }
type Phase = { label: string; short: string }
export type GameInitial = {
  name: string
  minPlayers: number
  maxPlayers: number
  teams: Team[]
  phases: { setup: Phase[]; cycle: Phase[] }
}

type Props = {
  initial?: GameInitial
  onCancel: () => void
  onCreated: (id: string) => void
}

const ALIGNMENTS: Alignment[] = ['good', 'neutral', 'evil']
const isHex = (c: string) => c.startsWith('#')

/** Create a new game (shape of play) — create-only, like ScriptEditor. Relations are
 *  omitted so the game inherits the default vocabulary (editing them lands in 7.6). */
export function GameEditor({ initial, onCancel, onCreated }: Props) {
  const { t } = useT()
  const palette = useSettings((s) => s.palette)
  const customColors = useSettings((s) => s.customColors)
  // A team colour is either a base-tone name (auto — tracks the alignment/palette) or a
  // literal hex (custom — the user picked it, and it then stays across alignment changes).
  const colorHex = (c: string) => (isHex(c) ? c : effectiveColor(palette, c as Tone, customColors))

  const [name, setName] = useState(initial?.name ?? '')
  const [minPlayers, setMin] = useState(initial?.minPlayers ?? 5)
  const [maxPlayers, setMax] = useState(initial?.maxPlayers ?? 10)
  const [teams, setTeams] = useState<Team[]>(
    initial?.teams?.length ? initial.teams : [{ name: '', alignment: 'good', color: 'good' }],
  )
  const [setup, setSetup] = useState<Phase[]>(initial?.phases.setup ?? [])
  const [cycle, setCycle] = useState<Phase[]>(initial?.phases.cycle?.length ? initial.phases.cycle : [{ label: '', short: '' }])
  const [errors, setErrors] = useState<string[]>([])

  const namedTeams = teams.filter((t) => t.name.trim())
  const namedCycle = cycle.filter((p) => p.label.trim() || p.short.trim())
  const canCreate = name.trim().length > 0 && namedTeams.length > 0 && namedCycle.length > 0

  function create() {
    const res = createGameConfig({ name, minPlayers, maxPlayers, teams: namedTeams, phases: { setup, cycle } })
    if (res.ok) onCreated(res.id)
    else setErrors(res.errors)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{initial ? t('editor.duplicateGame') : t('editor.newGame')}</h1>
        <button
          onClick={onCancel}
          className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-muted active:bg-line"
        >
          {t('common.cancel')}
        </button>
      </div>

      <label className="mt-5 block text-sm font-medium">{t('editor.gameName')}</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-line bg-raised px-3 py-2.5 text-ink focus:border-info focus:outline-none"
      />

      {/* Player count */}
      <label className="mt-5 block text-sm font-medium">{t('editor.playerCount')}</label>
      <div className="mt-2 flex gap-2">
        <NumField label={t('editor.min')} value={minPlayers} onChange={(v) => setMin(v)} />
        <NumField label={t('editor.max')} value={maxPlayers} onChange={(v) => setMax(v)} />
      </div>

      {/* Teams */}
      <div className="mt-6">
        <label className="text-sm font-medium">{t('editor.teams')}</label>
        <ul className="mt-2 space-y-2">
          {teams.map((team, i) => (
            <li key={i} className="rounded-xl border border-line bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorHex(team.color)}
                  onChange={(e) => setTeams((p) => p.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
                  aria-label={t('editor.teamName')}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <input
                  value={team.name}
                  onChange={(e) => setTeams((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder={t('editor.teamName')}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-raised px-2.5 py-2 text-sm focus:border-info focus:outline-none"
                />
                <button
                  onClick={() => setTeams((p) => p.filter((_, j) => j !== i))}
                  aria-label={t('common.remove')}
                  className="shrink-0 rounded-lg border border-line px-2 py-2 text-xs text-muted active:bg-raised"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex gap-1.5">
                {ALIGNMENTS.map((a) => (
                  <button
                    key={a}
                    onClick={() =>
                      setTeams((p) =>
                        p.map((x, j) => (j === i ? { ...x, alignment: a, color: isHex(x.color) ? x.color : a } : x)),
                      )
                    }
                    aria-pressed={team.alignment === a}
                    className={[
                      'flex-1 rounded-lg border px-2 py-1 text-xs',
                      team.alignment === a ? 'border-info bg-info/15 text-ink' : 'border-line bg-raised text-muted active:bg-line',
                    ].join(' ')}
                  >
                    {t(`tone.${a}`)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={() => setTeams((p) => [...p, { name: '', alignment: 'good', color: 'good' }])}
          className="mt-2 w-full rounded-xl border border-dashed border-line py-2 text-sm text-muted active:bg-raised"
        >
          {t('editor.addTeam')}
        </button>
      </div>

      {/* Phases */}
      <div className="mt-6 flex-1">
        <label className="text-sm font-medium">{t('editor.phases')}</label>
        <PhaseList label={t('editor.setupPhases')} phases={setup} setPhases={setSetup} t={t} />
        <PhaseList label={t('editor.cyclePhases')} phases={cycle} setPhases={setCycle} t={t} />
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

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="number"
        min={1}
        max={30}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
        className="w-full min-w-0 bg-transparent text-right text-sm tabular-nums focus:outline-none"
      />
    </label>
  )
}

function PhaseList({
  label,
  phases,
  setPhases,
  t,
}: {
  label: string
  phases: Phase[]
  setPhases: (fn: (p: Phase[]) => Phase[]) => void
  t: (k: string) => string
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] tracking-wide text-muted uppercase">{label}</div>
      <ul className="space-y-1.5">
        {phases.map((phase, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={phase.label}
              onChange={(e) => setPhases((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              placeholder={t('editor.phaseName')}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-sm focus:border-info focus:outline-none"
            />
            <input
              value={phase.short}
              onChange={(e) => setPhases((p) => p.map((x, j) => (j === i ? { ...x, short: e.target.value } : x)))}
              placeholder={t('editor.phaseShort')}
              autoComplete="off"
              className="w-16 shrink-0 rounded-lg border border-line bg-raised px-2 py-1.5 text-sm focus:border-info focus:outline-none"
            />
            <button
              onClick={() => setPhases((p) => p.filter((_, j) => j !== i))}
              aria-label="remove"
              className="shrink-0 rounded-lg border border-line px-2 py-1.5 text-xs text-muted active:bg-raised"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => setPhases((p) => [...p, { label: '', short: '' }])}
        className="mt-1.5 w-full rounded-lg border border-dashed border-line py-1.5 text-[11px] text-muted active:bg-raised"
      >
        {t('editor.addPhase')}
      </button>
    </div>
  )
}

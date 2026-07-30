import { useRef, useState } from 'react'
import {
  allGames,
  removeGameConfig,
  removeScriptConfig,
  restoreDefaultConfigs,
  scriptsForGame,
  updateTeamColor,
} from '../config'
import { useT, type TFn } from '../i18n'
import { type Lang, useSettings } from '../settings'
import {
  buildBackupBundle,
  buildConfigBundle,
  bundleFilename,
  downloadText,
  parseBundle,
  serializeBundle,
} from '../share'
import { useSessions, useStore } from '../store'
import { effectiveColor, PALETTES } from '../theme'
import type { Tone } from '../types'
import { GameEditor, type GameInitial } from './GameEditor'
import { ScriptEditor } from './ScriptEditor'

type EditorState =
  | { kind: 'script'; gameId: string; initial?: { name: string; roles: { name: string; team: string }[] } }
  | { kind: 'game'; initial?: GameInitial }

const TONE_ORDER: Tone[] = ['good', 'evil', 'neutral', 'info']
const BASE_TONES = new Set<string>(TONE_ORDER)
const LANG_LABELS: Record<Lang, string> = { en: 'English', zh: '中文' }

/** A team colour as a hex the <input type="color"> can show: base tones resolve to
 *  their current palette hex; a literal colour is returned as-is. */
function teamHex(color: string, palette: string, custom: Partial<Record<Tone, string>>): string {
  return BASE_TONES.has(color) ? effectiveColor(palette, color as Tone, custom) : color
}

type ImportOutcome =
  | { ok: true; summary: { sessions: number; games: number; scripts: number; settings: boolean } }
  | { ok: false; errors: string[] }

export function Settings({ onClose }: { onClose: () => void }) {
  const sessions = useSessions()
  const importBundle = useStore((s) => s.importBundle)
  const palette = useSettings((s) => s.palette)
  const setPalette = useSettings((s) => s.setPalette)
  const customColors = useSettings((s) => s.customColors)
  const setCustomColor = useSettings((s) => s.setCustomColor)
  const resetColors = useSettings((s) => s.resetColors)
  const language = useSettings((s) => s.language)
  const setLanguage = useSettings((s) => s.setLanguage)
  const { t } = useT()
  const fileInput = useRef<HTMLInputElement>(null)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  // The config registries mutate in place; bump this to re-read them after a change.
  const [rev, setRev] = useState(0)
  const bump = () => setRev((v) => v + 1)
  const [editor, setEditor] = useState<EditorState | null>(null)

  function exportAll() {
    if (sessions.length === 0) return
    downloadText(bundleFilename('toolkit-backup'), serializeBundle(buildBackupBundle(sessions)))
  }

  async function onFile(file: File) {
    setOutcome(null)
    const text = await file.text()
    const res = parseBundle(text)
    if (!res.ok) {
      setOutcome({ ok: false, errors: res.errors })
      return
    }
    importBundle(res.bundle)
    setOutcome({ ok: true, summary: res.bundle.summary })
  }

  // The create-only editor replaces the Settings screen while open; saving registers
  // a new config and returns here (bumped so the list re-reads).
  if (editor) {
    const done = () => {
      setEditor(null)
      bump()
    }
    if (editor.kind === 'game') {
      return <GameEditor initial={editor.initial} onCancel={() => setEditor(null)} onCreated={done} />
    }
    return (
      <ScriptEditor
        gameId={editor.gameId}
        initial={editor.initial}
        onCancel={() => setEditor(null)}
        onCreated={done}
      />
    )
  }

  // A config can't be removed while a saved game depends on it (getGame/getScript
  // throw by design), so the buttons for those are disabled.
  const games = allGames()
  const gameInUse = new Set(sessions.map((s) => s.gameId))
  const scriptInUse = new Set(sessions.map((s) => s.scriptId))

  return (
    <div
      data-config-rev={rev}
      className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
        <button
          onClick={onClose}
          className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-muted active:bg-line"
        >
          {t('common.done')}
        </button>
      </div>

      <section className="mt-6">
        <h2 className="mb-1 text-[11px] tracking-wide text-muted uppercase">{t('settings.data')}</h2>
        <p className="mb-3 text-xs text-muted">{t('settings.dataHint')}</p>

        <div className="space-y-2">
          <button
            onClick={exportAll}
            disabled={sessions.length === 0}
            className="w-full rounded-xl border border-line bg-raised px-3 py-3 text-left text-sm active:bg-line disabled:opacity-40"
          >
            <span className="font-medium">{t('settings.exportAll')}</span>
            <span className="mt-0.5 block text-[11px] text-muted">
              {sessions.length === 0 ? t('settings.noExport') : t('settings.exportSub', { n: sessions.length })}
            </span>
          </button>

          <button
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-xl border border-line bg-raised px-3 py-3 text-left text-sm active:bg-line"
          >
            <span className="font-medium">{t('settings.importFile')}</span>
            <span className="mt-0.5 block text-[11px] text-muted">{t('settings.importFileSub')}</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
              e.target.value = '' // let the same file be re-picked
            }}
          />
        </div>

        {outcome && !outcome.ok && (
          <ul className="mt-3 space-y-1 rounded-xl border border-evil/40 bg-evil/10 px-3 py-2 text-xs text-evil">
            {outcome.errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}
        {outcome && outcome.ok && (
          <p className="mt-3 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-xs text-good">
            {t('settings.importedPrefix')}
            {summarize(outcome.summary, t)}.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-[11px] tracking-wide text-muted uppercase">{t('settings.appearance')}</h2>
        <p className="mb-3 text-xs text-muted">{t('settings.appearanceHint')}</p>
        <div className="space-y-2">
          {PALETTES.map((p) => {
            const selected = p.id === palette
            return (
              <button
                key={p.id}
                onClick={() => setPalette(p.id)}
                aria-pressed={selected}
                className={[
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left active:bg-line',
                  selected ? 'border-info bg-info/10' : 'border-line bg-raised',
                ].join(' ')}
              >
                <span className="flex shrink-0 gap-1">
                  {TONE_ORDER.map((tone) => (
                    <span key={tone} className="h-4 w-4 rounded-full" style={{ backgroundColor: p.colors[tone] }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t(`palette.${p.id}.name`)}</span>
                  <span className="block text-[11px] text-muted">{t(`palette.${p.id}.desc`)}</span>
                </span>
                {selected && <span className="shrink-0 text-info">✓</span>}
              </button>
            )
          })}
        </div>

        {/* Per-tone override on top of the chosen preset. */}
        <div className="mt-3 rounded-xl border border-line bg-surface px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">{t('settings.customise')}</span>
            {Object.keys(customColors).length > 0 && (
              <button onClick={resetColors} className="text-[11px] text-info active:text-ink">
                {t('settings.reset')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TONE_ORDER.map((tone) => (
              <label
                key={tone}
                className="flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-2"
              >
                <input
                  type="color"
                  value={effectiveColor(palette, tone, customColors)}
                  onChange={(e) => setCustomColor(tone, e.target.value)}
                  className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={t(`tone.${tone}`)}
                />
                <span className="text-sm">{t(`tone.${tone}`)}</span>
                {customColors[tone] && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      setCustomColor(tone, null)
                    }}
                    aria-label={`${t('settings.reset')} ${t(`tone.${tone}`)}`}
                    className="ml-auto text-[11px] text-muted active:text-ink"
                  >
                    ✕
                  </button>
                )}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-[11px] tracking-wide text-muted uppercase">{t('settings.language')}</h2>
        <div className="flex gap-2">
          {(['en', 'zh'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              aria-pressed={language === l}
              className={[
                'flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium active:bg-line',
                language === l ? 'border-info bg-info/10 text-ink' : 'border-line bg-raised text-muted',
              ].join(' ')}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-[11px] tracking-wide text-muted uppercase">{t('settings.games')}</h2>
        <p className="mb-3 text-xs text-muted">{t('settings.gamesHint')}</p>

        {games.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            {t('settings.noGamesInstalled')}
          </p>
        ) : (
          <ul className="space-y-2">
            {games.map((g) => {
              const scripts = scriptsForGame(g.id)
              const gInUse = gameInUse.has(g.id)
              return (
                <li key={g.id} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{g.name}</div>
                      <div className="text-[11px] text-muted">
                        {t('settings.gameMeta', { min: g.minPlayers, max: g.maxPlayers, n: scripts.length })}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setEditor({
                          kind: 'game',
                          initial: {
                            name: `${g.name}_updated`,
                            minPlayers: g.minPlayers,
                            maxPlayers: g.maxPlayers,
                            teams: g.teams.map((tm) => ({ name: tm.name, alignment: tm.alignment, color: tm.color })),
                            phases: {
                              setup: (g.phases.setup ?? []).map((p) => ({ label: p.label, short: p.short })),
                              cycle: g.phases.cycle.map((p) => ({ label: p.label, short: p.short })),
                            },
                          },
                        })
                      }
                      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-muted active:bg-raised"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => downloadText(bundleFilename(g.name), serializeBundle(buildConfigBundle(g.id)))}
                      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-muted active:bg-raised"
                    >
                      {t('common.export')}
                    </button>
                    <button
                      onClick={() => {
                        removeGameConfig(g.id)
                        bump()
                      }}
                      disabled={gInUse}
                      className="shrink-0 rounded-lg border border-evil/40 px-2.5 py-1 text-xs text-evil active:bg-raised disabled:border-line disabled:text-muted disabled:opacity-40"
                    >
                      {t('common.remove')}
                    </button>
                  </div>

                  {/* Team colours — cosmetic, so safe to edit in place. A base-tone
                      team tracks the palette; picking a colour pins it to that hex. */}
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                    {g.teams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-1.5 rounded-lg border border-line bg-raised px-2 py-1"
                      >
                        <input
                          type="color"
                          value={teamHex(team.color, palette, customColors)}
                          onChange={(e) => {
                            updateTeamColor(g.id, team.id, e.target.value)
                            bump()
                          }}
                          className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                          aria-label={`${team.name} colour`}
                        />
                        <span className="text-[11px]">{team.name}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-2 space-y-1 border-t border-line pt-2">
                    {scripts.map((s) => {
                      const sInUse = scriptInUse.has(s.id)
                      return (
                        <div key={s.id} className="flex items-center gap-2 pl-1">
                          <span className="min-w-0 flex-1 truncate text-xs text-ink">{s.name}</span>
                          {sInUse && <span className="shrink-0 text-[10px] text-muted">{t('settings.inUse')}</span>}
                          <button
                            onClick={() =>
                              setEditor({
                                kind: 'script',
                                gameId: g.id,
                                initial: { name: `${s.name}_updated`, roles: s.roles.map((r) => ({ name: r.name, team: r.team })) },
                              })
                            }
                            className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[11px] text-muted active:bg-raised"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => {
                              removeScriptConfig(s.id)
                              bump()
                            }}
                            disabled={sInUse}
                            className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[11px] text-muted active:bg-raised disabled:opacity-40"
                          >
                            {t('common.remove')}
                          </button>
                        </div>
                      )
                    })}
                    <button
                      onClick={() => setEditor({ kind: 'script', gameId: g.id })}
                      className="mt-1 w-full rounded-md border border-dashed border-line py-1.5 text-[11px] text-muted active:bg-raised"
                    >
                      {t('settings.newScript')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <button
          onClick={() => setEditor({ kind: 'game' })}
          className="mt-3 w-full rounded-xl border border-dashed border-line py-2.5 text-sm text-info active:bg-raised"
        >
          {t('settings.newGame')}
        </button>

        <button
          onClick={() => {
            restoreDefaultConfigs()
            bump()
          }}
          className="mt-2 w-full rounded-xl border border-line bg-raised px-3 py-2.5 text-sm text-muted active:bg-line"
        >
          {t('common.restoreDefaults')}
        </button>
      </section>
    </div>
  )
}

function summarize(s: { sessions: number; games: number; scripts: number; settings: boolean }, t: TFn): string {
  const parts: string[] = []
  if (s.sessions) parts.push(t('summary.games', { n: s.sessions }))
  if (s.games) parts.push(t('summary.gameConfigs', { n: s.games }))
  if (s.scripts) parts.push(t('summary.scripts', { n: s.scripts }))
  if (s.settings) parts.push(t('summary.settings'))
  return parts.length ? parts.join(t('common.and')) : t('summary.nothing')
}

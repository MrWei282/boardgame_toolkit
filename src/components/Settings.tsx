import { useRef, useState } from 'react'
import {
  allGames,
  removeGameConfig,
  removeScriptConfig,
  restoreDefaultConfigs,
  scriptsForGame,
} from '../config'
import { useSettings } from '../settings'
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

const TONE_LABELS: Record<Tone, string> = { good: 'Good', evil: 'Evil', neutral: 'Neutral', info: 'Info' }
const TONE_ORDER: Tone[] = ['good', 'evil', 'neutral', 'info']

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
  const fileInput = useRef<HTMLInputElement>(null)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  // The config registries mutate in place; bump this to re-read them after a change.
  const [rev, setRev] = useState(0)
  const bump = () => setRev((v) => v + 1)

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
        <h1 className="text-xl font-semibold">Settings</h1>
        <button
          onClick={onClose}
          className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-muted active:bg-line"
        >
          Done
        </button>
      </div>

      <section className="mt-6">
        <h2 className="mb-1 text-[11px] tracking-wide text-muted uppercase">Data</h2>
        <p className="mb-3 text-xs text-muted">
          Everything is stored on this device. Export a backup to move it to another device or keep it
          safe; import merges a file in (your existing games are never overwritten).
        </p>

        <div className="space-y-2">
          <button
            onClick={exportAll}
            disabled={sessions.length === 0}
            className="w-full rounded-xl border border-line bg-raised px-3 py-3 text-left text-sm active:bg-line disabled:opacity-40"
          >
            <span className="font-medium">Export everything</span>
            <span className="mt-0.5 block text-[11px] text-muted">
              {sessions.length === 0
                ? 'No games to export yet'
                : `${sessions.length} game${sessions.length === 1 ? '' : 's'} + your configs as one file`}
            </span>
          </button>

          <button
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-xl border border-line bg-raised px-3 py-3 text-left text-sm active:bg-line"
          >
            <span className="font-medium">Import a file</span>
            <span className="mt-0.5 block text-[11px] text-muted">A backup, a shared game, or a config</span>
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
            Imported {summarize(outcome.summary)}.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-[11px] tracking-wide text-muted uppercase">Appearance</h2>
        <p className="mb-3 text-xs text-muted">
          The four base colours — reads, relations and neutral/info — across the app and diagram.
          Team colours come from each game’s config.
        </p>
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
                  {TONE_ORDER.map((t) => (
                    <span key={t} className="h-4 w-4 rounded-full" style={{ backgroundColor: p.colors[t] }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="block text-[11px] text-muted">{p.description}</span>
                </span>
                {selected && <span className="shrink-0 text-info">✓</span>}
              </button>
            )
          })}
        </div>

        {/* Per-tone override on top of the chosen preset. */}
        <div className="mt-3 rounded-xl border border-line bg-surface px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Customise colours</span>
            {Object.keys(customColors).length > 0 && (
              <button onClick={resetColors} className="text-[11px] text-info active:text-ink">
                Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TONE_ORDER.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-2"
              >
                <input
                  type="color"
                  value={effectiveColor(palette, t, customColors)}
                  onChange={(e) => setCustomColor(t, e.target.value)}
                  className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={`${TONE_LABELS[t]} colour`}
                />
                <span className="text-sm">{TONE_LABELS[t]}</span>
                {customColors[t] && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      setCustomColor(t, null)
                    }}
                    aria-label={`Reset ${TONE_LABELS[t]}`}
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
        <h2 className="mb-1 text-[11px] tracking-wide text-muted uppercase">Games &amp; scripts</h2>
        <p className="mb-3 text-xs text-muted">
          Every game and script installed on this device. Removing a game removes its scripts too.
          Anything used by a saved game can’t be removed.
        </p>

        {games.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            No games installed.
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
                        {g.minPlayers}–{g.maxPlayers} players · {scripts.length} script
                        {scripts.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadText(bundleFilename(g.name), serializeBundle(buildConfigBundle(g.id)))}
                      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-muted active:bg-raised"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => {
                        removeGameConfig(g.id)
                        bump()
                      }}
                      disabled={gInUse}
                      className="shrink-0 rounded-lg border border-evil/40 px-2.5 py-1 text-xs text-evil active:bg-raised disabled:border-line disabled:text-muted disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  {scripts.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-line pt-2">
                      {scripts.map((s) => {
                        const sInUse = scriptInUse.has(s.id)
                        return (
                          <li key={s.id} className="flex items-center gap-2 pl-1">
                            <span className="min-w-0 flex-1 truncate text-xs text-ink">{s.name}</span>
                            {sInUse && <span className="shrink-0 text-[10px] text-muted">in use</span>}
                            <button
                              onClick={() => {
                                removeScriptConfig(s.id)
                                bump()
                              }}
                              disabled={sInUse}
                              className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[11px] text-muted active:bg-raised disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <button
          onClick={() => {
            restoreDefaultConfigs()
            bump()
          }}
          className="mt-3 w-full rounded-xl border border-line bg-raised px-3 py-2.5 text-sm text-muted active:bg-line"
        >
          Restore default games
        </button>
      </section>
    </div>
  )
}

function summarize(s: { sessions: number; games: number; scripts: number; settings: boolean }): string {
  const parts: string[] = []
  if (s.sessions) parts.push(`${s.sessions} game${s.sessions === 1 ? '' : 's'}`)
  if (s.games) parts.push(`${s.games} game config${s.games === 1 ? '' : 's'}`)
  if (s.scripts) parts.push(`${s.scripts} script${s.scripts === 1 ? '' : 's'}`)
  if (s.settings) parts.push('settings')
  return parts.length ? parts.join(', ') : 'nothing'
}

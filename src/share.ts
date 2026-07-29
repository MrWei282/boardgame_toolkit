import { allGames, allScripts, getGame, getScript, scriptsForGame } from './config'
import { validateGame, validateScript } from './config/validate'
import type { GameConfig, ScriptConfig, Session } from './types'

// Portability, no backend. A Bundle is a self-contained, portable snapshot that can
// carry any subset of { sessions, configs, settings }. The same format serves every
// export granularity — a full backup (move to a new device), one game (share a recap
// with a tablemate), or just configs (share a custom game). Import auto-detects
// whatever is inside. Configs travel *with* the sessions that need them, because a
// bare Session references a game/script by id that the recipient may not have.

const KIND = 'botc-toolkit/bundle'
const VERSION = 1

export type Bundle = {
  kind: typeof KIND
  version: number
  exportedAt: number
  sessions?: Session[]
  games?: GameConfig[]
  scripts?: ScriptConfig[]
  // Reserved for full-backup app settings (palette/language) — added in 7.3/7.4.
  settings?: { palette?: string; language?: string }
}

/** A validated, normalized bundle ready to import, plus a human summary for the preview. */
export type ParsedBundle = {
  sessions: Session[]
  games: GameConfig[]
  scripts: ScriptConfig[]
  settings?: { palette?: string; language?: string }
  summary: { sessions: number; games: number; scripts: number; settings: boolean }
}

// --- building ----------------------------------------------------------------

/** Everything: all sessions + all configs (+ settings later). The multi-device backup. */
export function buildBackupBundle(sessions: Session[]): Bundle {
  return {
    kind: KIND,
    version: VERSION,
    exportedAt: Date.now(),
    sessions,
    games: allGames(),
    scripts: allScripts(),
  }
}

/** One game config + its scripts, no sessions — the "share a custom game" export. */
export function buildConfigBundle(gameId: string): Bundle {
  return {
    kind: KIND,
    version: VERSION,
    exportedAt: Date.now(),
    games: [getGame(gameId)],
    scripts: scriptsForGame(gameId),
  }
}

/** One session plus exactly the configs it references — the "share a game" export. */
export function buildSessionBundle(session: Session): Bundle {
  return {
    kind: KIND,
    version: VERSION,
    exportedAt: Date.now(),
    sessions: [session],
    games: [getGame(session.gameId)],
    scripts: [getScript(session.scriptId)],
  }
}

export function serializeBundle(bundle: Bundle): string {
  return JSON.stringify(bundle, null, 2)
}

// --- parsing (never throws; path-prefixed errors, like validate.ts) ----------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Shape-guard a session. Deliberately shallow — sessions come from the app's own
 *  storage, so this catches a wrong-file / corruption mistake, not every field. */
function isSessionShape(v: unknown): v is Session {
  if (!isObject(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.gameId === 'string' &&
    typeof v.scriptId === 'string' &&
    Array.isArray(v.players) &&
    Array.isArray(v.assertions) &&
    Array.isArray(v.roleTags) &&
    Array.isArray(v.reads) &&
    Array.isArray(v.events)
  )
}

export function parseBundle(text: string): { ok: true; bundle: ParsedBundle } | { ok: false; errors: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { ok: false, errors: [`Not valid JSON: ${(err as Error).message}`] }
  }
  if (!isObject(parsed)) return { ok: false, errors: ['Expected a JSON object'] }
  if (parsed.kind !== KIND)
    return { ok: false, errors: ['This file is not a toolkit bundle (wrong "kind").'] }
  if (typeof parsed.version !== 'number' || parsed.version > VERSION)
    return { ok: false, errors: [`Bundle version ${String(parsed.version)} is newer than this app understands.`] }

  const errors: string[] = []

  // Games first — a script's team references are checked against its game.
  const games: GameConfig[] = []
  if (parsed.games !== undefined) {
    if (!Array.isArray(parsed.games)) errors.push('games: must be an array')
    else
      parsed.games.forEach((g, i) => {
        const res = validateGame(g)
        if (!res.ok) errors.push(...res.errors.map((m) => `games[${i}] — ${m}`))
        else games.push(res.value)
      })
  }

  // A game the bundle's scripts may extend: one in this bundle, or one already installed.
  function teamIdsFor(gameId: unknown): Set<string> | null {
    const inBundle = typeof gameId === 'string' ? games.find((g) => g.id === gameId) : undefined
    const existing = typeof gameId === 'string' ? allGames().find((g) => g.id === gameId) : undefined
    const g = inBundle ?? existing
    return g ? new Set(g.teams.map((t) => t.id)) : null
  }

  const scripts: ScriptConfig[] = []
  if (parsed.scripts !== undefined) {
    if (!Array.isArray(parsed.scripts)) errors.push('scripts: must be an array')
    else
      parsed.scripts.forEach((s, i) => {
        const gid = isObject(s) ? s.gameId : undefined
        const res = validateScript(s, teamIdsFor(gid))
        if (!res.ok) errors.push(...res.errors.map((m) => `scripts[${i}] — ${m}`))
        else scripts.push(res.value)
      })
  }

  const sessions: Session[] = []
  if (parsed.sessions !== undefined) {
    if (!Array.isArray(parsed.sessions)) errors.push('sessions: must be an array')
    else
      parsed.sessions.forEach((s, i) => {
        if (!isSessionShape(s)) errors.push(`sessions[${i}]: not a valid session`)
        else sessions.push(s)
      })
  }

  // Every session must be renderable after import: its game/script has to resolve,
  // either from this bundle or from what's already installed. Otherwise getGame throws
  // mid-render later — better to reject the import now with a clear message.
  const gameIds = new Set([...games.map((g) => g.id), ...allGames().map((g) => g.id)])
  const scriptIds = new Set([...scripts.map((s) => s.id), ...allScripts().map((s) => s.id)])
  sessions.forEach((s, i) => {
    if (!gameIds.has(s.gameId)) errors.push(`sessions[${i}]: needs game "${s.gameId}", which isn't in the file`)
    if (!scriptIds.has(s.scriptId)) errors.push(`sessions[${i}]: needs script "${s.scriptId}", which isn't in the file`)
  })

  if (sessions.length === 0 && games.length === 0 && scripts.length === 0 && parsed.settings === undefined)
    errors.push('Nothing to import — the file is empty.')

  if (errors.length) return { ok: false, errors }

  const settings = isObject(parsed.settings) ? (parsed.settings as ParsedBundle['settings']) : undefined
  return {
    ok: true,
    bundle: {
      sessions,
      games,
      scripts,
      settings,
      summary: { sessions: sessions.length, games: games.length, scripts: scripts.length, settings: settings !== undefined },
    },
  }
}

// --- file helpers ------------------------------------------------------------

/** Trigger a browser download of `text` as `filename`. */
export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** A filesystem-safe filename stem from a label + today's date. */
export function bundleFilename(label: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bundle'
  return `${slug}-${date}.botc.json`
}

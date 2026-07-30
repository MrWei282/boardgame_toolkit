import type { GameConfig, ScriptConfig } from '../types'

// The config store. Every game and script the app knows lives here, in localStorage,
// on equal footing — the shipped defaults (BotC, Avalon) are *seeded* into this same
// store on first run, not held apart as privileged built-ins. After seeding they are
// ordinary entries: editable, deletable, exportable exactly like an imported config.
// Read *synchronously* at module load — unlike session data, configs must be present
// before the first render, since `getGame` runs during it.

const KEY = 'deduction-config-store'
// Pre-modular blob (games/scripts only, no seeding). Adopted once so a user who had
// imported custom configs before the modular refactor keeps them.
const LEGACY_KEY = 'deduction-custom-configs'

type ConfigBlob = {
  version: number
  games: GameConfig[]
  scripts: ScriptConfig[]
  /**
   * Ids of defaults that have already been seeded once. A default whose id is in
   * here is never re-seeded automatically, so deleting BotC/Avalon *sticks* across
   * reloads; a newly shipped default (id not here) seeds once on the next load.
   * "Restore defaults" is the explicit way to bring a deleted default back.
   */
  seededIds: string[]
}

const EMPTY: ConfigBlob = { version: 2, games: [], scripts: [], seededIds: [] }

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function read(): ConfigBlob {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      // First run under the modular store: adopt any pre-modular custom configs, with
      // no seeded ids so the shipped defaults seed in alongside them on this load.
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        const old = JSON.parse(legacy) as Partial<ConfigBlob>
        return { version: 2, games: arr(old.games), scripts: arr(old.scripts), seededIds: [] }
      }
      return { ...EMPTY }
    }
    const data = JSON.parse(raw) as Partial<ConfigBlob>
    // Shape guard only — configs were validated before they were saved.
    return {
      version: 2,
      games: arr(data.games),
      scripts: arr(data.scripts),
      seededIds: arr<string>(data.seededIds).filter((x) => typeof x === 'string'),
    }
  } catch (err) {
    console.error('Failed to read config store, ignoring it:', err)
    return { ...EMPTY }
  }
}

function write(next: ConfigBlob) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch (err) {
    console.error('Failed to save config store:', err)
  }
}

let blob = read()

export function storedGames(): GameConfig[] {
  return blob.games
}
export function storedScripts(): ScriptConfig[] {
  return blob.scripts
}

/** Upsert a game by id (a re-imported config replaces the older version). An existing
 *  id is replaced *in place* so editing a game doesn't reorder the list; a new id appends. */
export function saveGame(game: GameConfig) {
  const games = blob.games.some((g) => g.id === game.id)
    ? blob.games.map((g) => (g.id === game.id ? game : g))
    : [...blob.games, game]
  blob = { ...blob, games }
  write(blob)
}
/** Upsert a script by id (replace in place if present, else append). */
export function saveScript(script: ScriptConfig) {
  const scripts = blob.scripts.some((s) => s.id === script.id)
    ? blob.scripts.map((s) => (s.id === script.id ? script : s))
    : [...blob.scripts, script]
  blob = { ...blob, scripts }
  write(blob)
}

/** Remove a game and cascade to the scripts that extended it. */
export function removeGame(id: string) {
  blob = {
    ...blob,
    games: blob.games.filter((g) => g.id !== id),
    scripts: blob.scripts.filter((s) => s.gameId !== id),
  }
  write(blob)
}
export function removeScript(id: string) {
  blob = { ...blob, scripts: blob.scripts.filter((s) => s.id !== id) }
  write(blob)
}

/**
 * Copy shipped defaults into the store the first time each is seen (tracked by
 * `seededIds`), skipping any the user has since deleted. Idempotent: on a normal
 * reload nothing changes; it acts only on a genuinely new default id.
 */
export function seedDefaults(games: GameConfig[], scripts: ScriptConfig[]) {
  const seeded = new Set(blob.seededIds)
  const gameById = new Map(blob.games.map((g) => [g.id, true]))
  const scriptById = new Map(blob.scripts.map((s) => [s.id, true]))

  const addGames = games.filter((g) => !seeded.has(g.id) && !gameById.has(g.id))
  const addScripts = scripts.filter((s) => !seeded.has(s.id) && !scriptById.has(s.id))
  const newIds = [...games, ...scripts].map((c) => c.id).filter((id) => !seeded.has(id))

  if (addGames.length === 0 && addScripts.length === 0 && newIds.length === 0) return
  for (const id of newIds) seeded.add(id)
  blob = {
    ...blob,
    games: [...blob.games, ...addGames],
    scripts: [...blob.scripts, ...addScripts],
    seededIds: [...seeded],
  }
  write(blob)
}

/**
 * Bring every shipped default back (upsert), even ones the user deleted — the
 * "Restore defaults" action. Existing custom configs and edits to non-default
 * configs are untouched.
 */
export function restoreDefaults(games: GameConfig[], scripts: ScriptConfig[]) {
  const gamesById = new Map(blob.games.map((g) => [g.id, g]))
  for (const g of games) gamesById.set(g.id, g)
  const scriptsById = new Map(blob.scripts.map((s) => [s.id, s]))
  for (const s of scripts) scriptsById.set(s.id, s)
  const seeded = new Set([...blob.seededIds, ...games.map((g) => g.id), ...scripts.map((s) => s.id)])
  blob = {
    version: 2,
    games: [...gamesById.values()],
    scripts: [...scriptsById.values()],
    seededIds: [...seeded],
  }
  write(blob)
}

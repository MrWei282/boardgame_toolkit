import type {
  GameConfig,
  RelationConfig,
  RelationId,
  RoleConfig,
  RoleId,
  ScriptConfig,
  TeamConfig,
  TeamId,
} from '../types'
import {
  removeGame,
  removeScript,
  restoreDefaults as restoreDefaultsInStore,
  saveGame,
  saveScript,
  seedDefaults,
  storedGames,
  storedScripts,
} from './custom'
import { DEFAULT_GAMES, DEFAULT_SCRIPTS } from './defaults'
import { validateGame, validateScript } from './validate'

export { DEFAULT_GAME_ID, DEFAULT_SCRIPT_ID } from './defaults'

/**
 * The relation vocabulary nearly every social-deduction game shares. A game config
 * may omit `relations` entirely and inherit this — so writing a game is usually just
 * teams + roles + phases, no boilerplate (and none of the fiddly vote roll-up wiring).
 * A game that needs a different vocabulary can still supply its own `relations`.
 */
const DEFAULT_RELATIONS: RelationConfig[] = [
  { id: 'vouch', label: 'Vouch', phrase: 'vouches for', targets: 'many', roles: 'none', edge: true, tone: 'good' },
  { id: 'accuse', label: 'Accuse', phrase: 'accuses', targets: 'many', roles: 'none', edge: true, tone: 'evil' },
  { id: 'nominate', label: 'Nominate', phrase: 'nominates', targets: 'one', roles: 'none', edge: true, tone: 'neutral', collectsVotesAs: 'vote' },
  { id: 'vote', label: 'Vote', phrase: 'votes for', targets: 'one', roles: 'none', edge: false, tone: 'neutral', internal: true },
  { id: 'info', label: 'Info', phrase: 'gives info on', selfPhrase: 'claims', targets: 'many', roles: 'optional', edge: true, tone: 'info' },
]

/** Fill in the default relations for a game that didn't declare its own. */
function withDefaults(game: GameConfig): GameConfig {
  return game.relations?.length ? game : { ...game, relations: DEFAULT_RELATIONS }
}

// The in-memory registries every component reads. They are a projection of the config
// store: the shipped defaults are seeded into the store on first run (making them
// ordinary, deletable entries) and then everything — defaults and imports alike — is
// loaded the same way. `withDefaults` is applied here so downstream code always sees a
// full `relations` array whether or not the stored config spelled one out.
export const GAMES: Record<string, GameConfig> = {}
export const SCRIPTS: Record<string, ScriptConfig> = {}

/** Rebuild the registries from the store. Called at load and after any store change,
 *  so the registries never drift from what's persisted. */
function rebuildRegistries() {
  for (const k of Object.keys(GAMES)) delete GAMES[k]
  for (const k of Object.keys(SCRIPTS)) delete SCRIPTS[k]
  for (const g of storedGames()) GAMES[g.id] = withDefaults(g)
  for (const s of storedScripts()) SCRIPTS[s.id] = s
}

seedDefaults(DEFAULT_GAMES, DEFAULT_SCRIPTS)
rebuildRegistries()

// Config problems should be loud and immediate rather than surfacing as an
// undefined three components deep.
export function getGame(id: string): GameConfig {
  const game = GAMES[id]
  if (!game) throw new Error(`Unknown game config: ${id}`)
  return game
}

export function getScript(id: string): ScriptConfig {
  const script = SCRIPTS[id]
  if (!script) throw new Error(`Unknown script config: ${id}`)
  return script
}

/** Every game that can start a session, in registry order — the setup picker reads this. */
export function allGames(): GameConfig[] {
  return Object.values(GAMES)
}

/** Every script, across all games — the config-management list reads this. */
export function allScripts(): ScriptConfig[] {
  return Object.values(SCRIPTS)
}

/** The scripts belonging to a game (a script extends a game via `gameId`). */
export function scriptsForGame(gameId: string): ScriptConfig[] {
  return Object.values(SCRIPTS).filter((s) => s.gameId === gameId)
}

export function getRelation(game: GameConfig, id: RelationId): RelationConfig {
  const relation = game.relations.find((r) => r.id === id)
  if (!relation) throw new Error(`Unknown relation "${id}" in game "${game.id}"`)
  return relation
}

export function getTeam(game: GameConfig, id: TeamId): TeamConfig | undefined {
  return game.teams.find((t) => t.id === id)
}

export function getRole(script: ScriptConfig, id: RoleId): RoleConfig | undefined {
  return script.roles.find((r) => r.id === id)
}

/** Roles grouped by team, in the team order the game config declares. */
export function rolesByTeam(
  game: GameConfig,
  script: ScriptConfig,
): { team: TeamConfig; roles: RoleConfig[] }[] {
  return game.teams
    .map((team) => ({ team, roles: script.roles.filter((r) => r.team === team.id) }))
    .filter((group) => group.roles.length > 0)
}

// --- config import / lifecycle ----------------------------------------------

export type ImportResult =
  | { ok: true; imported: string[]; gameId: string }
  | { ok: false; errors: string[] }

/**
 * Parse and register user-pasted config. Accepts a game (has `phases`), a script
 * (has `roles`/`gameId`), or a `{ game, script }` bundle. Everything is validated
 * first and only committed if the whole import is clean — a half-registered import
 * would be more confusing than a rejected one. An imported id replaces (upserts) an
 * existing config of the same id; there are no privileged built-ins to protect.
 */
export function importConfigText(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { ok: false, errors: [`Not valid JSON: ${(err as Error).message}`] }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return { ok: false, errors: ['Expected a JSON object'] }

  const obj = parsed as Record<string, unknown>
  let gameInput: unknown
  let scriptInput: unknown
  if ('game' in obj || 'script' in obj) {
    gameInput = obj.game
    scriptInput = obj.script
  } else if ('phases' in obj) {
    gameInput = obj
  } else if ('roles' in obj || 'gameId' in obj) {
    scriptInput = obj
  } else {
    return {
      ok: false,
      errors: ['Unrecognized config — expected a game (with "phases"), a script (with "roles"), or { game, script }'],
    }
  }

  const errors: string[] = []
  let gameToAdd: GameConfig | undefined
  let scriptToAdd: ScriptConfig | undefined

  if (gameInput !== undefined) {
    const res = validateGame(gameInput)
    if (!res.ok) errors.push(...res.errors.map((m) => `game — ${m}`))
    else gameToAdd = res.value
  }

  if (scriptInput !== undefined) {
    // Resolve the game the script extends: one in this same bundle, or an existing one.
    const gid = (scriptInput as Record<string, unknown>).gameId
    const targetGame =
      gameToAdd && gameToAdd.id === gid ? gameToAdd : typeof gid === 'string' ? GAMES[gid] : undefined
    const teamIds = targetGame ? new Set(targetGame.teams.map((t) => t.id)) : null
    const res = validateScript(scriptInput, teamIds)
    if (!res.ok) errors.push(...res.errors.map((m) => `script — ${m}`))
    else if (!targetGame) errors.push(`script — extends unknown game "${String(gid)}" (import its game too)`)
    else scriptToAdd = res.value
  }

  if (errors.length) return { ok: false, errors }

  const imported: string[] = []
  if (gameToAdd) {
    saveGame(gameToAdd) // stored raw (may omit relations); withDefaults applied on rebuild
    imported.push(`game “${gameToAdd.name}”`)
  }
  if (scriptToAdd) {
    saveScript(scriptToAdd)
    imported.push(`script “${scriptToAdd.name}”`)
  }
  rebuildRegistries()
  // The game to surface in the picker: the imported game, or the one a lone script extends.
  const gameId = gameToAdd?.id ?? scriptToAdd!.gameId
  return { ok: true, imported, gameId }
}

/** Register already-validated configs from a bundle import (see share.ts). Upserts by id. */
export function registerImportedConfigs(games: GameConfig[], scripts: ScriptConfig[]) {
  for (const g of games) saveGame(g)
  for (const s of scripts) saveScript(s)
  rebuildRegistries()
}

/** Remove a game and its scripts. Integrity (not deleting a config a saved session
 *  uses) is enforced by callers, which know the sessions. */
export function removeGameConfig(id: string) {
  removeGame(id)
  rebuildRegistries()
}

/** Remove a single script, leaving its game in place. */
export function removeScriptConfig(id: string) {
  removeScript(id)
  rebuildRegistries()
}

/** Bring the shipped default games/scripts back (even deleted ones). */
export function restoreDefaultConfigs() {
  restoreDefaultsInStore(DEFAULT_GAMES, DEFAULT_SCRIPTS)
  rebuildRegistries()
}

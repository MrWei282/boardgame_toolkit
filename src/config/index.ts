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
  customGames,
  customScripts,
  removeCustomGame as persistRemoveGame,
  saveCustomGame,
  saveCustomScript,
} from './custom'
import avalonGame from './game.avalon.json'
import botcGame from './game.botc.json'
import avalonBase from './script.avalon.json'
import troubleBrewing from './script.trouble-brewing.json'
import { validateGame, validateScript } from './validate'

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
  { id: 'info', label: 'Info', phrase: 'gives info on', selfPhrase: 'claims', targets: 'many', roles: 'optional', edge: false, tone: 'info' },
]

/** Fill in the default relations for a game that didn't declare its own. */
function withDefaults(game: GameConfig): GameConfig {
  return game.relations?.length ? game : { ...game, relations: DEFAULT_RELATIONS }
}

// JSON imports widen string literals to `string`, so the shape is asserted here.
// This is the single point where config enters the app. Built-in config is trusted;
// user-imported config passes through `validate.ts` before it is registered here.
// Every game is run through `withDefaults` on the way in, so downstream code always
// sees a full `relations` array whether or not the config spelled one out.
export const GAMES: Record<string, GameConfig> = {
  botc: withDefaults(botcGame as unknown as GameConfig),
  avalon: withDefaults(avalonGame as unknown as GameConfig),
}

export const SCRIPTS: Record<string, ScriptConfig> = {
  'trouble-brewing': troubleBrewing as unknown as ScriptConfig,
  'avalon-base': avalonBase as unknown as ScriptConfig,
}

// Frozen before merging so we always know what shipped with the app: built-ins can
// never be overwritten or deleted by an import.
const BUILTIN_GAME_IDS = new Set(Object.keys(GAMES))
const BUILTIN_SCRIPT_IDS = new Set(Object.keys(SCRIPTS))

// Merge previously-imported configs into the registries at load, so `getGame` and
// the picker see them from the first render. Done here (not in `custom.ts`) so the
// registries stay the single source components read.
for (const g of customGames()) GAMES[g.id] = withDefaults(g)
for (const s of customScripts()) SCRIPTS[s.id] = s

export function isBuiltinGame(id: string): boolean {
  return BUILTIN_GAME_IDS.has(id)
}
export function isBuiltinScript(id: string): boolean {
  return BUILTIN_SCRIPT_IDS.has(id)
}

export const DEFAULT_GAME_ID = 'botc'
export const DEFAULT_SCRIPT_ID = 'trouble-brewing'

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

// --- custom config import ----------------------------------------------------

export type ImportResult =
  | { ok: true; imported: string[]; gameId: string }
  | { ok: false; errors: string[] }

/**
 * Parse and register user-pasted config. Accepts a game (has `phases`), a script
 * (has `roles`/`gameId`), or a `{ game, script }` bundle. Everything is validated
 * first and only committed if the whole import is clean — a half-registered import
 * would be more confusing than a rejected one. Built-in ids can't be overwritten.
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
    else if (isBuiltinGame(res.value.id))
      errors.push(`game — id "${res.value.id}" is built in and can't be overwritten`)
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
    else if (isBuiltinScript(res.value.id))
      errors.push(`script — id "${res.value.id}" is built in and can't be overwritten`)
    else if (!targetGame) errors.push(`script — extends unknown game "${String(gid)}" (import its game too)`)
    else scriptToAdd = res.value
  }

  if (errors.length) return { ok: false, errors }

  const imported: string[] = []
  if (gameToAdd) {
    saveCustomGame(gameToAdd) // persist as imported (may omit relations)
    GAMES[gameToAdd.id] = withDefaults(gameToAdd)
    imported.push(`game “${gameToAdd.name}”`)
  }
  if (scriptToAdd) {
    saveCustomScript(scriptToAdd)
    SCRIPTS[scriptToAdd.id] = scriptToAdd
    imported.push(`script “${scriptToAdd.name}”`)
  }
  // The game to surface in the picker: the imported game, or the one a lone script extends.
  const gameId = gameToAdd?.id ?? scriptToAdd!.gameId
  return { ok: true, imported, gameId }
}

/** Remove an imported game and its imported scripts (built-ins are left alone). */
export function removeCustomGameConfig(id: string) {
  if (isBuiltinGame(id)) return
  persistRemoveGame(id)
  delete GAMES[id]
  for (const s of Object.values(SCRIPTS))
    if (s.gameId === id && !isBuiltinScript(s.id)) delete SCRIPTS[s.id]
}

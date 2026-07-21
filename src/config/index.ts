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
import botcGame from './game.botc.json'
import troubleBrewing from './script.trouble-brewing.json'

// JSON imports widen string literals to `string`, so the shape is asserted here.
// This is the single point where config enters the app, which is also where a
// runtime validator belongs once configs can be user-supplied or hand-edited.
export const GAMES: Record<string, GameConfig> = {
  botc: botcGame as unknown as GameConfig,
}

export const SCRIPTS: Record<string, ScriptConfig> = {
  'trouble-brewing': troubleBrewing as unknown as ScriptConfig,
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

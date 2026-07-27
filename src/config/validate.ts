import type { Alignment, GameConfig, ScriptConfig, Tone } from '../types'

// Runtime validation for user-supplied config. Built-in config is trusted (it's
// type-checked at build), but an imported game.json / script.json is arbitrary
// JSON that must be checked before it reaches render code — a bad config must
// surface as a clear message, never a crash mid-game-night. Nothing here throws;
// everything funnels into an error list.

export type Valid<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const TONES: Tone[] = ['good', 'evil', 'neutral', 'info', 'blue', 'purple']
const ALIGNMENTS: Alignment[] = ['good', 'evil', 'neutral']

// --- small typed checks ------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

/** A collector that gathers errors under a path prefix instead of throwing. */
class Errors {
  readonly list: string[] = []
  add(path: string, msg: string) {
    this.list.push(`${path}: ${msg}`)
  }
  get ok() {
    return this.list.length === 0
  }
}

function checkPhaseDefs(defs: unknown, path: string, e: Errors): void {
  if (!Array.isArray(defs)) {
    e.add(path, 'must be an array of phases')
    return
  }
  const ids = new Set<string>()
  defs.forEach((d, i) => {
    const p = `${path}[${i}]`
    if (!isObject(d)) return e.add(p, 'must be an object')
    if (!str(d.id)) e.add(`${p}.id`, 'is required')
    else if (ids.has(d.id)) e.add(`${p}.id`, `duplicate phase id "${d.id}"`)
    else ids.add(d.id)
    if (!str(d.label)) e.add(`${p}.label`, 'is required')
    if (!str(d.short)) e.add(`${p}.short`, 'is required')
  })
}

// --- game --------------------------------------------------------------------

export function validateGame(input: unknown): Valid<GameConfig> {
  const e = new Errors()
  if (!isObject(input)) return { ok: false, errors: ['Game config must be a JSON object'] }

  if (!str(input.id)) e.add('id', 'is required')
  if (!str(input.name)) e.add('name', 'is required')

  const min = input.minPlayers
  const max = input.maxPlayers
  if (typeof min !== 'number' || min < 1) e.add('minPlayers', 'must be a number ≥ 1')
  if (typeof max !== 'number' || max < 1) e.add('maxPlayers', 'must be a number ≥ 1')
  if (typeof min === 'number' && typeof max === 'number' && max < min)
    e.add('maxPlayers', 'must be ≥ minPlayers')

  // phases: { setup?: [], cycle: [non-empty] }
  if (!isObject(input.phases)) {
    e.add('phases', 'must be an object with a `cycle` array')
  } else {
    if (input.phases.setup !== undefined) checkPhaseDefs(input.phases.setup, 'phases.setup', e)
    if (!Array.isArray(input.phases.cycle) || input.phases.cycle.length === 0)
      e.add('phases.cycle', 'must be a non-empty array (the repeating phases)')
    else checkPhaseDefs(input.phases.cycle, 'phases.cycle', e)
  }

  // teams
  const teamIds = new Set<string>()
  if (!Array.isArray(input.teams) || input.teams.length === 0) {
    e.add('teams', 'must be a non-empty array')
  } else {
    input.teams.forEach((t, i) => {
      const p = `teams[${i}]`
      if (!isObject(t)) return e.add(p, 'must be an object')
      if (!str(t.id)) e.add(`${p}.id`, 'is required')
      else if (teamIds.has(t.id)) e.add(`${p}.id`, `duplicate team id "${t.id}"`)
      else teamIds.add(t.id)
      if (!str(t.name)) e.add(`${p}.name`, 'is required')
      if (!ALIGNMENTS.includes(t.alignment as Alignment))
        e.add(`${p}.alignment`, `must be one of ${ALIGNMENTS.join(', ')}`)
      if (!TONES.includes(t.tone as Tone)) e.add(`${p}.tone`, `must be one of ${TONES.join(', ')}`)
    })
  }

  // relations — optional; a game that omits them inherits the default vocabulary.
  const relIds = new Set<string>()
  const collectsRefs: { path: string; ref: string }[] = []
  if (input.relations === undefined) {
    // nothing to check — defaults will be filled in when the game is registered
  } else if (!Array.isArray(input.relations) || input.relations.length === 0) {
    e.add('relations', 'if present, must be a non-empty array (omit it to use the defaults)')
  } else {
    input.relations.forEach((r, i) => {
      const p = `relations[${i}]`
      if (!isObject(r)) return e.add(p, 'must be an object')
      if (!str(r.id)) e.add(`${p}.id`, 'is required')
      else if (relIds.has(r.id)) e.add(`${p}.id`, `duplicate relation id "${r.id}"`)
      else relIds.add(r.id)
      if (!str(r.label)) e.add(`${p}.label`, 'is required')
      if (!str(r.phrase)) e.add(`${p}.phrase`, 'is required')
      if (r.targets !== 'one' && r.targets !== 'many') e.add(`${p}.targets`, 'must be "one" or "many"')
      if (r.roles !== 'none' && r.roles !== 'optional') e.add(`${p}.roles`, 'must be "none" or "optional"')
      if (typeof r.edge !== 'boolean') e.add(`${p}.edge`, 'must be true or false')
      if (!TONES.includes(r.tone as Tone)) e.add(`${p}.tone`, `must be one of ${TONES.join(', ')}`)
      if (r.selfPhrase !== undefined && !str(r.selfPhrase)) e.add(`${p}.selfPhrase`, 'must be a string')
      if (r.internal !== undefined && typeof r.internal !== 'boolean')
        e.add(`${p}.internal`, 'must be true or false')
      if (r.collectsVotesAs !== undefined) {
        if (!str(r.collectsVotesAs)) e.add(`${p}.collectsVotesAs`, 'must be a relation id')
        else collectsRefs.push({ path: `${p}.collectsVotesAs`, ref: r.collectsVotesAs })
      }
    })
    // collectsVotesAs must point at another relation in this same game.
    for (const { path, ref } of collectsRefs)
      if (!relIds.has(ref)) e.add(path, `references unknown relation "${ref}"`)
  }

  if (!e.ok) return { ok: false, errors: e.list }
  return { ok: true, value: input as unknown as GameConfig }
}

// --- script ------------------------------------------------------------------

/**
 * `knownTeamIds` for the target game lets role→team references be checked. Pass the
 * teams of whichever game the script extends (built-in or just-imported).
 */
export function validateScript(input: unknown, gameTeamIds: Set<string> | null): Valid<ScriptConfig> {
  const e = new Errors()
  if (!isObject(input)) return { ok: false, errors: ['Script config must be a JSON object'] }

  if (!str(input.id)) e.add('id', 'is required')
  if (!str(input.gameId)) e.add('gameId', 'is required (the game this script extends)')
  if (!str(input.name)) e.add('name', 'is required')

  const roleIds = new Set<string>()
  if (!Array.isArray(input.roles) || input.roles.length === 0) {
    e.add('roles', 'must be a non-empty array')
  } else {
    input.roles.forEach((r, i) => {
      const p = `roles[${i}]`
      if (!isObject(r)) return e.add(p, 'must be an object')
      if (!str(r.id)) e.add(`${p}.id`, 'is required')
      else if (roleIds.has(r.id)) e.add(`${p}.id`, `duplicate role id "${r.id}"`)
      else roleIds.add(r.id)
      if (!str(r.name)) e.add(`${p}.name`, 'is required')
      if (!str(r.team)) e.add(`${p}.team`, 'is required')
      else if (gameTeamIds && !gameTeamIds.has(r.team))
        e.add(`${p}.team`, `references unknown team "${r.team}" in the game`)
    })
  }

  if (!e.ok) return { ok: false, errors: e.list }
  return { ok: true, value: input as unknown as ScriptConfig }
}

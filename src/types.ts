// Data model for iteration 1. See CLAUDE.md for why each field looks like this —
// in particular why there is no polarity, no `unspoken` flag, no `source` on
// RoleTag, and no suspicion primitive. Please read that before adding any of them.

export type PlayerId = string
export type RoleId = string
export type RelationId = string
export type TeamId = string

export type Phase = 'day' | 'night'

/** A thing someone said. Always a public speech act in iteration 1. */
export type Assertion = {
  id: string
  round: number
  phase: Phase
  speaker: PlayerId
  relation: RelationId
  /**
   * Load-bearing as an array even though the entry sheet currently writes one
   * element. BotC info roles break a strict triple immediately ("1 evil between
   * P2 and P4"), and the expensive part to retrofit is not this field but the
   * single-target assumptions that would spread through the render code.
   */
  targets: PlayerId[]
  /** Candidate roles named by the assertion. Empty for vouch/accuse/nominate/vote. */
  roles?: RoleId[]
  /** The quote or evidence. */
  note?: string
  createdAt: number
}

/**
 * My private guess at what a player is. Append-only with a round stamp so the
 * timeline stage gets its history for free; the UI reads the latest entry per
 * player. Multiple roles are simultaneous guesses with equal weight and no
 * priority order.
 *
 * A *public* role claim is not this — that is an assertion whose speaker and
 * target are the same player. Claims live in the log, guesses live on the token.
 */
export type RoleTag = {
  id: string
  playerId: PlayerId
  roleIds: RoleId[]
  round: number
  phase: Phase
  createdAt: number
}

export type PlayerState = {
  id: PlayerId
  /** Physical seat order. Game-critical in BotC — adjacency drives abilities. */
  seat: number
  name: string
  alive: boolean
}

export type Session = {
  id: string
  createdAt: number
  gameId: string
  scriptId: string
  round: number
  phase: Phase
  players: PlayerState[]
  assertions: Assertion[]
  roleTags: RoleTag[]
}

// --- config ------------------------------------------------------------------
// Games are config, not code. Two layers: a game defines the shape of play, a
// script defines the role list and extends a game.

// Tone is a named colour slot (maps to a --color-* variable), not an alignment.
// Teams and relations each choose one. Townsfolk are 'good' (green) and Outsiders
// 'blue' so the two good-team groups read apart; later this becomes a per-team
// colour in config rather than a fixed vocabulary here.
export type Tone = 'good' | 'evil' | 'neutral' | 'info' | 'blue'

export type RelationConfig = {
  id: RelationId
  /** Button label in the entry sheet. */
  label: string
  /** Log line reads "{speaker} {phrase} {targets}". */
  phrase: string
  /**
   * Used instead of `phrase` when the only target is the speaker, so a role
   * claim reads "P3 claims — Empath" rather than "P3 gives info on P3". Keeps
   * the phrasing special case in config rather than in render code.
   */
  selfPhrase?: string
  /** 'one' requires exactly one target; 'many' allows zero or more. */
  targets: 'one' | 'many'
  roles: 'none' | 'optional'
  /**
   * Whether this draws an arrow on the diagram. Edges are relationships, tokens
   * are state — `info` narrows what a player *is*, so it renders on the token
   * and never draws an edge.
   */
  edge: boolean
  tone: Tone
}

export type TeamConfig = {
  id: TeamId
  name: string
  tone: Tone
}

export type GameConfig = {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  phases: Phase[]
  teams: TeamConfig[]
  relations: RelationConfig[]
}

export type RoleConfig = {
  id: RoleId
  name: string
  team: TeamId
}

export type ScriptConfig = {
  id: string
  gameId: string
  name: string
  roles: RoleConfig[]
}

import type { GameConfig, GameEvent, Phase, PhaseDef, PlayerId, Session } from './types'

// Projections turn the log into the things we render. State is never stored twice
// — the diagram at a round, who is alive, the timeline — they are all reads over
// the same event log. See CLAUDE.md.

// --- phase ordering ----------------------------------------------------------
// A game's phases are config now (setup once + a repeating cycle), so the rank
// helpers take the game. The layout: setup phases occupy round 0 at ranks
// 0..S-1, then cycle round r≥1 phase j sits at S + (r-1)*C + j — contiguous, so
// the game's first phase is always rank 0. For a game with no setup (BotC) this
// reduces to (round-1)*C + j.

function setupPhases(game: GameConfig): PhaseDef[] {
  return game.phases.setup ?? []
}

function cyclePhases(game: GameConfig): PhaseDef[] {
  return game.phases.cycle
}

function phaseDefAt(game: GameConfig, round: number, phase: Phase): PhaseDef | undefined {
  return (round === 0 ? setupPhases(game) : cyclePhases(game)).find((p) => p.id === phase)
}

/**
 * A single monotonic ordering over phases: the game's first phase is 0 and each
 * subsequent phase is +1. Only the ordering is load-bearing (ranks are compared
 * and used to slice, never stored), so changing this formula needs no migration.
 */
export function rankOf(game: GameConfig, round: number, phase: Phase): number {
  const setup = setupPhases(game)
  const cycle = cyclePhases(game)
  if (round === 0) {
    const i = setup.findIndex((p) => p.id === phase)
    return i >= 0 ? i : 0
  }
  const j = cycle.findIndex((p) => p.id === phase)
  return setup.length + (round - 1) * cycle.length + Math.max(0, j)
}

export function phaseFromRank(game: GameConfig, rank: number): { round: number; phase: Phase } {
  const setup = setupPhases(game)
  const cycle = cyclePhases(game)
  if (rank < setup.length) return { round: 0, phase: setup[rank].id }
  const k = rank - setup.length
  return { round: Math.floor(k / cycle.length) + 1, phase: cycle[k % cycle.length].id }
}

/** Rank of the game's opening phase — always 0 by construction (see above). */
export const FIRST_RANK = 0

/** "Night 1" / "Mission 2". Setup phases (round 0) show no number — there is one. */
export function phaseLabel(game: GameConfig, round: number, phase: Phase): string {
  const label = phaseDefAt(game, round, phase)?.label ?? phase
  return round === 0 ? label : `${label} ${round}`
}

/** Compact form for the timeline pills: "N1" / "M2"; setup shows just its short. */
export function shortPhaseLabel(game: GameConfig, round: number, phase: Phase): string {
  const short = phaseDefAt(game, round, phase)?.short ?? phase.charAt(0).toUpperCase()
  return round === 0 ? short : `${short}${round}`
}

// --- aliveness ---------------------------------------------------------------

/**
 * Whether a player is alive given the events in this session slice. Aliveness is
 * the latest life-affecting event for that player winning — so passing a session
 * projected to a past phase answers "were they alive back then?", and deleting a
 * death event reverts it with no stored state to unwind.
 */
export function isAlive(game: GameConfig, session: Session, playerId: PlayerId): boolean {
  let latest: GameEvent | undefined
  let latestRank = -1
  for (const e of session.events) {
    if (e.hidden) continue // struck entries count in no projection
    if (e.setsAlive === undefined) continue
    if (!e.subjects.includes(playerId)) continue
    const r = rankOf(game, e.round, e.phase)
    // Later phase wins; within a phase the later-logged event wins.
    if (r > latestRank || (r === latestRank && (!latest || e.createdAt > latest.createdAt))) {
      latest = e
      latestRank = r
    }
  }
  return latest ? latest.setsAlive! : true
}

export function aliveCount(game: GameConfig, session: Session): number {
  return session.players.reduce((n, p) => n + (isAlive(game, session, p.id) ? 1 : 0), 0)
}

/**
 * A copy of the session containing only what had happened at or before `atRank`.
 * Rendering components take this slice and stay unaware of the timeline — they
 * just draw whatever session they are handed.
 */
export function projectSession(game: GameConfig, session: Session, atRank: number): Session {
  return {
    ...session,
    assertions: session.assertions.filter((a) => rankOf(game, a.round, a.phase) <= atRank),
    events: session.events.filter((e) => rankOf(game, e.round, e.phase) <= atRank),
    roleTags: session.roleTags.filter((t) => rankOf(game, t.round, t.phase) <= atRank),
    reads: session.reads.filter((r) => rankOf(game, r.round, r.phase) <= atRank),
  }
}

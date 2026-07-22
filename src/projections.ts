import type { GameEvent, Phase, PlayerId, Session } from './types'

// Projections turn the log into the things we render. State is never stored twice
// — the diagram at a round, who is alive, the timeline — they are all reads over
// the same event log. See CLAUDE.md.

/**
 * A single monotonic ordering over phases: Night 1 < Day 1 < Night 2 < …
 * Night sorts before Day within a round, matching BotC's night-then-day flow.
 */
export function rankOf(round: number, phase: Phase): number {
  return round * 2 + (phase === 'day' ? 1 : 0)
}

export function phaseFromRank(rank: number): { round: number; phase: Phase } {
  return { round: Math.floor(rank / 2), phase: rank % 2 === 0 ? 'night' : 'day' }
}

export function shortPhaseLabel(round: number, phase: Phase): string {
  return `${phase === 'night' ? 'N' : 'D'}${round}`
}

/**
 * Whether a player is alive given the events in this session slice. Aliveness is
 * the latest life-affecting event for that player winning — so passing a session
 * projected to a past phase answers "were they alive back then?", and deleting a
 * death event reverts it with no stored state to unwind.
 */
export function isAlive(session: Session, playerId: PlayerId): boolean {
  let latest: GameEvent | undefined
  let latestRank = -1
  for (const e of session.events) {
    if (e.setsAlive === undefined) continue
    if (!e.subjects.includes(playerId)) continue
    const r = rankOf(e.round, e.phase)
    // Later phase wins; within a phase the later-logged event wins.
    if (r > latestRank || (r === latestRank && (!latest || e.createdAt > latest.createdAt))) {
      latest = e
      latestRank = r
    }
  }
  return latest ? latest.setsAlive! : true
}

export function aliveCount(session: Session): number {
  return session.players.reduce((n, p) => n + (isAlive(session, p.id) ? 1 : 0), 0)
}

/**
 * A copy of the session containing only what had happened at or before `atRank`.
 * Rendering components take this slice and stay unaware of the timeline — they
 * just draw whatever session they are handed.
 */
export function projectSession(session: Session, atRank: number): Session {
  return {
    ...session,
    assertions: session.assertions.filter((a) => rankOf(a.round, a.phase) <= atRank),
    events: session.events.filter((e) => rankOf(e.round, e.phase) <= atRank),
    roleTags: session.roleTags.filter((t) => rankOf(t.round, t.phase) <= atRank),
  }
}

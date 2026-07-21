import { getRelation } from '../config'
import type { GameConfig, PlayerId, Session, Tone } from '../types'

export type DerivedEdge = {
  key: string
  from: PlayerId
  to: PlayerId
  relation: string
  tone: Tone
  /** How many times this exact speaker→relation→target was logged. */
  count: number
  /** Bow offset among edges sharing this directed pair, so parallels separate. */
  fanIndex: number
  fanCount: number
}

/**
 * Turns the assertion log into arrows to draw. Only relations flagged `edge`
 * become arrows (info narrows what a player *is*, so it lives on the token, not
 * as a line). Identical speaker→relation→target entries collapse into one arrow
 * with a count, so repeated votes and accusations don't bury the diagram.
 */
export function deriveEdges(session: Session, game: GameConfig): DerivedEdge[] {
  const merged = new Map<string, DerivedEdge>()

  for (const a of session.assertions) {
    const relation = getRelation(game, a.relation)
    if (!relation.edge) continue

    for (const target of a.targets) {
      const key = `${a.speaker}|${a.relation}|${target}`
      const existing = merged.get(key)
      if (existing) {
        existing.count += 1
      } else {
        merged.set(key, {
          key,
          from: a.speaker,
          to: target,
          relation: a.relation,
          tone: relation.tone,
          count: 1,
          fanIndex: 0,
          fanCount: 1,
        })
      }
    }
  }

  // Fan out edges that share a directed pair (e.g. A vouches for and nominates B)
  // so they don't draw on top of each other. Opposite directions already bow to
  // opposite sides via the signed curve, so they are grouped separately here.
  const byPair = new Map<string, DerivedEdge[]>()
  for (const edge of merged.values()) {
    const pair = `${edge.from}->${edge.to}`
    const group = byPair.get(pair)
    if (group) group.push(edge)
    else byPair.set(pair, [edge])
  }
  for (const group of byPair.values()) {
    group.forEach((edge, i) => {
      edge.fanIndex = i
      edge.fanCount = group.length
    })
  }

  return [...merged.values()]
}

/** Player ids touched by an edge that involves `id` — its neighbours plus itself. */
export function neighboursOf(edges: DerivedEdge[], id: PlayerId): Set<PlayerId> {
  const set = new Set<PlayerId>([id])
  for (const e of edges) {
    if (e.from === id) set.add(e.to)
    if (e.to === id) set.add(e.from)
  }
  return set
}

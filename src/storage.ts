import { GAMES } from './config'
import { rankOf } from './projections'
import type { Assertion, Session } from './types'
import { uid } from './uid'

/**
 * The single swap point for persistence. Currently localStorage + a JSON blob;
 * IndexedDB/Dexie replaces the two functions below and nothing else.
 *
 * The API is async even though localStorage is not, so that swap does not force
 * an await-everything refactor across every call site later.
 */

const KEY = 'deduction-notes'
export const VERSION = 3

export type Persisted = {
  version: number
  currentSessionId: string | null
  sessions: Record<string, Session>
}

const EMPTY: Persisted = { version: VERSION, currentSessionId: null, sessions: {} }

// Migrations run in sequence, each lifting the blob one version. Adding a new
// schema version means appending a step here and bumping VERSION.
const MIGRATIONS: Record<number, (data: Persisted) => Persisted> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
}

export async function loadAll(): Promise<Persisted> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }

    let data = JSON.parse(raw) as Persisted
    if (data.version === VERSION) return data

    // A version we can't step up from (too new, or with no migration path) is not
    // something to guess at — back it up and start clean rather than corrupt it.
    if (data.version > VERSION || !MIGRATIONS[data.version]) {
      localStorage.setItem(`${KEY}.v${data.version}.bak`, raw)
      if (data.version > VERSION) return data // forward-compatible: keep as-is
      return { ...EMPTY }
    }

    // Keep the pre-migration blob in case a migration is ever wrong — losing a
    // night's notes would be worse than a manual recovery.
    localStorage.setItem(`${KEY}.v${data.version}.bak`, raw)
    while (data.version < VERSION && MIGRATIONS[data.version]) {
      data = MIGRATIONS[data.version](data)
    }
    return data
  } catch (err) {
    // A corrupt blob must not brick the app in the middle of a game night.
    console.error('Failed to load saved sessions, starting empty:', err)
    return { ...EMPTY }
  }
}

/**
 * v1 stored `alive` as a boolean on each player. v2 derives life from events, so
 * any player marked dead becomes a death event stamped at the session's current
 * phase, and the boolean is dropped.
 */
function migrateV1toV2(old: Persisted): Persisted {
  type LegacyPlayer = { id: string; seat: number; name: string; alive?: boolean }
  const sessions: Record<string, Session> = {}

  for (const [id, session] of Object.entries(old.sessions)) {
    const legacyPlayers = session.players as unknown as LegacyPlayer[]
    const events = Array.isArray(session.events) ? [...session.events] : []

    legacyPlayers.forEach((p, i) => {
      if (p.alive === false) {
        events.push({
          id: uid(),
          round: session.round,
          phase: session.phase,
          label: 'Died',
          subjects: [p.id],
          setsAlive: false,
          // Preserve relative order; these all land in the current phase.
          createdAt: Date.now() + i,
        })
      }
    })

    // Sort so aliveness derivation sees a sensible order after the bulk insert.
    events.sort((a, b) => rankOf(a.round, a.phase) - rankOf(b.round, b.phase) || a.createdAt - b.createdAt)

    sessions[id] = {
      ...session,
      players: legacyPlayers.map(({ id: pid, seat, name }) => ({ id: pid, seat, name })),
      events,
    }
  }

  // Each step lifts exactly one version; the pipeline runs the next one.
  return { version: 2, currentSessionId: old.currentSessionId, sessions }
}

/**
 * v3 adds subjective reads (`reads: []`) and links each vote to its nomination
 * (`parentId`). Existing votes are backfilled with the old (nominee, phase)
 * heuristic so historical roll-ups survive — best-effort, since that heuristic is
 * exactly what became ambiguous when a nominee was nominated twice in one phase.
 */
function migrateV2toV3(old: Persisted): Persisted {
  const sessions: Record<string, Session> = {}

  for (const [id, session] of Object.entries(old.sessions)) {
    const game = GAMES[session.gameId]
    const nominationRel = game?.relations.find((r) => r.collectsVotesAs)
    const voteRelId = nominationRel?.collectsVotesAs

    let assertions = session.assertions
    if (nominationRel && voteRelId) {
      // Claim each vote for at most one nomination so a re-nomination of the same
      // nominee doesn't re-pool the same votes.
      const claimed = new Set<string>()
      const parentOf = new Map<string, string>()
      const nominations = session.assertions.filter((a) => a.relation === nominationRel.id)
      for (const nom of nominations) {
        for (const v of session.assertions) {
          if (claimed.has(v.id)) continue
          if (v.relation !== voteRelId || v.parentId) continue
          if (v.targets[0] === nom.targets[0] && v.round === nom.round && v.phase === nom.phase) {
            claimed.add(v.id)
            parentOf.set(v.id, nom.id)
          }
        }
      }
      if (parentOf.size > 0) {
        assertions = session.assertions.map((a): Assertion =>
          parentOf.has(a.id) ? { ...a, parentId: parentOf.get(a.id) } : a,
        )
      }
    }

    sessions[id] = { ...session, assertions, reads: session.reads ?? [] }
  }

  return { version: 3, currentSessionId: old.currentSessionId, sessions }
}

export async function saveAll(data: Persisted): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to save sessions:', err)
  }
}

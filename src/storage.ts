import { rankOf } from './projections'
import type { Session } from './types'
import { uid } from './uid'

/**
 * The single swap point for persistence. Currently localStorage + a JSON blob;
 * IndexedDB/Dexie replaces the two functions below and nothing else.
 *
 * The API is async even though localStorage is not, so that swap does not force
 * an await-everything refactor across every call site later.
 */

const KEY = 'deduction-notes'
export const VERSION = 2

export type Persisted = {
  version: number
  currentSessionId: string | null
  sessions: Record<string, Session>
}

const EMPTY: Persisted = { version: VERSION, currentSessionId: null, sessions: {} }

export async function loadAll(): Promise<Persisted> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }

    const parsed = JSON.parse(raw) as Persisted
    if (parsed.version === VERSION) return parsed

    if (parsed.version === 1) {
      // Keep the pre-migration blob in case the migration is ever wrong — losing
      // a night's notes would be worse than a manual recovery.
      localStorage.setItem(`${KEY}.v1.bak`, raw)
      return migrateV1toV2(parsed)
    }

    localStorage.setItem(`${KEY}.v${parsed.version}.bak`, raw)
    return { ...EMPTY }
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

  return { version: VERSION, currentSessionId: old.currentSessionId, sessions }
}

export async function saveAll(data: Persisted): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to save sessions:', err)
  }
}

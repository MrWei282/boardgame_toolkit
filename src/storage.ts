import type { Session } from './types'

/**
 * The single swap point for persistence. Currently localStorage + a JSON blob;
 * IndexedDB/Dexie replaces the two functions below and nothing else.
 *
 * The API is async even though localStorage is not, so that swap does not force
 * an await-everything refactor across every call site later.
 */

const KEY = 'deduction-notes'
const VERSION = 1

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
    if (parsed.version !== VERSION) {
      // No migrations exist yet. Keep the old blob under a suffixed key rather
      // than dropping it — losing a night's notes to a schema bump would be
      // worse than starting the session over.
      localStorage.setItem(`${KEY}.v${parsed.version}.bak`, raw)
      return { ...EMPTY }
    }
    return parsed
  } catch (err) {
    // A corrupt blob must not brick the app in the middle of a game night.
    console.error('Failed to load saved sessions, starting empty:', err)
    return { ...EMPTY }
  }
}

export async function saveAll(data: Persisted): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to save sessions:', err)
  }
}

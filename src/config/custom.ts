import type { GameConfig, ScriptConfig } from '../types'

// Persistence for user-imported configs. Kept in its own localStorage key (not the
// session blob) and read *synchronously* at module load — unlike session data,
// configs must be present before the first render, since `getGame` runs during it.
// Small and rarely written, so sync localStorage is fine here.

const KEY = 'deduction-custom-configs'

type CustomBlob = { version: number; games: GameConfig[]; scripts: ScriptConfig[] }
const EMPTY: CustomBlob = { version: 1, games: [], scripts: [] }

function read(): CustomBlob {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const data = JSON.parse(raw) as Partial<CustomBlob>
    // Shape guard only — the configs were validated before they were saved.
    return {
      version: 1,
      games: Array.isArray(data.games) ? data.games : [],
      scripts: Array.isArray(data.scripts) ? data.scripts : [],
    }
  } catch (err) {
    console.error('Failed to read custom configs, ignoring them:', err)
    return { ...EMPTY }
  }
}

function write(next: CustomBlob) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch (err) {
    console.error('Failed to save custom configs:', err)
  }
}

let blob = read()

export function customGames(): GameConfig[] {
  return blob.games
}
export function customScripts(): ScriptConfig[] {
  return blob.scripts
}

export function saveCustomGame(game: GameConfig) {
  blob = { ...blob, games: [...blob.games.filter((g) => g.id !== game.id), game] }
  write(blob)
}
export function saveCustomScript(script: ScriptConfig) {
  blob = { ...blob, scripts: [...blob.scripts.filter((s) => s.id !== script.id), script] }
  write(blob)
}

/** Remove a custom game and any custom scripts that extended it. */
export function removeCustomGame(id: string) {
  blob = {
    ...blob,
    games: blob.games.filter((g) => g.id !== id),
    scripts: blob.scripts.filter((s) => s.gameId !== id),
  }
  write(blob)
}
export function removeCustomScript(id: string) {
  blob = { ...blob, scripts: blob.scripts.filter((s) => s.id !== id) }
  write(blob)
}

import { create } from 'zustand'
import { applyPalette, DEFAULT_PALETTE_ID } from './theme'

// App-wide preferences that aren't game data: the colour palette now, UI language
// later (7.4). Kept in its own localStorage key so it can ride along in a backup
// bundle (share.ts `settings`) independently of sessions and configs.

const KEY = 'deduction-settings'

type Settings = { palette: string }
const DEFAULTS: Settings = { palette: DEFAULT_PALETTE_ID }

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const d = JSON.parse(raw) as Partial<Settings>
    return { palette: typeof d.palette === 'string' ? d.palette : DEFAULT_PALETTE_ID }
  } catch {
    return { ...DEFAULTS }
  }
}

function write(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}

type SettingsStore = Settings & {
  setPalette: (id: string) => void
}

export const useSettings = create<SettingsStore>((set) => ({
  ...read(),
  setPalette: (id) => {
    applyPalette(id) // recolour live
    write({ palette: id })
    set({ palette: id })
  },
}))

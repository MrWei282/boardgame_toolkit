import { create } from 'zustand'
import { applyTheme, type CustomColors, DEFAULT_PALETTE_ID } from './theme'
import type { Tone } from './types'

// App-wide preferences that aren't game data: the colour palette (a preset id plus
// optional per-tone hex overrides) now, UI language later (7.4). Kept in its own
// localStorage key so it can ride along in a backup bundle (share.ts `settings`)
// independently of sessions and configs.

const KEY = 'deduction-settings'

type Settings = { palette: string; customColors: CustomColors }

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { palette: DEFAULT_PALETTE_ID, customColors: {} }
    const d = JSON.parse(raw) as Partial<Settings>
    return {
      palette: typeof d.palette === 'string' ? d.palette : DEFAULT_PALETTE_ID,
      customColors: cleanColors(d.customColors),
    }
  } catch {
    return { palette: DEFAULT_PALETTE_ID, customColors: {} }
  }
}

/** Keep only recognised tone keys with string values. */
function cleanColors(v: unknown): CustomColors {
  if (typeof v !== 'object' || v === null) return {}
  const out: CustomColors = {}
  for (const tone of ['good', 'evil', 'neutral', 'info'] as Tone[]) {
    const c = (v as Record<string, unknown>)[tone]
    if (typeof c === 'string') out[tone] = c
  }
  return out
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
  setCustomColor: (tone: Tone, hex: string | null) => void
  resetColors: () => void
  /** Apply settings from an imported backup bundle. */
  importSettings: (s: { palette?: string; customColors?: CustomColors }) => void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...read(),

  setPalette: (id) => {
    const { customColors } = get()
    applyTheme(id, customColors)
    write({ palette: id, customColors })
    set({ palette: id })
  },

  setCustomColor: (tone, hex) => {
    const next = { ...get().customColors }
    if (hex) next[tone] = hex
    else delete next[tone]
    applyTheme(get().palette, next)
    write({ palette: get().palette, customColors: next })
    set({ customColors: next })
  },

  resetColors: () => {
    applyTheme(get().palette, {})
    write({ palette: get().palette, customColors: {} })
    set({ customColors: {} })
  },

  importSettings: (s) => {
    const palette = typeof s.palette === 'string' ? s.palette : get().palette
    const customColors = cleanColors(s.customColors)
    applyTheme(palette, customColors)
    write({ palette, customColors })
    set({ palette, customColors })
  },
}))

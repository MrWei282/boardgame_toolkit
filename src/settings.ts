import { create } from 'zustand'
import { applyTheme, type CustomColors, DEFAULT_PALETTE_ID } from './theme'
import type { Tone } from './types'

// App-wide preferences that aren't game data: the colour palette (a preset id plus
// optional per-tone hex overrides) and the UI language. Kept in its own localStorage
// key so it can ride along in a backup bundle (share.ts `settings`) independently of
// sessions and configs.

const KEY = 'deduction-settings'

export type Lang = 'en' | 'zh'
const LANGS: Lang[] = ['en', 'zh']

type Settings = { palette: string; customColors: CustomColors; language: Lang }

function read(): Settings {
  const fallback: Settings = { palette: DEFAULT_PALETTE_ID, customColors: {}, language: 'en' }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const d = JSON.parse(raw) as Partial<Settings>
    return {
      palette: typeof d.palette === 'string' ? d.palette : DEFAULT_PALETTE_ID,
      customColors: cleanColors(d.customColors),
      language: LANGS.includes(d.language as Lang) ? (d.language as Lang) : 'en',
    }
  } catch {
    return fallback
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

/** Reflect the language on <html lang> for accessibility / correct font shaping. */
export function applyLang(lang: Lang) {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en'
}

type SettingsStore = Settings & {
  setPalette: (id: string) => void
  setCustomColor: (tone: Tone, hex: string | null) => void
  resetColors: () => void
  setLanguage: (lang: Lang) => void
  /** Apply settings from an imported backup bundle (loosely typed — validated here). */
  importSettings: (s: { palette?: string; customColors?: Record<string, string>; language?: string }) => void
}

export const useSettings = create<SettingsStore>((set, get) => {
  /** Persist the data half of the store (state minus actions). */
  const persist = (patch: Partial<Settings>) => {
    const { palette, customColors, language } = { ...get(), ...patch }
    write({ palette, customColors, language })
    set(patch)
  }

  return {
    ...read(),

    setPalette: (id) => {
      applyTheme(id, get().customColors)
      persist({ palette: id })
    },

    setCustomColor: (tone, hex) => {
      const next = { ...get().customColors }
      if (hex) next[tone] = hex
      else delete next[tone]
      applyTheme(get().palette, next)
      persist({ customColors: next })
    },

    resetColors: () => {
      applyTheme(get().palette, {})
      persist({ customColors: {} })
    },

    setLanguage: (lang) => {
      applyLang(lang)
      persist({ language: lang })
    },

    importSettings: (s) => {
      const palette = typeof s.palette === 'string' ? s.palette : get().palette
      const customColors = cleanColors(s.customColors)
      const language = LANGS.includes(s.language as Lang) ? (s.language as Lang) : get().language
      applyTheme(palette, customColors)
      applyLang(language)
      persist({ palette, customColors, language })
    },
  }
})

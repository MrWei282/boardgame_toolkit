import type { Tone } from './types'

// Colour presets + per-tone custom overrides. Every colour in the app — Tailwind
// utilities and the diagram SVG alike — resolves through the four `--color-<tone>`
// CSS variables (see index.css), so the theme just overrides those on <html> at
// runtime and the whole UI + diagram recolour at once. Only the four *base* tones are
// global and customisable here; team colours live in each game's config.

const TONES: Tone[] = ['good', 'evil', 'neutral', 'info']

export type Palette = {
  id: string
  name: string
  description: string
  colors: Record<Tone, string>
}

/** Per-tone hex overrides layered on top of a preset (the custom colour picker). */
export type CustomColors = Partial<Record<Tone, string>>

export const DEFAULT_PALETTE_ID = 'default'

export const PALETTES: Palette[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'The original palette.',
    // Kept in sync with index.css so the swatches match the un-overridden look.
    colors: { good: '#3fb950', evil: '#f85149', neutral: '#d29922', info: '#58a6ff' },
  },
  {
    id: 'okabe-ito',
    name: 'Colourblind-safe',
    description: 'Okabe–Ito — good vs evil stay distinct under red-green colour blindness.',
    colors: {
      good: '#009e73', // bluish green
      evil: '#d55e00', // vermillion
      neutral: '#f0e442', // yellow
      info: '#56b4e9', // sky blue
    },
  },
]

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/**
 * The colour a tone resolves to under a preset + overrides — what the swatches and
 * the colour-picker inputs display. Mirrors what `applyTheme` writes.
 */
export function effectiveColor(paletteId: string, tone: Tone, custom?: CustomColors): string {
  return custom?.[tone] ?? getPalette(paletteId).colors[tone]
}

/**
 * Apply a preset plus any per-tone overrides by writing the four `--color-<tone>`
 * variables onto <html>. On the default preset with no override for a tone, the
 * variable is *cleared* so it falls back to the stylesheet — keeping index.css the
 * single source of truth for the default look.
 */
export function applyTheme(paletteId: string, custom?: CustomColors) {
  const root = document.documentElement
  const preset = getPalette(paletteId)
  for (const tone of TONES) {
    const override = custom?.[tone]
    if (override) root.style.setProperty(`--color-${tone}`, override)
    else if (preset.id === DEFAULT_PALETTE_ID) root.style.removeProperty(`--color-${tone}`)
    else root.style.setProperty(`--color-${tone}`, preset.colors[tone])
  }
}

import type { Tone } from './types'

// Colour presets. Every colour in the app — Tailwind utilities and the diagram SVG
// alike — resolves through the six `--color-<tone>` CSS variables (see index.css),
// so a preset just overrides those six variables on <html> at runtime and the whole
// UI + diagram recolour at once. No component knows this happened.

const TONES: Tone[] = ['good', 'evil', 'neutral', 'info', 'blue', 'purple']

export type Palette = {
  id: string
  name: string
  description: string
  colors: Record<Tone, string>
}

export const DEFAULT_PALETTE_ID = 'default'

export const PALETTES: Palette[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'The original palette.',
    // Kept in sync with index.css so the swatches match the un-overridden look.
    colors: {
      good: '#3fb950',
      evil: '#f85149',
      neutral: '#d29922',
      info: '#58a6ff',
      blue: '#4c9aff',
      purple: '#bf5af2',
    },
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
      blue: '#0072b2', // blue
      purple: '#cc79a7', // reddish purple
    },
  },
]

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/**
 * Apply a preset by writing the six `--color-<tone>` variables onto <html>. The
 * default preset *clears* the overrides instead, so the values fall back to the
 * stylesheet — that keeps index.css the single source of truth for the default look.
 */
export function applyPalette(id: string) {
  const root = document.documentElement
  const palette = getPalette(id)
  if (palette.id === DEFAULT_PALETTE_ID) {
    for (const tone of TONES) root.style.removeProperty(`--color-${tone}`)
    return
  }
  for (const tone of TONES) root.style.setProperty(`--color-${tone}`, palette.colors[tone])
}

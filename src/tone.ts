import type { CSSProperties } from 'react'
import type { Tone } from './types'

// Written as whole literal class strings so Tailwind's scanner can see them —
// building them by interpolation would silently produce unstyled elements. Keyed by
// the four base tones (the shared semantic palette). Team colours are NOT here: a
// team's colour is game-config data (a base-tone name or a literal hex) and renders
// through resolveTeamColor / teamChipStyle below, since an arbitrary hex can't be a
// compile-time Tailwind class.

export const toneText: Record<Tone, string> = {
  good: 'text-good',
  evil: 'text-evil',
  neutral: 'text-neutral',
  info: 'text-info',
}

export const toneChip: Record<Tone, string> = {
  good: 'bg-good/15 text-good border-good/40',
  evil: 'bg-evil/15 text-evil border-evil/40',
  neutral: 'bg-neutral/15 text-neutral border-neutral/40',
  info: 'bg-info/15 text-info border-info/40',
}

export const toneSolid: Record<Tone, string> = {
  good: 'bg-good/25 text-good border-good',
  evil: 'bg-evil/25 text-evil border-evil',
  neutral: 'bg-neutral/25 text-neutral border-neutral',
  info: 'bg-info/25 text-info border-info',
}

const BASE_TONES = new Set<string>(['good', 'evil', 'neutral', 'info'])

/**
 * Resolve a team's `color` to a usable CSS colour. A base-tone name goes through its
 * `--color-*` variable so a palette / colourblind-preset change reaches it; anything
 * else (a hex) is returned as-is.
 */
export function resolveTeamColor(color: string): string {
  return BASE_TONES.has(color) ? `var(--color-${color})` : color
}

/**
 * Tinted chip style (bg 15% / border 40% / solid text) for a team colour. Uses
 * `color-mix` so the same code works for a palette variable or a literal hex — this
 * replaces the Tailwind `toneChip` classes for team-coloured chips, which can't be
 * class strings once a team colour may be any hex.
 */
export function teamChipStyle(color: string): CSSProperties {
  const c = resolveTeamColor(color)
  return {
    color: c,
    backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`,
    borderColor: `color-mix(in srgb, ${c} 40%, transparent)`,
  }
}

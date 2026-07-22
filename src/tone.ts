import type { Tone } from './types'

// Written as whole literal class strings so Tailwind's scanner can see them —
// building them by interpolation would silently produce unstyled elements.

export const toneText: Record<Tone, string> = {
  good: 'text-good',
  evil: 'text-evil',
  neutral: 'text-neutral',
  info: 'text-info',
  blue: 'text-blue',
}

export const toneChip: Record<Tone, string> = {
  good: 'bg-good/15 text-good border-good/40',
  evil: 'bg-evil/15 text-evil border-evil/40',
  neutral: 'bg-neutral/15 text-neutral border-neutral/40',
  info: 'bg-info/15 text-info border-info/40',
  blue: 'bg-blue/15 text-blue border-blue/40',
}

export const toneSolid: Record<Tone, string> = {
  good: 'bg-good/25 text-good border-good',
  evil: 'bg-evil/25 text-evil border-evil',
  neutral: 'bg-neutral/25 text-neutral border-neutral',
  info: 'bg-info/25 text-info border-info',
  blue: 'bg-blue/25 text-blue border-blue',
}

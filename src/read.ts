import type { Tone } from './types'

// The read primitive is a signed lean (-2..+2). This is the one place the
// good↔evil axis is interpreted, so a multi-team game later only touches here.

/**
 * The five read steps, evil → neutral → good, in the order the control shows them.
 * The label is spelled out — a `−−/++` shorthand read as noise; the words carry the
 * scale on their own, so no separate legend is needed.
 */
export const LEAN_STEPS: { lean: number; label: string }[] = [
  { lean: -2, label: 'sure evil' },
  { lean: -1, label: 'maybe evil' },
  { lean: 0, label: 'neutral' },
  { lean: 1, label: 'maybe good' },
  { lean: 2, label: 'sure good' },
]

export function leanTone(lean: number): Tone {
  return lean > 0 ? 'good' : lean < 0 ? 'evil' : 'neutral'
}

/**
 * How the token halo draws, by how sure the read is. Colour (via `leanTone`)
 * carries the side and stays vivid so +/−/neutral read clearly; certainty is a
 * shape difference — a hunch (±1) or a neutral read (0) is a thin dashed ring, a
 * confident read (±2) a thick solid one. `null` (never read) draws no halo, which
 * is what keeps a deliberate neutral read visually distinct from no read at all.
 */
export function haloStyle(lean: number | null): { width: number; opacity: number; dash?: string } | null {
  if (lean === null) return null
  return Math.abs(lean) >= 2 ? { width: 3.75, opacity: 1 } : { width: 2, opacity: 0.9, dash: '2.5 2.5' }
}

import { getRole, getTeam } from './config'
import type { Alignment, GameConfig, RoleId, ScriptConfig } from './types'

// Post-game scoring: read (alignment lean) vs truth alignment, and role guess vs
// truth role. Kept out of the components so the two review views agree on the math.

/**
 * The default alignment a role implies, used only to *prefill* the truth toggle —
 * the user can override it for a swap/misregistration. Read straight off the
 * role's team now that alignment is config (was derived from the tone colour).
 */
export function roleAlignment(game: GameConfig, script: ScriptConfig, roleId: RoleId): Alignment {
  const role = getRole(script, roleId)
  return (role ? getTeam(game, role.team)?.alignment : undefined) ?? 'good'
}

/**
 * My alignment read vs what they actually were. `lean` is `null` when I never
 * read the player (no ReadTag) — that's the only "not made" case. A read I *did*
 * make maps to a side, including lean 0 → `neutral`: reading someone as a third
 * party is a real call, scored correct only if they actually ended neutral. So
 * "read them neutral, they were neutral" ticks, while "never read them" doesn't.
 */
export function scoreRead(lean: number | null, actual: Alignment): { made: boolean; correct: boolean } {
  if (lean === null) return { made: false, correct: false }
  const side: Alignment = lean > 0 ? 'good' : lean < 0 ? 'evil' : 'neutral'
  return { made: true, correct: side === actual }
}

/** My role guess(es) vs the actual role. `made` is false when I never guessed. */
export function scoreGuess(guessed: RoleId[], actual: RoleId | undefined): { made: boolean; correct: boolean } {
  if (guessed.length === 0) return { made: false, correct: false }
  if (!actual) return { made: true, correct: false }
  return { made: true, correct: guessed.includes(actual) }
}

import { getRole, getTeam } from './config'
import type { Alignment, GameConfig, RoleId, ScriptConfig } from './types'

// Post-game scoring: read (alignment lean) vs truth alignment, and role guess vs
// truth role. Kept out of the components so the two review views agree on the math.

/**
 * The default alignment a role implies, used only to *prefill* the truth toggle —
 * the user can override it for a swap/misregistration. BotC teams collapse to two
 * sides: an `evil` tone is evil, everything else (townsfolk green, outsider blue)
 * is good. A game with more than two sides makes this config-driven later.
 */
export function roleAlignment(game: GameConfig, script: ScriptConfig, roleId: RoleId): Alignment {
  const role = getRole(script, roleId)
  const tone = role ? getTeam(game, role.team)?.tone : undefined
  return tone === 'evil' ? 'evil' : 'good'
}

/** My alignment read vs what they actually were. `made` is false at lean 0. */
export function scoreRead(lean: number, actual: Alignment): { made: boolean; correct: boolean } {
  if (lean === 0) return { made: false, correct: false }
  return { made: true, correct: (lean > 0 ? 'good' : 'evil') === actual }
}

/** My role guess(es) vs the actual role. `made` is false when I never guessed. */
export function scoreGuess(guessed: RoleId[], actual: RoleId | undefined): { made: boolean; correct: boolean } {
  if (guessed.length === 0) return { made: false, correct: false }
  if (!actual) return { made: true, correct: false }
  return { made: true, correct: guessed.includes(actual) }
}

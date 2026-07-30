import { getRelation, getRole } from './config'
import { relationPhrase } from './i18n'
import type { Assertion, GameConfig, ScriptConfig, Session, Tone } from './types'

export type AssertionParts = {
  speaker: string
  phrase: string
  tone: Tone
  /** Empty for a self-only claim, where the phrase ("claims") already implies it. */
  targetText: string
  /** Empty when no roles are named. */
  roleText: string
  note?: string
}

/**
 * The single source of truth for how an assertion reads as words. Shared by the
 * log and the diagram's focus panel so the two never drift apart.
 */
export function assertionParts(
  assertion: Assertion,
  session: Session,
  game: GameConfig,
  script: ScriptConfig,
): AssertionParts {
  const relation = getRelation(game, assertion.relation)
  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? '?'

  const isSelfOnly = assertion.targets.length === 1 && assertion.targets[0] === assertion.speaker
  const useSelf = isSelfOnly && Boolean(relation.selfPhrase)

  return {
    speaker: nameOf(assertion.speaker),
    phrase: relationPhrase(relation, useSelf),
    tone: relation.tone,
    targetText: useSelf ? '' : assertion.targets.map(nameOf).join(' & '),
    roleText: (assertion.roles ?? []).map((id) => getRole(script, id)?.name ?? id).join(' / '),
    note: assertion.note,
  }
}

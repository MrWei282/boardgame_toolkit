import { getRelation, getRole } from '../config'
import { phaseLabel, useStore } from '../store'
import { toneText } from '../tone'
import type { Assertion, GameConfig, ScriptConfig, Session } from '../types'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
}

export function LogView({ session, game, script }: Props) {
  const deleteAssertion = useStore((s) => s.deleteAssertion)

  if (session.assertions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
        Nothing logged yet.
      </p>
    )
  }

  // Newest first — during play you are checking what just happened, not reading
  // the game from the top.
  const ordered = [...session.assertions].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <ul className="space-y-1.5">
      {ordered.map((assertion, i) => {
        const prev = ordered[i - 1]
        const startsPhase =
          !prev || prev.round !== assertion.round || prev.phase !== assertion.phase

        return (
          <li key={assertion.id}>
            {startsPhase && (
              <div className="mt-3 mb-1.5 text-[11px] tracking-wide text-muted uppercase">
                {phaseLabel(assertion.round, assertion.phase)}
              </div>
            )}
            <div className="flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
              <p className="min-w-0 flex-1 text-sm leading-snug">
                {describe(assertion, session, game, script)}
                {assertion.note && (
                  <span className="mt-0.5 block text-xs text-muted">“{assertion.note}”</span>
                )}
              </p>
              <button
                onClick={() => deleteAssertion(assertion.id)}
                aria-label="Delete entry"
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted active:bg-raised"
              >
                ✕
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function describe(
  assertion: Assertion,
  session: Session,
  game: GameConfig,
  script: ScriptConfig,
) {
  const relation = getRelation(game, assertion.relation)
  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? '?'

  const isSelfOnly = assertion.targets.length === 1 && assertion.targets[0] === assertion.speaker
  const phrase = isSelfOnly && relation.selfPhrase ? relation.selfPhrase : relation.phrase
  const targets = isSelfOnly && relation.selfPhrase ? '' : assertion.targets.map(nameOf).join(' & ')

  const roleNames = (assertion.roles ?? [])
    .map((id) => getRole(script, id)?.name ?? id)
    .join(' / ')

  return (
    <>
      <span className="font-medium">{nameOf(assertion.speaker)}</span>{' '}
      <span className={toneText[relation.tone]}>{phrase}</span>
      {targets && <> {targets}</>}
      {roleNames && <span className="text-muted"> — {roleNames}</span>}
    </>
  )
}

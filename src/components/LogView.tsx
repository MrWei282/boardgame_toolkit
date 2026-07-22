import { assertionParts } from '../describe'
import { phaseLabel, useStore } from '../store'
import type { GameConfig, ScriptConfig, Session } from '../types'
import { AssertionText } from './AssertionText'

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
        const parts = assertionParts(assertion, session, game, script)

        return (
          <li key={assertion.id}>
            {startsPhase && (
              <div className="mt-3 mb-1.5 text-[11px] tracking-wide text-muted uppercase">
                {phaseLabel(assertion.round, assertion.phase)}
              </div>
            )}
            <div className="flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <AssertionText parts={parts} />
                {parts.note && (
                  <span className="mt-0.5 block text-xs text-muted">“{parts.note}”</span>
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

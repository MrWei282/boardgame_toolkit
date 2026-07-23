import { useState } from 'react'
import type { GameConfig, ScriptConfig, Session } from '../types'
import { Postmortem } from './Postmortem'
import { TruthEntry } from './TruthEntry'

/**
 * The finished-game review: enter ground truth first, then read the post-mortem.
 * Only shown once a game is marked finished.
 */
export function ReviewTab({
  session,
  game,
  script,
}: {
  session: Session
  game: GameConfig
  script: ScriptConfig
}) {
  const [editing, setEditing] = useState(false)

  if (!session.truth || editing) {
    return <TruthEntry session={session} game={game} script={script} onSaved={() => setEditing(false)} />
  }
  return <Postmortem session={session} script={script} onEdit={() => setEditing(true)} />
}

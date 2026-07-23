import { useEffect, useState } from 'react'
import { currentRoleIds, useStore } from '../store'
import type { GameConfig, Phase, PlayerId, RoleId, ScriptConfig, Session } from '../types'
import { RolePicker } from './RolePicker'
import { Sheet } from './Sheet'

type Props = {
  playerId: PlayerId | null
  onClose: () => void
  session: Session
  game: GameConfig
  script: ScriptConfig
  /** Phase to record into — the phase currently being viewed. */
  at: { round: number; phase: Phase }
}

/**
 * My guess at what a player is. Several roles can be selected at once — they are
 * simultaneous hypotheses with equal weight, not a ranked list.
 */
export function RoleTagSheet({ playerId, onClose, session, game, script, at }: Props) {
  const setRoleTag = useStore((s) => s.setRoleTag)
  const player = session.players.find((p) => p.id === playerId) ?? null

  const [selected, setSelected] = useState<RoleId[]>([])

  useEffect(() => {
    if (playerId) setSelected(currentRoleIds(session, playerId))
    // Re-seeding on every session change would fight the user mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  function save() {
    if (!playerId) return
    setRoleTag(playerId, selected, at)
    onClose()
  }

  return (
    <Sheet
      open={Boolean(player)}
      onClose={onClose}
      title={player ? `Guess — ${player.name}` : ''}
      footer={
        <div className="flex gap-2">
          <button
            onClick={() => setSelected([])}
            className="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted active:bg-line"
          >
            Clear
          </button>
          <button
            onClick={save}
            className="flex-1 rounded-xl bg-info py-3 font-semibold text-bg active:opacity-80"
          >
            Save
          </button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted">
        Pick every role still in play for them. This is your <em>guess</em> — what
        they <em>claimed</em> out loud belongs in the log instead. Your good/evil
        read lives on the diagram.
      </p>
      <RolePicker
        game={game}
        script={script}
        selected={selected}
        // Functional update: tapping several roles faster than React re-renders
        // would otherwise read a stale `selected` and drop all but the last.
        onToggle={(id) =>
          setSelected((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
        }
      />
    </Sheet>
  )
}

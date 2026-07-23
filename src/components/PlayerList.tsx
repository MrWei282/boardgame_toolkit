import { getRole, getTeam } from '../config'
import { isAlive } from '../projections'
import { currentRead, currentRoleIds, useStore } from '../store'
import { toneChip } from '../tone'
import type { GameConfig, Phase, PlayerId, ScriptConfig, Session } from '../types'
import { LeanControl } from './LeanControl'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  onTagPlayer: (id: PlayerId) => void
  /** Open the event sheet to record a death/revival for this player. */
  onEditLife: (id: PlayerId) => void
  /** Phase to stamp a new read into — the phase currently in view. */
  at: { round: number; phase: Phase }
}

export function PlayerList({ session, game, script, onTagPlayer, onEditLife, at }: Props) {
  const setRead = useStore((s) => s.setRead)
  return (
    <ul className="space-y-1.5">
      {session.players.map((player) => {
        const roleIds = currentRoleIds(session, player.id)
        const alive = isAlive(session, player.id)

        return (
          <li key={player.id} className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-stretch">
            <button
              onClick={() => onTagPlayer(player.id)}
              className={[
                'flex min-h-14 flex-1 items-center gap-2.5 px-3 py-2 text-left active:bg-raised',
                alive ? '' : 'opacity-50',
              ].join(' ')}
            >
              <span className="w-5 shrink-0 text-sm text-muted tabular-nums">
                {player.seat + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{player.name}</span>
                {roleIds.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {roleIds.slice(0, 3).map((id) => {
                      const role = getRole(script, id)
                      const tone = role ? getTeam(game, role.team)?.tone : undefined
                      return (
                        <span
                          key={id}
                          className={[
                            'rounded border px-1.5 py-0.5 text-[11px] leading-none',
                            tone ? toneChip[tone] : 'border-line text-muted',
                          ].join(' ')}
                        >
                          {role?.name ?? id}
                        </span>
                      )
                    })}
                    {roleIds.length > 3 && (
                      <span className="rounded border border-line px-1.5 py-0.5 text-[11px] leading-none text-muted">
                        +{roleIds.length - 3}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[11px] text-muted/70">no guess</span>
                )}
              </span>
            </button>

            <button
              onClick={() => onEditLife(player.id)}
              aria-label={alive ? `Record death for ${player.name}` : `Record revival for ${player.name}`}
              className={[
                'flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-line text-xs',
                alive ? 'text-muted active:bg-raised' : 'bg-evil/15 text-evil',
              ].join(' ')}
            >
              {alive ? (
                'alive'
              ) : (
                <>
                  <span className="text-base leading-none">💀</span>
                  <span>dead</span>
                </>
              )}
            </button>
          </div>

          {/* My alignment read — inline so a hunch is one tap, no sheet. */}
          <div className="flex items-center gap-2 border-t border-line px-3 py-2">
            <span className="shrink-0 text-[11px] text-muted">read</span>
            <div className="flex-1">
              <LeanControl
                value={currentRead(session, player.id)}
                onChange={(lean) => setRead(player.id, lean, at)}
              />
            </div>
          </div>
          </li>
        )
      })}
    </ul>
  )
}

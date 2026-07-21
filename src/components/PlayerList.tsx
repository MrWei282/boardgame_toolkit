import { getRole, getTeam } from '../config'
import { currentRoleIds, useStore } from '../store'
import { toneChip } from '../tone'
import type { GameConfig, PlayerId, ScriptConfig, Session } from '../types'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  onTagPlayer: (id: PlayerId) => void
}

export function PlayerList({ session, game, script, onTagPlayer }: Props) {
  const toggleAlive = useStore((s) => s.toggleAlive)

  return (
    <ul className="space-y-1.5">
      {session.players.map((player) => {
        const roleIds = currentRoleIds(session, player.id)

        return (
          <li key={player.id} className="flex items-stretch gap-1.5">
            <button
              onClick={() => onTagPlayer(player.id)}
              className={[
                'flex min-h-14 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-left active:bg-raised',
                player.alive ? '' : 'opacity-50',
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
              onClick={() => toggleAlive(player.id)}
              aria-label={player.alive ? `Mark ${player.name} dead` : `Mark ${player.name} alive`}
              className={[
                'w-14 shrink-0 rounded-xl border text-xs',
                player.alive
                  ? 'border-line bg-surface text-muted active:bg-raised'
                  : 'border-evil/40 bg-evil/15 text-evil',
              ].join(' ')}
            >
              {player.alive ? 'alive' : 'dead'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

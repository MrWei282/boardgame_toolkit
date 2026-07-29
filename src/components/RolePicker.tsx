import { rolesByTeam } from '../config'
import { teamChipStyle } from '../tone'
import type { GameConfig, RoleId, ScriptConfig } from '../types'

type Props = {
  game: GameConfig
  script: ScriptConfig
  selected: RoleId[]
  onToggle: (id: RoleId) => void
}

export function RolePicker({ game, script, selected, onToggle }: Props) {
  return (
    <div className="space-y-3">
      {rolesByTeam(game, script).map(({ team, roles }) => (
        <div key={team.id}>
          <div className="mb-1.5 text-[11px] tracking-wide text-muted uppercase">{team.name}</div>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => {
              const isSelected = selected.includes(role.id)
              return (
                <button
                  key={role.id}
                  onClick={() => onToggle(role.id)}
                  className={[
                    'rounded-lg border px-2.5 py-1.5 text-sm',
                    isSelected ? '' : 'border-line bg-raised text-muted active:bg-line',
                  ].join(' ')}
                  style={isSelected ? teamChipStyle(team.color) : undefined}
                >
                  {role.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

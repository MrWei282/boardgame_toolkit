import type { PlayerId, PlayerState } from '../types'

type Props = {
  players: PlayerState[]
  selected: PlayerId[]
  onSelect: (id: PlayerId) => void
}

/**
 * Seat chips. Dead players stay fully selectable — they are still spoken about
 * and can still speak (in BotC the dead keep talking), so "P1 vouches for the
 * dead P2" is a valid thing to log. Death is shown with a marker and a struck
 * name rather than by dimming the whole chip: a blanket opacity made dead chips
 * look disabled and, worse, washed out the selected highlight so a tap looked
 * like it did nothing.
 */
export function SeatGrid({ players, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {players.map((p) => {
        const isSelected = selected.includes(p.id)
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            aria-pressed={isSelected}
            className={[
              'flex min-h-12 flex-col items-center justify-center rounded-xl border px-2 py-2 leading-tight',
              isSelected
                ? 'border-info bg-info/25 text-ink'
                : 'border-line bg-raised text-ink active:bg-line',
            ].join(' ')}
          >
            <span className="text-[10px] text-muted">
              {p.seat + 1}
              {p.alive ? '' : ' · †dead'}
            </span>
            <span
              className={[
                'max-w-full truncate text-sm',
                p.alive ? '' : 'text-muted line-through decoration-muted/70',
              ].join(' ')}
            >
              {p.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

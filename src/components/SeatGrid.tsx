import type { PlayerId, PlayerState } from '../types'

type Props = {
  players: PlayerState[]
  selected: PlayerId[]
  onSelect: (id: PlayerId) => void
}

/**
 * Seat chips. Dead players stay selectable — they are still spoken about, and
 * "P4 accused P7 before P7 died" is exactly the kind of thing worth logging.
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
            className={[
              'flex min-h-12 flex-col items-center justify-center rounded-xl border px-2 py-2 leading-tight',
              isSelected
                ? 'border-info bg-info/20 text-ink'
                : 'border-line bg-raised text-ink active:bg-line',
              p.alive ? '' : 'opacity-45',
            ].join(' ')}
          >
            <span className="text-[10px] text-muted">
              {p.seat + 1}
              {p.alive ? '' : ' · dead'}
            </span>
            <span className="max-w-full truncate text-sm">{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}

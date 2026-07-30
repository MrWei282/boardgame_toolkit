import { useT } from '../i18n'
import { LEAN_STEPS } from '../read'

type Props = {
  /** Current read, or null when the player has never been read (nothing active). */
  value: number | null
  /** A lean to set, or null to clear (tapping the already-active segment). */
  onChange: (lean: number | null) => void
}

// Whole literal class strings so Tailwind's scanner sees them. The extremes take a
// heavier fill than the leans, so "certain" reads stronger than "possible".
function activeClass(lean: number): string {
  switch (lean) {
    case -2:
      return 'bg-evil/35 text-evil'
    case -1:
      return 'bg-evil/15 text-evil'
    case 1:
      return 'bg-good/15 text-good'
    case 2:
      return 'bg-good/35 text-good'
    default:
      return 'bg-neutral/25 text-neutral'
  }
}

function idleClass(lean: number): string {
  return lean < 0 ? 'text-evil/55' : lean > 0 ? 'text-good/55' : 'text-muted'
}

/**
 * A five-segment alignment read: certain evil → neutral → certain good. One tap
 * sets the read — reads are light enough that they don't warrant a sheet, and a
 * live discussion leaves no time to open one. A never-read player shows nothing
 * active; the middle segment is a deliberate *neutral* read (a third-party call),
 * distinct from having no read at all — the post-mortem scores the two apart.
 * Tapping the already-active segment clears the read (back to no read).
 */
export function LeanControl({ value, onChange }: Props) {
  const { t } = useT()
  return (
    <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label={t('diagram.myRead')}>
      {LEAN_STEPS.map((step, i) => {
        const active = value === step.lean
        const label = t(`lean.${step.lean}`)
        return (
          <button
            key={step.lean}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(active ? null : step.lean)}
            className={[
              'flex-1 px-0.5 py-1.5 text-center text-[10px] leading-tight font-medium',
              i > 0 ? 'border-l border-line' : '',
              active ? activeClass(step.lean) : idleClass(step.lean),
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

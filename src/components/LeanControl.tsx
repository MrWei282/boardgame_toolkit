import { LEAN_STEPS } from '../read'

type Props = {
  value: number
  onChange: (lean: number) => void
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
 * live discussion leaves no time to open one. Clearing is tapping neutral.
 */
export function LeanControl({ value, onChange }: Props) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="My read">
      {LEAN_STEPS.map((step, i) => {
        const active = value === step.lean
        return (
          <button
            key={step.lean}
            aria-label={step.label}
            aria-pressed={active}
            onClick={() => onChange(step.lean)}
            className={[
              'flex-1 px-0.5 py-1.5 text-center text-[10px] leading-tight font-medium',
              i > 0 ? 'border-l border-line' : '',
              active ? activeClass(step.lean) : idleClass(step.lean),
            ].join(' ')}
          >
            {step.label}
          </button>
        )
      })}
    </div>
  )
}

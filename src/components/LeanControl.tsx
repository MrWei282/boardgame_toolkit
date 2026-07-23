import { LEAN_STEPS } from '../read'

type Props = {
  value: number
  onChange: (lean: number) => void
  /** Flank the segments with evil/good labels so the axis reads without a legend. */
  endpoints?: boolean
}

// Whole literal class strings so Tailwind's scanner sees them. The extremes take a
// heavier fill than the leans, so ++ looks more certain than + at a glance.
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
 * A five-segment alignment read: evil ← neutral → good. One tap sets the read —
 * reads are light enough that they don't warrant a sheet, and a live discussion
 * leaves no time to open one. Clearing is just tapping the neutral middle.
 */
export function LeanControl({ value, onChange, endpoints }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      {endpoints && <span className="shrink-0 text-[10px] font-medium text-evil/80">evil</span>}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-line" role="group" aria-label="My read">
        {LEAN_STEPS.map((step, i) => {
          const active = value === step.lean
          return (
            <button
              key={step.lean}
              aria-label={step.aria}
              aria-pressed={active}
              onClick={() => onChange(step.lean)}
              className={[
                'flex-1 py-1.5 text-sm font-semibold tabular-nums active:bg-raised',
                i > 0 ? 'border-l border-line' : '',
                active ? activeClass(step.lean) : idleClass(step.lean),
              ].join(' ')}
            >
              {step.label}
            </button>
          )
        })}
      </div>
      {endpoints && <span className="shrink-0 text-[10px] font-medium text-good/80">good</span>}
    </div>
  )
}

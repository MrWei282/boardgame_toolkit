import { useState } from 'react'

type Props = {
  onConfirm: () => void
  /** What is being deleted, shown in the confirm dialog. */
  message?: string
  className?: string
}

/**
 * A delete (✕) that asks first. The log is tapped fast and often, so an
 * accidental hit on a delete would otherwise quietly lose a claim.
 */
export function DeleteButton({ onConfirm, message = 'Delete this entry?', className }: Props) {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        aria-label="Delete"
        className={className ?? 'shrink-0 rounded-lg px-2 py-0.5 text-xs text-muted active:bg-raised'}
      >
        ✕
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-line bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm">{message}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-line bg-raised py-2.5 text-sm active:bg-line"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirm()
                  setConfirming(false)
                }}
                className="flex-1 rounded-xl border border-evil/50 bg-evil/20 py-2.5 text-sm font-semibold text-evil active:bg-evil/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

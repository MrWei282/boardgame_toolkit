import { useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  pinned: boolean
  hidden: boolean
  onEdit: () => void
  onTogglePin: () => void
  onToggleStrike: () => void
  onDelete: () => void
  deleteMessage?: string
}

/**
 * The four per-entry actions — edit, pin, strike, delete — as inline icon buttons.
 * A ⋯ sheet was one tap too many for something used this often, and it hid the
 * actions from the diagram's focus panel entirely; inline icons put the same
 * controls wherever an entry is shown. Only delete confirms (the log is tapped
 * fast; a stray delete would quietly lose a claim), and the dialog portals to
 * <body> so no backdrop-blur/transform ancestor can crop it.
 */
export function EntryActions({
  pinned,
  hidden,
  onEdit,
  onTogglePin,
  onToggleStrike,
  onDelete,
  deleteMessage = 'Delete this entry?',
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const btn = 'shrink-0 rounded-lg px-1.5 py-1 text-sm leading-none active:bg-raised'

  return (
    <div className="flex shrink-0 items-start gap-0.5">
      <button onClick={onEdit} aria-label="Edit" className={`${btn} text-muted`}>
        ✎
      </button>
      <button
        onClick={onTogglePin}
        aria-label={pinned ? 'Unpin' : 'Pin to top'}
        className={`${btn} ${pinned ? 'text-neutral' : 'text-muted'}`}
      >
        {pinned ? '★' : '☆'}
      </button>
      <button
        onClick={onToggleStrike}
        aria-label={hidden ? 'Un-strike (show again)' : 'Strike through (hide from diagram)'}
        className={`${btn} ${hidden ? 'text-ink' : 'text-muted'}`}
      >
        <span className="line-through">S</span>
      </button>
      <button onClick={() => setConfirming(true)} aria-label="Delete" className={`${btn} text-muted`}>
        ✕
      </button>

      {confirming &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
            onClick={() => setConfirming(false)}
          >
            <div
              className="w-full max-w-xs rounded-2xl border border-line bg-surface p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm">{deleteMessage}</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-xl border border-line bg-raised py-2.5 text-sm active:bg-line"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete()
                    setConfirming(false)
                  }}
                  className="flex-1 rounded-xl border border-evil/50 bg-evil/20 py-2.5 text-sm font-semibold text-evil active:bg-evil/30"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

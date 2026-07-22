import { useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'

type Props = {
  pinned: boolean
  hidden: boolean
  onEdit: () => void
  onTogglePin: () => void
  onToggleStrike: () => void
  onDelete: () => void
}

/**
 * Per-entry actions behind a ⋯ button: edit, pin, strike, delete. An action sheet
 * rather than inline buttons keeps each log row uncluttered, and delete still
 * confirms so a stray tap never loses an entry.
 */
export function EntryMenu({ pinned, hidden, onEdit, onTogglePin, onToggleStrike, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function run(fn: () => void) {
    fn()
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Entry actions"
        className="shrink-0 rounded-lg px-2 py-0.5 text-muted active:bg-raised"
      >
        ⋯
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Entry">
        <div className="space-y-1.5">
          <Item onClick={() => run(onEdit)}>Edit</Item>
          <Item onClick={() => run(onTogglePin)}>{pinned ? 'Unpin' : 'Pin to top'}</Item>
          <Item onClick={() => run(onToggleStrike)}>
            {hidden ? 'Un-strike (show again)' : 'Strike through (hide from diagram)'}
          </Item>
          <Item
            danger
            onClick={() => {
              setOpen(false)
              setConfirming(true)
            }}
          >
            Delete
          </Item>
        </div>
      </Sheet>

      {confirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-line bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm">Delete this entry?</p>
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
        </div>
      )}
    </>
  )
}

function Item({
  children,
  onClick,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full rounded-xl border px-3 py-3 text-left text-sm active:bg-raised',
        danger ? 'border-evil/40 text-evil' : 'border-line text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

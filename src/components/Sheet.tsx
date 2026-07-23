import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Sheet({ open, title, onClose, children, footer }: Props) {
  if (!open) return null

  // Portal to <body> so the `fixed` overlay is viewport-relative regardless of
  // where it's rendered. Ancestors with backdrop-filter/transform/opacity (e.g.
  // the RoundBar's backdrop-blur) become the containing block for fixed children
  // and would otherwise crop the sheet to that ancestor's box — the stacking-
  // context gotcha in CLAUDE.md.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] flex-col rounded-t-2xl border-t border-line bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-muted active:bg-raised"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

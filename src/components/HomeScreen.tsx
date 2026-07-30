import { useState } from 'react'
import { getGame, getScript } from '../config'
import { useT, type TFn } from '../i18n'
import { phaseLabel } from '../projections'
import { buildSessionBundle, bundleFilename, downloadText, serializeBundle } from '../share'
import { useSessions, useStore } from '../store'
import type { Session } from '../types'
import { Sheet } from './Sheet'

type Props = {
  /** Open the new-session form. */
  onNewGame: () => void
  /** Open the settings screen. */
  onOpenSettings: () => void
}

/** Today / Yesterday / a short date, so the list reads as game-nights. */
function dayLabel(ts: number, t: TFn): string {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return t('home.today')
  if (diffDays === 1) return t('home.yesterday')
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function HomeScreen({ onNewGame, onOpenSettings }: Props) {
  const sessions = useSessions()
  const openSession = useStore((s) => s.openSession)
  const { t } = useT()

  // Group consecutive sessions (already newest-first) by day into game-nights.
  const groups: { label: string; items: Session[] }[] = []
  for (const s of sessions) {
    const label = dayLabel(s.createdAt, t)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(s)
    else groups.push({ label, items: [s] })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('home.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            aria-label={t('home.settings')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-raised text-muted active:bg-line"
          >
            ⚙
          </button>
          <button
            onClick={onNewGame}
            className="rounded-xl bg-info px-4 py-2.5 text-sm font-semibold text-bg active:opacity-80"
          >
            {t('home.newGame')}
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-16 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          {t('home.empty')}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-1.5 text-[11px] tracking-wide text-muted uppercase">{group.label}</h2>
              <ul className="space-y-1.5">
                {group.items.map((s) => (
                  <GameRow key={s.id} session={s} onOpen={() => openSession(s.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function GameRow({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const setEnded = useStore((s) => s.setEnded)
  const deleteSession = useStore((s) => s.deleteSession)
  const { t } = useT()
  const [menu, setMenu] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const script = getScript(session.scriptId)
  const ended = session.endedAt !== undefined

  return (
    <li className="flex items-stretch overflow-hidden rounded-xl border border-line bg-surface">
      <button onClick={onOpen} className="min-h-14 flex-1 px-3 py-2.5 text-left active:bg-raised">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{script.name}</span>
          <span
            className={[
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
              ended ? 'bg-neutral/15 text-neutral' : 'bg-good/15 text-good',
            ].join(' ')}
          >
            {ended ? t('home.finished') : t('home.ongoing')}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {t('home.players', { n: session.players.length })} · {phaseLabel(getGame(session.gameId), session.round, session.phase)} · {timeLabel(session.createdAt)}
        </div>
      </button>

      <button
        onClick={() => setMenu(true)}
        aria-label="Game actions"
        className="w-11 shrink-0 border-l border-line text-muted active:bg-raised"
      >
        ⋯
      </button>

      <Sheet open={menu} onClose={() => setMenu(false)} title={script.name}>
        <div className="space-y-1.5">
          <button
            onClick={() => {
              setMenu(false)
              downloadText(bundleFilename(script.name), serializeBundle(buildSessionBundle(session)))
            }}
            className="w-full rounded-xl border border-line px-3 py-3 text-left text-sm text-ink active:bg-raised"
          >
            {t('home.export')}
          </button>
          <button
            onClick={() => {
              setMenu(false)
              setEnded(session.id, !ended)
            }}
            className="w-full rounded-xl border border-line px-3 py-3 text-left text-sm text-ink active:bg-raised"
          >
            {ended ? t('home.reopen') : t('home.markFinished')}
          </button>
          <button
            onClick={() => {
              setMenu(false)
              setConfirming(true)
            }}
            className="w-full rounded-xl border border-evil/40 px-3 py-3 text-left text-sm text-evil active:bg-raised"
          >
            {t('common.delete')}
          </button>
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
            <p className="text-sm">{t('home.deleteConfirm')}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-line bg-raised py-2.5 text-sm active:bg-line"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  setConfirming(false)
                  deleteSession(session.id)
                }}
                className="flex-1 rounded-xl border border-evil/50 bg-evil/20 py-2.5 text-sm font-semibold text-evil active:bg-evil/30"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

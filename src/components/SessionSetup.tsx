import { useState, type ReactNode } from 'react'
import {
  allGames,
  DEFAULT_GAME_ID,
  getGame,
  importConfigText,
  restoreDefaultConfigs,
  scriptsForGame,
  type ImportResult,
} from '../config'
import { useStore } from '../store'
import { Sheet } from './Sheet'

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * A game's default table size: the midpoint of its allowed range, rounded up.
 * Always in [min, max] and sensible even for a tiny or single-value range —
 * unlike a fixed default (8) that had to be clamped and could sit at an edge.
 */
function defaultCount(min: number, max: number): number {
  return Math.ceil((min + max) / 2)
}

export function SessionSetup({ onCancel }: { onCancel: () => void }) {
  const createSession = useStore((s) => s.createSession)

  // Bumped after an import/restore so the picker re-reads the (mutated) registries.
  // Managing/deleting configs lives in Settings now; this sheet only imports.
  const [configVersion, setConfigVersion] = useState(0)
  const games = allGames()

  const [gameId, setGameId] = useState(DEFAULT_GAME_ID)
  // Games can all be deleted now (no privileged built-ins), so never assume the
  // selected id still resolves — fall back to whatever remains, or undefined.
  const game = games.find((g) => g.id === gameId) ?? games[0]

  const scripts = game ? scriptsForGame(game.id) : []
  const [scriptId, setScriptId] = useState(scripts[0]?.id ?? '')

  const [count, setCount] = useState(() => (game ? defaultCount(game.minPlayers, game.maxPlayers) : 0))
  const maxSeats = games.length ? Math.max(...games.map((g) => g.maxPlayers)) : 0
  const [names, setNames] = useState<string[]>(() => Array(maxSeats).fill(''))

  const [importing, setImporting] = useState(false)

  // Switching game re-picks its first script and pulls the count into its range.
  function chooseGame(id: string) {
    const g = getGame(id)
    setGameId(id)
    setScriptId(scriptsForGame(id)[0]?.id ?? '')
    setCount((c) => clamp(c, g.minPlayers, g.maxPlayers))
  }

  function setName(i: number, value: string) {
    setNames((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  // configVersion is a state bump so the picker re-renders after an import/remove
  // (the registries are mutated in place, which React can't see on its own).
  function afterImport(gid: string) {
    setConfigVersion((v) => v + 1)
    chooseGame(gid)
  }

  function restoreDefaults() {
    restoreDefaultConfigs()
    setConfigVersion((v) => v + 1)
    chooseGame(DEFAULT_GAME_ID)
  }

  function start() {
    if (!game) return
    createSession({ gameId: game.id, scriptId, names: names.slice(0, count) })
  }

  const canStart = scripts.length > 0 && Boolean(scriptId)

  // Every game can be deleted now, so handle the zero-games case rather than crash.
  if (!game) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">New session</h1>
          <button
            onClick={onCancel}
            className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-muted active:bg-line"
          >
            Cancel
          </button>
        </div>
        <div className="mt-16 rounded-xl border border-dashed border-line px-4 py-10 text-center">
          <p className="text-sm text-muted">No games available — import one, or bring back the defaults.</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={restoreDefaults}
              className="w-full rounded-xl bg-info py-3 font-semibold text-bg active:opacity-80"
            >
              Restore default games
            </button>
            <button
              onClick={() => setImporting(true)}
              className="w-full rounded-xl border border-line bg-raised py-3 text-sm active:bg-line"
            >
              Import a game
            </button>
          </div>
        </div>
        <ImportSheet open={importing} onClose={() => setImporting(false)} onImported={afterImport} />
      </div>
    )
  }

  return (
    <div
      data-config-version={configVersion}
      className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">New session</h1>
        <button
          onClick={onCancel}
          className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-muted active:bg-line"
        >
          Cancel
        </button>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium">Game</label>
          <button
            onClick={() => setImporting(true)}
            className="text-xs text-info underline decoration-dotted active:text-ink"
          >
            ＋ Import a game
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {games.map((g) => (
            <Chip key={g.id} selected={g.id === gameId} onClick={() => chooseGame(g.id)}>
              {g.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* Script — the role list layered on the game. */}
      <div className="mt-4">
        <label className="text-sm font-medium">Script</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {scripts.length === 0 ? (
            <p className="text-xs text-muted">
              This game has no script yet — import one that extends “{game.name}”.
            </p>
          ) : (
            scripts.map((s) => (
              <Chip key={s.id} selected={s.id === scriptId} onClick={() => setScriptId(s.id)}>
                {s.name}
              </Chip>
            ))
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <label className="text-sm font-medium">Players</label>
          <span className="text-sm text-muted">
            {game.minPlayers}–{game.maxPlayers}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCount((c) => Math.max(game.minPlayers, c - 1))}
            disabled={count <= game.minPlayers}
            className="h-12 w-12 shrink-0 rounded-xl border border-line bg-raised text-xl active:bg-line disabled:opacity-30"
          >
            −
          </button>
          <div className="flex-1 text-center text-2xl font-semibold tabular-nums">{count}</div>
          <button
            onClick={() => setCount((c) => Math.min(game.maxPlayers, c + 1))}
            disabled={count >= game.maxPlayers}
            className="h-12 w-12 shrink-0 rounded-xl border border-line bg-raised text-xl active:bg-line disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-6 flex-1">
        <label className="text-sm font-medium">Seats</label>
        <p className="mt-0.5 mb-2 text-xs text-muted">
          In physical seating order — adjacency matters in play. Blank names become P1, P2, …
        </p>
        <div className="space-y-2">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">{i + 1}</span>
              <input
                value={names[i] ?? ''}
                onChange={(e) => setName(i, e.target.value)}
                placeholder={`P${i + 1}`}
                autoComplete="off"
                autoCorrect="off"
                className="min-w-0 flex-1 rounded-xl border border-line bg-raised px-3 py-2.5 text-ink placeholder:text-muted/60 focus:border-info focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={start}
        disabled={!canStart}
        className="sticky bottom-4 mt-6 w-full rounded-xl bg-info py-3.5 font-semibold text-bg active:opacity-80 disabled:opacity-30"
      >
        Start session
      </button>

      <ImportSheet open={importing} onClose={() => setImporting(false)} onImported={afterImport} />
    </div>
  )
}

function ImportSheet({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: (gameId: string) => void
}) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  function doImport() {
    const res = importConfigText(text)
    setResult(res)
    if (res.ok) {
      setText('')
      onImported(res.gameId)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Import a game">
      <div className="space-y-3">
        <p className="text-xs text-muted">
          Paste a game (with <code>phases</code>), a script (with <code>roles</code>), or a{' '}
          <code>{'{ game, script }'}</code> bundle. It’s validated before it’s added — nothing is
          saved if anything is wrong. Manage or delete installed games in Settings.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "game": { … }, "script": { … } }'
          spellCheck={false}
          className="h-40 w-full rounded-xl border border-line bg-raised px-3 py-2.5 font-mono text-xs text-ink placeholder:text-muted/60 focus:border-info focus:outline-none"
        />

        {result && !result.ok && (
          <ul className="space-y-1 rounded-xl border border-evil/40 bg-evil/10 px-3 py-2 text-xs text-evil">
            {result.errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}
        {result && result.ok && (
          <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-xs text-good">
            Imported {result.imported.join(' and ')}.
          </p>
        )}

        <button
          onClick={doImport}
          disabled={text.trim().length === 0}
          className="w-full rounded-xl bg-info py-3 font-semibold text-bg active:opacity-80 disabled:opacity-30"
        >
          Validate &amp; import
        </button>
      </div>
    </Sheet>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'rounded-xl border px-3 py-2 text-sm font-medium',
        selected ? 'border-info bg-info/15 text-ink' : 'border-line bg-raised text-muted active:bg-line',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

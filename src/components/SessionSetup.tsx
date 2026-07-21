import { useState } from 'react'
import { DEFAULT_GAME_ID, DEFAULT_SCRIPT_ID, getGame, getScript } from '../config'
import { useStore } from '../store'

export function SessionSetup() {
  const createSession = useStore((s) => s.createSession)

  const game = getGame(DEFAULT_GAME_ID)
  const script = getScript(DEFAULT_SCRIPT_ID)

  const [count, setCount] = useState(8)
  const [names, setNames] = useState<string[]>(() => Array(15).fill(''))

  function setName(i: number, value: string) {
    setNames((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  function start() {
    createSession({
      gameId: game.id,
      scriptId: script.id,
      names: names.slice(0, count),
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <h1 className="text-xl font-semibold">New session</h1>
      <p className="mt-1 text-sm text-muted">
        {game.name} · {script.name}
      </p>

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
              <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">
                {i + 1}
              </span>
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
        className="sticky bottom-4 mt-6 w-full rounded-xl bg-info py-3.5 font-semibold text-bg active:opacity-80"
      >
        Start session
      </button>
    </div>
  )
}

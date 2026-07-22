import { useState, type ReactNode } from 'react'
import { getGame, getScript } from '../config'
import type { PlayerId, Session } from '../types'
import { AssertionSheet } from './AssertionSheet'
import { DiagramView } from './DiagramView'
import { LogView } from './LogView'
import { PlayerList } from './PlayerList'
import { RoleTagSheet } from './RoleTagSheet'
import { RoundBar } from './RoundBar'

type Tab = 'diagram' | 'players' | 'log'

export function GameScreen({ session }: { session: Session }) {
  const game = getGame(session.gameId)
  const script = getScript(session.scriptId)

  const [tab, setTab] = useState<Tab>('diagram')
  const [logging, setLogging] = useState(false)
  const [taggingPlayer, setTaggingPlayer] = useState<PlayerId | null>(null)

  return (
    <div className="min-h-dvh">
      <RoundBar session={session} />

      <div className="mx-auto max-w-md px-3">
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
          <TabButton active={tab === 'diagram'} onClick={() => setTab('diagram')}>
            Diagram
          </TabButton>
          <TabButton active={tab === 'players'} onClick={() => setTab('players')}>
            Players
          </TabButton>
          <TabButton active={tab === 'log'} onClick={() => setTab('log')}>
            Log{session.assertions.length > 0 && ` · ${session.assertions.length}`}
          </TabButton>
        </div>

        {/* Bottom padding clears the sticky log button. */}
        <main className="mt-3 pb-32">
          {tab === 'diagram' && (
            <DiagramView
              session={session}
              game={game}
              script={script}
              onTagPlayer={setTaggingPlayer}
            />
          )}
          {tab === 'players' && (
            <PlayerList
              session={session}
              game={game}
              script={script}
              onTagPlayer={setTaggingPlayer}
            />
          )}
          {tab === 'log' && <LogView session={session} game={game} script={script} />}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          onClick={() => setLogging(true)}
          className="mx-auto block w-full max-w-md rounded-xl bg-info py-3.5 font-semibold text-bg active:opacity-80"
        >
          + Log what was said
        </button>
      </div>

      <AssertionSheet
        open={logging}
        onClose={() => setLogging(false)}
        session={session}
        game={game}
        script={script}
      />

      <RoleTagSheet
        playerId={taggingPlayer}
        onClose={() => setTaggingPlayer(null)}
        session={session}
        game={game}
        script={script}
      />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-lg py-2 text-sm font-medium',
        active ? 'bg-raised text-ink' : 'text-muted active:bg-raised/60',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

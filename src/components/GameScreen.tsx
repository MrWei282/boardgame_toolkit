import { useState, type ReactNode } from 'react'
import { getGame, getScript } from '../config'
import { projectSession, rankOf } from '../projections'
import type { PlayerId, Session } from '../types'
import { AssertionSheet } from './AssertionSheet'
import { DiagramView } from './DiagramView'
import { EventSheet } from './EventSheet'
import { LogView } from './LogView'
import { PlayerList } from './PlayerList'
import { RoleTagSheet } from './RoleTagSheet'
import { RoundBar } from './RoundBar'
import { Timeline } from './Timeline'

type Tab = 'diagram' | 'players' | 'log'

export function GameScreen({ session }: { session: Session }) {
  const game = getGame(session.gameId)
  const script = getScript(session.scriptId)

  const [tab, setTab] = useState<Tab>('diagram')
  const [logging, setLogging] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [eventPreset, setEventPreset] = useState<PlayerId | null>(null)
  const [taggingPlayer, setTaggingPlayer] = useState<PlayerId | null>(null)

  // Timeline viewpoint. null = live (follow the game); a rank = reviewing the past.
  const currentRank = rankOf(session.round, session.phase)
  const [pinnedRank, setPinnedRank] = useState<number | null>(null)
  const viewRank = pinnedRank !== null && pinnedRank < currentRank ? pinnedRank : currentRank
  const isLive = viewRank >= currentRank

  // Rendering tabs see the session as of the viewpoint; entry sheets always act
  // on the live session (new entries are stamped at the current phase).
  const view = isLive ? session : projectSession(session, viewRank)

  function openEventFor(id: PlayerId | null) {
    setEventPreset(id)
    setEventOpen(true)
  }

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
            Log{session.assertions.length + session.events.length > 0 && ` · ${session.assertions.length + session.events.length}`}
          </TabButton>
        </div>

        <Timeline currentRank={currentRank} viewRank={viewRank} onSelect={(r) => setPinnedRank(r)} />

        {/* Bottom padding clears the sticky log buttons. */}
        <main className="mt-3 pb-32">
          {tab === 'diagram' && (
            <DiagramView session={view} game={game} script={script} onTagPlayer={setTaggingPlayer} />
          )}
          {tab === 'players' && (
            <PlayerList
              session={view}
              game={game}
              script={script}
              onTagPlayer={setTaggingPlayer}
              onEditLife={openEventFor}
            />
          )}
          {tab === 'log' && (
            <LogView session={view} game={game} script={script} highlightRank={viewRank} />
          )}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          {isLive ? (
            <div className="flex gap-2">
              <button
                onClick={() => setLogging(true)}
                className="flex-1 rounded-xl bg-info py-3.5 font-semibold text-bg active:opacity-80"
              >
                + What was said
              </button>
              <button
                onClick={() => openEventFor(null)}
                className="flex-1 rounded-xl border border-line bg-raised py-3.5 font-semibold text-ink active:bg-line"
              >
                + What happened
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPinnedRank(currentRank)}
              className="w-full rounded-xl border border-info/40 bg-info/10 py-3.5 font-medium text-info active:bg-info/20"
            >
              Return to live to log
            </button>
          )}
        </div>
      </div>

      <AssertionSheet
        open={logging}
        onClose={() => setLogging(false)}
        session={session}
        game={game}
        script={script}
      />

      <EventSheet
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        session={session}
        presetSubject={eventPreset}
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

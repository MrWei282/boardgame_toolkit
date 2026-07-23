import { useState, type ReactNode } from 'react'
import { getGame, getScript } from '../config'
import { aliveCount, phaseFromRank, projectSession, rankOf } from '../projections'
import { useStore } from '../store'
import type { Assertion, GameEvent, PlayerId, Session } from '../types'
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

  const nextPhase = useStore((s) => s.nextPhase)
  const prevPhase = useStore((s) => s.prevPhase)

  const [tab, setTab] = useState<Tab>('diagram')
  // null = closed. Otherwise the sheet is open, editing an entry or creating one.
  const [said, setSaid] = useState<{ editing: Assertion | null } | null>(null)
  const [happened, setHappened] = useState<{ editing: GameEvent | null; preset: PlayerId | null } | null>(null)
  const [taggingPlayer, setTaggingPlayer] = useState<PlayerId | null>(null)

  // Timeline viewpoint. null = live (follow the game); a rank = reviewing the past.
  const currentRank = rankOf(session.round, session.phase)
  const [pinnedRank, setPinnedRank] = useState<number | null>(null)
  const viewRank = pinnedRank !== null && pinnedRank < currentRank ? pinnedRank : currentRank
  const isLive = viewRank >= currentRank

  // Rendering tabs and entry sheets both see the session as of the viewpoint, and
  // new entries are stamped into that phase — so you can log into a past night.
  const view = isLive ? session : projectSession(session, viewRank)
  const viewPhase = phaseFromRank(viewRank)

  // The live phase can be undone only while it holds nothing — that reverses an
  // accidental advance without ever removing a phase that has content.
  const hasEntriesAtCurrent =
    session.assertions.some((a) => rankOf(a.round, a.phase) === currentRank) ||
    session.events.some((e) => rankOf(e.round, e.phase) === currentRank) ||
    session.roleTags.some((t) => rankOf(t.round, t.phase) === currentRank)
  const canRetract = currentRank > 2 && !hasEntriesAtCurrent

  function openEventFor(id: PlayerId | null) {
    setHappened({ editing: null, preset: id })
  }

  return (
    <div className="min-h-dvh">
      <RoundBar
        round={viewPhase.round}
        phase={viewPhase.phase}
        alive={aliveCount(view)}
        total={session.players.length}
        reviewing={!isLive}
      />

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

        <Timeline
          currentRank={currentRank}
          viewRank={viewRank}
          onSelect={(r) => setPinnedRank(r >= currentRank ? null : r)}
          onAdvance={() => {
            nextPhase()
            setPinnedRank(null)
          }}
          onRetract={() => {
            prevPhase()
            setPinnedRank(null)
          }}
          canRetract={canRetract}
        />

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
            <LogView
              session={view}
              game={game}
              script={script}
              highlightRank={viewRank}
              onEditAssertion={(a) => setSaid({ editing: a })}
              onEditEvent={(e) => setHappened({ editing: e, preset: null })}
            />
          )}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            onClick={() => setSaid({ editing: null })}
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
      </div>

      <AssertionSheet
        open={said !== null}
        onClose={() => setSaid(null)}
        session={view}
        game={game}
        script={script}
        at={viewPhase}
        editing={said?.editing ?? null}
      />

      <EventSheet
        open={happened !== null}
        onClose={() => setHappened(null)}
        session={view}
        presetSubject={happened?.preset ?? null}
        at={viewPhase}
        editing={happened?.editing ?? null}
      />

      <RoleTagSheet
        playerId={taggingPlayer}
        onClose={() => setTaggingPlayer(null)}
        session={view}
        game={game}
        script={script}
        at={viewPhase}
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

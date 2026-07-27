import { useEffect, useState, type ReactNode } from 'react'
import { getGame, getScript } from '../config'
import { aliveCount, FIRST_RANK, phaseFromRank, projectSession, rankOf } from '../projections'
import { useStore } from '../store'
import type { Assertion, GameEvent, PlayerId, Session } from '../types'
import { AssertionSheet } from './AssertionSheet'
import { DiagramView } from './DiagramView'
import { EventSheet } from './EventSheet'
import { LogView } from './LogView'
import { NominationSheet } from './NominationSheet'
import { PlayerList } from './PlayerList'
import { ReviewTab } from './ReviewTab'
import { RoleTagSheet } from './RoleTagSheet'
import { RoundBar } from './RoundBar'
import { Timeline } from './Timeline'

type Tab = 'diagram' | 'players' | 'log' | 'review'

export function GameScreen({ session }: { session: Session }) {
  const game = getGame(session.gameId)
  const script = getScript(session.scriptId)

  const nextPhase = useStore((s) => s.nextPhase)
  const prevPhase = useStore((s) => s.prevPhase)

  const [tab, setTab] = useState<Tab>('diagram')
  // Ending a game (or opening a finished one) drops you into the review.
  const ended = session.endedAt !== undefined
  useEffect(() => {
    if (ended) setTab('review')
  }, [ended])
  // null = closed. Otherwise a sheet is open, editing an entry or creating one.
  // said/nominating carry optional presets so a token's quick-record can pre-fill
  // the speaker (and, for an assertion, the relation).
  const [said, setSaid] = useState<{ editing: Assertion | null; speaker?: PlayerId; relation?: string } | null>(null)
  const [nominating, setNominating] = useState<{ editing: Assertion | null; nominator?: PlayerId } | null>(null)
  const [happened, setHappened] = useState<{ editing: GameEvent | null; preset: PlayerId | null; lifeEdit?: boolean } | null>(null)
  const [taggingPlayer, setTaggingPlayer] = useState<PlayerId | null>(null)

  // The game's nomination relation (whichever collects votes) drives both the
  // dedicated Nomination entry and routing a nomination's edit to its own sheet.
  const nominationRelId = game.relations.find((r) => r.collectsVotesAs)?.id ?? null

  // Editing a nomination opens the nomination sheet; anything else the assertion sheet.
  function editAssertion(a: Assertion) {
    if (nominationRelId && a.relation === nominationRelId) setNominating({ editing: a })
    else setSaid({ editing: a })
  }
  // Quick-record from a tapped token — pre-fill the player as speaker/nominator.
  function quickAssertion(speaker: PlayerId, relation: string) {
    setSaid({ editing: null, speaker, relation })
  }
  function quickNominate(nominator: PlayerId) {
    setNominating({ editing: null, nominator })
  }

  // Timeline viewpoint. null = live (follow the game); a rank = reviewing the past.
  const currentRank = rankOf(game, session.round, session.phase)
  const [pinnedRank, setPinnedRank] = useState<number | null>(null)
  const viewRank = pinnedRank !== null && pinnedRank < currentRank ? pinnedRank : currentRank
  const isLive = viewRank >= currentRank

  // Rendering tabs and entry sheets both see the session as of the viewpoint, and
  // new entries are stamped into that phase — so you can log into a past night.
  const view = isLive ? session : projectSession(game, session, viewRank)
  const viewPhase = phaseFromRank(game, viewRank)

  // The live phase can be undone only while it holds nothing — that reverses an
  // accidental advance without ever removing a phase that has content.
  const hasEntriesAtCurrent =
    session.assertions.some((a) => rankOf(game, a.round, a.phase) === currentRank) ||
    session.events.some((e) => rankOf(game, e.round, e.phase) === currentRank) ||
    session.roleTags.some((t) => rankOf(game, t.round, t.phase) === currentRank)
  const canRetract = currentRank > FIRST_RANK && !hasEntriesAtCurrent

  // lifeEdit true only when the intent is toggling life (the Players tab 💀 control),
  // where defaulting to died/revived saves a tap. A generic event (quick-record, the
  // "+ What happened" button) defaults to no life change.
  function openEventFor(id: PlayerId | null, lifeEdit = false) {
    setHappened({ editing: null, preset: id, lifeEdit })
  }

  return (
    <div className="min-h-dvh">
      <RoundBar
        game={game}
        round={viewPhase.round}
        phase={viewPhase.phase}
        alive={aliveCount(game, view)}
        total={session.players.length}
        reviewing={!isLive}
        ended={session.endedAt !== undefined}
      />

      <div className="mx-auto max-w-md px-3">
        <div className={`mt-3 grid ${ended ? 'grid-cols-4' : 'grid-cols-3'} gap-1 rounded-xl border border-line bg-surface p-1`}>
          <TabButton active={tab === 'diagram'} onClick={() => setTab('diagram')}>
            Diagram
          </TabButton>
          <TabButton active={tab === 'players'} onClick={() => setTab('players')}>
            Players
          </TabButton>
          <TabButton active={tab === 'log'} onClick={() => setTab('log')}>
            Log{session.assertions.length + session.events.length > 0 && ` · ${session.assertions.length + session.events.length}`}
          </TabButton>
          {ended && (
            <TabButton active={tab === 'review'} onClick={() => setTab('review')}>
              Review
            </TabButton>
          )}
        </div>

        {/* The timeline drives live play; the review is timeless, so hide it there. */}
        {tab !== 'review' && (
          <Timeline
            game={game}
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
        )}

        {/* Bottom padding clears the sticky log buttons (now two rows tall). */}
        <main className="mt-3 pb-40">
          {tab === 'diagram' && (
            <DiagramView
              session={view}
              game={game}
              script={script}
              onTagPlayer={setTaggingPlayer}
              onEditAssertion={editAssertion}
              onEditEvent={(e) => setHappened({ editing: e, preset: null })}
              onQuickAssertion={quickAssertion}
              onQuickNominate={nominationRelId ? quickNominate : undefined}
              onQuickEvent={openEventFor}
              at={viewPhase}
            />
          )}
          {tab === 'players' && (
            <PlayerList
              session={view}
              game={game}
              script={script}
              onTagPlayer={setTaggingPlayer}
              onEditLife={(id) => openEventFor(id, true)}
              at={viewPhase}
            />
          )}
          {tab === 'log' && (
            <LogView
              session={view}
              game={game}
              script={script}
              highlightRank={viewRank}
              onEditAssertion={editAssertion}
              onEditEvent={(e) => setHappened({ editing: e, preset: null })}
            />
          )}
          {/* The review reads the whole game, not the timeline slice. */}
          {tab === 'review' && <ReviewTab session={session} game={game} script={script} />}
        </main>
      </div>

      {/* Logging entry points belong to play, not the post-game review. */}
      {tab !== 'review' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-md flex-col gap-2">
            {/* Two levels so three actions don't crowd one row: the frequent "what
                was said" on top, then the two structured logs (nomination + event)
                beneath. Nomination only appears when the game collects votes. */}
            <button
              onClick={() => setSaid({ editing: null })}
              className="rounded-xl bg-info py-3 font-semibold text-bg active:opacity-80"
            >
              + Speech
            </button>
            <div className="flex gap-2">
              {nominationRelId && (
                <button
                  onClick={() => setNominating({ editing: null })}
                  className="flex-1 rounded-xl border border-neutral/50 bg-neutral/10 py-2.5 font-semibold text-neutral active:bg-neutral/20"
                >
                  + Nomination
                </button>
              )}
              <button
                onClick={() => openEventFor(null)}
                className="flex-1 rounded-xl border border-line bg-raised py-2.5 font-semibold text-ink active:bg-line"
              >
                + Event
              </button>
            </div>
          </div>
        </div>
      )}

      <AssertionSheet
        open={said !== null}
        onClose={() => setSaid(null)}
        session={view}
        game={game}
        script={script}
        at={viewPhase}
        editing={said?.editing ?? null}
        presetSpeaker={said?.speaker ?? null}
        presetRelation={said?.relation ?? null}
      />

      <NominationSheet
        open={nominating !== null}
        onClose={() => setNominating(null)}
        session={view}
        game={game}
        at={viewPhase}
        editing={nominating?.editing ?? null}
        presetNominator={nominating?.nominator ?? null}
      />

      <EventSheet
        open={happened !== null}
        onClose={() => setHappened(null)}
        session={view}
        game={game}
        presetSubject={happened?.preset ?? null}
        lifeEdit={happened?.lifeEdit ?? false}
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

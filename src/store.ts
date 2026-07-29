import { create } from 'zustand'
import { getGame, registerImportedConfigs } from './config'
import type { ParsedBundle } from './share'
import { loadAll, saveAll, VERSION } from './storage'
import type { Assertion, GameConfig, GameEvent, Phase, PlayerId, ReadTag, Reveal, RoleId, RoleTag, Session } from './types'
import { uid } from './uid'

/** The phase a game opens on: its first setup phase, or the first cycle phase. */
function openingPhase(game: GameConfig): { round: number; phase: Phase } {
  const setup = game.phases.setup ?? []
  return setup.length ? { round: 0, phase: setup[0].id } : { round: 1, phase: game.phases.cycle[0].id }
}

/**
 * Step one phase forward (`dir` 1) or back (`dir` -1) through a game's structure:
 * within setup, from setup into the cycle, and around the repeating cycle. The
 * clock never steps back past the opening phase. Replaces the old hardcoded
 * night↔day toggle so any game's phase list works.
 */
function stepPhase(game: GameConfig, round: number, phase: Phase, dir: 1 | -1): { round: number; phase: Phase } {
  const setup = game.phases.setup ?? []
  const cycle = game.phases.cycle
  if (round === 0) {
    const i = setup.findIndex((p) => p.id === phase)
    if (dir === 1) return i < setup.length - 1 ? { round: 0, phase: setup[i + 1].id } : { round: 1, phase: cycle[0].id }
    return i > 0 ? { round: 0, phase: setup[i - 1].id } : { round, phase } // at the opening
  }
  const j = Math.max(0, cycle.findIndex((p) => p.id === phase))
  if (dir === 1) {
    return j < cycle.length - 1 ? { round, phase: cycle[j + 1].id } : { round: round + 1, phase: cycle[0].id }
  }
  if (j > 0) return { round, phase: cycle[j - 1].id }
  if (round > 1) return { round: round - 1, phase: cycle[cycle.length - 1].id }
  if (setup.length) return { round: 0, phase: setup[setup.length - 1].id }
  return { round, phase } // at the opening, no setup to fall back to
}

type NewAssertion = {
  speaker: PlayerId
  relation: string
  targets: PlayerId[]
  roles?: RoleId[]
  note?: string
}

type NewEvent = {
  label: string
  subjects: PlayerId[]
  setsAlive?: boolean
  note?: string
}

/** Which phase to stamp a new entry into. Defaults to the live phase; the
 *  timeline passes the phase being viewed so you can log into the past. */
type PhaseRef = { round: number; phase: Phase }

type Store = {
  hydrated: boolean
  sessions: Record<string, Session>
  currentSessionId: string | null

  hydrate: () => Promise<void>
  createSession: (input: { gameId: string; scriptId: string; names: string[] }) => void
  /** Make an existing session current — resume an ongoing game or review a finished one. */
  openSession: (id: string) => void
  closeSession: () => void
  /** Mark the current game finished (stays open so the review can be filled in). */
  endSession: () => void
  /** Toggle a session's finished flag from the home list. */
  setEnded: (id: string, ended: boolean) => void
  /** Record end-of-game ground truth; also marks the game finished. */
  setTruth: (truth: Reveal[]) => void
  deleteSession: (id: string) => void
  /**
   * Merge a parsed bundle into local state (see share.ts). Configs upsert by id;
   * each session imports as a *new copy* on an id collision, so importing never
   * overwrites the user's own game data.
   */
  importBundle: (bundle: ParsedBundle) => void

  nextPhase: () => void
  prevPhase: () => void

  addAssertion: (input: NewAssertion, at?: PhaseRef) => void
  updateAssertion: (id: string, patch: Partial<Assertion>) => void
  deleteAssertion: (id: string) => void
  setRoleTag: (playerId: PlayerId, roleIds: RoleId[], at?: PhaseRef) => void
  /**
   * Stamp my alignment read on a player (append-only, latest wins). -2..+2; sign =
   * evil/good, magnitude = confidence. lean 0 is a deliberate *neutral* read (a
   * third-party call). `null` clears the read — appended as a `cleared` entry, not
   * a delete, so a past phase still shows the earlier read.
   */
  setRead: (playerId: PlayerId, lean: number | null, at?: PhaseRef) => void

  /**
   * Log a nomination plus a vote per voter, in one entry. `nominees` is an array
   * so a single-target lynch (BotC) and a multi-player team proposal (Avalon)
   * share one path — the votes roll up under the nomination either way.
   */
  addNomination: (
    input: { nominator: PlayerId; nominees: PlayerId[]; relation: string; voteRelation: string; voters: PlayerId[]; note?: string },
    at?: PhaseRef,
  ) => void

  /**
   * Edit a nomination in place, reconciling its vote children against the new
   * voter list — add votes for new voters, drop votes for removed ones, and keep
   * the rest pointing at the (possibly changed) nominees. This is what lets the
   * edit sheet change the vote history, not just who/whom.
   */
  updateNomination: (
    id: string,
    input: { nominator: PlayerId; nominees: PlayerId[]; voteRelation: string; voters: PlayerId[]; note?: string },
  ) => void

  addEvent: (input: NewEvent, at?: PhaseRef) => void
  updateEvent: (id: string, patch: Partial<GameEvent>) => void
  deleteEvent: (id: string) => void
}

export const useStore = create<Store>()((set, get) => {
  /** Applies a change to the current session and persists the result. */
  function updateSession(fn: (session: Session) => Session) {
    const { sessions, currentSessionId } = get()
    if (!currentSessionId) return
    const current = sessions[currentSessionId]
    if (!current) return

    const next = { ...sessions, [currentSessionId]: fn(current) }
    set({ sessions: next })
    void saveAll({ version: VERSION, currentSessionId, sessions: next })
  }

  return {
    hydrated: false,
    sessions: {},
    currentSessionId: null,

    hydrate: async () => {
      const data = await loadAll()
      set({
        hydrated: true,
        sessions: data.sessions,
        currentSessionId: data.currentSessionId,
      })
    },

    createSession: ({ gameId, scriptId, names }) => {
      // A game opens on the first phase its config declares (setup night, or the
      // first cycle phase) — no longer hardcoded to BotC's night 1.
      const opening = openingPhase(getGame(gameId))
      const session: Session = {
        id: uid(),
        createdAt: Date.now(),
        gameId,
        scriptId,
        round: opening.round,
        phase: opening.phase,
        players: names.map((name, i) => ({
          id: uid(),
          seat: i,
          name: name.trim() || `P${i + 1}`,
        })),
        assertions: [],
        roleTags: [],
        reads: [],
        events: [],
      }
      const sessions = { ...get().sessions, [session.id]: session }
      set({ sessions, currentSessionId: session.id })
      void saveAll({ version: VERSION, currentSessionId: session.id, sessions })
    },

    openSession: (id) => {
      const { sessions } = get()
      if (!sessions[id]) return
      set({ currentSessionId: id })
      void saveAll({ version: VERSION, currentSessionId: id, sessions })
    },

    closeSession: () => {
      // Keeps the session in storage — closing is leaving the game, not deleting it.
      const { sessions } = get()
      set({ currentSessionId: null })
      void saveAll({ version: VERSION, currentSessionId: null, sessions })
    },

    endSession: () =>
      // Stamp finished but stay in the session — GameScreen reveals the Review tab
      // so the post-game truth can be entered straight away.
      updateSession((s) => ({ ...s, endedAt: s.endedAt ?? Date.now() })),

    setTruth: (truth) =>
      updateSession((s) => ({ ...s, truth, endedAt: s.endedAt ?? Date.now() })),

    setEnded: (id, ended) => {
      const { sessions, currentSessionId } = get()
      const target = sessions[id]
      if (!target) return
      const next = { ...sessions, [id]: { ...target, endedAt: ended ? (target.endedAt ?? Date.now()) : undefined } }
      set({ sessions: next })
      void saveAll({ version: VERSION, currentSessionId, sessions: next })
    },

    deleteSession: (id) => {
      const { sessions, currentSessionId } = get()
      const next = { ...sessions }
      delete next[id]
      const nextCurrent = currentSessionId === id ? null : currentSessionId
      set({ sessions: next, currentSessionId: nextCurrent })
      void saveAll({ version: VERSION, currentSessionId: nextCurrent, sessions: next })
    },

    importBundle: (bundle) => {
      // Configs first, so imported sessions can resolve their game/script.
      registerImportedConfigs(bundle.games, bundle.scripts)
      const { sessions, currentSessionId } = get()
      const next = { ...sessions }
      for (const s of bundle.sessions) {
        // Never clobber an existing local session — a colliding id imports as a copy.
        const id = next[s.id] ? uid() : s.id
        next[id] = { ...s, id }
      }
      set({ sessions: next })
      void saveAll({ version: VERSION, currentSessionId, sessions: next })
      // Bundle settings (palette/language) are applied once those stores exist (7.3/7.4).
    },

    // Phase order comes from the game config now (see stepPhase).
    nextPhase: () =>
      updateSession((s) => ({ ...s, ...stepPhase(getGame(s.gameId), s.round, s.phase, 1) })),

    prevPhase: () =>
      updateSession((s) => ({ ...s, ...stepPhase(getGame(s.gameId), s.round, s.phase, -1) })),

    addAssertion: (input, at) =>
      updateSession((s) => {
        const assertion: Assertion = {
          id: uid(),
          round: at?.round ?? s.round,
          phase: at?.phase ?? s.phase,
          speaker: input.speaker,
          relation: input.relation,
          targets: input.targets,
          roles: input.roles?.length ? input.roles : undefined,
          note: input.note?.trim() || undefined,
          createdAt: Date.now(),
        }
        return { ...s, assertions: [...s.assertions, assertion] }
      }),

    updateAssertion: (id, patch) =>
      updateSession((s) => ({
        ...s,
        assertions: s.assertions.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      })),

    deleteAssertion: (id) =>
      updateSession((s) => ({
        ...s,
        assertions: s.assertions.filter((a) => a.id !== id),
      })),

    addNomination: (input, at) =>
      updateSession((s) => {
        const round = at?.round ?? s.round
        const phase = at?.phase ?? s.phase
        const base = Date.now()
        const nomination: Assertion = {
          id: uid(),
          round,
          phase,
          speaker: input.nominator,
          relation: input.relation,
          targets: input.nominees,
          note: input.note?.trim() || undefined,
          createdAt: base,
        }
        // One vote assertion per voter, all carrying the same nominees and linked
        // to this nomination by parentId. They render rolled up under the
        // nomination rather than as their own arrows. The parentId is what keeps
        // two nominations of the same target(s) in one phase from sharing votes.
        const votes: Assertion[] = input.voters.map((voter, i) => ({
          id: uid(),
          round,
          phase,
          speaker: voter,
          relation: input.voteRelation,
          targets: input.nominees,
          parentId: nomination.id,
          createdAt: base + 1 + i,
        }))
        return { ...s, assertions: [...s.assertions, nomination, ...votes] }
      }),

    updateNomination: (id, input) =>
      updateSession((s) => {
        const nomination = s.assertions.find((a) => a.id === id)
        if (!nomination) return s
        const wanted = new Set(input.voters)
        const isChildVote = (a: Assertion) => a.parentId === id && a.relation === input.voteRelation
        const existingVoters = new Set(s.assertions.filter(isChildVote).map((v) => v.speaker))

        const kept = s.assertions
          // Drop votes whose voter was removed.
          .filter((a) => !(isChildVote(a) && !wanted.has(a.speaker)))
          .map((a) => {
            if (a.id === id)
              return { ...a, speaker: input.nominator, targets: input.nominees, note: input.note?.trim() || undefined }
            // Kept votes follow the nominees if those changed.
            if (isChildVote(a)) return { ...a, targets: input.nominees }
            return a
          })

        const base = Date.now()
        const added: Assertion[] = input.voters
          .filter((v) => !existingVoters.has(v))
          .map((voter, i) => ({
            id: uid(),
            round: nomination.round,
            phase: nomination.phase,
            speaker: voter,
            relation: input.voteRelation,
            targets: input.nominees,
            parentId: id,
            createdAt: base + i,
          }))

        return { ...s, assertions: [...kept, ...added] }
      }),

    setRoleTag: (playerId, roleIds, at) =>
      updateSession((s) => {
        // Append-only: removing a guess writes a new entry with fewer roles
        // rather than mutating the old one, which is what gives the timeline
        // stage its history.
        const tag: RoleTag = {
          id: uid(),
          playerId,
          roleIds,
          round: at?.round ?? s.round,
          phase: at?.phase ?? s.phase,
          createdAt: Date.now(),
        }
        return { ...s, roleTags: [...s.roleTags, tag] }
      }),

    setRead: (playerId, lean, at) =>
      updateSession((s) => {
        // Append-only like roleTags: changing my read writes a new entry rather
        // than mutating the old one, so the timeline shows what I thought back then.
        // A null lean is a clear — recorded as a `cleared` entry for the same reason.
        const read: ReadTag = {
          id: uid(),
          playerId,
          lean: lean ?? 0,
          cleared: lean === null ? true : undefined,
          round: at?.round ?? s.round,
          phase: at?.phase ?? s.phase,
          createdAt: Date.now(),
        }
        return { ...s, reads: [...s.reads, read] }
      }),

    addEvent: (input, at) =>
      updateSession((s) => {
        const event: GameEvent = {
          id: uid(),
          round: at?.round ?? s.round,
          phase: at?.phase ?? s.phase,
          label: input.label.trim(),
          subjects: input.subjects,
          setsAlive: input.setsAlive,
          note: input.note?.trim() || undefined,
          createdAt: Date.now(),
        }
        return { ...s, events: [...s.events, event] }
      }),

    updateEvent: (id, patch) =>
      updateSession((s) => ({
        ...s,
        events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),

    // Deleting a death event just removes it from the log; aliveness is derived,
    // so the affected player is alive again on the next render with no extra work.
    deleteEvent: (id) =>
      updateSession((s) => ({
        ...s,
        events: s.events.filter((e) => e.id !== id),
      })),
  }
})

// --- selectors ---------------------------------------------------------------

export function useSession(): Session | null {
  return useStore((s) => (s.currentSessionId ? (s.sessions[s.currentSessionId] ?? null) : null))
}

/** All sessions, newest first — the home list reads this. */
export function useSessions(): Session[] {
  const sessions = useStore((s) => s.sessions)
  return Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt)
}

/** The current guess for a player — the latest entry, which may hold several roles. */
export function latestRoleTag(session: Session, playerId: PlayerId): RoleTag | undefined {
  let latest: RoleTag | undefined
  for (const tag of session.roleTags) {
    if (tag.playerId !== playerId) continue
    if (!latest || tag.createdAt >= latest.createdAt) latest = tag
  }
  return latest
}

export function currentRoleIds(session: Session, playerId: PlayerId): RoleId[] {
  return latestRoleTag(session, playerId)?.roleIds ?? []
}

// Near-twin of latestRoleTag/currentRoleIds — fold the two together if a third
// append-only-latest-wins tag ever appears; not worth a shared abstraction for two.
export function latestRead(session: Session, playerId: PlayerId): ReadTag | undefined {
  let latest: ReadTag | undefined
  for (const r of session.reads) {
    if (r.playerId !== playerId) continue
    if (!latest || r.createdAt >= latest.createdAt) latest = r
  }
  return latest
}

/**
 * My current alignment read on a player as a value: -2..+2 (0 = a neutral read),
 * or `null` when there is no read — either never read, or the latest entry cleared
 * it. The three-way distinction is what lets the token show a neutral halo but
 * nothing for no-read, and the post-mortem score a neutral read but skip no-read.
 */
export function currentReadValue(session: Session, playerId: PlayerId): number | null {
  const t = latestRead(session, playerId)
  return t && !t.cleared ? t.lean : null
}

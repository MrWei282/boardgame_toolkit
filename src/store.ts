import { create } from 'zustand'
import { loadAll, saveAll, VERSION } from './storage'
import type { Assertion, GameEvent, Phase, PlayerId, ReadTag, Reveal, RoleId, RoleTag, Session } from './types'
import { uid } from './uid'

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

  nextPhase: () => void
  prevPhase: () => void

  addAssertion: (input: NewAssertion, at?: PhaseRef) => void
  updateAssertion: (id: string, patch: Partial<Assertion>) => void
  deleteAssertion: (id: string) => void
  setRoleTag: (playerId: PlayerId, roleIds: RoleId[], at?: PhaseRef) => void
  /** Stamp my alignment read on a player (append-only, latest wins). 0 clears it. */
  setRead: (playerId: PlayerId, lean: number, at?: PhaseRef) => void

  /** Log a nomination plus a vote per voter, in one entry. */
  addNomination: (
    input: { nominator: PlayerId; nominee: PlayerId; relation: string; voteRelation: string; voters: PlayerId[]; note?: string },
    at?: PhaseRef,
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
      const session: Session = {
        id: uid(),
        createdAt: Date.now(),
        gameId,
        scriptId,
        // BotC opens on the first night, so that is where a session starts.
        round: 1,
        phase: 'night',
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

    // Phase order is night 1 -> day 1 -> night 2 -> day 2 ...
    nextPhase: () =>
      updateSession((s) =>
        s.phase === 'night'
          ? { ...s, phase: 'day' }
          : { ...s, phase: 'night', round: s.round + 1 },
      ),

    prevPhase: () =>
      updateSession((s) => {
        if (s.phase === 'day') return { ...s, phase: 'night' }
        if (s.round <= 1) return s
        return { ...s, phase: 'day', round: s.round - 1 }
      }),

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
          targets: [input.nominee],
          note: input.note?.trim() || undefined,
          createdAt: base,
        }
        // One vote assertion per voter, all targeting the nominee and linked to
        // this nomination by parentId. They render rolled up under the nomination
        // rather than as their own arrows. The parentId is what keeps two
        // nominations of the same nominee in one phase from sharing votes.
        const votes: Assertion[] = input.voters.map((voter, i) => ({
          id: uid(),
          round,
          phase,
          speaker: voter,
          relation: input.voteRelation,
          targets: [input.nominee],
          parentId: nomination.id,
          createdAt: base + 1 + i,
        }))
        return { ...s, assertions: [...s.assertions, nomination, ...votes] }
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
        const read: ReadTag = {
          id: uid(),
          playerId,
          lean,
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

/** My current alignment read on a player: -2..+2, 0 when unread. */
export function currentRead(session: Session, playerId: PlayerId): number {
  return latestRead(session, playerId)?.lean ?? 0
}

export function phaseLabel(round: number, phase: Phase): string {
  return `${phase === 'day' ? 'Day' : 'Night'} ${round}`
}

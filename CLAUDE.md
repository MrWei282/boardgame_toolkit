# Social Deduction Toolkit

A player-side (not Storyteller-side) note-taking tool for social deduction games.
Primary feature: a relationship diagram of players, derived from a log of things
said during the game. First target game is Blood on the Clocktower (BotC).

## The problem

Over a multi-session game night, memory blends between games and fatigue makes it
hard to track who said what about whom. Pen and paper works but nobody keeps it up.
Beginners have it worst — tracking relationships on top of learning mechanics.

## Landscape (why this exists)

- **Clocktracker** — post-game logging and stats. Records *that* you played, not what happened.
- **Pocket Grimoire / botc.app / townsquare** — Storyteller-side. Ground truth, not the social layer.
- **BotC Helper** — closest existing tool. Player-side board with tokens/votes/deaths. BotC-only, no relationship edges or claim provenance.

Nobody does player-side, cross-game, relationship-and-claim tracking. That is the gap.

## Core architectural decisions

**The event log is the source of truth. Everything else is a projection of it.**
The diagram is the log rendered at round N. The timeline is the log filtered by
round. History is the log persisted. Get the log right and the rest is view code.

**Edges are relationships. Tokens are state.**
If something describes what a player *is* (role guesses, info narrowing them to a
set of roles, alive/dead), it renders on the token. If it describes a link
*between* players (vouch/accuse/nominate/vote), it renders as an arrow. This
settles most "where does this go" questions.

**Structured logging, not arrow-dragging.**
Input is `[speaker] · [relation] · [target]` in as few taps as possible. Dragging
arrows may come later as an option. Input speed is the hard problem of this
project — during a live discussion phase the user has ~3 seconds of spare
attention, and looking at a phone at the table is itself a tell.

**Games are config, not code.**
Two layers: `game.json` (player count range, phase structure, relation vocabulary)
and `script.json` (role list), where script extends game. This is what makes the
tool generalisable beyond BotC and lets scripts be amended without code changes.

**Fixed circular layout — do not use a graph layout library.**
Players sit in a circle and seat order is game-critical in BotC (Empath, Chef,
adjacency effects). Node positions are trigonometry. A force layout (d3-force,
cytoscape, react-flow) would actively fight this by moving seats. Arrows are
quadratic bezier SVG paths. Hand-rolled, ~150 lines.

## Stack

- Vite + React + TypeScript, Tailwind, Zustand
- **No backend.** Static files, deployed to Cloudflare Pages. Offline-first —
  game venues have bad wifi.
- Storage: `localStorage` + JSON blob for now, behind a one-file `storage.ts`
  boundary so swapping to IndexedDB/Dexie later is contained.
- PWA via `vite-plugin-pwa`
- No accounts, no auth, no sync until stage 7.

Rejected: PyScript/Pyodide (10MB WASM, slow on mobile), Reflex/NiceGUI (need a
live server, kills offline-first), Streamlit (not a PWA, re-runs on interaction).

## Data model

```ts
type Assertion = {
  id: string
  round: number
  phase: 'day' | 'night'
  speaker: PlayerId
  relation: 'vouch' | 'accuse' | 'nominate' | 'vote' | 'info'
  targets: PlayerId[]     // UI writes 1 for now; array is load-bearing (see below)
  roles?: RoleId[]        // empty for vote/nominate
  note?: string           // the quote / evidence
  hidden?: boolean        // struck: reversible, excluded from ALL projections
  pinned?: boolean        // starred: floats to top of its phase group in the log
  parentId?: string       // vote → its nomination; the roll-up matches on this
}

type RoleTag = {          // append-only; UI shows the latest *entry* per player
  id: string
  playerId: PlayerId
  roleIds: RoleId[]       // simultaneous guesses, equal weight, no priority order
  round: number
  phase: 'day' | 'night'
}

type ReadTag = {          // my alignment read; append-only, latest entry wins
  id: string
  playerId: PlayerId
  lean: number            // -2..+2; sign = evil/good, magnitude = confidence, 0 = none
  round: number
  phase: 'day' | 'night'
}

type GameEvent = {         // things that happened, as opposed to things said
  id: string
  round: number
  phase: 'day' | 'night'
  label: string            // free text: "Executed", "Died at night", "Quest failed"
  subjects: PlayerId[]     // who it touched
  setsAlive?: boolean      // undefined = no life effect; false = dies; true = revives
  note?: string
  hidden?: boolean         // same strike/pin semantics as Assertion
  pinned?: boolean
}

type PlayerState = { id: PlayerId; seat: number; name: string }  // no `alive` — derived

type Reveal = {              // end-of-game ground truth, one per player
  playerId: PlayerId
  roleId?: RoleId            // actual role — optional; the alignment is the core input
  alignment: 'good' | 'evil' // stored EXPLICITLY, not derived — swaps/misregistration
}
```

Notes on why it looks like this:

- **`GameEvent` is deliberately generic — a free-text label plus subjects, no
  per-game event vocabulary in config.** Covers BotC deaths, Avalon quests, ability
  triggers and games we haven't modelled. The only structured consequence is
  `setsAlive` on the *event instance* (not a config flag), which is what lets
  resurrection be `setsAlive: true` and keeps games from needing a kill-vocabulary.
- **Aliveness is derived from events, never stored** (`projections.ts`): the latest
  life-affecting event per player wins, so the timeline shows true historical
  alive/dead and deleting/striking a death reverts it with no state to unwind. The
  invariant that makes this hold: struck or deleted entries count in *no* projection.
- **The timeline is a projection, not a mode.** `projectSession(session, rank)`
  returns a session slice with only what happened at or before a phase (`rankOf`
  orders phases: Night 1 < Day 1 < …). Rendering tabs receive that slice and stay
  unaware of time; entry sheets stamp new entries into the *viewed* phase (so you
  can log into a past night). The game clock only moves forward (Timeline's `+`);
  stepping back is offered only to undo an empty just-added phase.
- **Nomination/vote roll-up is config-driven, not BotC-hardcoded.** The nominate
  relation has `collectsVotesAs: 'vote'`; votes carry `edge: false` and `internal:
  true` (so they draw no arrow and aren't a standalone picker choice). Each vote
  points at its nomination via `parentId` and the log rolls up on that. This
  *replaced* an earlier heuristic (votes matched by same-nominee-same-phase), which
  silently pooled votes across two nominations of one nominee in a phase — a
  re-nomination duplicated the count. A vote can't be tied to a nomination without
  the link, so `parentId` is load-bearing, not speculative. `storage.ts` v3 backfills
  it on old votes (best-effort; that historical case is exactly the ambiguous one).
- **Gotcha — `opacity`/`transform`/`filter`/`backdrop-filter` creates a containing
  block *and* a stacking context.** Two bites: (1) a struck row dimmed with
  `opacity-45` trapped the entry menu's fixed popover below the bottom bar's
  z-index; (2) the RoundBar's `backdrop-blur` became the containing block for the
  Menu's `fixed inset-0` Sheet, cropping it to the header. Fix for overlays: the
  shared `Sheet` now `createPortal`s to `document.body`, so it's viewport-relative
  regardless of ancestors. Still: dim *content*, never a container that holds an
  overlay, and portal anything `fixed` that can render under a filtered ancestor.

- **`targets` is an array** even though v1 writes one element. BotC info roles break
  a strict triple immediately — Empath says "1 evil between P2 and P4", Fortune
  Teller says "P3 and P7 — no". The cost of retrofitting isn't the field, it's that
  `drawArrow(speaker, target)` assumptions spread through the render code.
- **`info` is one generic relation, deliberately not modelled per-role.** BotC info
  comes in a dozen structurally different shapes (Washerwoman: 2 players + 1 role;
  Chef: a number, no targets; Fortune Teller: yes/no). Modelling each ability would
  consume the whole schedule. Generic `targets` + `roles` + `note` covers
  Washerwoman/Librarian/Investigator/Undertaker/Ravenkeeper and degrades gracefully
  to a note for the rest. Specialise only after real play tells us which shapes matter.
- **`RoleTag` has no `source` field.** A *public* role claim is already expressible
  as an assertion targeting the speaker themselves (`speaker: P3, relation: info,
  targets: [P3], roles: [Empath]`). So claims live in the log; guesses live on the
  token. Adding `source` would duplicate what the log already does.
- **`RoleTag` is append-only with a round stamp** — ~3 lines more than a mutable
  field, and it hands the timeline stage the history it needs for free.
- **No polarity field.** The sign is baked into the verb (vouch vs accuse), and
  "not vouch" / "not accuse" overlap into mush. Polarity returns later as a property
  of specific script-level *info* relations (Fortune Teller yes/no), not of every
  assertion.
- **The suspicion primitive is `ReadTag` (stage 4, shipped), not an `unspoken`
  flag or an edge.** A subjective read — "I think P3 is evil" — has no second
  endpoint, so it is a node attribute, not an arrow. It is stored append-only with a
  round stamp *exactly like `RoleTag`* (latest entry per player wins, projected by
  rank) — conceptually a node attribute, implementationally a projected log, so the
  stage-5 post-mortem gets read history for free. It's a single signed `lean` scalar,
  deliberately: sign is the good↔evil axis (hardcoded for now — fine for BotC's binary
  alignment; a multi-team game makes it config-driven), magnitude is confidence. A
  read and a role *guess* are orthogonal channels and can disagree ("claims Empath,
  I read them evil"). `speaker` stays a plain PlayerId; no `'ME'` value reserved.
  `latestRead`/`currentRead` are near-twins of the RoleTag selectors — fold them
  together only if a third append-only-latest tag appears.
- **`Reveal.alignment` is stored, not derived from the role.** The post-mortem
  scores my read (a good/evil lean) against what a player *actually ended as*, and
  in BotC that can differ from the role's default team (a good player turned evil, a
  Recluse registering evil). Deriving alignment from `roleId` would score exactly
  those cases wrong. Picking a role only *prefills* the toggle (`roleAlignment` in
  `review.ts`, a tone heuristic); the user can override. The post-mortem itself is a
  pure projection — final `ReadTag`/`RoleTag` vs `truth`, no stored score
  (`review.ts` holds the math so the entry and scorecard views agree).

## Rendering rules

- Diagram draws edges for `edge: true` relations only: vouch (green), accuse (red),
  nominate (neutral). Info and vote never draw an edge — info renders on the token,
  votes roll up under their nomination. Outsiders are blue, distinct from townsfolk
  green (a `blue` tone; team colour will move to config later).
- Info renders beside the **speaker's** token. In focus mode, show every assertion
  *involving* the tapped player — as speaker or as target. One filter, no extra data.
- Role guesses render as N equal wedges on the token. ~2–3 are legible at 15 players
  on a phone; past that use a count badge with the full list in focus mode.
- **The token has four distinct visual channels, deliberately kept apart** so a
  player whose alignment/role swaps mid-game still reads cleanly: *wedge fills* =
  role guesses (team-toned); *outer halo ring* = my alignment read (green/red by
  sign, solid+thick for a sure ±2, dashed+thin for a leaning ±1 — a shape difference,
  not a brightness one, so the colour stays vivid); *border* = focus/alive; *inner
  chip* = the seat number, or 💀 when dead (death lives in the chip, the one non-role
  zone, so it never covers the wedges — the seat number moves to the name label).
- Repeated identical assertions collapse into one arrow with a `×N` badge at its
  midpoint (`deriveEdges` counts by speaker|relation|target; `geometry` returns the
  curve midpoint). Death is 💀 everywhere (token chip, focus pill, player list, entry
  sheets) — no `†` marker.
- Focus mode is the working view, not the full graph: tap a player, dim the rest,
  show only their edges. A full 15-player arrow graph is unreadable on a phone.
- **Diagram zoom is a ring *spread*, not a magnify.** It grows the ring radius so
  seats move apart while tokens keep their size — crowded arrows get real gap.
  Implemented by scaling `ringR` (tokens fixed) and rendering the SVG larger than
  its scroll box; wheel/pinch/`+`−`/drag/`Fit`. Crowded tables (12+) auto-spread.
  A plain magnify (tried first) kept the spacing and just cropped — rejected.
- **Per-entry actions are inline icons (`EntryActions`: edit ✎ / pin ★ / strike S̶ /
  delete ✕), used in both the log and the diagram focus panel** — a ⋯ sheet hid the
  actions from the focus panel and was a tap too many. Delete confirms (portaled).
- Dark by default. A bright phone at a dim table is an attention magnet.
- Portrait, one-handed, thumb-reachable.

## Staging

Ship one stage at a time; do not build a large prototype in one go.

1. **Done** — Config load, session setup, assertion log, relationship arrows, focus mode.
2. **Done** — Timeline scrubber over the log, round-diff highlight, and a generic
   `GameEvent` log (deaths and anything else). Alive/dead is *derived* from events
   (`setsAlive` per event, latest wins), never stored — see `projections.ts`.
   Alive/dead history was pulled forward to here rather than stage 3.
3. **Done (3.5)** — nomination/vote roll-up (votes stop drawing their own arrows;
   they group under the nomination, shown on tap), edit an entry, strikethrough
   (`hidden` on assertions/events, reversible, excluded from *all* projections),
   pin/star (floats to top of its phase group). Entry actions live behind a ⋯ menu.
4. **Done** — Subjective reads (`ReadTag`, a signed `lean` node attribute drawn as a
   token halo; inline `LeanControl`, no sheet). No refactor was needed — the RoleTag
   pattern absorbed it. Shipped alongside a vote roll-up fix (`parentId`) and a token
   visual pass (halo contrast, 💀 death in the chip, `×N` edge counts).
5. **Done** — History and review. *5.0*: a home/games list (the default when no
   game is open — sessions grouped by date into game-nights, ongoing/finished
   badge, open/reopen/delete), and a game lifecycle (`Session.endedAt`, "End game"
   in the RoundBar menu). This closed a real gap — a left/finished game used to be
   unreachable. *5.5*: end-of-game truth entry (`Session.truth: Reveal[]`, role +
   *explicit* alignment) and a read-vs-reality post-mortem scorecard, both on a
   "Review" tab that only appears once a game is finished. Both fields are optional
   and absent-tolerant, so still no migration (schema stays v3).
6. Second game (Werewolf or Deception) — the real test of the config abstraction.
   Expect to refactor.
7. Accounts, cloud sync, sharing.

Explicitly out of scope: multi-player shared sessions (turns a note-taking need
into a distributed-consistency problem), Storyteller/moderator features (crowded
market), stats dashboards (Clocktracker owns this; integrate later rather than compete).

## Constraints

- **Do not ship official BotC art.** Role icons, token art and parchment textures
  are licensed to TPI/Gstone. Interaction and layout patterns are fine to borrow
  (e.g. from clocktower.gstonegames.com); assets are not. Use role names as text.
- BotC is 5–15 players plus a Storyteller.
- Nomination rule: each player may nominate once per day and be nominated once per
  day. v1 records, it does not enforce — no rule validation.

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
}

type RoleTag = {          // append-only; UI shows the latest *entry* per player
  id: string
  playerId: PlayerId
  roleIds: RoleId[]       // simultaneous guesses, equal weight, no priority order
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
}

type PlayerState = { id: PlayerId; seat: number; name: string }  // no `alive` — derived
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
- **No suspicion primitive and no `unspoken` flag.** In v1 every assertion is a
  public speech act, so the flag carries no information. Subjective reads arrive at
  stage 4 as a *node attribute* (`myRead` on the player), not an edge — "I think P3
  is evil" has no second endpoint, so drawing it as an arrow is a category error.
  `speaker` stays a plain PlayerId; do not reserve a `'ME'` value yet.

## Rendering rules

- Diagram renders 4 relations only: vouch (green), accuse (red), nominate/vote
  (neutral-bold). Info never draws an edge.
- Info renders beside the **speaker's** token. In focus mode, show every assertion
  *involving* the tapped player — as speaker or as target. One filter, no extra data.
- Role guesses render as N equal wedges on the token. ~2–3 are legible at 15 players
  on a phone; past that use a count badge with the full list in focus mode.
- Focus mode is the working view, not the full graph: tap a player, dim the rest,
  show only their edges. A full 15-player arrow graph is unreadable on a phone.
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
4. Subjective reads layer (`myRead` as node attribute) — the suspicion primitive.
   Expected to need a refactor.
5. History and review: end-of-game truth entry, post-mortem comparing reads to
   reality, session archive, multi-session game-night grouping.
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

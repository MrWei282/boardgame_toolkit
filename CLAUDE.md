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
attention, and looking at a phone at the table is itself a tell. The fastest path
found so far (6.5, from real play): **tap the player, then the action** — the
centered token card leads with quick-record. Watch for chances to shave taps.

**Games are config, not code.** (Realised in iteration 6, validated by Avalon; made
*literally* true in iteration 7 — see below.) Two layers: `game.json` (player range,
phase structure, teams, relation vocabulary) and `script.json` (role list, extends a
game via `gameId`). Both live in `src/config/` and are registered in `config/index.ts`.
Key shapes (see `types.ts`):
- `GameConfig.phases: { setup?: PhaseDef[]; cycle: PhaseDef[] }` — `setup` runs once
  at game start (round 0; Avalon's opening night), `cycle` repeats every round from 1
  (BotC `[night, day]`). `PhaseDef = { id, label, short }`, in *play order* (array
  order is the phase order `rankOf` keys off). Ranks are computed, never stored.
- `TeamConfig` carries **`alignment`** (good/evil/neutral — the deduction axis, drives
  reads/scoring) **separately from `color`** (its display colour). They genuinely diverge:
  BotC outsiders are `alignment: good` but coloured blue so the two good-team groups read
  apart. **`color` is game-config data, not a fixed global slot** (iteration 7.3b): either
  a base-tone name (`good`/`evil`/`neutral`/`info`, tracking the palette + colourblind
  preset) or a literal hex (`#4c9aff`, its own hue). BotC: townsfolk `good`, demon `evil`,
  outsider `#4c9aff`, minion `#bf5af2`. `roleAlignment` reads `team.alignment`. (Legacy
  configs used a `tone` slot incl. the now-removed `blue`/`purple`; `withDefaults`
  normalises `tone`→`color`, mapping blue/purple to their old hexes — see config/index.ts.)
- `relations` is **optional** — omit it and the game inherits `DEFAULT_RELATIONS`
  (`config/index.ts`: the generic vouch/accuse/nominate/vote/info, with the fiddly
  vote roll-up wiring). `withDefaults()` fills it on every game entering the registry,
  so a config is usually just teams + roles + phases + players. A game overrides only
  when it needs a different vocabulary.
- **Users can import their own config.** `importConfigText` (paste a game / script /
  `{game,script}` bundle) runs it through `validate.ts` (never throws; path-prefixed
  errors) and, only if clean, registers it via the config store (`custom.ts`), read
  synchronously at module load so `getGame` sees it on first render.
- **There are no built-in games any more (iteration 7).** BotC/Avalon stopped being
  privileged, compiled-in built-ins and became *seed data*. `config/defaults.ts` holds
  the shipped JSON purely as a seed source; on first run `custom.ts` `seedDefaults`
  copies them into the one config store (localStorage key `deduction-config-store`,
  which also holds every imported config), tracking each seeded id in `seededIds`.
  After that they are ordinary entries — editable, **deletable**, exportable like any
  import; `GAMES`/`SCRIPTS` are just a `withDefaults`-applied projection of the store
  (`rebuildRegistries` after every mutation). `seededIds` is what makes deletion
  *stick*: a default whose id is already there is never auto-re-seeded, so removing
  BotC survives a reload; a newly *shipped* default (id not in `seededIds`) seeds once.
  `restoreDefaultConfigs()` re-adds the shipped defaults (the escape hatch when you've
  deleted them all — `SessionSetup` shows it in a zero-games empty state). The only
  surviving guard is integrity, not privilege: callers won't delete a config a saved
  session references (`getGame` throws by design). `isBuiltinGame/Script` are **gone**.
  Legacy note: the pre-7 `deduction-custom-configs` key is adopted once on first read.

**Fixed circular layout — do not use a graph layout library.**
Players sit in a circle and seat order is game-critical in BotC (Empath, Chef,
adjacency effects). Node positions are trigonometry. A force layout (d3-force,
cytoscape, react-flow) would actively fight this by moving seats. Arrows are
quadratic bezier SVG paths. Hand-rolled, ~150 lines.

## Stack

- Vite + React + TypeScript, Tailwind, Zustand
- **No backend.** Static files, deployed as a Cloudflare **Worker** (serves `dist/`
  as an SPA; `wrangler.jsonc`, name `boardgame-toolkit`) — **auto-deploys on push to
  `main`**. Offline-first — game venues have bad wifi.
- Storage: `localStorage` + JSON blob for now, behind a one-file `storage.ts`
  boundary so swapping to IndexedDB/Dexie later is contained. Three independent keys:
  `deduction-notes` (the versioned session blob, v3), `deduction-config-store` (all
  games/scripts + `seededIds`; see "no built-in games"), and `deduction-settings`
  (`settings.ts`: colour `palette`, later `language`). `share.ts` is the portability
  layer over all three — a `Bundle` (kind `botc-toolkit/bundle`) carrying any subset of
  sessions/configs/settings, exported to / imported from a JSON file (`parseBundle`
  never throws; sessions import as a copy on id-collision, configs upsert, settings
  replace on a full-backup import).
- PWA via `vite-plugin-pwa`
- No accounts, no auth, no sync until stage 7.

Rejected: PyScript/Pyodide (10MB WASM, slow on mobile), Reflex/NiceGUI (need a
live server, kills offline-first), Streamlit (not a PWA, re-runs on interaction).

## Data model

```ts
// Phase, RelationId, RoleId, TeamId are all `string` ids the game's config declares
// (they were fixed unions early on; opened up in iteration 6 — see "Games are config").

type Assertion = {
  id: string
  round: number
  phase: Phase            // a phase id from the game's config (`night`, `mission`, …)
  speaker: PlayerId
  relation: RelationId    // an id from the game's relations (or the default set)
  targets: PlayerId[]     // load-bearing array — multi-target vouch/accuse/nominate
  roles?: RoleId[]        // empty for vote/nominate
  note?: string           // the quote / evidence
  hidden?: boolean        // struck: reversible, excluded from ALL projections
  pinned?: boolean        // starred: floats to top of its phase group in the log
  parentId?: string       // vote → its nomination; the roll-up matches on this
  createdAt: number       // tiebreak within a phase; also orders life events
}

type RoleTag = {          // append-only; UI shows the latest *entry* per player
  id: string
  playerId: PlayerId
  roleIds: RoleId[]       // simultaneous guesses, equal weight, no priority order
  round: number
  phase: Phase
  createdAt: number
}

type ReadTag = {          // my alignment read; append-only, latest entry wins
  id: string
  playerId: PlayerId
  lean: number            // -2..+2; sign = evil/good, magnitude = confidence
  cleared?: boolean       // this entry clears the read (back to "no read"); see below
  round: number
  phase: Phase
  createdAt: number
}

type GameEvent = {         // things that happened, as opposed to things said
  id: string
  round: number
  phase: Phase
  label: string            // free text: "Executed", "Died at night", "Quest failed"
  subjects: PlayerId[]     // who it touched
  setsAlive?: boolean      // undefined = no life effect; false = dies; true = revives
  note?: string
  hidden?: boolean         // same strike/pin semantics as Assertion
  pinned?: boolean
  createdAt: number
}

type PlayerState = { id: PlayerId; seat: number; name: string }  // no `alive` — derived

type Alignment = 'good' | 'evil' | 'neutral'  // the shared deduction axis

type Reveal = {              // end-of-game ground truth, one per player
  playerId: PlayerId
  roleId?: RoleId            // actual role — optional; the alignment is the core input
  alignment: Alignment       // stored EXPLICITLY, not derived — swaps/misregistration
}

// Session = { id, createdAt, endedAt?, gameId, scriptId, round, phase, players[],
//   assertions[], roleTags[], reads[], events[], truth?: Reveal[] }. Storage is v3
// (localStorage, migrations chain v1→v2→v3). Iteration 6 added no schema version —
// new config lives outside the session blob (see custom config below).
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
  *(6.5)* **Nomination is its own entry category** — the game's nomination is whichever
  relation has `collectsVotesAs`, and it gets a dedicated `NominationSheet` (create +
  edit) instead of hiding in the generic relation picker; the bottom bar is two levels
  (Speech / Nomination / Event). `addNomination` takes `nominees[]` (one for a BotC
  lynch, several for an Avalon team proposal) and `updateNomination` reconciles the
  vote children on edit (add/drop/keep) — which fixed the bug where a nomination's
  edit couldn't change its votes. Nomination only appears when a game collects votes.
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
- **The suspicion primitive is `ReadTag` (stage 4), not an `unspoken` flag or an
  edge.** A subjective read has no second endpoint, so it is a node attribute, not an
  arrow. Stored append-only with a round stamp *exactly like `RoleTag`* (latest entry
  per player wins, projected by rank), so the post-mortem gets read history for free.
  A read and a role *guess* are orthogonal channels and can disagree ("claims Empath,
  I read them evil"). It's a signed `lean` scalar, magnitude = confidence. **The read
  has three states** (iteration 6.5): *no `ReadTag`* = never read; *a tag at lean 0* =
  a deliberate **neutral** read (a third-party call — yellow dashed halo); *a tag with
  `cleared`* = tapped off. `currentReadValue()` resolves these to `number | null`
  (null = no halo, unscored); clearing appends a `cleared` tag rather than deleting
  (append-only preserved, like role guesses clearing via an empty set). `LeanControl`
  taps-active-to-clear; `scoreRead(number | null, actual)` scores 3-way. The good↔evil
  poles are still hardcoded (fine for the binary axis all target games share).
- **`Reveal.alignment` is stored, not derived from the role.** The post-mortem
  scores my read against what a player *actually ended as*, which can differ from the
  role's default team (a good player turned evil, a Recluse registering evil, a role
  that becomes a neutral third party). Deriving alignment from `roleId` would score
  those wrong. Picking a role only *prefills* the toggle (`roleAlignment` reads
  `team.alignment` now); the user can override — the truth toggle is three-way
  (good/neutral/evil). A player who ended `neutral` is off the good↔evil read axis, so
  `scoreRead` leaves that read unscored rather than counting it wrong. The post-mortem
  is a pure projection (`review.ts` holds the math so entry and scorecard agree).

## Rendering rules

- Diagram draws arrows for `edge: true` relations: vouch (green), accuse (red),
  nominate (neutral/yellow), and — since 6.5 — **info** (blue). A self-directed entry
  (a role *claim*, speaker == target) draws no self-loop: `deriveEdges` skips
  `target === speaker`. Votes never draw an edge — they roll up under their
  nomination. **Relations can be toggled off** the diagram (`hiddenRelations` in
  `DiagramView`, filtering `deriveEdges`) to declutter when several colours fly at once —
  via a compact **eye/Arrows filter button** (`RelationFilter`, top-right above the
  circle, 7.3c) that opens a hide/show dropdown and shows a `−N` badge; it replaced the
  always-on chip row, which sat in the thumb's token-tapping zone and drew accidental
  taps. Team colour comes from `team.color` (7.3b): townsfolk green, outsider blue
  (`#4c9aff`), minion purple (`#bf5af2`), demon red; **editable per game in Settings →
  Games & scripts** (`updateTeamColor` — cosmetic, so safe to edit in place unlike
  structural config). Team-coloured bits (token wedges, role-guess chips) resolve
  via `resolveTeamColor`/`teamChipStyle` (inline styles + `color-mix`, since a hex can't
  be a Tailwind class); relations/reads keep the four base-tone Tailwind classes.
- Role guesses render as N equal team-toned wedges on the token, **and (6.5) as text
  under the player's name label** for quick glance (the wedges stay the colour cue).
  ~2–3 wedges are legible at 15 players; past that a count badge + the focus card.
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
- **Tapping a player opens a centered card** (6.5; `createPortal`, tap-out to close),
  not the old below-the-diagram panel that made you scroll. It leads with **quick
  record** — the intuitive "tap the player, then the action" — with a button per
  non-nomination relation plus Nominate and Event, each opening the matching sheet
  pre-filled with that player (`presetSpeaker`/`presetRelation` on `AssertionSheet`,
  `presetNominator` on `NominationSheet`, `presetSubject` on `EventSheet`). Below that:
  role guesses, the read control, and the log entries involving them. Input speed is
  *the* hard problem here, and starting from the token is the fastest path found so far.
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
6. **Done** — Config generalisation, validated by a real second game (**Avalon**).
   The abstraction held: adding Avalon was two JSON files + one small generalisation
   (`addNomination` nominee → `nominees[]`). Phases became `{ setup?, cycle }`;
   alignment gained `neutral` and split from `tone`; relations became optional with a
   default set; **custom `game.json`/`script.json` can be pasted in** (validated by
   `validate.ts`, stored by `custom.ts`). Reads gained a real neutral state.
6.5 **Done** — UX polish from the first live game night: info draws arrows + a
   per-relation hide toggle; role guesses shown as text under names; **nomination is
   its own entry category** (dedicated sheet, editable votes — fixed a real bug); a
   **centered tap-a-player card with quick-record**; entry buttons renamed/recoloured
   (Speech / Nomination / Event); default table size = range midpoint; minion purple /
   demon red. All merged to `main` and deployed.
7. **In progress — Portability & modular configs (no backend).** Accounts / cloud
   sync were considered and **dropped** for a hobby project — with no backend, file
   export/import *is* the multi-device and sharing story. Sub-iterations:
   - *7.0a* **Done** — modular config store: BotC/Avalon are seed data, every config
     deletable/editable/exportable (see "no built-in games"). `defaults.ts` +
     rewritten `custom.ts`/`index.ts`; `SessionSetup` handles zero games + restore.
   - *7.0b* **Done** — portability: `share.ts` `Bundle` format; a **Settings** screen
     (gear on Home) with Export-everything / Import-a-file; per-session **Export** in
     the Home row menu. Merge rules: sessions → copy on id-collision, configs → upsert,
     settings → replace (settings not populated until 7.3/7.4).
   - *7.1* **Done** — config-lifecycle UI: a **Games & scripts** section in `Settings`
     lists every game with its scripts, each with Remove (guarded when a saved session
     uses it) + a per-game Export (`buildConfigBundle`), plus **Restore default games**.
     Per-script delete uses `removeScriptConfig`. The setup **"Import a game"** sheet was
     reverted to *import-only* — managing/deleting configs is a Settings concern now.
   - *7.2* Freeform empty-state polish (setup already has a zero-games Restore state).
   - *7.3* **Done** — colour presets: `theme.ts` (Default + Okabe-Ito colourblind-safe)
     overrides the six `--color-*` vars on `<html>` at runtime (Default *clears* the
     overrides so index.css governs); every colour already resolves through them, so UI
     + diagram recolour at once. A `settings.ts` Zustand store (localStorage key
     `deduction-settings`) holds `palette`; `main.tsx` applies it before first paint (no
     flash); an **Appearance** section in `Settings` picks it; the palette rides along in
     the backup bundle (`Bundle.settings`, applied on import).
   - *7.3b* **Done** — modular colours: the global palette shrank to the **four base
     tones** (good/evil/neutral/info); `blue`/`purple` are gone. **Team colour is game
     config** (`TeamConfig.color` = base-tone name *or* hex — see "Games are config"),
     so a game brings its own team colours instead of fitting global slots. Rendering
     split: teams use `resolveTeamColor`/`teamChipStyle` (inline + `color-mix`),
     relations/reads keep base-tone Tailwind classes. Settings **Appearance** gained a
     per-tone custom-colour picker (overrides layered on a preset, in `settings.ts`
     `customColors`, riding in the backup). Back-compat: `withDefaults` normalises legacy
     `team.tone`→`color`.
   - *7.4* **Done (live-play surfaces)** — localisation EN / 中文, **UI chrome only**.
     `i18n.ts`: flat `en`/`zh` dicts + `useT()` (reactive `t`/`tOr`, `{param}` interp);
     `language` in `settings.ts` (applied to `<html lang>`, rides in the bundle).
     **Relations are the one hybrid**: the shipped default vocabulary translates by id
     (`relationLabel`/`relationPhrase` via `tOr(\`relation.<id>.<slot>\`, authoredLabel)`),
     while a game's own custom relations fall back to their authored label — config
     content (game/role/team/phase names) is never translated. Translated: Home,
     SessionSetup, Settings (+ Language section), GameScreen, RoundBar, Timeline,
     DiagramView, SeatCircle controls, LeanControl, PlayerList, LogView, EntryActions,
     and all four entry sheets. **Still English: the post-game Review tab
     (`ReviewTab`/`Postmortem`/`TruthEntry`)** — a 7.4b follow-up. (Minor: English
     plurals like "1 scripts" not handled — zh has no plural, kept simple.)
   - *7.5* **In-app config editor (create-only).** Duplicate/create a script (role list)
     or a game (name, player count, team names, phases) from the app — never edits an
     existing config in place (ids are referential; create-only sidesteps orphaning).
   - *7.6* **Relation editing** — a "voting" toggle that wires the `nominate`↔`vote`
     pair for you (instead of raw `collectsVotesAs`), plus adding simple extra verbs;
     raw relation internals stay JSON-only. (A game config *already* supports a custom
     `relations` array today — 7.6 only adds safe UI over it.)
   Still-deferred threads: approve/reject vote *outcomes*; post-mortem showing *when* a
   read turned right (from read history); another diagram-zoom pass.

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

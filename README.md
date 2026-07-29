# Social Deduction Toolkit

A player-side note-taking tool for social deduction games (first target: Blood on
the Clocktower). Log what people say as a structured event log and see it as a
relationship diagram — a ring of seats with arrows for vouches, accusations,
nominations and votes, plus role guesses on each token.

It runs entirely in the browser. No backend, no account, works offline.
Try with: https://boardgame-toolkit.aw2822309062.workers.dev/

## Requirements

- [Node.js](https://nodejs.org) 20 or newer (includes `npm`)

## Run locally

```bash
npm install
npm run dev
```

Vite prints two URLs:

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.0.55:5173/     <- use this on your phone
```

The dev server is configured with `host: true`, so the **Network** URL is
reachable from a phone **on the same Wi-Fi**. Open it on the phone and you can
test with real touch input. If it doesn't load, allow Node through your firewall
for private networks (Windows usually prompts the first time).

The exact Network IP depends on your machine; use whichever one Vite prints.

## Build

```bash
npm run build      # type-checks, then writes static files to dist/
npm run preview    # serve the built dist/ locally to sanity-check it
```

`dist/` is a self-contained static site — plain HTML/CSS/JS plus a service
worker. Any static host can serve it.

## Deploy

The output is static, so hosting is free and simple. Pick one:

There are **two separate ways** to put it on Cloudflare Pages. Pick one — don't
mix them. Mixing them (putting `wrangler pages deploy` into the Git build
command) is the usual reason a project exists but no site is live.

#### Option A — Git integration (recommended, auto-deploys on push)

Cloudflare clones the repo and runs the build itself, then publishes the output.
You do **not** run `wrangler` here.

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
2. Select the repo, branch `main`, and set:
   - **Framework preset:** `Vite` (or `None`)
   - **Build command:** `npm run build`  ← this only, nothing else
   - **Build output directory:** `dist`
3. Save and deploy. You get a `https://<project>.pages.dev` URL, and every push
   to `main` rebuilds and republishes automatically.

> If you already created the project with a wrong build command, fix it under
> **Settings → Builds & deployments → Build configuration**, set the command to
> exactly `npm run build` and output to `dist`, then **Retry deployment** (or
> push a new commit). Do not include `wrangler` in that command.

#### Option B — Direct upload from your machine (no Git build)

You build locally and upload the finished `dist/` folder yourself:

```bash
npm run build
npx wrangler login          # first time only — opens a browser to authorise
npx wrangler pages deploy dist
```

The first run asks to create the Pages project; after that the same command
republishes. Use this if you'd rather not connect the repo. Don't also set a
build command in the dashboard for this project — there's no Git build here.

### Netlify (fastest one-off test)

Drag-and-drop the `dist/` folder onto <https://app.netlify.com/drop>. You get a
public URL in seconds — good for a quick phone test without any setup. (Run
`npm run build` first.)

### Any other static host

`dist/` works on GitHub Pages, Vercel, S3, or `npx serve dist` on your own
machine. It's just files.

## Install on a phone (PWA)

Once it's served over HTTPS (any of the deploy options above), open it on the
phone and use **Add to Home Screen** from the browser menu. It then launches
full-screen and works offline.

> Note: the "install" prompt and offline caching only kick in over HTTPS. The
> LAN dev-server URL (plain `http://…`) runs fine for testing but won't offer
> install.

## Custom games and scripts

Games are **data, not code**. The app ships with Blood on the Clocktower and Avalon
as ordinary configs you can edit or delete, and you can add your own. A game is two
small JSON pieces:

- **game** — the shape of play: player range, phases, teams, and (optionally) the
  relation vocabulary.
- **script** — a role list layered on a game. One game can have several scripts.

### A game

```json
{
  "id": "werewolf",
  "name": "Werewolf",
  "minPlayers": 5,
  "maxPlayers": 12,
  "phases": {
    "setup": [{ "id": "firstnight", "label": "First Night", "short": "N1" }],
    "cycle": [
      { "id": "night", "label": "Night", "short": "N" },
      { "id": "day", "label": "Day", "short": "D" }
    ]
  },
  "teams": [
    { "id": "village", "name": "Village", "alignment": "good", "tone": "good" },
    { "id": "wolves", "name": "Werewolves", "alignment": "evil", "tone": "evil" }
  ]
}
```

- `phases.cycle` repeats every round; `phases.setup` (optional) runs once at the start,
  like an opening night. List phases in play order.
- `alignment` is the deduction axis — `good` | `evil` | `neutral`. `tone` is only the
  colour — `good` | `evil` | `neutral` | `info` | `blue` | `purple`.
- **`relations` is optional.** Omit it and the game inherits the standard set (vouch,
  accuse, nominate, vote, info). Add your own only if you need different verbs.

### A script

```json
{
  "id": "werewolf-classic",
  "gameId": "werewolf",
  "name": "Classic",
  "roles": [
    { "id": "seer", "name": "Seer", "team": "village" },
    { "id": "werewolf", "name": "Werewolf", "team": "wolves" }
  ]
}
```

- `gameId` must match a game's `id`; each role's `team` must be a team `id` in that game.

### Import, edit, share

- **Add one** — New game → **＋ Import a game**, then paste a game, a script, or both as
  `{ "game": { … }, "script": { … } }`. It's validated before anything is saved.
- **Manage** — Settings → **Games & scripts** lists everything installed. Remove a game
  or an individual script, or **Export** a game to a `.json` file.
- **Edit an existing one** — Export it, change the JSON, and import the file back
  (Settings → Import). The same `id` replaces the old version. To tweak a built-in,
  export Blood on the Clocktower or Avalon first.
- **Share / back up** — an exported file imports on any other device. Ids must be
  unique; two games can't share an `id`.

## Notes for manual testing

- Data is stored in the browser's `localStorage`, per device and per browser.
  It is **not** synced anywhere. Clearing site data wipes your sessions.
- "Exit" on the round bar leaves a session without deleting it; it's still saved.
- Everything is local, so testing on your laptop and testing on your phone are
  two independent sets of data.

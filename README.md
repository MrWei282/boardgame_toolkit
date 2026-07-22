# Social Deduction Toolkit

A player-side note-taking tool for social deduction games (first target: Blood on
the Clocktower). Log what people say as a structured event log and see it as a
relationship diagram — a ring of seats with arrows for vouches, accusations,
nominations and votes, plus role guesses on each token.

It runs entirely in the browser. No backend, no account, works offline. See
[CLAUDE.md](CLAUDE.md) for the design and data model.

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

### Cloudflare Pages (recommended, has a URL you can open anywhere)

1. Push this repo to GitHub (already done).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repo and set:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Deploy. Every push to `main` rebuilds and publishes automatically.

Or deploy the built folder directly without Git, using the Wrangler CLI:

```bash
npm run build
npx wrangler pages deploy dist
```

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

## Notes for manual testing

- Data is stored in the browser's `localStorage`, per device and per browser.
  It is **not** synced anywhere. Clearing site data wipes your sessions.
- "Exit" on the round bar leaves a session without deleting it; it's still saved.
- Everything is local, so testing on your laptop and testing on your phone are
  two independent sets of data.

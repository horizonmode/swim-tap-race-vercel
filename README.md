# Swim Tap Race — Vercel edition

A tiny real-time multiplayer race for a wellbeing presentation.

## Deploy to Vercel

1. Put this folder in a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repo.
3. Framework preset: **Other**.
4. Do not set a build command.
5. In the project's **Storage** tab, connect an **Upstash Redis** database through the Vercel Marketplace. Choose a region near London where available.
6. Under **Settings → Environment Variables**, ensure `REDIS_URL` is set for **Production** to the database's Redis connection URL (`rediss://…`). The integration may add this automatically. Use the Redis URL, not the REST API URL/token, and keep it server-side.
7. Add a private `PRESENTER_KEY` (any non-empty word or phrase, up to 256 characters) to Production. You can use the generated key in your local `.env`; never put it in the QR URL or client code. Set `ALLOWED_ORIGINS=https://swim-tap.vercel.app` for this site (change it if you use another domain). Multiple exact origins can be comma-separated, without trailing slashes. Vercel's generated deployment/branch domains are also allowed automatically when its system variables are available.
8. Make sure **Fluid Compute** is enabled, then deploy (or redeploy after adding environment variables).
9. Open the production `/race` page and enter the presenter key to unlock the controls. Scan its QR code on a phone and join. The presenter should list the swimmer immediately. Check Start, tapping, Reset, and Clear players from a second device.

Do not paste Redis credentials into source files or commit them. Preview deployments need their own `REDIS_URL` environment setting if you want to test them. Production and preview use separate room keys by default.

Your URLs will be:

- Players: `https://YOUR-PROJECT.vercel.app/`
- Presenter: `https://YOUR-PROJECT.vercel.app/race`

The presenter screen displays a QR code that opens the player page.

## Run locally

Requires Node.js 20.12+ (for native `.env` loading).

```bash
npm install
cp .env.example .env # first checkout only; keep your existing .env
npm run dev
```

The server automatically loads `.env`. Set `PRESENTER_KEY` to any non-empty word or phrase (up to 256 characters) and enter it on the presenter screen to unlock controls. Local play uses in-memory storage by default; set `LOCAL_REDIS=true` only when explicitly testing the shared Redis backend locally. `REDIS_URL` is still required for deployed Vercel WebSockets. `PORT` defaults to 3000 and `RACE_ROOM=local` keeps local testing separate from production. Restart the server after changing variables. `.env` is ignored by Git and cannot be downloaded from the local server.

Then open:

- Player: `http://localhost:3000/`
- Presenter: `http://localhost:3000/race`

Scan the QR code on the presenter screen with a phone on the same Wi-Fi. The local server supplies your computer’s network address automatically. If several addresses appear, choose the one for your Wi-Fi network.

## Shared state on Vercel

Vercel can route player and presenter WebSockets to different Function instances. An in-memory Map cannot synchronize those instances, even when the project is pinned to one region.

The deployed backend now stores race state in Redis and publishes each update to all instances. Atomic compare-and-set updates preserve concurrent joins/taps and select one winner. Each instance also checks for missed updates every two seconds, and countdowns can resume if their original instance disappears. Reconnecting players can rejoin an existing race without losing progress.

Redis is required for the deployed backend: without it, the UI reports a setup error rather than accepting players into isolated games. Local `npm run dev` uses Redis when `REDIS_URL` is set; otherwise it runs in memory.

The lobby persists across redeploys; use **Clear players** before a new session. `RACE_ROOM` optionally sets a room namespace (use distinct values for separate games/projects sharing one database). All devices for a game must use the same deployment and room configuration.

See [Vercel's shared-state WebSocket guide](https://vercel.com/kb/guide/real-time-chat-websockets).

## Checks

Run `npm test`. Regression tests simulate independent Function instances sharing a Redis test double: cross-instance joins, concurrent updates, reconnects, countdown recovery, winner selection, and missing storage. They do not replace the two-device production check against your real Redis database.

## Settings

In `lib/race-state.js` for deployment (and `local-server.js` for local play):

- Maximum players: 20
- Tap cooldown: 55 ms
- Distance per accepted tap: 1.2

## Presenter controls

- **Start race** — 3, 2, 1, GO
- **Reset** — keeps players but returns everyone to the start
- **Clear players** — empties the lobby

## Security controls

- Presenter commands require the private `PRESENTER_KEY`. The browser retains it only in page memory for reconnects; refreshing requires entering it again. Missing or empty keys leave controls locked. Keys are case-sensitive.
- Each player has a private, randomly generated reconnect token stored in their tab's session storage. Only its hash is stored with race state. Public snapshots include neither the token nor its hash.
- Both local and Redis play use the same message validation and authorization. Malformed messages close that connection rather than crashing the server.
- WebSocket upgrades require `/api/ws` and an exact allowed Origin. Local play automatically allows localhost and the computer's LAN addresses; production origins come from `ALLOWED_ORIGINS` and Vercel system variables. Origin checking supplements authentication; it does not authenticate non-browser clients.
- Each instance caps connections at 100, connection attempts at a burst of 60 then 2/second, messages per connection at a burst of 60 then 30/second, and queued commands at 16 per connection. A shared instance work budget limits storage submissions, and tap cooldowns are checked before Redis access. Five failed presenter-key attempts close a connection. These limits mitigate abuse but do not provide global distributed DDoS protection; configure Vercel Firewall/spend controls for public events as needed.
- Existing players created before token authentication cannot be claimed with their public IDs. After this upgrade, unlock the presenter, **Clear players**, then reload both pages and rejoin.

Use HTTPS/WSS for the deployed event. Local HTTP is intended for a trusted development Wi-Fi network; it does not encrypt the presenter key or player tokens in transit. Redis configuration and credentials remain server-side.

## Race movement and reconnects

Tap batches retain their server-received timestamps, apply the cooldown to those timestamps, and process at most three taps per update. Display transitions smooth delayed updates. Disconnecting keeps a player's lane, progress, and final result. Leaving in the lobby removes the player; during a race the participant stays on the board until the presenter clears players. Use **Clear players** between simulation runs to remove retained test swimmers.

Local static serving is restricted to built pages and assets inside `dist`; rebuild with `npm run build` after client changes. Presenter authentication survives socket reconnects in page memory.

## Client structure

`src/PlayerApp.svelte` and `src/PresenterApp.svelte` coordinate race state and connections. Reusable UI lives in `src/components`: joining, character selection, pool lanes, race board, QR code, presenter controls, boosts, and the results dialog. Component layout styles are scoped to their Svelte files. `src/styles` contains shared design tokens, base styles, and SVG sprite animations. Vite bundles these styles once; the HTML pages only load their app entry points.

Each character sprite has its own readable file in `src/swimmers`. `src/swimmers/index.js` registers the sprites; the root `swimmers.js` shares character identifiers and validation with the backend. The obsolete vanilla page scripts and DOM-based results renderer have been removed.

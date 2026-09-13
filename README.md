# Swim Tap Race — Vercel edition

A tiny real-time multiplayer race for a wellbeing presentation.

## Deploy to Vercel

1. Put this folder in a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repo.
3. Framework preset: **Other**.
4. Do not set a build command.
5. In the project's **Storage** tab, connect an **Upstash Redis** database through the Vercel Marketplace. Choose a region near London where available.
6. Under **Settings → Environment Variables**, ensure `REDIS_URL` is set for **Production** to the database's Redis connection URL (`rediss://…`). The integration may add this automatically. Use the Redis URL, not the REST API URL/token, and keep it server-side.
7. Make sure **Fluid Compute** is enabled, then deploy (or redeploy after adding the environment variable).
8. Open the production `/race` page, scan its QR code on a phone, and join. The presenter should list the swimmer immediately. Check Start, tapping, Reset, and Clear players from a second device.

Do not paste Redis credentials into source files or commit them. Preview deployments need their own `REDIS_URL` environment setting if you want to test them. Production and preview use separate room keys by default.

Your URLs will be:

- Players: `https://YOUR-PROJECT.vercel.app/`
- Presenter: `https://YOUR-PROJECT.vercel.app/race`

The presenter screen displays a QR code that opens the player page.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open:

- Player: `http://localhost:3000/`
- Presenter: `http://localhost:3000/race`

Scan the QR code on the presenter screen with a phone on the same Wi-Fi. The local server supplies your computer’s network address automatically. If several addresses appear, choose the one for your Wi-Fi network.

## Shared state on Vercel

Vercel can route player and presenter WebSockets to different Function instances. An in-memory Map cannot synchronize those instances, even when the project is pinned to one region.

The deployed backend now stores race state in Redis and publishes each update to all instances. Atomic compare-and-set updates preserve concurrent joins/taps and select one winner. Each instance also checks for missed updates every two seconds, and countdowns can resume if their original instance disappears. Reconnecting players can rejoin an existing race without losing progress.

Redis is required for the deployed backend: without it, the UI reports a setup error rather than accepting players into isolated games. Local `npm run dev` still runs a single in-memory server and needs no Redis.

The lobby persists across redeploys; use **Clear players** before a new session. `RACE_ROOM` optionally sets a room namespace (use distinct values for separate games/projects sharing one database). All devices for a game must use the same deployment and room configuration.

See [Vercel's shared-state WebSocket guide](https://vercel.com/kb/guide/real-time-chat-websockets).

## Checks

Run `npm test`. Regression tests simulate independent Function instances sharing a Redis test double: cross-instance joins, concurrent updates, reconnects, countdown recovery, winner selection, and missing storage. They do not replace the two-device production check against your real Redis database.

## Settings

In `lib/race-state.js` for deployment (and `local-server.js` for local play):

- Maximum players: 20
- Tap cooldown: 55 ms
- Distance per accepted tap: 1.45

## Presenter controls

- **Start race** — 3, 2, 1, GO
- **Reset** — keeps players but returns everyone to the start
- **Clear players** — empties the lobby

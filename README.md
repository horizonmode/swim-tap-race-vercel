# Swim Tap Race — Vercel edition

A tiny real-time multiplayer race for a wellbeing presentation.

## Deploy to Vercel

1. Put this folder in a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repo.
3. Framework preset: **Other**.
4. Do not set a build command.
5. Deploy.
6. Make sure **Fluid Compute** is enabled for the project; Vercel's WebSocket support currently runs on Fluid Compute.
7. Test with two phones before presentation day.

Your URLs will be:

- Players: `https://YOUR-PROJECT.vercel.app/`
- Presenter: `https://YOUR-PROJECT.vercel.app/race`

Turn the player URL into a QR code and put it on your presentation slide.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open:

- Player: `http://localhost:3000/`
- Presenter: `http://localhost:3000/race`

## Important Vercel beta note

Vercel WebSockets are currently a public beta. This game keeps the live race state in the WebSocket function's memory because that is ideal for a short, single-room presentation. The project is pinned to the London Vercel region (`lhr1`) to keep UK latency low, but Vercel can still create more than one function instance.

For an internal presentation with a small group this is intentionally lightweight. Test it with roughly the number of phones you expect to use. If you later want large or highly reliable public races, move race state/fan-out to a shared realtime service such as Redis/Upstash/Ably.

## Settings

In `api/ws.js`:

- `MAX_PLAYERS` — default 20
- `TAP_COOLDOWN_MS` — server-side anti-autoclick rate limit
- `TAP_POWER` — distance per accepted tap

## Presenter controls

- **Start race** — 3, 2, 1, GO
- **Reset** — keeps players but returns everyone to the start
- **Clear players** — empties the lobby

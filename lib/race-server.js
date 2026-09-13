import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { createRedisStore } from "./race-store.js";
import { publicState } from "./race-state.js";

export function createRaceServer(getStorage = createRedisStore, requestHandler) {
const clients = new Set();
let storage;
let subscription;
let subscriberConnection;
let latest;
let countdownTimer;
let recoveryTimer;

function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function deliver(ws, state) {
  send(ws, publicState(state));
  const winner = state.players.find(p => p.id === state.race.winnerId);
  if (winner) send(ws, { type: "winner", id: winner.id, name: winner.name, timeMs: winner.finishedAt - state.race.startedAt });
}

function accept(state) {
  if (latest && state.revision <= latest.revision) return;
  latest = state;
  for (const ws of clients) deliver(ws, state);
  clearTimeout(countdownTimer);
  if (state.race.state === "countdown") {
    countdownTimer = setTimeout(() => {
      storage.store.update({ type: "tick" }).then(result => accept(result.state)).catch(storageError);
    }, Math.max(0, state.race.countdownEndsAt - Date.now()));
  }
}

function storageError() {
  console.error("Shared race storage unavailable");
  for (const ws of clients) {
    send(ws, { type: "serverError", message: "Race connection interrupted. Please wait while we reconnect." });
    ws.close(1013, "Storage connection interrupted");
  }
}

async function initialize() {
  if (!storage) storage = getStorage();
  if (!subscription) {
    const subscriber = storage.redis.duplicate();
    subscriberConnection = subscriber;
    subscriber.on("error", storageError);
    subscriber.on("message", (_channel, raw) => {
      try { accept(JSON.parse(raw)); } catch { storageError(); }
    });
    subscription = subscriber.subscribe(storage.store.channel).catch(error => {
      subscriber.disconnect();
      subscription = null;
      throw error;
    });
  }
  await subscription;
  if (!recoveryTimer) {
    // Catch up after missed pub/sub messages or an interrupted countdown timer.
    recoveryTimer = setInterval(() => {
      if (clients.size) storage.store.update({ type: "tick" }).then(result => accept(result.state)).catch(storageError);
    }, 2000);
    recoveryTimer.unref();
  }
}

const httpServer = createServer(requestHandler || ((_req, res) => {
  res.writeHead(426);
  res.end("WebSocket connection required");
}));
const wss = new WebSocketServer({ server: httpServer, maxPayload: 4096 });

wss.on("connection", ws => {
  clients.add(ws);
  let playerId = null;
  // Attach listeners synchronously; serialize messages behind initialization.
  let queue = initialize().then(async () => {
    const { state } = await storage.store.update({ type: "tick" });
    accept(state);
    deliver(ws, latest || state);
  }).catch(() => {
    send(ws, { type: "serverError", message: process.env.REDIS_URL
      ? "Race server could not connect. Please try again shortly."
      : "Multiplayer setup is incomplete. The presenter needs to connect Redis and redeploy." });
    ws.close(1013, "Shared race storage unavailable");
  });

  ws.on("message", raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (!message || !["join", "tap", "presenter:start", "presenter:reset", "presenter:clear"].includes(message.type)) return;
    queue = queue.then(async () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const result = await storage.store.update(message, playerId);
      if (result.reply) {
        if (result.reply.ok) playerId = result.reply.id;
        send(ws, result.reply);
      }
      accept(result.state);
      // Pub/sub may arrive before joinResult; send a snapshot after joining.
      if (result.reply?.ok) deliver(ws, latest || result.state);
    }).catch(() => {
      send(ws, { type: "serverError", message: "Could not update the race. Please try again." });
    });
  });
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => {});
});

return { server: httpServer, wss, close() {
  clearTimeout(countdownTimer);
  clearInterval(recoveryTimer);
  storage?.redis.disconnect();
  subscriberConnection?.disconnect();
  for (const ws of clients) ws.close();
  wss.close();
} };
}

import { allowedUpgrade, configuredOrigins, sameSecret, tokenBucket, validMessage } from "./security.js";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { createRedisStore } from "./race-store.js";
import { publicState } from "./race-state.js";

export function createRaceServer(getStorage = createRedisStore, requestHandler, options = {}) {
  const log = (event, details = {}) => console.log(JSON.stringify({
    timestamp: new Date().toISOString(), event, ...details
  }));
  const logError = (event, details = {}) => console.error(JSON.stringify({
    timestamp: new Date().toISOString(), event, ...details
  }));
  const clients = new Set();
  const pendingLeaves = new Map();
  const disconnectGraceMs = 5000;
  const origins = options.allowedOrigins || configuredOrigins();
  const presenterKey = options.presenterKey ?? process.env.PRESENTER_KEY;
  const allowConnection = tokenBucket(60, 2);
  const allowWork = tokenBucket(500, 400);
  const maxClients = options.maxClients ?? 100;
  let storage;
  let subscription;
  let subscriberConnection;
  let latest;
  let countdownTimer;
  let recoveryTimer;

  function send(ws, message) {
    if (ws.bufferedAmount > 64 * 1024) {
      // Dropping stale snapshots lets a slow client catch up without removing its player.
      if (message.type === "gameState") {
        log("state-skipped-slow-client", { bufferedBytes: ws.bufferedAmount });
        return;
      }
      log("slow-client-closed", { bufferedBytes: ws.bufferedAmount, messageType: message.type });
      ws.close(1013, "Slow connection");
      return;
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function deliver(ws, state) {
    send(ws, publicState(state));
    const winner = state.players.find(p => p.id === state.race.winnerId);
    if (winner) send(ws, { type: "winner", id: winner.id, name: winner.name, timeMs: winner.finishedAt - state.race.startedAt });
  }

  function accept(state) {
    if (latest && state.revision <= latest.revision) return;
    const previousState = latest?.race.state;
    latest = state;
    if (previousState !== state.race.state) {
      log("race-state", { state: state.race.state, players: state.players.length, revision: state.revision });
    }
    for (const ws of clients) deliver(ws, state);
    clearTimeout(countdownTimer);
    if (state.race.state === "countdown") {
      countdownTimer = setTimeout(() => {
        storage.store.update({ type: "tick" }).then(result => accept(result.state)).catch(storageError);
      }, Math.max(0, state.race.countdownEndsAt - Date.now()));
    }
  }

  function storageError() {
    logError("storage-unavailable", { clients: clients.size });
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
  const wss = new WebSocketServer({
    server: httpServer, maxPayload: 4096, perMessageDeflate: false,
    verifyClient: ({ req }) => allowedUpgrade(req, origins) && clients.size < maxClients && allowConnection()
  });

  wss.on("connection", ws => {
    if (clients.size >= maxClients) { ws.close(1013, "Race server full"); return; }
    clients.add(ws);
    log("connection-open", { clients: clients.size });
    let playerId = null;
    let playerToken = null;
    const connectionNonce = randomUUID();
    let presenter = false;
    let authAttempts = 0;
    let pending = 0;
    let queuedTaps = 0;
    let tapDrainTimer;
    let drainingTaps = false;
    const allowMessage = tokenBucket(60, 30);
    const allowJoin = tokenBucket(4, 0.2);
    // Attach listeners synchronously; serialize messages behind initialization.
    let queue = initialize().then(async () => {
      const { state } = await storage.store.update({ type: "tick" });
      accept(state);
      deliver(ws, latest || state);
    }).catch(() => {
      send(ws, {
        type: "serverError", message: process.env.REDIS_URL
          ? "Race server could not connect. Please try again shortly."
          : "Multiplayer setup is incomplete. The presenter needs to connect Redis and redeploy."
      });
      ws.close(1013, "Shared race storage unavailable");
    });

    function drainTapQueue() {
      if (drainingTaps) return;
      drainingTaps = true;
      const drain = () => {
        if (!queuedTaps || ws.readyState !== WebSocket.OPEN) {
          drainingTaps = false;
          return;
        }
        if (pending >= 16 || !allowWork()) {
          tapDrainTimer = setTimeout(drain, 25);
          return;
        }
        const tapCount = Math.min(queuedTaps, 12);
        queuedTaps -= tapCount;
        pending++;
        queue = queue.then(async () => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const result = await storage.store.update({ type: "tapBatch", count: tapCount, playerToken }, playerId);
          accept(result.state);
          if (result.reply?.ok) deliver(ws, latest || result.state);
        }).catch(() => {
          send(ws, { type: "serverError", message: "Could not update the race. Please try again." });
        }).finally(() => {
          pending--;
          drain();
        });
      };
      tapDrainTimer = setTimeout(drain, 25);
    }

    ws.on("message", raw => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!allowMessage() || Buffer.byteLength(raw) > 4096) {
        log("message-limit-close", { clients: clients.size });
        ws.close(1008, "Message limit exceeded"); return;
      }
      let message;
      try { message = JSON.parse(raw.toString()); } catch {
        ws.close(1008, "Invalid message"); return;
      }
      if (!validMessage(message)) { ws.close(1008, "Invalid message"); return; }
      if (message.type === "presenter:auth") {
        presenter = sameSecret(message.key, presenterKey);
        send(ws, { type: "presenterAuth", ok: presenter, message: presenter ? "Presenter controls unlocked" : "Invalid presenter key or presenter setup incomplete." });
        if (!presenter && ++authAttempts >= 5) ws.close(1008, "Too many authentication attempts");
        return;
      }
      if (message.type.startsWith("presenter:") && !presenter) {
        send(ws, { type: "serverError", message: "Unlock presenter controls first." }); return;
      }
      if (message.type === "join" && !allowJoin()) {
        log("join-rate-limit-close", { clients: clients.size });
        ws.close(1008, "Too many join attempts"); return;
      }
      if (message.type === "tap") {
        if (!playerId || !latest || latest.race.state !== "racing") return;
        if (queuedTaps >= 12) {
          log("tap-queue-full", { playerId, queuedTaps });
          return;
        }
        queuedTaps++;
        drainTapQueue();
        return;
      }
      if (pending >= 16 || !allowWork()) {
        log("busy-client-closed", { messageType: message.type, playerId, pending });
        ws.close(1013, "Race server busy");
        return;
      }
      pending++;
      queue = queue.then(async () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const storageMessage = message.type === "join"
          ? { ...message, connectionNonce }
          : message.type === "tap" ? { type: "tap", playerToken } : message;
        const result = await storage.store.update(storageMessage, playerId);
        if (result.reply) {
          if (result.reply.ok) { playerId = result.reply.id; playerToken = message.playerToken; }
          if (message.type === "join") {
            if (result.reply.ok) {
              const pendingLeave = pendingLeaves.get(playerId);
              if (pendingLeave) {
                clearTimeout(pendingLeave);
                pendingLeaves.delete(playerId);
              }
            }
            log("player-join", { playerId: result.reply.id || message.playerId, ok: result.reply.ok, players: result.state.players.length });
          }
          send(ws, result.reply);
        }
        accept(result.state);
        if (result.reply?.ok) deliver(ws, latest || result.state);
      }).catch(() => {
        send(ws, { type: "serverError", message: "Could not update the race. Please try again." });
      }).finally(() => { pending--; });
    });
    ws.on("close", (code, reason) => {
      clients.delete(ws);
      clearTimeout(tapDrainTimer);
      queuedTaps = 0;
      const closedPlayerId = playerId;
      const closedPlayerToken = playerToken;
      log("connection-close", {
        code,
        reason: reason?.toString() || "",
        playerId: closedPlayerId,
        clients: clients.size
      });
      if (!closedPlayerId || !closedPlayerToken) return;
      const leaveTimer = setTimeout(() => {
        pendingLeaves.delete(closedPlayerId);
        queue = queue.then(async () => {
        const result = await storage.store.update({ type: "leave", playerToken: closedPlayerToken, connectionNonce }, closedPlayerId);
        if (result.state.players.length < latest?.players.length) {
          log("player-leave", { playerId: closedPlayerId, players: result.state.players.length });
        }
        accept(result.state);
        }).catch(() => { });
      }, disconnectGraceMs);
      pendingLeaves.set(closedPlayerId, leaveTimer);
    });
    ws.on("error", () => { });
  });

  return {
    server: httpServer, wss, close() {
      clearTimeout(countdownTimer);
      clearInterval(recoveryTimer);
      storage?.redis.disconnect();
      subscriberConnection?.disconnect();
      for (const ws of clients) ws.close();
      wss.close();
    }
  };
}

import { boostStatus } from "./boost.js";
import { allowedUpgrade, configuredOrigins, sameSecret, sameSecretHash, tokenBucket, validMessage } from "./security.js";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { createRedisStore } from "./race-store.js";
import { publicState } from "./race-state.js";

const validRoom = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(value);

export function createRaceServer(getStorage = createRedisStore, requestHandler, options = {}) {
  const verbose = (options.logLevel ?? process.env.LOG_LEVEL)?.toLowerCase() === "verbose";
  const log = (event, details = {}) => {
    if (verbose) console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...details }));
  };
  const logError = (event, details = {}) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), event, ...details }));
  const clients = new Set();
  const rooms = new Map();
  const origins = options.allowedOrigins || configuredOrigins();
  const masterCode = options.masterCode ?? process.env.MASTER_CODE;
  const legacyRoom = process.env.RACE_ROOM || "default";
  const allowConnection = tokenBucket(60, 2);
  const allowWork = tokenBucket(500, 400);
  const maxClients = options.maxClients ?? 100;

  function context(roomId) {
    if (!rooms.has(roomId)) rooms.set(roomId, { id: roomId, clients: new Set(), storage: null, subscription: null, subscriber: null, latest: null, countdownTimer: null, recoveryTimer: null });
    return rooms.get(roomId);
  }

  function send(ws, message) {
    if (ws.bufferedAmount > 64 * 1024) {
      if (message.type !== "gameState") ws.close(1013, "Slow connection");
      return;
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function deliver(ws, state) {
    send(ws, publicState(state));
    send(ws, { type: "boostStatus", boost: boostStatus(state, ws.playerId) });
  }

  function storageError(ctx) {
    logError("storage-unavailable", { room: ctx.id, clients: ctx.clients.size });
    for (const ws of ctx.clients) {
      send(ws, { type: "serverError", message: "Race connection interrupted. Please wait while we reconnect." });
      ws.close(1013, "Storage connection interrupted");
    }
  }

  function accept(ctx, state) {
    if (ctx.latest && state.revision <= ctx.latest.revision) return;
    const previousState = ctx.latest?.race.state;
    ctx.latest = state;
    if (previousState !== state.race.state) log("race-state", { room: ctx.id, state: state.race.state, players: state.players.length, revision: state.revision });
    for (const ws of ctx.clients) deliver(ws, state);
    clearTimeout(ctx.countdownTimer);
    if (state.race.state === "countdown") {
      ctx.countdownTimer = setTimeout(() => ctx.storage.store.update({ type: "tick" }).then(result => accept(ctx, result.state)).catch(() => storageError(ctx)), Math.max(0, state.race.countdownEndsAt - Date.now()));
    }
  }

  async function initialize(ctx) {
    if (!ctx.storage) ctx.storage = getStorage(ctx.id);
    if (!ctx.subscription) {
      const subscriber = ctx.storage.redis.duplicate();
      ctx.subscriber = subscriber;
      subscriber.on("error", () => storageError(ctx));
      subscriber.on("message", (_channel, raw) => {
        try { accept(ctx, JSON.parse(raw)); } catch { storageError(ctx); }
      });
      ctx.subscription = subscriber.subscribe(ctx.storage.store.channel).catch(error => {
        subscriber.disconnect();
        ctx.subscription = null;
        throw error;
      });
    }
    await ctx.subscription;
    if (!ctx.recoveryTimer) {
      ctx.recoveryTimer = setInterval(() => {
        if (ctx.latest) for (const ws of ctx.clients) send(ws, { type: "boostStatus", boost: boostStatus(ctx.latest, ws.playerId) });
        if (ctx.clients.size) ctx.storage.store.update({ type: "tick" }).then(result => accept(ctx, result.state)).catch(() => storageError(ctx));
      }, 2000);
      ctx.recoveryTimer.unref();
    }
  }

  const httpServer = createServer(requestHandler || ((_req, res) => { res.writeHead(426); res.end("WebSocket connection required"); }));
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 4096, perMessageDeflate: false, verifyClient: ({ req }) => allowedUpgrade(req, origins) && clients.size < maxClients && allowConnection() });

  wss.on("connection", (ws, request) => {
    if (clients.size >= maxClients) { ws.close(1013, "Race server full"); return; }
    const requestedRoom = request ? new URL(request.url, "http://localhost").searchParams.get("room") : null;
    const roomId = validRoom(requestedRoom) ? requestedRoom : legacyRoom;
    const ctx = context(roomId);
    clients.add(ws);
    ctx.clients.add(ws);
    log("connection-open", { room: roomId, clients: clients.size });
    let playerId = null;
    let playerToken = null;
    const connectionNonce = randomUUID();
    let presenter = false;
    let admin = false;
    let authAttempts = 0;
    let pending = 0;
    let queuedTaps = [];
    let lastReceivedTap = 0;
    let tapDrainTimer;
    let drainingTaps = false;
    const allowMessage = tokenBucket(60, 30);
    const allowJoin = tokenBucket(4, 0.2);
    let queue = initialize(ctx).then(async () => {
      const { state } = await ctx.storage.store.update({ type: "tick" });
      accept(ctx, state);
      deliver(ws, ctx.latest || state);
    }).catch(() => {
      send(ws, { type: "serverError", message: process.env.REDIS_URL ? "Race server could not connect. Please try again shortly." : "Multiplayer setup is incomplete. The presenter needs to connect Redis and redeploy." });
      ws.close(1013, "Shared race storage unavailable");
    });

    function drainTapQueue() {
      if (drainingTaps) return;
      drainingTaps = true;
      const drain = () => {
        if (!queuedTaps.length || ws.readyState !== WebSocket.OPEN) { drainingTaps = false; return; }
        if (pending >= 16 || !allowWork()) { tapDrainTimer = setTimeout(drain, 25); return; }
        const taps = queuedTaps.splice(0, 3);
        const startedAt = ctx.latest?.race.startedAt;
        pending++;
        queue = queue.then(async () => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const result = await ctx.storage.store.update({ type: "tapBatch", taps, startedAt, playerToken }, playerId);
          accept(ctx, result.state);
          if (result.reply?.ok) deliver(ws, ctx.latest || result.state);
        }).catch(() => send(ws, { type: "serverError", message: "Could not update the race. Please try again." })).finally(() => { pending--; drain(); });
      };
      tapDrainTimer = setTimeout(drain, 25);
    }

    ws.on("message", raw => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!allowMessage() || Buffer.byteLength(raw) > 4096) { ws.close(1008, "Message limit exceeded"); return; }
      let message;
      try { message = JSON.parse(raw.toString()); } catch { ws.close(1008, "Invalid message"); return; }
      if (!validMessage(message)) { ws.close(1008, "Invalid message"); return; }
      if (message.type === "admin:auth") {
        admin = sameSecret(message.key, masterCode);
        send(ws, { type: "adminAuth", ok: admin, message: admin ? "Admin unlocked" : "Invalid master code." });
        if (!admin && ++authAttempts >= 5) ws.close(1008, "Too many authentication attempts");
        if (admin) queue = queue.then(async () => send(ws, { type: "lobbyList", lobbies: await ctx.storage.listLobbies() }));
        return;
      } else if (message.type === "admin:list") {
        if (!admin) send(ws, { type: "serverError", message: "Unlock admin first." });
        else queue = queue.then(async () => send(ws, { type: "lobbyList", lobbies: await ctx.storage.listLobbies() }));
        return;
      } else if (message.type === "session:create") {
        if (!sameSecret(message.masterKey, masterCode)) {
          send(ws, { type: "sessionCreated", ok: false, message: "Invalid master code." });
          if (++authAttempts >= 5) ws.close(1008, "Too many authentication attempts");
          return;
        }
      } else if (message.type === "presenter:auth") {
        presenter = ctx.latest?.sessionKeyHash ? sameSecretHash(message.key, ctx.latest.sessionKeyHash)
          : roomId === legacyRoom && sameSecret(message.key, masterCode);
        send(ws, { type: "presenterAuth", ok: presenter, message: presenter ? "Lobby controls unlocked" : "Invalid session key." });
        if (!presenter && ++authAttempts >= 5) ws.close(1008, "Too many authentication attempts");
        return;
      } else if (message.type.startsWith("presenter:") && !presenter) {
        send(ws, { type: "serverError", message: "Unlock lobby controls first." }); return;
      }
      if (message.type === "join" && !allowJoin()) { ws.close(1008, "Too many join attempts"); return; }
      if (message.type === "tap") {
        if (!playerId || !ctx.latest || ctx.latest.race.state !== "racing") return;
        if (queuedTaps.length >= 12) return;
        const receivedAt = Date.now();
        if (receivedAt - lastReceivedTap < 55) return;
        lastReceivedTap = receivedAt;
        queuedTaps.push(receivedAt);
        drainTapQueue();
        return;
      }
      if (pending >= 16 || !allowWork()) { ws.close(1013, "Race server busy"); return; }
      pending++;
      queue = queue.then(async () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (message.type === "join" && roomId !== legacyRoom && !ctx.latest?.sessionKeyHash) {
          send(ws, { type: "joinResult", ok: false, message: "This lobby does not exist." });
          return;
        }
        const storageMessage = message.type === "join" ? { ...message, connectionNonce }
          : message.type === "boost" ? { type: "boost", boostId: message.boostId, playerToken }
          : message.type === "session:create" ? { type: "session:create", sessionKey: message.sessionKey, lobbyName: message.lobbyName }
          : message;
        const result = await ctx.storage.store.update(storageMessage, playerId);
        if (message.type === "session:create" && result.reply?.ok) await ctx.storage.registerLobby(result.state.lobbyName);
        if (result.reply) {
          if (result.reply.ok && message.type === "join") { playerId = result.reply.id; ws.playerId = playerId; playerToken = message.playerToken; }
          send(ws, result.reply);
        }
        accept(ctx, result.state);
        if (result.reply?.ok) deliver(ws, ctx.latest || result.state);
      }).catch(() => send(ws, { type: "serverError", message: "Could not update the race. Please try again." })).finally(() => { pending--; });
    });
    ws.on("close", (code, reason) => {
      clients.delete(ws);
      ctx.clients.delete(ws);
      clearTimeout(tapDrainTimer);
      queuedTaps = [];
      log("connection-close", { room: roomId, code, reason: reason?.toString() || "", playerId, clients: clients.size });
    });
    ws.on("error", () => {});
  });

  return { server: httpServer, wss, close() {
    for (const ctx of rooms.values()) {
      clearTimeout(ctx.countdownTimer);
      clearInterval(ctx.recoveryTimer);
      ctx.storage?.redis.disconnect();
      ctx.subscriber?.disconnect();
    }
    for (const ws of clients) ws.close();
    wss.close();
  } };
}

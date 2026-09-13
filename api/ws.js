import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const MAX_PLAYERS = 20;
const RACE_DISTANCE = 100;
const TAP_COOLDOWN_MS = 55;
const TAP_POWER = 1.45;
const STALE_PLAYER_MS = 45_000;

const state = globalThis.__swimRaceState ??= {
  clients: new Set(),
  players: new Map(),
  race: {
    state: "lobby",
    startedAt: null,
    winnerId: null,
    countdownEndsAt: null
  },
  countdownTimer: null
};

function cleanName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, 18);
}

function publicPlayers() {
  return [...state.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    distance: p.distance,
    finishedAt: p.finishedAt
  }));
}

function payload(type, data = {}) {
  return JSON.stringify({ type, ...data });
}

function send(ws, type, data = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(payload(type, data));
  }
}

function broadcast(type, data = {}) {
  const body = payload(type, data);
  for (const ws of state.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(body);
  }
}

function emitState() {
  broadcast("gameState", {
    race: state.race,
    players: publicPlayers()
  });
}

function resetRace() {
  if (state.countdownTimer) clearTimeout(state.countdownTimer);
  state.countdownTimer = null;
  state.race = {
    state: "lobby",
    startedAt: null,
    winnerId: null,
    countdownEndsAt: null
  };
  for (const p of state.players.values()) {
    p.distance = 0;
    p.finishedAt = null;
    p.lastTapAt = 0;
  }
  emitState();
}

function startCountdown() {
  if (state.players.size < 1 || state.race.state !== "lobby") return;

  state.race = {
    state: "countdown",
    startedAt: null,
    winnerId: null,
    countdownEndsAt: Date.now() + 3000
  };

  for (const p of state.players.values()) {
    p.distance = 0;
    p.finishedAt = null;
    p.lastTapAt = 0;
  }

  emitState();

  state.countdownTimer = setTimeout(() => {
    if (state.race.state !== "countdown") return;
    state.race = {
      ...state.race,
      state: "racing",
      startedAt: Date.now(),
      countdownEndsAt: null
    };
    emitState();
  }, 3000);
}

function removeStalePlayers() {
  const now = Date.now();
  let changed = false;
  for (const [id, player] of state.players.entries()) {
    if (!player.connected && now - player.lastSeenAt > STALE_PLAYER_MS) {
      state.players.delete(id);
      changed = true;
    }
  }
  if (changed) emitState();
}

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  state.clients.add(ws);
  ws.meta = { playerId: null, role: "viewer" };
  send(ws, "gameState", { race: state.race, players: publicPlayers() });

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (!message || typeof message.type !== "string") return;

    if (message.type === "join") {
      if (state.race.state !== "lobby") {
        send(ws, "joinResult", { ok: false, message: "A race is already in progress." });
        return;
      }

      const id = String(message.playerId ?? "").slice(0, 80);
      const name = cleanName(message.name);
      if (!id || !name) {
        send(ws, "joinResult", { ok: false, message: "Enter a name first." });
        return;
      }

      const existing = state.players.get(id);
      const duplicate = [...state.players.values()].some(
        (p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase()
      );

      if (duplicate) {
        send(ws, "joinResult", { ok: false, message: "That name is already taken." });
        return;
      }

      if (!existing && state.players.size >= MAX_PLAYERS) {
        send(ws, "joinResult", { ok: false, message: "This race is full." });
        return;
      }

      state.players.set(id, existing ? {
        ...existing,
        name,
        connected: true,
        lastSeenAt: Date.now()
      } : {
        id,
        name,
        distance: 0,
        finishedAt: null,
        lastTapAt: 0,
        connected: true,
        lastSeenAt: Date.now()
      });

      ws.meta = { playerId: id, role: "player" };
      send(ws, "joinResult", { ok: true, id });
      emitState();
      return;
    }

    if (message.type === "tap") {
      if (state.race.state !== "racing") return;
      const id = ws.meta?.playerId;
      const player = id ? state.players.get(id) : null;
      if (!player || player.finishedAt) return;

      const now = Date.now();
      player.lastSeenAt = now;
      if (now - player.lastTapAt < TAP_COOLDOWN_MS) return;
      player.lastTapAt = now;
      player.distance = Math.min(RACE_DISTANCE, player.distance + TAP_POWER);

      if (player.distance >= RACE_DISTANCE) {
        player.finishedAt = now;
        if (!state.race.winnerId) {
          state.race = { ...state.race, winnerId: player.id, state: "finished" };
          broadcast("winner", {
            id: player.id,
            name: player.name,
            timeMs: now - state.race.startedAt
          });
        }
      }
      emitState();
      return;
    }

    if (message.type === "presenter:start") {
      startCountdown();
      return;
    }

    if (message.type === "presenter:reset") {
      resetRace();
      return;
    }

    if (message.type === "presenter:clear") {
      state.players.clear();
      resetRace();
    }
  });

  ws.on("close", () => {
    state.clients.delete(ws);
    const id = ws.meta?.playerId;
    if (id && state.players.has(id)) {
      const player = state.players.get(id);
      player.connected = false;
      player.lastSeenAt = Date.now();
      setTimeout(removeStalePlayers, STALE_PLAYER_MS + 1000);
    }
  });

  ws.on("error", () => {});
});

export default httpServer;

import { boostStatus } from "./boost.js";
import { hashToken, validToken } from "./security.js";
import { normalizeSwimmer } from "../swimmers.js";

const DISTANCE_PER_TAP = 1.2;

export const initialState = () => ({
  revision: 0, players: [], sessionKeyHash: null, lobbyName: null,
  race: { state: "lobby", startedAt: null, winnerId: null, countdownEndsAt: null }
});

// May run again after a concurrent update; keep side effects outside this reducer.
export function applyCommand(state, message, playerId, now = Date.now()) {
  let reply = null;
  let changed = false;
  const race = state.race;
  if (race.state === "countdown" && now >= race.countdownEndsAt) {
    state.race = { ...race, state: "racing", startedAt: race.countdownEndsAt, countdownEndsAt: null };
    changed = true;
  }
  if (message.type === "session:create") {
    if (state.sessionKeyHash) reply = { type: "sessionCreated", ok: false, message: "This lobby already exists." };
    else {
      state.sessionKeyHash = hashToken(message.sessionKey);
      state.lobbyName = String(message.lobbyName || "Lobby").trim().replace(/[<>]/g, "").slice(0, 40) || "Lobby";
      reply = { type: "sessionCreated", ok: true };
      changed = true;
    }
  } else if (message.type === "join") {
    const id = String(message.playerId ?? "").slice(0, 80);
    const name = String(message.name ?? "").trim().replace(/[<>]/g, "").slice(0, 18);
    const existing = state.players.find(p => p.id === id);
    let error;
    if (!validToken(message.playerToken)) error = "Refresh the page to join securely.";
    else if (existing && existing.tokenHash !== hashToken(message.playerToken)) error = "Could not verify this player. Rejoin as a new player.";
    else if (!id || !name) error = "Enter a name first.";
    else if (!existing && state.race.state !== "lobby") error = "A race is already in progress.";
    else if (state.players.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) error = "That name is already taken.";
    else if (!existing && state.players.length >= 50) error = "This race is full.";
    if (error) reply = { type: "joinResult", ok: false, message: error };
    else {
      const swimmer = normalizeSwimmer(message.swimmer ?? existing?.swimmer);
      if (existing) {
        existing.name = name;
        existing.swimmer = swimmer;
        if (message.connectionNonce) existing.connectionNonce = message.connectionNonce;
      } else state.players.push({ id, name, swimmer, tokenHash: hashToken(message.playerToken), connectionNonce: message.connectionNonce, distance: 0, finishedAt: null, lastTapAt: 0 });
      reply = { type: "joinResult", ok: true, id };
      changed = true;
    }
  } else if (message.type === "leave") {
    const player = state.players.find(p => p.id === playerId);
    if (state.race.state === "lobby" && player && validToken(message.playerToken) && player.tokenHash === hashToken(message.playerToken) &&
      (!message.connectionNonce || player.connectionNonce === message.connectionNonce)) {
      state.players = state.players.filter(p => p.id !== playerId);
      if (!state.players.length) state.race = initialState().race;
      changed = true;
    }
  } else if (message.type === "boost" && state.race.state === "racing") {
    const player = state.players.find(p => p.id === playerId);
    const boost = boostStatus(state, playerId, now);
    if (player && validToken(message.playerToken) && player.tokenHash === hashToken(message.playerToken) &&
      boost && !boost.used && message.boostId === boost.id && now >= boost.opensAt && now < boost.expiresAt) {
      player.lastBoostId = boost.id;
      player.distance = Math.min(100, player.distance + 6);
      if (player.distance >= 100) {
        player.finishedAt = now;
        state.race = { ...state.race, state: "finished", winnerId: player.id };
      }
      changed = true;
    }
  } else if (["tap", "tapBatch"].includes(message.type) && state.race.state === "racing") {
    const player = state.players.find(p => p.id === playerId);
    if (player && validToken(message.playerToken) && player.tokenHash === hashToken(message.playerToken) && !player.finishedAt) {
      // Batch times come from server receipt, never the client's message.
      // Processing delays must not make valid taps collide with a wall-clock cooldown.
      const taps = message.type === "tapBatch"
        ? (message.startedAt === state.race.startedAt && Array.isArray(message.taps) ? message.taps.slice(0, 3) : [])
        : [now];
      for (const tappedAt of taps) {
        if (!Number.isFinite(tappedAt) || tappedAt > now || tappedAt < state.race.startedAt || tappedAt - player.lastTapAt < 55) continue;
        player.lastTapAt = tappedAt;
        player.distance = Math.min(100, player.distance + DISTANCE_PER_TAP);
        changed = true;
        if (player.distance >= 100) {
          player.finishedAt = tappedAt;
          state.race = { ...state.race, state: "finished", winnerId: player.id };
          break;
        }
      }
    }
  } else if (message.type === "presenter:start" && state.race.state === "lobby" && state.players.length) {
    state.race = { state: "countdown", startedAt: null, winnerId: null, countdownEndsAt: now + 3000 };
    changed = true;
  } else if (["presenter:reset", "presenter:clear"].includes(message.type)) {
    state.race = initialState().race;
    if (message.type === "presenter:clear") state.players = [];
    for (const player of state.players) {
      player.distance = 0;
      player.finishedAt = null;
      player.lastTapAt = 0;
      player.lastBoostId = null;
    }
    changed = true;
  }
  return { changed, reply };
}

export function publicState(state) {
  return {
    type: "gameState", race: state.race, lobbyName: state.lobbyName,
    players: state.players.map(({ id, name, swimmer, distance, finishedAt }) => ({ id, name, swimmer, distance, finishedAt }))
  };
}

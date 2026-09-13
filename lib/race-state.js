export const initialState = () => ({
  revision: 0, players: [],
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
  if (message.type === "join") {
    const id = String(message.playerId ?? "").slice(0, 80);
    const name = String(message.name ?? "").trim().replace(/[<>]/g, "").slice(0, 18);
    const existing = state.players.find(p => p.id === id);
    let error;
    if (!id || !name) error = "Enter a name first.";
    else if (!existing && state.race.state !== "lobby") error = "A race is already in progress.";
    else if (state.players.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) error = "That name is already taken.";
    else if (!existing && state.players.length >= 20) error = "This race is full.";
    if (error) reply = { type: "joinResult", ok: false, message: error };
    else {
      if (existing) existing.name = name;
      else state.players.push({ id, name, distance: 0, finishedAt: null, lastTapAt: 0 });
      reply = { type: "joinResult", ok: true, id };
      changed = true;
    }
  } else if (message.type === "tap" && state.race.state === "racing") {
    const player = state.players.find(p => p.id === playerId);
    if (player && !player.finishedAt && now - player.lastTapAt >= 55) {
      player.lastTapAt = now;
      player.distance = Math.min(100, player.distance + 1.45);
      if (player.distance >= 100) {
        player.finishedAt = now;
        state.race = { ...state.race, state: "finished", winnerId: player.id };
      }
      changed = true;
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
    }
    changed = true;
  }
  return { changed, reply };
}

export function publicState(state) {
  return { type: "gameState", race: state.race,
    players: state.players.map(({ lastTapAt, ...player }) => player) };
}

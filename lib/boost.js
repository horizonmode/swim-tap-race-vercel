import { createHash } from 'node:crypto';

// Random-looking windows are stable across instances, retries and reconnects.
export function boostStatus(state, playerId, now = Date.now()) {
  const player = state.players.find(p => p.id === playerId);
  if (!player || state.race.state !== 'racing' || player.finishedAt) return null;
  const start = state.race.startedAt;
  const slot = Math.max(0, Math.floor((now - start) / 10000));
  const id = `${start}:${slot}`;
  const random = createHash('sha256').update(`${player.tokenHash}:${id}`).digest().readUInt32BE(0);
  const opensAt = start + slot * 10000 + 3000 + random % 4001;
  return { id, opensAt, expiresAt: opensAt + 3000, used: player.lastBoostId === id };
}

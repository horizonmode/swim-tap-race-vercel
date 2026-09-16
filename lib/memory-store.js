import { EventEmitter } from 'node:events';
import { initialState, applyCommand } from './race-state.js';

// Local play uses exactly the same protocol, validation and permissions as Redis play.
export function createMemoryStore(roomId = 'default', registry = new Map()) {
  let state = initialState();
  const redis = new EventEmitter();
  redis.disconnect = () => {};
  redis.duplicate = () => {
    const subscriber = new EventEmitter();
    subscriber.subscribe = async () => {};
    subscriber.disconnect = () => {};
    return subscriber;
  };
  const result = { redis, store: {
    channel: 'local',
    async read() { return structuredClone(state); },
    async update(message, playerId, now = Date.now()) {
      const result = applyCommand(state, message, playerId, now);
      if (result.changed) state.revision++;
      return { state: structuredClone(state), reply: result.reply };
    }
  },
  async registerLobby(name) { registry.set(roomId, { name, createdAt: Date.now(), read: result.store.read }); },
  async listLobbies() {
    return Promise.all([...registry].map(async ([id, entry]) => {
      const current = await entry.read();
      return { id, name: entry.name, createdAt: entry.createdAt, status: current.race.state, players: current.players.length };
    }));
  } };
  return result;
}

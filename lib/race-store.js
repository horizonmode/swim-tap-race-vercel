import { Redis } from "ioredis";
import { applyCommand, initialState } from "./race-state.js";

// Atomically compare, write and publish: simultaneous taps cannot overwrite each other.
export const COMMIT_SCRIPT = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('PUBLISH', KEYS[2], ARGV[2])
return 1
`;

export function createStore(redis, key) {
  const channel = `${key}:updates`;
  return {
    channel,
    async read() {
      return JSON.parse(await redis.get(key) || JSON.stringify(initialState()));
    },
    async update(message, playerId, now = Date.now()) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const raw = await redis.get(key) || "";
        const next = raw ? JSON.parse(raw) : initialState();
        const { changed, reply } = applyCommand(next, message, playerId, now);
        if (!changed) return { state: next, reply };
        next.revision++;
        if (await redis.eval(COMMIT_SCRIPT, 2, key, channel, raw, JSON.stringify(next))) {
          return { state: next, reply };
        }
      }
      throw new Error("Race update contention");
    }
  };
}

export function createRedisStore() {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required for deployed multiplayer");
  const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1, connectTimeout: 5000, commandTimeout: 5000
  });
  // Never log connection URLs or credentials.
  redis.on("error", () => console.error("Race storage connection failed"));
  const environment = process.env.VERCEL_ENV || "development";
  const store = createStore(redis, `swim-race:${process.env.RACE_ROOM || environment}:v1`);
  return { redis, store };
}

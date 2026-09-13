import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createStore } from '../lib/race-store.js';
import { createRaceServer } from '../lib/race-server.js';

// Shared Redis test double implements compare-and-set plus subscriber delivery.
// Two server factories have separate memory and sockets, as on Vercel.
function database() {
  let raw = null;
  const subscribers = new Set();
  function client() {
    const redis = new EventEmitter();
    redis.get = async () => raw;
    redis.eval = async (_script, _count, _key, channel, expected, next) => {
      if ((raw || '') !== expected) return 0;
      raw = next;
      for (const subscriber of subscribers) queueMicrotask(() => subscriber.emit('message', channel, next));
      return 1;
    };
    redis.duplicate = client;
    redis.subscribe = async () => { subscribers.add(redis); };
    redis.disconnect = () => subscribers.delete(redis);
    return redis;
  }
  return () => { const redis = client(); return { redis, store: createStore(redis, 'test') }; };
}
function socket(server) {
  const ws = new EventEmitter();
  ws.readyState = 1;
  ws.messages = [];
  ws.send = raw => ws.messages.push(JSON.parse(raw));
  ws.close = () => { ws.readyState = 3; ws.emit('close'); };
  server.wss.emit('connection', ws);
  ws.command = data => ws.emit('message', JSON.stringify(data));
  return ws;
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('player join on one instance updates a presenter on another, including immediate join and reconnect', async t => {
  const storage = database();
  const a = createRaceServer(storage, undefined, { presenterKey: 'test-presenter-key-000000000000000' });
  const b = createRaceServer(storage);
  t.after(() => { a.close(); b.close(); });
  const presenter = socket(a);
  const player = socket(b);
  player.command({ type: 'join', playerId: 'one', playerToken: 'test-player-token-0000000000000000', name: 'Swimmer', swimmer: 'cat' });
  await settle();
  assert.equal(player.messages.find(m => m.type === 'joinResult').ok, true);
  assert.equal(presenter.messages.filter(m => m.type === 'gameState').at(-1).players[0].name, 'Swimmer');
  assert.equal(presenter.messages.filter(m => m.type === 'gameState').at(-1).players[0].swimmer, 'cat');
  presenter.command({ type: 'presenter:auth', key: 'test-presenter-key-000000000000000' });
  presenter.command({ type: 'presenter:start' });
  await settle();
  assert.equal(player.messages.filter(m => m.type === 'gameState').at(-1).race.state, 'countdown');
  player.close();
  const reconnected = socket(b);
  reconnected.command({ type: 'join', playerId: 'one', playerToken: 'test-player-token-0000000000000000', name: 'Swimmer' });
  await settle();
  assert.equal(reconnected.messages.find(m => m.type === 'joinResult').ok, true);
  assert.equal(reconnected.messages.filter(m => m.type === 'gameState').at(-1).players[0].swimmer, 'cat');
  // Finish the race, then reset from the presenter on the other instance.
  const store = storage().store;
  const started = await store.read();
  const startAt = started.race.countdownEndsAt;
  for (let tap = 0; tap < 69; tap++) {
    await store.update({ type: 'tap', playerToken: 'test-player-token-0000000000000000' }, 'one', startAt + tap * 60);
  }
  await settle();
  assert.equal(reconnected.messages.filter(m => m.type === 'gameState').at(-1).race.state, 'finished');
  presenter.command({ type: 'presenter:reset' });
  await settle();
  for (const client of [presenter, reconnected]) {
    const reset = client.messages.filter(m => m.type === 'gameState').at(-1);
    assert.equal(reset.race.state, 'lobby');
    assert.equal(reset.race.winnerId, null);
    assert.equal(reset.players[0].distance, 0);
    assert.equal(reset.players[0].finishedAt, null);
    assert.equal(reset.players[0].swimmer, 'cat');
  }
  presenter.command({ type: 'presenter:clear' });
  await settle();
  assert.equal(reconnected.messages.filter(m => m.type === 'gameState').at(-1).players.length, 0);
});

test('concurrent instances preserve joins, enforce unique names and keep a single winner', async () => {
  const storage = database();
  const a = storage().store;
  const b = storage().store;
  await Promise.all([
    a.update({ type: 'join', playerId: 'a', playerToken: 'test-player-token-0000000000000000', name: 'A' }, null, 1000),
    b.update({ type: 'join', playerId: 'b', playerToken: 'test-player-token-0000000000000000', name: 'B' }, null, 1000)
  ]);
  assert.equal((await a.read()).players.length, 2);
  const duplicates = await Promise.all([
    a.update({ type: 'join', playerId: 'c', playerToken: 'test-player-token-0000000000000000', name: 'Same' }),
    b.update({ type: 'join', playerId: 'd', playerToken: 'test-player-token-0000000000000000', name: 'Same' })
  ]);
  assert.equal(duplicates.filter(result => result.reply.ok).length, 1);
  await a.update({ type: 'presenter:start' }, null, 1000);
  // Any instance can advance a countdown after the original instance disappears.
  await b.update({ type: 'tick' }, null, 4000);
  for (let tap = 0; tap < 69; tap++) {
    await Promise.all([a.update({ type: 'tap', playerToken: 'test-player-token-0000000000000000' }, 'a', 4000 + tap * 60), b.update({ type: 'tap', playerToken: 'test-player-token-0000000000000000' }, 'b', 4000 + tap * 60)]);
  }
  const result = await a.read();
  assert.equal(result.race.state, 'finished');
  assert.equal(result.players.filter(p => p.finishedAt).length, 1);
  assert.equal(result.race.winnerId, result.players.find(p => p.finishedAt).id);
  await b.update({ type: 'presenter:reset' }, null, 10000);
  const reset = await a.read();
  assert.equal(reset.race.state, 'lobby');
  assert.ok(reset.players.every(p => p.distance === 0 && p.finishedAt === null));
});

test('simultaneous taps for the same player cannot bypass the cooldown', async () => {
  const storage = database();
  const a = storage().store;
  const b = storage().store;
  await a.update({ type: 'join', playerId: 'a', playerToken: 'test-player-token-0000000000000000', name: 'A' }, null, 1000);
  await a.update({ type: 'presenter:start' }, null, 1000);
  await a.update({ type: 'tick' }, null, 4000);
  await Promise.all([a.update({ type: 'tap', playerToken: 'test-player-token-0000000000000000' }, 'a', 4000), b.update({ type: 'tap', playerToken: 'test-player-token-0000000000000000' }, 'a', 4000)]);
  assert.equal((await a.read()).players[0].distance, 1.45);
});

test('missing storage reports an error instead of accepting a disconnected local-only join', async t => {
  const server = createRaceServer(() => { throw new Error('Missing Redis'); });
  t.after(() => server.close());
  const player = socket(server);
  player.command({ type: 'join', playerId: 'a', playerToken: 'test-player-token-0000000000000000', name: 'A' });
  await settle();
  assert.equal(player.messages[0].type, 'serverError');
  assert.equal(player.readyState, 3);
  assert.ok(!player.messages.some(m => m.type === 'joinResult' && m.ok));
});

test('character choices persist through reset and invalid choices fall back safely', async () => {
  const store = database()().store;
  await store.update({ type: 'join', playerId: 'dog', playerToken: 'test-player-token-0000000000000000', name: 'Dog', swimmer: 'dog' });
  await store.update({ type: 'join', playerId: 'frog', playerToken: 'test-player-token-0000000000000000', name: 'Frog', swimmer: 'frog' });
  await store.update({ type: 'join', playerId: 'bad', playerToken: 'test-player-token-0000000000000000', name: 'Fallback', swimmer: '<script>' });
  await store.update({ type: 'presenter:reset' });
  assert.deepEqual((await store.read()).players.map(p => p.swimmer), ['dog', 'frog', 'human']);
});

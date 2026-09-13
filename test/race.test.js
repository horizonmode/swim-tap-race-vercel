import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createStore } from '../lib/race-store.js';
import { createRaceServer } from '../lib/race-server.js';
import { createMemoryStore } from '../lib/memory-store.js';
import { allowedUpgrade, configuredOrigins } from '../lib/security.js';
import { publicState } from '../lib/race-state.js';
const TOKEN = 'test-player-token-with-at-least-32-characters';
const KEY = 'test-presenter-key-with-at-least-32-characters';

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
  const b = createRaceServer(storage, undefined, { presenterKey: KEY });
  t.after(() => { a.close(); b.close(); });
  const presenter = socket(a);
  presenter.command({ type: 'presenter:auth', key: KEY });
  const player = socket(b);
  player.command({ type: 'join', playerToken: TOKEN, playerId: 'one', playerToken: 'test-player-token-0000000000000000', name: 'Swimmer', swimmer: 'cat' });
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
  reconnected.command({ type: 'join', playerToken: TOKEN, playerId: 'one', playerToken: 'test-player-token-0000000000000000', name: 'Swimmer' });
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
    a.update({ type: 'join', playerToken: TOKEN, playerId: 'a', playerToken: 'test-player-token-0000000000000000', name: 'A' }, null, 1000),
    b.update({ type: 'join', playerToken: TOKEN, playerId: 'b', playerToken: 'test-player-token-0000000000000000', name: 'B' }, null, 1000)
  ]);
  assert.equal((await a.read()).players.length, 2);
  const duplicates = await Promise.all([
    a.update({ type: 'join', playerToken: TOKEN, playerId: 'c', playerToken: 'test-player-token-0000000000000000', name: 'Same' }),
    b.update({ type: 'join', playerToken: TOKEN, playerId: 'd', playerToken: 'test-player-token-0000000000000000', name: 'Same' })
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
  await a.update({ type: 'join', playerToken: TOKEN, playerId: 'a', playerToken: 'test-player-token-0000000000000000', name: 'A' }, null, 1000);
  await a.update({ type: 'presenter:start' }, null, 1000);
  await a.update({ type: 'tick' }, null, 4000);
  await Promise.all([a.update({ type: 'tap', playerToken: 'test-player-token-0000000000000000' }, 'a', 4000), b.update({ type: 'tap', playerToken: 'test-player-token-0000000000000000' }, 'a', 4000)]);
  assert.equal((await a.read()).players[0].distance, 1.45);
});

test('missing storage reports an error instead of accepting a disconnected local-only join', async t => {
  const server = createRaceServer(() => { throw new Error('Missing Redis'); });
  t.after(() => server.close());
  const player = socket(server);
  player.command({ type: 'join', playerToken: TOKEN, playerId: 'a', playerToken: 'test-player-token-0000000000000000', name: 'A' });
  await settle();
  assert.equal(player.messages[0].type, 'serverError');
  assert.equal(player.readyState, 3);
  assert.ok(!player.messages.some(m => m.type === 'joinResult' && m.ok));
});

test('character choices persist through reset and invalid choices fall back safely', async () => {
  const store = database()().store;
  await store.update({ type: 'join', playerToken: TOKEN, playerId: 'dog', playerToken: 'test-player-token-0000000000000000', name: 'Dog', swimmer: 'dog' });
  await store.update({ type: 'join', playerToken: TOKEN, playerId: 'frog', playerToken: 'test-player-token-0000000000000000', name: 'Frog', swimmer: 'frog' });
  await store.update({ type: 'join', playerToken: TOKEN, playerId: 'bad', playerToken: 'test-player-token-0000000000000000', name: 'Fallback', swimmer: '<script>' });
  await store.update({ type: 'presenter:reset' });
  assert.deepEqual((await store.read()).players.map(p => p.swimmer), ['dog', 'frog', 'human']);
});

for (const [mode, getStorage] of [['memory', createMemoryStore], ['redis', database()]]) {
  test(`${mode}: reject every unauthorized presenter action, allow correct key`, async t => {
    const server = createRaceServer(getStorage, undefined, { presenterKey: KEY });
    t.after(() => server.close());
    const player = socket(server);
    player.command({ type: 'join', playerId: 'victim', playerToken: TOKEN, name: 'Victim' });
    await settle();
    for (const type of ['presenter:start', 'presenter:reset', 'presenter:clear']) player.command({ type });
    await settle();
    assert.equal(player.messages.filter(m => m.type === 'serverError').length, 3);
    assert.equal(player.messages.filter(m => m.type === 'gameState').at(-1).race.state, 'lobby');
    player.command({ type: 'presenter:auth', key: 'x'.repeat(32) });
    assert.equal(player.messages.at(-1).ok, false);
    player.command({ type: 'presenter:auth', key: KEY });
    player.command({ type: 'presenter:clear' });
    await settle();
    assert.equal(player.messages.filter(m => m.type === 'gameState').at(-1).players.length, 0);
  });

  test(`${mode}: reject null, arrays, malformed JSON, missing tokens and oversized messages without crashing`, async t => {
    const server = createRaceServer(getStorage);
    t.after(() => server.close());
    for (const raw of ['null', '[]', '{', '{"type":"join","playerId":"x","name":"X"}', ' '.repeat(4097)]) {
      const client = socket(server);
      assert.doesNotThrow(() => client.emit('message', raw));
      assert.equal(client.readyState, 3);
    }
    await settle();
    const valid = socket(server);
    valid.command({ type: 'join', playerToken: TOKEN, playerId: 'safe', name: 'Safe' });
    await settle();
    assert.equal(valid.messages.find(m => m.type === 'joinResult').ok, true);
  });
}

test('public IDs cannot be used to take over players and tokens never appear in broadcasts', async t => {
  const storage = database();
  const server = createRaceServer(storage);
  t.after(() => server.close());
  const victim = socket(server);
  victim.command({ type: 'join', playerToken: TOKEN, playerId: 'victim', name: 'Original' });
  await settle();
  const attacker = socket(server);
  attacker.command({ type: 'join', playerToken: 'attacker-token-with-at-least-32-characters', playerId: 'victim', name: 'Changed' });
  await settle();
  assert.equal(attacker.messages.find(m => m.type === 'joinResult').ok, false);
  assert.equal((await storage().store.read()).players[0].name, 'Original');
  const snapshot = publicState(await storage().store.read());
  assert.ok(!('tokenHash' in snapshot.players[0]));
  assert.ok(!JSON.stringify(attacker.messages).includes(TOKEN));
  victim.close();
  const reconnect = socket(server);
  reconnect.command({ type: 'join', playerToken: TOKEN, playerId: 'victim', name: 'Original' });
  await settle();
  assert.equal(reconnect.messages.find(m => m.type === 'joinResult').ok, true);
});

test('connection cap, message rate and pending queue limits prevent unbounded work', async t => {
  const server = createRaceServer(createMemoryStore, undefined, { maxClients: 2 });
  t.after(() => server.close());
  const first = socket(server);
  const second = socket(server);
  assert.equal(socket(server).readyState, 3);
  for (let i = 0; i < 61; i++) first.command({ type: 'tap' });
  assert.equal(first.readyState, 3);
  second.close();
  let release;
  let updates = 0;
  const slow = createMemoryStore();
  slow.store.update = () => { updates++; return new Promise(resolve => { release = resolve; }); };
  const queued = createRaceServer(() => slow, undefined, { presenterKey: KEY });
  t.after(() => queued.close());
  const client = socket(queued);
  await settle();
  client.command({ type: 'presenter:auth', key: KEY });
  for (let i = 0; i < 17; i++) client.command({ type: 'presenter:reset' });
  assert.equal(client.readyState, 3);
  assert.equal(updates, 1); // No queued command reached storage.
  release({ state: { revision: 0, race: { state: 'lobby' }, players: [] } });
  await settle();
});

test('only exact allowed origins and the intended WebSocket path pass the upgrade guard', () => {
  const origins = configuredOrigins({ ALLOWED_ORIGINS: 'https://game.example', VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'game.vercel.app' });
  const request = origin => ({ url: '/api/ws', headers: { origin } });
  assert.equal(allowedUpgrade(request('https://game.example'), origins), true);
  assert.equal(allowedUpgrade(request('https://game.vercel.app'), origins), true);
  for (const origin of [undefined, 'null', 'https://evil.example', 'https://game.example.evil.example', 'http://game.example']) {
    assert.equal(allowedUpgrade(request(origin), origins), false);
  }
  assert.equal(allowedUpgrade({ url: '/other', headers: { origin: 'https://game.example' } }, origins), false);
});

test('missing presenter key fails closed and five wrong keys disconnect the client', async t => {
  const server = createRaceServer(createMemoryStore, undefined, { presenterKey: '' });
  t.after(() => server.close());
  const client = socket(server);
  for (let i = 0; i < 5; i++) client.command({ type: 'presenter:auth', key: KEY });
  assert.equal(client.readyState, 3);
  assert.ok(client.messages.every(m => m.type !== 'presenterAuth' || !m.ok));
  await settle();
});

test('an old connection token cannot tap for a player ID reused after clearing', async () => {
  const store = createMemoryStore().store;
  await store.update({ type: 'join', playerId: 'same', playerToken: TOKEN, name: 'Old' });
  await store.update({ type: 'presenter:clear' });
  const newToken = 'new-player-private-token-at-least-32-characters';
  await store.update({ type: 'join', playerId: 'same', playerToken: newToken, name: 'New' });
  await store.update({ type: 'presenter:start' }, null, 1000);
  await store.update({ type: 'tap', playerToken: TOKEN }, 'same', 4000);
  assert.equal((await store.read()).players[0].distance, 0);
  await store.update({ type: 'tap', playerToken: newToken }, 'same', 4000);
  assert.equal((await store.read()).players[0].distance, 1.45);
});

test('presenter keys accept a single character, words and phrases while rejecting incorrect values', async t => {
  for (const key of ['a', 'swim', 'pool party', '泳ぐ']) {
    const server = createRaceServer(createMemoryStore, undefined, { presenterKey: key });
    t.after(() => server.close());
    const client = socket(server);
    client.command({ type: 'presenter:auth', key: key + 'wrong' });
    assert.equal(client.messages.at(-1).ok, false);
    client.command({ type: 'presenter:auth', key });
    assert.equal(client.messages.at(-1).ok, true);
    client.close();
  }
  await settle();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../lib/memory-store.js';
import { boostStatus } from '../lib/boost.js';
const token = 'boost-test-private-token-00000000000000';

async function setup() {
  const store = createMemoryStore().store;
  await store.update({ type: 'join', playerId: 'boost', playerToken: token, name: 'Boost' }, null, 1000);
  await store.update({ type: 'presenter:start' }, null, 1000);
  await store.update({ type: 'tick' }, null, 4000);
  return store;
}
test('boost is timed, authenticated, single-use and stable across instances', async () => {
  const store = await setup();
  const state = await store.read();
  const boost = boostStatus(state, 'boost', 4000);
  assert.deepEqual(boostStatus(structuredClone(state), 'boost', 4000), boost);
  const claim = { type: 'boost', boostId: boost.id, playerToken: token };
  await store.update(claim, 'boost', boost.opensAt - 1);
  assert.equal((await store.read()).players[0].distance, 0);
  await store.update({ ...claim, playerToken: 'wrong-private-token-000000000000000000' }, 'boost', boost.opensAt);
  assert.equal((await store.read()).players[0].distance, 0);
  await store.update(claim, 'boost', boost.opensAt);
  assert.equal((await store.read()).players[0].distance, 6);
  await store.update(claim, 'boost', boost.opensAt + 1);
  assert.equal((await store.read()).players[0].distance, 6);
});
test('expired boosts fail and an eligible boost can finish a race', async () => {
  const store = await setup();
  const boost = boostStatus(await store.read(), 'boost', 4000);
  const claim = { type: 'boost', boostId: boost.id, playerToken: token };
  await store.update(claim, 'boost', boost.expiresAt);
  assert.equal((await store.read()).players[0].distance, 0);
  for (let i = 0; i < 79; i++) await store.update({ type: 'tap', playerToken: token }, 'boost', 4000 + i * 60);
  const later = boostStatus(await store.read(), 'boost', 14000);
  await store.update({ ...claim, boostId: later.id }, 'boost', later.opensAt);
  assert.equal((await store.read()).race.state, 'finished');
  assert.equal((await store.read()).players[0].distance, 100);
  assert.equal(boostStatus(await store.read(), 'boost', later.opensAt), null);
});

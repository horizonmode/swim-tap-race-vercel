import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresenterSession } from '../src/presenter-session.js';
import { motionDuration } from '../src/swimmer-motion.js';

test('session key survives form clearing and reconnect, but is discarded after rejection', () => {
  const messages = [];
  const session = createPresenterSession((type, data) => { messages.push({ type, ...data }); return true; });
  let input = 'swim';
  assert.equal(session.authenticate(input), true);
  input = '';
  session.reconnect();
  assert.deepEqual(messages, [{ type: 'presenter:auth', key: 'swim' }, { type: 'presenter:auth', key: 'swim' }]);
  session.clear();
  session.reconnect();
  assert.equal(messages.length, 2);
});

test('failed sends do not replace the saved credential', () => {
  const messages = [];
  let connected = true;
  const session = createPresenterSession((type, data) => { if (!connected) return false; messages.push(data); return true; });
  session.authenticate('first');
  connected = false;
  assert.equal(session.authenticate('unsent'), false);
  connected = true;
  session.reconnect();
  assert.equal(messages.at(-1).key, 'first');
});

test('movement smooths delayed progress and snaps back on reset', () => {
  assert.equal(motionDuration(0, 1.2, true), 140);
  assert.ok(motionDuration(0, 3.6, true) >= 165);
  assert.equal(motionDuration(0, 14.4, true), 660);
  assert.equal(motionDuration(50, 0, true), 0);
  assert.equal(motionDuration(50, 0, false), 0);
});

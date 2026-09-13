import test from 'node:test';
import assert from 'node:assert/strict';
import { createResults } from '../results.js';

function element() {
  const listeners = new Map();
  const children = new Map();
  const classes = new Set();
  return {
    open: false,
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    setAttribute() {}, appendChild() {}, replaceChildren() {},
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, element());
      return children.get(selector);
    },
    addEventListener(type, callback) { listeners.set(type, callback); },
    showModal() { this.open = true; },
    close() {
      if (!this.open) return;
      this.open = false;
      queueMicrotask(() => listeners.get('close')?.());
    }
  };
}

test('presenter dismissal resets once; broadcast lobby closes client results without another reset', async t => {
  const dialogs = [];
  const original = globalThis.document;
  globalThis.document = {
    body: element(),
    createElement(tag) {
      const node = element();
      if (tag === 'dialog') dialogs.push(node);
      return node;
    }
  };
  t.after(() => {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  let resets = 0;
  const presenter = createResults(element(), { onDismiss: () => resets++ });
  const client = createResults(element());
  const finished = { race: { state: 'finished' }, players: [] };
  const lobby = { race: { state: 'lobby' }, players: [] };
  presenter(finished);
  client(finished);
  dialogs[0].close();
  await Promise.resolve();
  assert.equal(resets, 1);
  presenter(lobby);
  client(lobby);
  await Promise.resolve();
  assert.equal(dialogs[1].open, false);
  assert.equal(resets, 1);
  // A reset from another presenter must not cause an extra command.
  presenter(finished);
  presenter(lobby);
  await Promise.resolve();
  assert.equal(resets, 1);
});

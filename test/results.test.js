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
  t.mock.method(globalThis, 'document', undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resultsLifecycle, rankPlayers } from '../src/results-model.js';

test('presenter dismissal resets once; a state-driven close does not reset again', () => {
  let resets = 0;
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const lifecycle = resultsLifecycle(dialog, () => resets++);
  lifecycle.update('finished');
  assert.equal(dialog.open, true);
  dialog.close(); lifecycle.dismiss(); lifecycle.dismiss();
  assert.equal(resets, 1);
  lifecycle.update('lobby');
  lifecycle.update('finished');
  lifecycle.update('lobby');
  lifecycle.dismiss();
  assert.equal(dialog.open, false);
  assert.equal(resets, 1);
});

test('results prioritize the winner, preserve ties, and format time and progress', () => {
  const players = [
    { id: 'b', name: 'B', distance: 50, finishedAt: null },
    { id: 'winner', name: 'Winner', distance: 100, finishedAt: 7000 },
    { id: 'a', name: 'A', distance: 50, finishedAt: null }
  ];
  const rows = rankPlayers({ winnerId: 'winner', startedAt: 4000 }, players);
  assert.deepEqual(rows.map(row => row.rank), [1, 2, 2]);
  assert.deepEqual(rows.map(row => row.result), ['3.00s', '50.0%', '50.0%']);
  assert.deepEqual(players.map(player => player.id), ['b', 'winner', 'a']);
});

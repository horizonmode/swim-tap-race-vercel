import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPublicFile } from '../lib/static-files.js';

test('serves built files, rejects traversal and symlinks, never falls back to repository files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'swim-static-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist/assets'), { recursive: true });
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, '.env'), 'fixture-secret');
  await writeFile(join(root, 'dist/index.html'), 'built page');
  await writeFile(join(root, 'dist/admin.html'), 'admin page');
  await writeFile(join(root, 'dist/assets/app-hash.js'), 'built script');
  await writeFile(join(root, 'assets/fallback.js'), 'private fallback');
  await symlink(join(root, '.env'), join(root, 'dist/assets/link.js'));
  assert.equal((await readPublicFile(root, '/?test=1')).data.toString(), 'built page');
  assert.equal((await readPublicFile(root, '/assets/app-hash.js?v=1')).data.toString(), 'built script');
  assert.equal((await readPublicFile(root, '/.admin')).data.toString(), 'admin page');
  assert.equal((await readPublicFile(root, '/admin')).data.toString(), 'admin page');
  for (const path of ['/.env', '/assets/../../.env', '/assets/../index.html', '/assets/%2e%2e/%2e%2e/.env', '/assets/..\\..\\.env', '/assets/link.js', '/assets/fallback.js']) {
    assert.equal(await readPublicFile(root, path), null, path);
  }
});

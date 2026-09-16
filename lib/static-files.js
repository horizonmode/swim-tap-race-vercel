import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';

// Only built entry pages and flat Vite assets are public. Resolve symlinks too.
export async function readPublicFile(root, requestUrl) {
  const path = (requestUrl || '').split('?')[0];
  const page = { '/': 'index.html', '/index.html': 'index.html', '/race': 'race.html', '/race.html': 'race.html', '/.admin': 'admin.html', '/admin': 'admin.html', '/admin.html': 'admin.html' }[path];
  const asset = /^\/assets\/[a-zA-Z0-9_.-]+\.(js|css|png|svg|webp|woff2?)$/.test(path);
  if (!page && !asset) return null;
  try {
    const base = await realpath(resolve(root, 'dist', asset ? 'assets' : '.'));
    const file = await realpath(resolve(root, 'dist', page || path.slice(1)));
    const location = relative(base, file);
    if (!location || location.startsWith('..') || isAbsolute(location)) return null;
    return { data: await readFile(file), extension: extname(file) };
  } catch { return null; }
}

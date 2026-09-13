import { createHash, timingSafeEqual } from 'node:crypto';

export const hashToken = value => createHash('sha256').update(value).digest('hex');
export function sameSecret(value, expected) {
  return typeof value === 'string' && typeof expected === 'string' && expected.length > 0 &&
    timingSafeEqual(Buffer.from(hashToken(value), 'hex'), Buffer.from(hashToken(expected), 'hex'));
}
export const validToken = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{32,128}$/.test(value);

export function validMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
  if (message.type === 'presenter:auth') return typeof message.key === 'string' && message.key.length > 0 && message.key.length <= 256;
  if (message.type === 'join') return typeof message.playerId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(message.playerId) &&
    typeof message.name === 'string' && message.name.trim().length > 0 && message.name.length <= 80 && validToken(message.playerToken) &&
    (message.swimmer === undefined || typeof message.swimmer === 'string' && message.swimmer.length <= 20);
  return ['tap', 'leave', 'presenter:start', 'presenter:reset', 'presenter:clear'].includes(message.type);
}

export function configuredOrigins(env = process.env) {
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_ENV === 'production' ? env.VERCEL_PROJECT_PRODUCTION_URL : null]) {
    if (host) origins.push(`https://${host}`);
  }
  return new Set(origins);
}
export function allowedUpgrade(request, origins) {
  return request?.url === '/api/ws' && typeof request.headers?.origin === 'string' && origins.has(request.headers.origin);
}

export function tokenBucket(capacity, perSecond) {
  let remaining = capacity;
  let updated = Date.now();
  return () => {
    const now = Date.now();
    remaining = Math.min(capacity, remaining + (now - updated) * perSecond / 1000);
    updated = now;
    if (remaining < 1) return false;
    remaining--;
    return true;
  };
}

// One admin password (ADMIN_PASSWORD in Vercel). A signed cookie keeps you signed in for 30 days;
// the same cookie turns on previews of scheduled articles on the site.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError, env, optEnv } from './http';

export const COOKIE = 'nf_admin';
const MAX_AGE = 60 * 60 * 24 * 30;

const key = () => optEnv('SESSION_SECRET') || `nf:${env('ADMIN_PASSWORD')}`;
const sign = (p: string) => createHmac('sha256', key()).update(p).digest('base64url');

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(given: string): boolean {
  return safeEqual(sign(`pw:${given}`), sign(`pw:${env('ADMIN_PASSWORD')}`));
}

export function sessionCookie(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString('base64url');
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function isAdmin(req: Request): boolean {
  if (!process.env.ADMIN_PASSWORD) return false;
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number };
    return typeof exp === 'number' && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request): void {
  if (!isAdmin(req)) throw new HttpError(401, 'Please sign in.');
}

// Cron and the database's pg_cron poke: Authorization: Bearer <TICK_SECRET>.
export function isTick(req: Request): boolean {
  const s = process.env.TICK_SECRET;
  const h = req.headers.get('authorization') ?? '';
  return !!s && safeEqual(h, `Bearer ${s}`);
}

// Wrong-password limit: 5 tries per address in 15 minutes, then that address waits 15 minutes.
// Counted in the database (so every server instance sees it) with an in-memory fallback.
const FAIL_LIMIT = 5;
const WINDOW_MS = 15 * 60_000;
type Fails = { count: number; first: number; lockedUntil: number };
const memFails = new Map<string, Fails>();

export function clientKey(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  return `login_fail:${createHmac('sha256', 'nf-login').update(ip).digest('hex').slice(0, 16)}`;
}

type Store = { get: (k: string) => Promise<Fails | null>; put: (k: string, v: Fails) => Promise<unknown> };

async function readFails(store: Store, k: string): Promise<Fails> {
  const now = Date.now();
  const v = (await store.get(k).catch(() => null)) ?? memFails.get(k) ?? null;
  return v && now - v.first < WINDOW_MS + Math.max(0, v.lockedUntil - now) ? v : { count: 0, first: now, lockedUntil: 0 };
}

export async function loginLocked(req: Request, store: Store): Promise<number> {
  const f = await readFails(store, clientKey(req));
  return Math.max(0, f.lockedUntil - Date.now());
}

export async function noteLoginFailure(req: Request, store: Store): Promise<void> {
  const k = clientKey(req);
  const f = await readFails(store, k);
  f.count += 1;
  if (f.count >= FAIL_LIMIT) f.lockedUntil = Date.now() + WINDOW_MS;
  memFails.set(k, f);
  await store.put(k, f).catch(() => undefined);
}

export async function clearLoginFailures(req: Request, store: Store): Promise<void> {
  const k = clientKey(req);
  if (!memFails.has(k) && !(await store.get(k).catch(() => null))) return;
  memFails.delete(k);
  await store.put(k, { count: 0, first: Date.now(), lockedUntil: 0 }).catch(() => undefined);
}

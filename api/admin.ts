// numfall.store admin API. Every route below /api/admin/* (vercel.json rewrites them here with ?path=...) checks
// the admin cookie on the server (requireAdmin) except login, logout and me. Responses are JSON, no-store, noindex.
//
//   POST   /api/admin/login              {password}            -> sets the admin cookie (5 wrong tries per address lock 15 min)
//   POST   /api/admin/logout
//   GET    /api/admin/me                                        -> {admin}
//   GET    /api/admin/analytics?range=today|yesterday|7d|30d   -> GA4 snapshot (501 with the missing env vars if not set up)
//   GET    /api/admin/blog                                      -> posts list + settings the editor needs
//   POST   /api/admin/blog                {post, intent}        -> create (intent: draft | publish)
//   GET    /api/admin/blog/:id
//   PUT    /api/admin/blog/:id            {post, intent}        -> update (intent: draft | publish | unpublish)
//   PATCH  /api/admin/blog/:id            {action:"publish_now"}-> a scheduled post goes live now (409 otherwise)
//   DELETE /api/admin/blog/:id
import { waitUntil } from '@vercel/functions';
import { db, type BlogPost } from '../writer/server/db';
import { HttpError, json, readJson } from '../writer/server/http';
import { checkPassword, clearCookie, clearLoginFailures, isAdmin, loginLocked, noteLoginFailure, requireAdmin, sessionCookie } from '../writer/server/auth';
import { NotConfigured, RANGES, snapshot, type RangeKey } from '../writer/server/admin/analytics';
import { assertSlugFree, checkPost, isLive, type Intent, type PostInput } from '../writer/server/admin/posts';
import { afterGoingLive, publishNow } from '../writer/server/blog';
import { submitToIndexNow } from '../writer/server/indexnow';
import { isSiteRole } from '../writer/server/role';

const LOGIN_DELAY_MS = () => Number(process.env.LOGIN_DELAY_MS ?? 800);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const later = (p: Promise<unknown>) => {
  try {
    waitUntil(p);
  } catch {
    void p; // outside Vercel (tests): let it run
  }
};

function fail(e: unknown): Response {
  if (e instanceof NotConfigured) return json({ error: e.message, missing: e.missing }, 501);
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: 'Something went wrong on the server. Try again; if it keeps happening, check the error log.' }, 500);
}

const view = (p: BlogPost) => ({ ...p, content_html: p.html, meta_description: p.description, live: isLive(p) });

async function handle(req: Request): Promise<Response> {
  if (!isSiteRole()) throw new HttpError(404, 'Not found.');
  const u = new URL(req.url);
  const parts = (u.searchParams.get('path') ?? '').split('/').filter(Boolean);
  const [area, id, extra] = parts;
  const m = req.method;

  if (area === 'me' && m === 'GET') return json({ admin: isAdmin(req) });
  if (area === 'logout' && m === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
  if (area === 'login' && m === 'POST') {
    const body = await readJson<{ password?: string }>(req);
    const store = { get: (k: string) => db.getState<{ count: number; first: number; lockedUntil: number }>(k), put: db.putState };
    const wait = await loginLocked(req, store);
    if (wait > 0) throw new HttpError(429, `Too many wrong passwords. Try again in ${Math.ceil(wait / 60_000)} minutes.`);
    if (!checkPassword(String(body.password ?? ''))) {
      await noteLoginFailure(req, store);
      await new Promise(r => setTimeout(r, LOGIN_DELAY_MS()));
      throw new HttpError(401, 'Wrong password.');
    }
    await clearLoginFailures(req, store);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie() });
  }

  // Everything else: admin only, checked here on the server.
  requireAdmin(req);

  if (area === 'analytics' && m === 'GET') {
    const range = (u.searchParams.get('range') ?? '7d') as RangeKey;
    if (!(range in RANGES)) throw new HttpError(400, 'range must be today, yesterday, 7d or 30d.');
    return json(await snapshot(range));
  }

  if (area === 'blog') {
    if (extra) throw new HttpError(404, 'Not found.');
    if (!id) {
      if (m === 'GET') {
        const [rows, s] = await Promise.all([db.blogList(), db.getSettings()]);
        return json({ rows, timeZone: s.timeZone, authors: s.authors, categories: [...new Set(rows.map(r => r.category).filter(Boolean))].sort() });
      }
      if (m === 'POST') {
        const body = await readJson<{ post?: PostInput; intent?: Intent }>(req);
        const intent = body.intent === 'publish' ? 'publish' : 'draft';
        const s = await db.getSettings();
        const post = checkPost(body.post ?? {}, intent, s.bannedNames);
        await assertSlugFree(post.slug);
        const saved = await db.blogSave(post);
        if (isLive(saved)) later(submitToIndexNow().catch(() => null));
        return json(view(saved), 201);
      }
      throw new HttpError(405, 'Method not allowed.');
    }
    if (!UUID.test(id)) throw new HttpError(404, 'Post not found.');
    const current = await db.blogGet(id);
    if (!current) throw new HttpError(404, 'Post not found.');
    if (m === 'GET') return json(view(current));
    if (m === 'DELETE') {
      await db.blogDelete(id);
      if (isLive(current)) later(submitToIndexNow().catch(() => null));
      return json({ deleted: true });
    }
    if (m === 'PATCH') {
      const body = await readJson<{ action?: string }>(req);
      if (body.action !== 'publish_now') throw new HttpError(400, 'Unknown action. Use {"action":"publish_now"}.');
      if (current.status === 'draft' || current.status === 'unpublished') throw new HttpError(409, 'This post is a draft. Open it and press Publish.');
      if (isLive(current)) throw new HttpError(409, 'This post is already live.');
      const r = await publishNow({ id }, new Date(), later);
      return json({ post: view(r.post), indexNow: r.indexNow });
    }
    if (m === 'PUT') {
      const body = await readJson<{ post?: PostInput; intent?: Intent }>(req);
      const intent: Intent = body.intent === 'publish' || body.intent === 'unpublish' ? body.intent : 'draft';
      const s = await db.getSettings();
      const post = checkPost({ ...body.post, article_id: current.article_id }, intent === 'unpublish' ? 'draft' : intent, s.bannedNames);
      await assertSlugFree(post.slug, id);
      const saved = await db.blogSave({ ...post, id });
      const wasLive = isLive(current);
      if (current.status === 'scheduled' && !wasLive && isLive(saved)) await afterGoingLive(saved, new Date(), later);
      else if (wasLive || isLive(saved)) later(submitToIndexNow().catch(() => null));
      return json(view(saved));
    }
    throw new HttpError(405, 'Method not allowed.');
  }
  throw new HttpError(404, 'Not found.');
}

const run = (req: Request) => handle(req).catch(fail);
export const GET = run;
export const POST = run;
export const PUT = run;
export const PATCH = run;
export const DELETE = run;

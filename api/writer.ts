// NumFall Writer API for the admin page (/admin). Every action needs the admin cookie except login.
import { db } from '../writer/server/db';
import { HttpError, errorResponse, json, readJson } from '../writer/server/http';
import { checkPassword, clearCookie, clearLoginFailures, isAdmin, loginLocked, noteLoginFailure, requireAdmin, sessionCookie } from '../writer/server/auth';
import { createBatch, postNow, retry, runFromBrowser, saveArticle, unpublish, type BatchInput } from '../writer/server/runner';
import { appFacts } from '../writer/server/appfacts';
import { lastSubmission } from '../writer/server/indexnow';
import { pauseInfo } from '../writer/server/humanizer';
import { parseSection } from '../writer/server/steps';
import { mergeSettings } from '../writer/shared/settings';
import { saveBlogPost } from '../writer/server/blog';
import type { Article, Block, Settings } from '../writer/shared/types';

const RUN_BUDGET_MS = 240_000;
const LOGIN_DELAY_MS = Number(process.env.LOGIN_DELAY_MS ?? 800); // slows password guessing

const keys = () => ({
  anthropic: !!process.env.ANTHROPIC_API_KEY,
  groq: !!process.env.GROQ_API_KEY,
  openrouter: !!process.env.OPENROUTER_API_KEY,
  gptzero: !!process.env.GPTZERO_API_KEY,
  database: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.WRITER_DB_SECRET),
  tick: !!process.env.TICK_SECRET,
});

export async function GET(req: Request): Promise<Response> {
  try {
    const u = new URL(req.url);
    const action = u.searchParams.get('action');
    if (action === 'me') return json({ admin: isAdmin(req), keys: isAdmin(req) ? keys() : undefined });
    requireAdmin(req);
    switch (action) {
      case 'list':
        return json({
          articles: await db.listArticles(),
          humanizerPaused: { groq: await pauseInfo('groq'), openrouter: await pauseInfo('openrouter') },
          indexNow: await lastSubmission(),
          openErrors: (await db.errors(true, 500).catch(() => [])).filter(e => e.kind !== 'warning').length,
        });
      case 'get': {
        const a = await db.getArticle(u.searchParams.get('id') ?? '');
        if (!a) throw new HttpError(404, 'Article not found.');
        return json(a);
      }
      case 'settings':
        return json(await db.getSettings());
      case 'usage':
        return json(await db.usage(u.searchParams.get('from') ?? undefined, u.searchParams.get('to') ?? undefined));
      case 'facts':
        return json(await appFacts(u.searchParams.get('refresh') === '1'));
      case 'posts':
        return json(await db.postsIndex());
      case 'errors':
        return json(await db.errors(u.searchParams.get('open') === '1'));
      case 'blog_list':
        return json(await db.blogList());
      case 'blog_get': {
        const p = await db.blogGet(u.searchParams.get('id') ?? '');
        if (!p) throw new HttpError(404, 'Post not found.');
        return json(p);
      }
      default:
        throw new HttpError(404, 'Unknown action.');
    }
  } catch (e) {
    return errorResponse(e);
  }
}

function markdownToBlocks(md: string): Block[] {
  const out: Block[] = [];
  for (const chunk of md.replace(/\r/g, '').split(/\n{2,}/)) {
    const h = chunk.trim().match(/^##\s+(.+)$/);
    if (h) out.push({ type: 'h2', text: h[1].trim() });
    else out.push(...parseSection(chunk));
  }
  return out;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await readJson<Record<string, unknown> & { action?: string }>(req);
    if (body.action === 'login') {
      const store = { get: (k: string) => db.getState<{ count: number; first: number; lockedUntil: number }>(k), put: db.putState };
      const wait = await loginLocked(req, store);
      if (wait > 0) throw new HttpError(429, `Too many wrong passwords. Try again in ${Math.ceil(wait / 60_000)} minutes.`);
      if (!checkPassword(String(body.password ?? ''))) {
        await noteLoginFailure(req, store);
        await new Promise(r => setTimeout(r, LOGIN_DELAY_MS));
        throw new HttpError(401, 'Wrong password.');
      }
      await clearLoginFailures(req, store);
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie() });
    }
    if (body.action === 'logout') return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
    requireAdmin(req);
    const owner = String(body.owner ?? 'browser').slice(0, 60);
    const id = String(body.id ?? '');
    switch (body.action) {
      case 'batch': {
        const s = await db.getSettings();
        const made = await createBatch(body as unknown as BatchInput, s);
        return json({ created: made.map(a => ({ id: a.id, topic: a.options.topic, publishAt: a.options.publishAt })) });
      }
      case 'run':
        return json(await runFromBrowser(id || undefined, owner, RUN_BUDGET_MS));
      case 'retry':
        return json(await retry(id, owner));
      case 'stop': {
        const a = await db.claim(id, owner, 30);
        if (!a) throw new HttpError(409, 'Another runner is working on this article right now.');
        a.stopped = true;
        a.step = 'Stopped by you: press Retry to carry on';
        await saveArticle(a, owner);
        await db.release(id, owner);
        return json(a);
      }
      case 'delete': {
        const a = await db.getArticle(id);
        if (a && ['scheduled', 'published'].includes(a.status)) await db.unpublish(id);
        await db.deleteArticle(id);
        return json({ ok: true });
      }
      case 'post':
        return json(await postNow(id, owner, String(body.when ?? 'now')));
      case 'unpublish':
        return json(await unpublish(id, owner));
      case 'edit': {
        const a = await db.claim(id, owner, 60);
        if (!a) throw new HttpError(409, 'Another runner is working on this article right now.');
        const e = body as { title?: string; description?: string; markdown?: string; faq?: Article['faq'] };
        if (typeof e.title === 'string') a.title = e.title.trim();
        if (typeof e.description === 'string') a.description = e.description.trim();
        if (typeof e.markdown === 'string') a.body = markdownToBlocks(e.markdown);
        if (Array.isArray(e.faq)) a.faq = e.faq.filter(f => f?.q && f?.a);
        await saveArticle(a, owner);
        await db.release(id, owner);
        return json(a);
      }
      case 'blog_save':
        return json(await saveBlogPost(body.post as Record<string, unknown>, String(body.intent ?? 'draft') as 'draft' | 'publish' | 'unpublish'));
      case 'errors_resolve':
        return json(await db.resolveErrors((body.ids as number[]) ?? [], String(body.resolution ?? 'Marked resolved by you')));
      case 'blog_delete':
        return json(await db.blogDelete(String(body.id ?? '')));
      case 'settings': {
        const s = mergeSettings(body.settings as Partial<Settings>);
        return json(await db.putSettings(s));
      }
      default:
        throw new HttpError(404, 'Unknown action.');
    }
  } catch (e) {
    return errorResponse(e);
  }
}

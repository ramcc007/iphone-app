// Saving a post from the blog manager: clean the HTML, check the SEO fields, and work out the status.
//   draft      -> never public
//   publish    -> published now, or scheduled when the publish date is in the future
//   unpublish  -> off the site (kept, can be published again)
import type { BlogPost } from './db';
import { db } from './db';
import { HttpError } from './http';
import { htmlHeadings, htmlText, sanitizeHtml } from '../shared/sanitize';
import { headingSymbols, nameHits, toSymbols } from '../shared/clean';
import { DEFAULT_BANNED_NAMES } from '../shared/settings';
import { readingMinutes, slugify } from '../shared/text';
import { submitToIndexNow } from './indexnow';
import { markArticleLive } from './runner';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+){2,5}$/;

export async function saveBlogPost(input: Record<string, unknown>, intent: 'draft' | 'publish' | 'unpublish', now = new Date()): Promise<BlogPost> {
  const str = (k: string) => String(input[k] ?? '').trim();
  const title = headingSymbols(str('title'));
  if (!title) throw new HttpError(400, 'Add a title.');
  const slug = slugify(str('slug') || title);
  if (!SLUG.test(slug)) throw new HttpError(400, 'The URL slug must be 3 to 6 lowercase words joined by hyphens.');
  const html = sanitizeHtml(str('html'));
  const text = htmlText(html);
  if (intent === 'publish' && text.split(/\s+/).length < 100) throw new HttpError(400, 'The article is too short to publish (under 100 words).');
  const description = toSymbols(str('description') || str('excerpt')).slice(0, 320);
  const faq = (Array.isArray(input.faq) ? (input.faq as { q?: string; a?: string }[]) : [])
    .map(f => ({ q: headingSymbols(String(f.q ?? '').trim()), a: toSymbols(String(f.a ?? '').trim()) }))
    .filter(f => f.q && f.a);
  const sources = (Array.isArray(input.sources) ? (input.sources as { name?: string; url?: string }[]) : [])
    .map(x => ({ name: String(x.name ?? '').trim().slice(0, 80), url: String(x.url ?? '').trim() }))
    .filter(x => x.name && /^https?:\/\/[^\s]+\.[^\s]+$/.test(x.url) && !nameHits(`${x.name} ${x.url}`, DEFAULT_BANNED_NAMES).length)
    .slice(0, 8);
  const tags = (Array.isArray(input.tags) ? (input.tags as string[]) : []).map(t => String(t).trim()).filter(Boolean).slice(0, 12);
  const when = str('publish_at') ? new Date(str('publish_at')) : now;
  if (Number.isNaN(when.getTime())) throw new HttpError(400, 'Bad publish date.');
  const status = intent === 'draft' ? 'draft' : intent === 'unpublish' ? 'unpublished' : when.getTime() > now.getTime() ? 'scheduled' : 'published';
  const words = text ? text.split(/\s+/).length : 0;
  return db.blogSave({
    id: str('id') || undefined,
    article_id: str('article_id') || null,
    slug,
    title,
    description,
    excerpt: toSymbols(str('excerpt')).slice(0, 400),
    meta_title: str('meta_title').slice(0, 120),
    author: str('author') || 'NumFall Editors',
    category: str('category') || 'Number puzzles',
    tags,
    html,
    faq,
    sources,
    headings: htmlHeadings(html),
    word_count: words,
    reading_minutes: readingMinutes(words),
    status,
    publish_at: when.toISOString(),
  } as Partial<BlogPost>);
}

// "Publish now": a scheduled post goes live at once instead of waiting for its slot. Its date becomes now (so the
// site never shows a future date), the article it came from is marked live too, and IndexNow hears about it straight away.
export async function publishNow(ref: { id?: string; article_id?: string }, now = new Date(), defer?: (p: Promise<unknown>) => void): Promise<{ post: BlogPost; indexNow: string }> {
  let p = ref.id ? await db.blogGet(ref.id) : null;
  if (!p && ref.article_id) {
    const row = (await db.blogList()).find(r => r.article_id === ref.article_id);
    if (row) p = await db.blogGet(row.id);
  }
  if (!p) throw new HttpError(404, 'Post not found.');
  if (p.status === 'published' || (p.status === 'scheduled' && Date.parse(p.publish_at) <= now.getTime())) throw new HttpError(409, 'This post is already live.');
  if (p.status !== 'scheduled') throw new HttpError(409, 'Only scheduled posts can be published early. For a draft, use Publish in the editor.');
  const post = await db.blogSave({ ...p, status: 'published', publish_at: now.toISOString() });
  return { post, indexNow: await afterGoingLive(post, now, defer) };
}

// After a post goes live outside its schedule (Publish now, or a date moved into the past in the editor).
// With `defer` (Vercel waitUntil), the IndexNow ping is sent after the response.
export async function afterGoingLive(post: BlogPost, now = new Date(), defer?: (p: Promise<unknown>) => void): Promise<string> {
  if (post.article_id) {
    await markArticleLive(post.article_id, post.publish_at).catch(e =>
      db.logError({ article_id: post.article_id ?? undefined, title: post.title, stage: 'publish now', kind: 'warning', message: `Post is live, but its article could not be marked live: ${e instanceof Error ? e.message : String(e)}` }).catch(() => undefined),
    );
  }
  if (defer) {
    defer(submitToIndexNow(now).catch(() => null));
    return 'IndexNow is told in the background';
  }
  const r = await submitToIndexNow(now).catch(() => null);
  return r?.status === 200 || r?.status === 202 ? 'sent to IndexNow' : 'IndexNow will pick it up on its next 12-hour run';
}

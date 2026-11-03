// Publishing scheduled posts early, shared by the numfall.store admin (/api/admin) and the article writer.
import type { BlogPost } from './db';
import { db } from './db';
import { HttpError } from './http';
import { submitToIndexNow } from './indexnow';
import { markArticleLive } from './runner';

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

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

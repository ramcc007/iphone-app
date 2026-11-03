// Blog posts in the numfall.store admin: every field is checked here on the server, HTML is cleaned with
// sanitize-html, and the status follows the publishing rule:
//   draft                     -> never public
//   publish, date in future   -> scheduled (goes live by itself when its time comes)
//   publish, date now or past -> published (back-dated dates are allowed)
// A post is live when status is scheduled/published and publish_at <= now (checked by the database on every read).
import sanitize from 'sanitize-html';
import { db, type BlogPost, type BlogRow } from '../db';
import { HttpError } from '../http';
import { APP_CARD_MARK } from '../../shared/render';
import { headingSymbols, nameHits, toSymbols } from '../../shared/clean';
import { DEFAULT_BANNED_NAMES } from '../../shared/settings';
import { readingMinutes, slugify } from '../../shared/text';
import { htmlHeadings, htmlText } from '../../shared/sanitize';

export const SLUG_RULE = /^[a-z0-9]+(-[a-z0-9]+){2,5}$/;
export type Intent = 'draft' | 'publish' | 'unpublish';

// The editor marks the App Store card as <div data-app-card>; it is stored as the comment marker the site renders.
const CARD_DIV = /<div[^>]*data-app-card[^>]*>[\s\S]*?<\/div>/gi;

export function cleanHtml(input: string): string {
  const withMark = String(input ?? '').replace(CARD_DIV, '<p>@@APPCARD@@</p>');
  const clean = sanitize(withMark, {
    allowedTags: ['p', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'br'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    transformTags: { b: 'strong', i: 'em', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3' },
    exclusiveFilter: frame => ['p', 'li', 'h2', 'h3', 'blockquote'].includes(frame.tag) && !frame.text.trim() && !frame.mediaChildren.length,
  });
  return clean.replace(/<p>@@APPCARD@@<\/p>/g, APP_CARD_MARK).replace(/@@APPCARD@@/g, '').trim();
}

const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max + 1);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface PostInput {
  title?: unknown; slug?: unknown; excerpt?: unknown; category?: unknown; tags?: unknown; author?: unknown;
  meta_title?: unknown; description?: unknown; key_takeaways?: unknown; faq?: unknown; sources?: unknown;
  content_html?: unknown; html?: unknown; publish_at?: unknown; article_id?: unknown;
}

// Checks every field and returns what is stored, or throws 400 with every problem listed.
export function checkPost(input: PostInput, intent: Intent, bannedNames: string[] = DEFAULT_BANNED_NAMES, now = new Date()): Omit<BlogPost, 'id' | 'updated_at' | 'created_at' | 'related'> & { id?: string } {
  const problems: string[] = [];
  const title = headingSymbols(str(input.title, 120));
  if (title.length < 5) problems.push('Title: at least 5 characters.');
  if (title.length > 120) problems.push('Title: at most 120 characters.');
  const slug = slugify(str(input.slug, 120) || title).split('-').filter(Boolean).slice(0, 6).join('-');
  if (!SLUG_RULE.test(slug)) problems.push('URL slug: 3 to 6 lowercase words joined by hyphens (letters and numbers only).');
  const excerpt = toSymbols(str(input.excerpt, 300));
  if (excerpt.length > 300) problems.push('Excerpt: at most 300 characters.');
  const category = str(input.category, 40);
  if (category.length < 2) problems.push('Category: pick or type one.');
  if (category.length > 40) problems.push('Category: at most 40 characters.');
  const tags = [...new Set(list(input.tags).map(t => str(t, 40).toLowerCase()).filter(Boolean))];
  if (tags.length > 12) problems.push('Tags: at most 12.');
  if (tags.some(t => t.length > 40)) problems.push('Tags: each at most 40 characters.');
  const author = str(input.author, 60);
  if (author.length < 2) problems.push('Author: required.');
  if (author.length > 60) problems.push('Author: at most 60 characters.');
  const meta_title = str(input.meta_title, 70);
  if (meta_title.length > 70) problems.push('Meta title: at most 70 characters (about 60 shows in Google).');
  const description = toSymbols(str(input.description, 160));
  if (description.length > 160) problems.push('Meta description: at most 160 characters.');
  if (intent === 'publish' && description.length < 50) problems.push('Meta description: at least 50 characters before publishing.');
  const key_takeaways = list(input.key_takeaways).map(t => toSymbols(str(t, 200))).filter(Boolean);
  if (key_takeaways.length > 6) problems.push('Key takeaways: at most 6 lines.');
  if (key_takeaways.some(t => t.length > 200)) problems.push('Key takeaways: each line at most 200 characters.');
  const faq = list(input.faq)
    .map(f => ({ q: headingSymbols(str((f as { q?: unknown }).q, 200)), a: toSymbols(str((f as { a?: unknown }).a, 1000)) }))
    .filter(f => f.q || f.a);
  if (faq.some(f => !f.q || !f.a)) problems.push('FAQ: every question needs an answer, and every answer a question.');
  if (faq.length > 12) problems.push('FAQ: at most 12 questions.');
  if (faq.some(f => f.q.length > 200 || f.a.length > 1000)) problems.push('FAQ: questions at most 200 characters, answers at most 1,000.');
  const sources = list(input.sources)
    .map(x => ({ name: str((x as { name?: unknown }).name, 100), url: String((x as { url?: unknown }).url ?? '').trim() }))
    .filter(x => x.name || x.url);
  if (sources.length > 12) problems.push('Sources: at most 12.');
  for (const x of sources) {
    let ok = false;
    try {
      ok = ['http:', 'https:'].includes(new URL(x.url).protocol);
    } catch {}
    if (!x.name || !ok) problems.push(`Sources: "${x.name || x.url}" needs a name and a full http(s) address.`);
  }
  const html = cleanHtml(String(input.content_html ?? input.html ?? ''));
  const text = htmlText(html);
  const words = text ? text.split(/\s+/).length : 0;
  if (intent === 'publish' && words < 100) problems.push(`Article: at least 100 words before publishing (now ${words}).`);
  // Never another game or brand name in anything visitors see (project rule).
  const visible = [title, excerpt, description, meta_title, ...key_takeaways, ...faq.flatMap(f => [f.q, f.a]), ...tags, ...sources.map(s => `${s.name} ${s.url}`), text].join('\n');
  const names = nameHits(visible, bannedNames);
  if (names.length) problems.push(`Remove other game or brand names (${names.join(', ')}). Describe the rule instead, e.g. "each row, column and box holds each number once".`);
  let when = now;
  if (str(input.publish_at, 40)) {
    when = new Date(String(input.publish_at));
    if (Number.isNaN(when.getTime())) problems.push('Publish date: not a valid date.');
  }
  if (problems.length) throw new HttpError(400, problems.join('\n'));
  const status = intent === 'publish' ? (when.getTime() > now.getTime() ? 'scheduled' : 'published') : 'draft';
  return {
    article_id: str(input.article_id, 80) || null,
    slug, title, excerpt, description, meta_title, author, category, tags, html, faq, sources, key_takeaways,
    headings: htmlHeadings(html),
    word_count: words,
    reading_minutes: readingMinutes(words),
    status,
    publish_at: when.toISOString(),
  } as Omit<BlogPost, 'id' | 'updated_at' | 'created_at' | 'related'>;
}

// One clear 409 for a slug that is taken (the database's unique key is the final guard).
export async function assertSlugFree(slug: string, id?: string, rows?: BlogRow[]): Promise<void> {
  const taken = (rows ?? (await db.blogList())).find(r => r.slug === slug && r.id !== id);
  if (taken) throw new HttpError(409, `The URL /blog/${slug} is already used by "${taken.title}". Change the slug.`);
}

export const isLive = (p: { status: string; publish_at: string }, now = new Date()) =>
  ['scheduled', 'published'].includes(p.status) && Date.parse(p.publish_at) <= now.getTime();

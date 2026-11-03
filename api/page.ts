// Public pages that come from the database: /blog, /blog/<slug>, /sitemap.xml and /llms.txt (see vercel.json).
// Visitors only ever see live posts (the database's row security enforces it). A scheduled post returns 404
// until its time; signed in as admin, the same URL shows a preview with the go-live time.
import { isAdmin } from '../writer/server/auth';
import { db } from '../writer/server/db';
import { articlePage, catSlug, indexPage, llms, page, rss, siteFiles, sitemap, type PublicPost } from '../writer/site/blog';

// Live posts only: the database applies the live rule (scheduled/published and publish_at <= now) on every call.
const livePosts = () => db.liveList<PublicPost>();

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';
const html = (body: string, status = 200, cache = PUBLIC_CACHE) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } });

function notFound(): Response {
  const f = siteFiles();
  const body = page(f, {
    title: 'Page not found | NumFall',
    description: 'This page does not exist on numfall.store.',
    canonical: `${f.config.siteUrl}/blog`,
    robots: 'noindex',
    content: `<main class="narrow post"><h1>Page not found</h1><p>This article isn't here. The <a href="/blog">blog</a> lists every live article.</p></main>`,
  });
  // Never cached, so the article appears the moment it goes live.
  return html(body, 404, 'no-store');
}

export async function GET(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const r = u.searchParams.get('r');
  try {
    const f = siteFiles();
    if (r === 'sitemap') return new Response(sitemap(f, await livePosts()), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': PUBLIC_CACHE } });
    if (r === 'llms') return new Response(llms(f, await livePosts()), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': PUBLIC_CACHE } });
    if (r === 'rss') return new Response(rss(f, await livePosts()), { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': PUBLIC_CACHE } });
    if (r === 'blog') {
      const posts = await livePosts();
      const cat = u.searchParams.get('cat') ?? u.searchParams.get('category');
      if (cat && !posts.some(p => catSlug(p.category) === cat)) return notFound();
      return html(indexPage(f, posts, Number(u.searchParams.get('page') ?? 1) || 1, cat));
    }
    if (r === 'post') {
      const slug = (u.searchParams.get('slug') ?? '').toLowerCase();
      if (!/^[a-z0-9]+(-[a-z0-9]+){2,5}$/.test(slug)) return notFound();
      const [row, all] = await Promise.all([db.liveGet<PublicPost>(slug), livePosts()]);
      const live = new Set(all.map(p => p.slug));
      let p = row ?? undefined;
      let preview: { goLive: string } | undefined;
      if (!p && isAdmin(req)) {
        const row = (await db.postAdmin(slug).catch(() => null)) as PublicPost | null;
        if (row && row.status !== 'unpublished') {
          p = row;
          preview = { goLive: row.publish_at };
        }
      }
      if (!p) return notFound();
      const others = all.filter(x => x.slug !== p.slug);
      const related = [
        ...p.related.map(s => others.find(x => x.slug === s)).filter((x): x is PublicPost => !!x),
        ...others.filter(x => x.category === p.category && !p.related.includes(x.slug)),
        ...others,
      ].filter((x, i, a) => a.findIndex(y => y.slug === x.slug) === i).slice(0, 3);
      return html(articlePage(f, p, live, related, preview), 200, preview ? 'no-store' : PUBLIC_CACHE);
    }
    return notFound();
  } catch (e) {
    console.error(e);
    await db.logError({ kind: 'error', stage: `page ${r ?? ''}`.trim(), message: `Public page failed (${u.pathname}${u.search}): ${e instanceof Error ? e.message : String(e)}` });
    return new Response('Something went wrong loading this page. Please try again in a minute.', { status: 503, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store', 'retry-after': '60' } });
  }
}

// Renders /blog, /blog/<slug>, sitemap.xml and llms.txt from the posts table, inside the site's own layout.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_CARD_MARK, escapeHtml as esc } from '../shared/render';
import { SITE, appStoreLink, APP_ID } from '../shared/settings';
import { slugify } from '../shared/text';

export interface PublicPost {
  slug: string;
  title: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  html: string;
  faq: { q: string; a: string }[];
  related: string[];
  reading_minutes: number;
  publish_at: string;
  updated_at: string;
  status: string;
}

export interface SiteFiles {
  layout: string;
  analytics: string;
  llms: string;
  config: Record<string, string>;
  staticPages: string[]; // e.g. ['/', '/support', ...]
}

let cached: SiteFiles | undefined;
export function siteFiles(root = process.cwd()): SiteFiles {
  if (cached) return cached;
  const src = join(root, 'site', 'src');
  const config = JSON.parse(readFileSync(join(root, 'site', 'site.config.json'), 'utf8')) as Record<string, string>;
  const ENV: Record<string, string> = { SITE_LEGAL_NAME: 'legalName', SITE_SUPPORT_EMAIL: 'supportEmail', SITE_GOVERNING_LAW: 'governingLaw', SITE_URL: 'siteUrl', SITE_APPSTORE_URL: 'appStoreUrl' };
  for (const [k, v] of Object.entries(ENV)) if (process.env[k]) config[v] = process.env[k]!;
  cached = {
    layout: readFileSync(join(src, 'layout.html'), 'utf8'),
    analytics: readFileSync(join(src, 'analytics.html'), 'utf8'),
    llms: readFileSync(join(src, 'llms.txt'), 'utf8'),
    config,
    staticPages: ['/', '/support', '/privacy', '/terms', '/press', '/blog'],
  };
  return cached;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export function pageTitle(title: string, appName = 'NumFall'): string {
  const full = `${title} | ${appName}`;
  return full.length <= 60 ? full : title;
}

interface PageOpts {
  title: string;
  description: string;
  canonical: string;
  content: string;
  jsonLd?: unknown;
  ogImage?: string;
  ogAlt?: string;
  ogType?: string;
  robots?: string;
  extraHead?: string;
  noAnalytics?: boolean; // admin-only pages (previews) never load Google Analytics
}

export function page(f: SiteFiles, o: PageOpts): string {
  const c = f.config;
  const ga = c.gaMeasurementId;
  const vars: Record<string, string> = {
    ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, esc(String(v))])),
    appBanner: `<meta name="apple-itunes-app" content="app-id=${APP_ID}">`,
    fullTitle: esc(o.title),
    description: esc(o.description),
    canonical: esc(o.canonical),
    robots: o.robots ?? 'index, follow',
    ogType: o.ogType ?? 'website',
    ogImage: esc(o.ogImage ?? `${c.siteUrl}/og-image.png`),
    ogAlt: esc(o.ogAlt ?? `${c.appName}: ${c.tagline}`),
    extraHead: o.extraHead ?? '',
    jsonLd: o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
    analytics: ga && !o.noAnalytics ? f.analytics.replace(/\{\{gaId\}\}/g, ga) : '',
    content: o.content,
    year: String(new Date().getFullYear()),
  };
  return f.layout.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

function appCard(slug: string, where: 'mid' | 'end'): string {
  return `<aside class="app-card" aria-label="NumFall on the App Store"><img src="/icon-192.png" alt="" width="64" height="64" loading="lazy"><div><p class="app-name">NumFall: Number Puzzle Game</p><p class="app-line">A number puzzle where numbers fall into place: every row, column and box holds each number once. Free on iPhone and iPad.</p></div><a class="store-badge" href="${esc(appStoreLink(slug))}" target="_blank" rel="noopener" data-card="${where}"><img src="/app-store-badge.svg" alt="Download on the App Store" width="150" height="50"></a></aside>`;
}

function share(url: string, title: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return `<div class="share" aria-label="Share"><span>Share:</span>
<a href="https://twitter.com/intent/tweet?url=${u}&amp;text=${t}" target="_blank" rel="noopener">X</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a>
<a href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener">LinkedIn</a>
<a href="https://www.reddit.com/submit?url=${u}&amp;title=${t}" target="_blank" rel="noopener">Reddit</a>
<a href="mailto:?subject=${t}&amp;body=${u}">Email</a>
<button type="button" class="copy" data-url="${esc(url)}">Copy link</button></div>
<script>document.querySelectorAll('.share .copy').forEach(function(b){b.addEventListener('click',function(){try{navigator.clipboard.writeText(b.dataset.url);b.textContent='Link copied';}catch(e){}});});</script>`;
}

// Links to articles that aren't live yet show as plain text until the target is live.
export function unwrapDeadLinks(html: string, live: Set<string>): string {
  return html.replace(/<a href="\/blog\/([a-z0-9-]+)">([\s\S]*?)<\/a>/g, (m, slug: string, text: string) => (live.has(slug) ? m : text));
}

export function articlePage(f: SiteFiles, p: PublicPost, live: Set<string>, related: PublicPost[], preview?: { goLive: string }): string {
  const url = `${SITE}/blog/${p.slug}`;
  const og = `${SITE}/og/${p.slug}.png`;
  let body = unwrapDeadLinks(p.html, live);
  body = body.includes(APP_CARD_MARK) ? body.replace(APP_CARD_MARK, appCard(p.slug, 'mid')) : body;
  const faq = p.faq.length
    ? `<section class="faq post-faq"><h2 id="faq">FAQ</h2>${p.faq.map(x => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a).replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')}</p></details>`).join('')}</section>`
    : '';
  const rel = related.length
    ? `<section class="related"><h2>Related articles</h2><ul>${related.map(r => `<li><a href="/blog/${r.slug}">${esc(r.title)}</a><span>${esc(r.description)}</span></li>`).join('')}</ul></section>`
    : '';
  const banner = preview ? `<div class="preview-banner" role="status">Preview: this article goes live on ${esc(fmtDate(preview.goLive))} at ${esc(new Date(preview.goLive).toISOString().slice(11, 16))} UTC. Visitors see a 404 until then.</div>` : '';
  const content = `${banner}<main class="post narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/blog">Blog</a> › <span>${esc(p.category)}</span></nav>
<article>
<h1>${esc(p.title)}</h1>
<p class="byline">By ${esc(p.author)} · <time datetime="${p.publish_at}">${fmtDate(p.publish_at)}</time> · ${p.reading_minutes} min read</p>
${body}
${appCard(p.slug, 'end')}
${faq}
<p class="disclosure">NumFall is made by the publisher of this site. Any health or brain-training points here are general information, not medical advice.</p>
${share(url, p.title)}
</article>
${rel}
</main>`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: p.title,
        description: p.description,
        image: og,
        datePublished: p.publish_at,
        dateModified: p.updated_at > p.publish_at ? p.updated_at : p.publish_at,
        author: { '@type': 'Person', name: p.author },
        publisher: { '@type': 'Organization', name: 'NumFall', url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` } },
        mainEntityOfPage: url,
        articleSection: p.category,
        keywords: p.tags.join(', '),
      },
      ...(p.faq.length ? [{ '@type': 'FAQPage', mainEntity: p.faq.map(x => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') } })) }] : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ],
      },
      // The app card. No rating is claimed.
      {
        '@type': 'MobileApplication',
        name: 'NumFall: Number Puzzle Game',
        operatingSystem: 'iOS, iPadOS, macOS',
        applicationCategory: 'GameApplication',
        applicationSubCategory: 'Puzzle',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        downloadUrl: appStoreLink(p.slug),
        image: `${SITE}/icon-512.png`,
      },
    ],
  };
  return page(f, {
    title: pageTitle(p.title),
    description: p.description,
    canonical: url,
    content,
    jsonLd,
    ogImage: og,
    ogAlt: p.title,
    ogType: 'article',
    robots: preview ? 'noindex, nofollow' : 'index, follow',
    noAnalytics: !!preview,
    extraHead: `<meta property="article:published_time" content="${p.publish_at}">\n<meta property="article:author" content="${esc(p.author)}">\n`,
  });
}

export const PER_PAGE = 12;

export function indexPage(f: SiteFiles, posts: PublicPost[], pageNo: number, category: string | null): string {
  const cats = [...new Set(posts.map(p => p.category))].sort();
  const filtered = category ? posts.filter(p => slugify(p.category) === category) : posts;
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const n = Math.min(Math.max(1, pageNo), pages);
  const shown = filtered.slice((n - 1) * PER_PAGE, n * PER_PAGE);
  const catName = category ? cats.find(c => slugify(c) === category) : undefined;
  const qs = (k: number) => {
    const q = new URLSearchParams();
    if (category) q.set('category', category);
    if (k > 1) q.set('page', String(k));
    const s = q.toString();
    return `/blog${s ? `?${s}` : ''}`;
  };
  const content = `<main class="blog narrow">
<h1>${catName ? esc(catName) : 'NumFall blog: number puzzles and logic puzzles'}</h1>
<p class="lead">Solving techniques for 4×4, 6×6 and 9×9 grids, logic puzzle rules, brain game habits and casual puzzle gaming on iPhone and iPad.</p>
<nav class="cats" aria-label="Categories"><a href="/blog"${!category ? ' aria-current="page"' : ''}>All</a>${cats.map(c => `<a href="/blog?category=${slugify(c)}"${slugify(c) === category ? ' aria-current="page"' : ''}>${esc(c)}</a>`).join('')}</nav>
${shown.length ? `<ul class="post-list">${shown.map(p => `<li><a href="/blog/${p.slug}"><h2>${esc(p.title)}</h2></a><p>${esc(p.description)}</p><p class="meta">${esc(p.author)} · ${fmtDate(p.publish_at)} · ${esc(p.category)}</p></li>`).join('')}</ul>` : '<p>New articles are on the way.</p>'}
${pages > 1 ? `<nav class="pager" aria-label="Pages">${n > 1 ? `<a href="${qs(n - 1)}" rel="prev">Newer</a>` : ''}<span>Page ${n} of ${pages}</span>${n < pages ? `<a href="${qs(n + 1)}" rel="next">Older</a>` : ''}</nav>` : ''}
</main>`;
  return page(f, {
    title: catName ? pageTitle(`${catName} articles`) : 'Number puzzle and logic puzzle articles | NumFall',
    description: 'Articles on solving number puzzles and logic grids, puzzle techniques, brain game habits and casual puzzle games for iPhone and iPad.',
    canonical: `${SITE}${qs(n)}`,
    content,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'NumFall blog',
      url: `${SITE}/blog`,
      blogPost: shown.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.publish_at, author: { '@type': 'Person', name: p.author } })),
    },
  });
}

export function sitemap(f: SiteFiles, posts: PublicPost[]): string {
  const urls = [
    ...f.staticPages.map(p => `  <url><loc>${SITE}${p === '/' ? '/' : p}</loc></url>`),
    ...posts.map(p => `  <url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${(p.updated_at > p.publish_at ? p.updated_at : p.publish_at).slice(0, 10)}</lastmod></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function llms(f: SiteFiles, posts: PublicPost[]): string {
  const c = f.config;
  const storeStatus = c.appStoreUrl ? `available on the App Store: ${c.appStoreUrl}` : 'coming soon to the App Store.';
  const base = f.llms.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k === 'storeStatus' ? storeStatus : k in c ? String(c[k]) : m));
  const list = posts.map(p => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.description}`).join('\n');
  return `${base.trimEnd()}\n- [Blog](${SITE}/blog): articles on number puzzles, logic puzzles and solving techniques\n- [RSS feed](${SITE}/blog/rss.xml): the latest articles\n\n## Articles\n\n${list || '- (none yet)'}\n`;
}

// RSS 2.0 feed of the latest live articles: /blog/rss.xml
export function rss(f: SiteFiles, posts: PublicPost[], limit = 50): string {
  const x = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const items = posts.slice(0, limit).map(p => `    <item>
      <title>${x(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.publish_at).toUTCString()}</pubDate>
      <dc:creator>${x(p.author)}</dc:creator>
      <category>${x(p.category)}</category>
      <description>${x(p.description)}</description>
    </item>`);
  const last = posts[0] ? new Date(posts[0].publish_at).toUTCString() : new Date(0).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>NumFall blog</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Number puzzles, logic puzzles and solving techniques from ${x(String(f.config.appName ?? 'NumFall'))}.</description>
    <language>en-us</language>
    <lastBuildDate>${last}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>
`;
}

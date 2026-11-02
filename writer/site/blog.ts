// Renders /blog, /blog/<slug>, sitemap.xml and llms.txt from the posts table, inside the site's own layout.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_CARD_MARK, escapeHtml as esc, inline } from '../shared/render';
import { linkifyBare, linkifyHtml } from '../shared/links';
import { SITE, appStoreLink, APP_ID, DEFAULT_BANNED_NAMES } from '../shared/settings';
import { safeSources } from '../shared/clean';
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
  excerpt?: string;
  meta_title?: string;
  sources?: { name: string; url: string }[];
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
    staticPages: ['/', '/about', '/support', '/privacy', '/terms', '/press', '/blog'],
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
  return `<aside class="app-card" aria-label="${where === 'mid' ? 'About NumFall' : 'Get NumFall on the App Store'}"><img src="/icon-192.png" alt="" width="64" height="64" loading="lazy"><div><p class="app-name">NumFall: Number Puzzle Game</p><p class="app-line">A number puzzle where numbers fall into place: every row, column and box holds each number once. Free on iPhone and iPad.</p></div><a class="store-badge" href="${esc(appStoreLink(slug))}" target="_blank" rel="noopener" data-card="${where}"><img src="/app-store-badge.svg" alt="Download on the App Store" width="150" height="50"></a></aside>`;
}

const ICON = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// Share panel: the phone's own share sheet where available, the main networks by name, email and copy link.
// No third-party scripts; every button is a plain link. UTM tags show which network brought each visit.
function share(url: string, title: string, slug: string): string {
  const tagged = (src: string) => encodeURIComponent(`${url}?utm_source=${src}&utm_medium=social&utm_campaign=share`);
  const t = encodeURIComponent(title);
  const nets: [string, string, string][] = [
    ['x', 'X', `https://twitter.com/intent/tweet?url=${tagged('x')}&amp;text=${t}`],
    ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${tagged('facebook')}`],
    ['linkedin', 'LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${tagged('linkedin')}`],
    ['reddit', 'Reddit', `https://www.reddit.com/submit?url=${tagged('reddit')}&amp;title=${t}`],
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${t}%20${tagged('whatsapp')}`],
  ];
  return `<section class="sharebox" aria-labelledby="share-h-${slug}">
<div class="sharebox-head"><p id="share-h-${slug}" class="sharebox-t">Share this article</p><p class="sharebox-s">Know a puzzle fan who would like it? Send it their way.</p></div>
<div class="share-row">
<button type="button" class="share-native" data-title="${esc(title)}" data-url="${esc(url)}" hidden>${ICON.share}<span>Share</span></button>
${nets.map(([k, label, href]) => `<a class="net net-${k}" href="${href}" target="_blank" rel="noopener nofollow">${label}</a>`).join('\n')}
<a class="net net-email" href="mailto:?subject=${t}&amp;body=${tagged('email')}">${ICON.mail}<span>Email</span></a>
<button type="button" class="net net-copy share-copy" data-url="${esc(url)}">${ICON.link}<span>Copy link</span></button>
</div>
<p class="share-toast" role="status" aria-live="polite"></p>
</section>`;
}

const SHARE_SCRIPT = `<script>(function(){
var canShare=!!navigator.share;
document.querySelectorAll('.share-native').forEach(function(b){if(canShare)b.hidden=false;b.addEventListener('click',function(){navigator.share({title:b.dataset.title,url:b.dataset.url}).catch(function(){});});});
function copy(b){var u=b.dataset.url,box=b.closest('.sharebox,.byline-share'),t=box&&box.querySelector('.share-toast');
function done(){b.classList.add('done');var s=b.querySelector('span');if(s){var o=s.textContent;s.textContent='Copied';setTimeout(function(){s.textContent=o;b.classList.remove('done');},2200);}if(t)t.textContent='Link copied to your clipboard.';}
if(navigator.clipboard){navigator.clipboard.writeText(u).then(done,function(){prompt('Copy this link',u);});}else{prompt('Copy this link',u);}}
document.querySelectorAll('.share-copy').forEach(function(b){b.addEventListener('click',function(){copy(b);});});
document.querySelectorAll('.byline-share').forEach(function(b){b.addEventListener('click',function(){if(canShare){navigator.share({title:b.dataset.title,url:b.dataset.url}).catch(function(){});}else{var box=document.querySelector('.sharebox');if(box)box.scrollIntoView({behavior:'smooth',block:'center'});}});});
})();</script>`;

// Links to articles that aren't live yet show as plain text until the target is live.
export function unwrapDeadLinks(html: string, live: Set<string>): string {
  return html.replace(/<a href="\/blog\/([a-z0-9-]+)">([\s\S]*?)<\/a>/g, (m, slug: string, text: string) => (live.has(slug) ? m : text));
}

// A small number-grid mark drawn in CSS, different per article (no images needed).
export function gridMark(slug: string, size: 3 | 4 = 4): string {
  let h = 2166136261;
  for (const ch of slug) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const cells: string[] = [];
  for (let i = 0; i < size * size; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const v = (h >>> 0) % 7;
    cells.push(v < 3 ? `<i class="t${v}"></i>` : '<i></i>');
  }
  return `<span class="gridmark g${size}" aria-hidden="true">${cells.join('')}</span>`;
}

export const catSlug = (c: string) => slugify(c);

// Headings get ids so the contents box can link to them.
function withHeadingIds(html: string): { html: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h2(?:\s+id="[^"]*")?>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    let id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
    while (used.has(id)) id += '-2';
    used.add(id);
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

export function articlePage(f: SiteFiles, p: PublicPost, live: Set<string>, related: PublicPost[], preview?: { goLive: string }): string {
  const url = `${SITE}/blog/${p.slug}`;
  const og = `${SITE}/og/${p.slug}.png`;
  const prepared = withHeadingIds(unwrapDeadLinks(linkifyHtml(p.html), live));
  let body = prepared.html;
  body = body.includes(APP_CARD_MARK) ? body.replace(APP_CARD_MARK, appCard(p.slug, 'mid')) : body;
  const toc = prepared.toc.length >= 3
    ? `<nav class="toc" aria-label="On this page"><p>On this page</p><ol>${prepared.toc.map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}${p.faq.length ? '<li><a href="#faq">FAQ</a></li>' : ''}</ol></nav>`
    : '';
  const faq = p.faq.length
    ? `<section class="faq post-faq"><h2 id="faq">FAQ</h2>${p.faq.map(x => `<details><summary>${esc(x.q)}</summary><p>${inline(linkifyBare(x.a))}</p></details>`).join('')}</section>`
    : '';
  const shown = safeSources(p.sources, DEFAULT_BANNED_NAMES);
  const sources = shown.length
    ? `<section class="sources"><h2>Sources</h2><ul>${shown.map(x => `<li><a href="${esc(x.url)}" rel="noopener nofollow" target="_blank">${esc(x.name)}</a></li>`).join('')}</ul></section>`
    : '';
  const rel = related.length
    ? `<section class="related"><h2>Related articles</h2><ul class="cards">${related.map(r => card(r)).join('')}</ul></section>`
    : '';
  const updated = '';
  const banner = preview ? `<div class="preview-banner" role="status">Preview: this article goes live on ${esc(fmtDate(preview.goLive))} at ${esc(new Date(preview.goLive).toISOString().slice(11, 16))} UTC. Visitors see a 404 until then.</div>` : '';
  const content = `${banner}<main class="post">
<header class="post-head"><div class="narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span> <a href="/blog">Blog</a> <span aria-hidden="true">›</span> <a href="/blog/category/${catSlug(p.category)}">${esc(p.category)}</a></nav>
<h1>${esc(p.title)}</h1>
${p.description ? `<p class="dek">${esc(p.description)}</p>` : ''}
<div class="byline-row"><p class="byline"><span class="avatar" aria-hidden="true">${esc(p.author.split(/\s+/).map(w => w[0]).join('').slice(0, 2))}</span><span>By <strong>${esc(p.author)}</strong><br><time datetime="${p.publish_at}">${fmtDate(p.publish_at)}</time>${updated} · ${p.reading_minutes} min read</span></p><button type="button" class="byline-share" data-title="${esc(p.title)}" data-url="${esc(url)}">${ICON.share}<span>Share</span></button></div>
</div></header>
<div class="narrow">
<article class="prose">
${toc}
${body}
${appCard(p.slug, 'end')}
${faq}
${sources}
<p class="disclosure">NumFall is made by the publisher of this site. Any health or brain-training points here are general information, not medical advice.</p>
${share(url, p.title, p.slug)}
${SHARE_SCRIPT}
</article>
${rel}
<p class="back"><a href="/blog">← All articles</a></p>
</div>
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
      ...(p.faq.length ? [{ '@type': 'FAQPage', mainEntity: p.faq.map(x => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: linkifyBare(x.a).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') } })) }] : []),
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
    title: p.meta_title ? pageTitle(p.meta_title) : pageTitle(p.title),
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

function card(p: PublicPost, featured = false): string {
  return `<li class="pcard${featured ? ' featured' : ''}"><a href="/blog/${p.slug}">
${gridMark(p.slug, featured ? 4 : 3)}
<span class="card-body"><span class="chip">${esc(p.category)}</span>
<${featured ? 'h2' : 'h3'}>${esc(p.title)}</${featured ? 'h2' : 'h3'}>
<span class="excerpt">${esc(p.excerpt || p.description)}</span>
<span class="meta">${esc(p.author)} · ${fmtDate(p.publish_at)} · ${p.reading_minutes} min read</span></span></a></li>`;
}

export const PER_PAGE = 12;

export function indexPage(f: SiteFiles, posts: PublicPost[], pageNo: number, category: string | null): string {
  const cats = [...new Set(posts.map(p => p.category))].sort();
  const filtered = category ? posts.filter(p => catSlug(p.category) === category) : posts;
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const n = Math.min(Math.max(1, pageNo), pages);
  const shown = filtered.slice((n - 1) * PER_PAGE, n * PER_PAGE);
  const catName = category ? cats.find(c => catSlug(c) === category) : undefined;
  const base = category ? `/blog/category/${category}` : '/blog';
  const href = (k: number) => (k > 1 ? `${base}?page=${k}` : base);
  const featured = !category && n === 1 && shown.length ? shown[0] : null;
  const rest = featured ? shown.slice(1) : shown;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(k => k === 1 || k === pages || Math.abs(k - n) <= 2);
  const pager = pages > 1
    ? `<nav class="pager" aria-label="Pages">${n > 1 ? `<a href="${href(n - 1)}" rel="prev">← Newer</a>` : '<span></span>'}<span class="nums">${nums.map((k, i) => `${i && k - nums[i - 1] > 1 ? '<span>…</span>' : ''}${k === n ? `<span aria-current="page">${k}</span>` : `<a href="${href(k)}">${k}</a>`}`).join('')}</span>${n < pages ? `<a href="${href(n + 1)}" rel="next">Older →</a>` : '<span></span>'}</nav>`
    : '';
  const content = `<main class="blog">
<header class="blog-head"><div class="wrap">
<p class="kicker">${catName ? `<a href="/blog">Blog</a> › Category` : 'The NumFall blog'}</p>
<h1>${catName ? esc(catName) : 'Number puzzles, logic and the order of moves'}</h1>
<p class="lead">Solving techniques for 4×4, 6×6 and 9×9 grids, logic puzzle rules, brain game habits and casual puzzle gaming on iPhone and iPad.</p>
<nav class="cats" aria-label="Categories"><a href="/blog"${!category ? ' aria-current="page"' : ''}>All</a>${cats.map(c => `<a href="/blog/category/${catSlug(c)}"${catSlug(c) === category ? ' aria-current="page"' : ''}>${esc(c)}</a>`).join('')}</nav>
</div></header>
<div class="wrap">
${shown.length ? `${featured ? `<ul class="cards one">${card(featured, true)}</ul>` : ''}<ul class="cards">${rest.map(p => card(p)).join('')}</ul>` : '<p class="empty">New articles are on the way.</p>'}
${pager}
</div>
</main>`;
  return page(f, {
    title: catName ? pageTitle(`${catName} articles`) : 'Number puzzle and logic puzzle articles | NumFall',
    description: catName
      ? `${catName} articles from NumFall: plain guides to number puzzles, logic grids and solving techniques.`.slice(0, 155)
      : 'Articles on solving number puzzles and logic grids, puzzle techniques, brain game habits and casual puzzle games for iPhone and iPad.',
    canonical: `${SITE}${href(n)}`,
    content,
    extraHead: `${n > 1 ? `<link rel="prev" href="${SITE}${href(n - 1)}">\n` : ''}${n < pages ? `<link rel="next" href="${SITE}${href(n + 1)}">\n` : ''}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': catName ? 'CollectionPage' : 'Blog', name: catName ? `${catName}: NumFall blog` : 'NumFall blog', url: `${SITE}${href(n)}`, blogPost: shown.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.publish_at, author: { '@type': 'Person', name: p.author } })) },
        { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` }, ...(catName ? [{ '@type': 'ListItem', position: 3, name: catName, item: `${SITE}/blog/category/${category}` }] : [])] },
      ],
    },
  });
}

// Each URL gets changefreq and priority (owner's choice, 2 November 2026); no lastmod.
const SITEMAP_RULES: Record<string, [string, string]> = {
  '/': ['weekly', '1.0'],
  '/blog': ['daily', '0.9'],
  '/about': ['monthly', '0.5'],
  '/support': ['monthly', '0.4'],
  '/press': ['monthly', '0.3'],
  '/privacy': ['yearly', '0.2'],
  '/terms': ['yearly', '0.2'],
};

export function sitemap(f: SiteFiles, posts: PublicPost[]): string {
  const url = (loc: string, changefreq: string, priority: string) => `<url>\n<loc>${loc}</loc>\n<changefreq>${changefreq}</changefreq>\n<priority>${priority}</priority>\n</url>`;
  const urls = [
    ...f.staticPages.map(p => url(`${SITE}${p}`, ...(SITEMAP_RULES[p] ?? ['monthly', '0.5']))),
    ...[...new Set(posts.map(p => catSlug(p.category)))].map(c => url(`${SITE}/blog/category/${c}`, 'weekly', '0.5')),
    ...posts.map(p => url(`${SITE}/blog/${p.slug}`, 'monthly', '0.7')),
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

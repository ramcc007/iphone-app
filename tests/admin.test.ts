// numfall.store admin API (/api/admin/*): server-side admin checks on every route, blog CRUD with validation,
// sanitising, duplicate slugs, publishing rules, Publish now, and the GA4 dashboard's 501 / error handling.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Fake } from './fakes/server';

const fake = new Fake();
let adminApi: typeof import('../api/admin');
let pageApi: typeof import('../api/page');
let analytics: typeof import('../writer/server/admin/analytics');

before(async () => {
  await fake.start();
  Object.assign(process.env, fake.env(), { LOGIN_DELAY_MS: '0' });
  delete process.env.APP_ROLE;
  adminApi = await import('../api/admin');
  pageApi = await import('../api/page');
  analytics = await import('../writer/server/admin/analytics');
});
after(() => fake.stop());
beforeEach(() => {
  fake.posts.length = 0;
  fake.state.clear();
  fake.calls.indexnow = [];
  for (const k of analytics.GA4_ENV) delete process.env[k];
});

const BASE = 'https://www.numfall.store/api/admin';
type Opts = { method?: string; body?: unknown; cookie?: string; ip?: string };
async function call(path: string, o: Opts = {}): Promise<{ status: number; data: Record<string, unknown> & { error?: string } }> {
  const [p, q] = path.split('?');
  const url = `${BASE}?path=${p}${q ? `&${q}` : ''}`;
  const method = o.method ?? 'GET';
  const headers: Record<string, string> = { 'x-forwarded-for': o.ip ?? '192.0.2.1' };
  if (o.cookie) headers.cookie = o.cookie;
  const req = new Request(url, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  const fn = adminApi[method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'];
  const r = await fn(req);
  return { status: r.status, data: (await r.json()) as Record<string, unknown> & { error?: string } };
}
async function login(): Promise<string> {
  const req = new Request(`${BASE}?path=login`, { method: 'POST', headers: { 'x-forwarded-for': '192.0.2.50' }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
  const r = await adminApi.POST(req);
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie')!.split(';')[0];
}
const body = (n = 130) => `<h2>Rows first</h2><p>${'Each row holds each number once. '.repeat(Math.ceil(n / 7))}</p>`;
const valid = (over: Record<string, unknown> = {}) => ({
  title: 'How rows and columns work on a small grid',
  slug: '',
  excerpt: 'A short look at rows and columns.',
  category: 'How-to and techniques',
  tags: ['Grids', 'grids', 'beginners'],
  author: 'Emily Carter',
  meta_title: 'Rows and columns on a small grid',
  description: 'How rows and columns work on a small number grid, with a worked example and the mistakes beginners make.',
  key_takeaways: ['Each row holds each number once.', 'Check the column before you drop.'],
  faq: [{ q: 'Where should I start?', a: 'Start with the fullest row.' }],
  sources: [{ name: 'Cornell University', url: 'https://pi.math.cornell.edu/~mec/four.html' }],
  content_html: body(),
  ...over,
});

test('every admin route refuses callers without the admin cookie (checked on the server)', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  for (const [path, method] of [['analytics?range=7d', 'GET'], ['blog', 'GET'], ['blog', 'POST'], [`blog/${id}`, 'GET'], [`blog/${id}`, 'PUT'], [`blog/${id}`, 'PATCH'], [`blog/${id}`, 'DELETE']] as const) {
    const r = await call(path, { method, body: method === 'GET' || method === 'DELETE' ? undefined : {} });
    assert.equal(r.status, 401, `${method} ${path}`);
  }
  const forged = await call('blog', { cookie: 'nf_admin=eyJleHAiOjk5OTk5OTk5OTl9.forged' });
  assert.equal(forged.status, 401, 'a forged cookie is refused');
  assert.equal((await call('me')).data.admin, false);
  const c = await login();
  assert.equal((await call('me', { cookie: c })).data.admin, true);
});

test('create, read, update and delete a post; fields are checked and HTML is cleaned with sanitize-html', async () => {
  const c = await login();
  let r = await call('blog', { method: 'POST', cookie: c, body: { intent: 'draft', post: valid({ content_html: body() + '<script>alert(1)</script><p onclick="x()">Hi <a href="javascript:alert(1)">bad</a> <a href="/blog/x-y-z">ok</a></p><img src="x.png"><div data-app-card="1">App Store card</div>' }) } });
  assert.equal(r.status, 201, r.data.error);
  const id = String(r.data.id);
  assert.equal(r.data.status, 'draft');
  assert.equal(r.data.slug, 'how-rows-and-columns-work-on', 'slug from the title, 6 words at most');
  const html = String(r.data.content_html);
  assert.ok(!/script|onclick|javascript:|<img/i.test(html), html);
  assert.ok(html.includes('<a href="/blog/x-y-z">ok</a>'));
  assert.ok(html.includes('<!--app-card-->'), 'the App Store card marker survives');
  assert.deepEqual(r.data.tags, ['grids', 'beginners'], 'tags trimmed, lower case, no duplicates');
  assert.deepEqual(r.data.key_takeaways, ['Each row holds each number once.', 'Check the column before you drop.']);

  r = await call(`blog/${id}`, { cookie: c });
  assert.equal(r.status, 200);
  assert.equal(r.data.meta_description, valid().description);

  r = await call(`blog/${id}`, { method: 'PUT', cookie: c, body: { intent: 'draft', post: valid({ title: 'Rows and columns on a small grid, explained', slug: 'rows-columns-small-grid' }) } });
  assert.equal(r.status, 200, r.data.error);
  assert.equal(r.data.slug, 'rows-columns-small-grid');

  const list = await call('blog', { cookie: c });
  assert.equal((list.data.rows as unknown[]).length, 1);
  assert.ok(Array.isArray(list.data.categories) && list.data.timeZone);

  r = await call(`blog/${id}`, { method: 'DELETE', cookie: c });
  assert.equal(r.status, 200);
  assert.equal((await call(`blog/${id}`, { cookie: c })).status, 404);
  assert.equal((await call('blog/not-a-uuid', { cookie: c })).status, 404);
});

test('validation lists every problem; game names, short articles and bad sources are refused', async () => {
  const c = await login();
  const r = await call('blog', { method: 'POST', cookie: c, body: { intent: 'publish', post: valid({ title: 'Hi', slug: 'Bad Slug!!', category: '', description: 'short', content_html: '<p>Too short.</p>', faq: [{ q: 'Only a question?', a: '' }], sources: [{ name: 'X', url: 'ftp://x' }] }) } });
  assert.equal(r.status, 400);
  for (const msg of ['Title: at least 5', 'URL slug', 'Category', 'Meta description: at least 50', 'at least 100 words', 'FAQ: every question', 'Sources: "X"']) assert.ok(r.data.error!.includes(msg), msg);
  const named = await call('blog', { method: 'POST', cookie: c, body: { intent: 'draft', post: valid({ content_html: body() + '<p>Like a Sudoku grid.</p>' }) } });
  assert.equal(named.status, 400);
  assert.match(named.data.error!, /Remove other game or brand names \(Sudoku\)/);
  const named2 = await call('blog', { method: 'POST', cookie: c, body: { intent: 'draft', post: valid({ sources: [{ name: 'History guide', url: 'https://eversudoku.com/history' }] }) } });
  assert.equal(named2.status, 400, 'a game name inside a source address is caught too');
});

test('duplicate slugs get a clear 409', async () => {
  const c = await login();
  assert.equal((await call('blog', { method: 'POST', cookie: c, body: { intent: 'draft', post: valid({ slug: 'rows-columns-small-grid' }) } })).status, 201);
  const r = await call('blog', { method: 'POST', cookie: c, body: { intent: 'draft', post: valid({ slug: 'rows-columns-small-grid' }) } });
  assert.equal(r.status, 409);
  assert.match(r.data.error!, /already used by "How rows and columns work on a small grid"/);
});

test('publishing rules: future date = scheduled (404 for visitors, preview for admin), back-dated = live at once', async () => {
  const c = await login();
  const page = (slug: string, cookie?: string) => pageApi.GET(new Request(`https://www.numfall.store/api/page?r=post&slug=${slug}`, { headers: cookie ? { cookie } : {} }));
  const future = new Date(Date.now() + 3 * 86400_000).toISOString();
  let r = await call('blog', { method: 'POST', cookie: c, body: { intent: 'publish', post: valid({ slug: 'future-post-on-grids', publish_at: future }) } });
  assert.equal(r.status, 201, r.data.error);
  assert.equal(r.data.status, 'scheduled');
  assert.equal(r.data.live, false);
  assert.equal((await page('future-post-on-grids')).status, 404);
  const preview = await page('future-post-on-grids', c);
  assert.equal(preview.status, 200);
  assert.match(await preview.text(), /Preview: this article goes live/);

  const past = '2026-09-01T10:00:00.000Z';
  r = await call('blog', { method: 'POST', cookie: c, body: { intent: 'publish', post: valid({ slug: 'backdated-post-on-grids', publish_at: past }) } });
  assert.equal(r.data.status, 'published');
  assert.equal(r.data.publish_at, past, 'back-dated date kept');
  const live = await page('backdated-post-on-grids');
  assert.equal(live.status, 200);
  const html = await live.text();
  assert.ok(html.includes('In short') && html.includes('Check the column before you drop.'), 'key takeaways box');
  await new Promise(res => setTimeout(res, 20));
  assert.ok(fake.calls.indexnow.some(x => x.urlList.includes('https://www.numfall.store/blog/backdated-post-on-grids')), 'IndexNow pinged after the response');

  // Unpublish: back to draft, gone for visitors.
  const id = String(r.data.id);
  r = await call(`blog/${id}`, { method: 'PUT', cookie: c, body: { intent: 'unpublish', post: valid({ slug: 'backdated-post-on-grids', publish_at: past }) } });
  assert.equal(r.data.status, 'draft');
  assert.equal((await page('backdated-post-on-grids')).status, 404);
});

test('Publish now: only for scheduled posts; sets the date to now; 409 with the reason otherwise', async () => {
  const c = await login();
  const sched = await call('blog', { method: 'POST', cookie: c, body: { intent: 'publish', post: valid({ slug: 'scheduled-post-on-grids', publish_at: new Date(Date.now() + 86400_000).toISOString() }) } });
  const draft = await call('blog', { method: 'POST', cookie: c, body: { intent: 'draft', post: valid({ slug: 'draft-post-on-grids' }) } });
  const before = Date.now();
  let r = await call(`blog/${sched.data.id}`, { method: 'PATCH', cookie: c, body: { action: 'publish_now' } });
  assert.equal(r.status, 200, r.data.error);
  const post = r.data.post as { status: string; publish_at: string; live: boolean };
  assert.equal(post.status, 'published');
  assert.equal(post.live, true);
  assert.ok(Date.parse(post.publish_at) >= before - 1000);
  r = await call(`blog/${sched.data.id}`, { method: 'PATCH', cookie: c, body: { action: 'publish_now' } });
  assert.equal(r.status, 409);
  assert.match(r.data.error!, /already live/);
  r = await call(`blog/${draft.data.id}`, { method: 'PATCH', cookie: c, body: { action: 'publish_now' } });
  assert.equal(r.status, 409);
  assert.match(r.data.error!, /draft/);
  r = await call(`blog/${draft.data.id}`, { method: 'PATCH', cookie: c, body: { action: 'something' } });
  assert.equal(r.status, 400);
});

test('GA4 dashboard: 501 naming the missing env vars; Google errors never reach the page; ranges are checked', async () => {
  const c = await login();
  let r = await call('analytics?range=7d', { cookie: c });
  assert.equal(r.status, 501);
  assert.deepEqual(r.data.missing, ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_EMAIL', 'GA4_SERVICE_ACCOUNT_PRIVATE_KEY']);
  r = await call('analytics?range=90d', { cookie: c });
  assert.equal(r.status, 400);

  Object.assign(process.env, { GA4_PROPERTY_ID: '123', GA4_SERVICE_ACCOUNT_EMAIL: 'x@y.iam.gserviceaccount.com', GA4_SERVICE_ACCOUNT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n' });
  await assert.rejects(analytics.snapshot('today', async () => { throw new Error('7 PERMISSION_DENIED: User does not have sufficient permissions for this property.'); }), (e: Error) => {
    assert.ok(!/PERMISSION_DENIED/.test(e.message), 'raw Google error not shown');
    assert.match(e.message, /Viewer access/);
    return true;
  });
  // Shape of a good answer (the four reports run in parallel).
  const reqs: unknown[] = [];
  const snap = await analytics.snapshot('30d', async q => {
    reqs.push(...q);
    return [
      { rows: [{ metricValues: [{ value: '120' }, { value: '80' }, { value: '150' }, { value: '400' }, { value: '95.6' }] }] },
      { rows: [{ dimensionValues: [{ value: '/blog/x' }, { value: 'X' }], metricValues: [{ value: '40' }] }] },
      { rows: [{ dimensionValues: [{ value: 'mobile' }], metricValues: [{ value: '90' }] }] },
      { rows: [{ dimensionValues: [{ value: 'Austin' }, { value: 'United States' }], metricValues: [{ value: '12' }] }] },
    ];
  });
  assert.equal(reqs.length, 4);
  assert.deepEqual(snap.tiles, { activeUsers: 120, newUsers: 80, sessions: 150, pageViews: 400, avgSessionSeconds: 96 });
  assert.deepEqual(snap.locations[0], { city: 'Austin', country: 'United States', users: 12 });
  assert.equal(snap.label, 'Last 30 days');
});

test('blog pages: 9 per page at /blog/page/N (noindex, not in the sitemap); old ?page=N moves; past the end is 404', async () => {
  for (let i = 0; i < 20; i++) {
    fake.posts.push({ id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`, article_id: null, slug: `sample-post-number-${i + 1}`, title: `Sample post ${i + 1}`, description: 'd', excerpt: 'e', category: i % 2 ? 'Number puzzles' : 'Brain and habits', author: 'Emily Carter', tags: [], html: '<p>x</p>', faq: [], headings: [], related: [], reading_minutes: 3, status: 'published', publish_at: new Date(Date.now() - (i + 1) * 86400_000).toISOString(), updated_at: new Date().toISOString() });
  }
  const get = (q: string) => pageApi.GET(new Request(`https://www.numfall.store/api/page?${q}`));
  const p1 = await (await get('r=blog')).text();
  assert.equal((p1.match(/class="pcard/g) ?? []).length, 9);
  assert.match(p1, /<meta name="robots" content="index, follow">/);
  assert.ok(p1.includes('href="/blog/page/2"'));
  const p2r = await get('r=blog&pg=2');
  assert.equal(p2r.status, 200);
  const p2 = await p2r.text();
  assert.match(p2, /<meta name="robots" content="noindex, follow">/);
  assert.match(p2, /<link rel="canonical" href="https:\/\/www.numfall.store\/blog\/page\/2">/);
  assert.equal((await get('r=blog&pg=4')).status, 404, '20 posts = 3 pages');
  const old = await get('r=blog&page=2');
  assert.equal(old.status, 301);
  assert.equal(old.headers.get('location'), '/blog/page/2');
  assert.equal((await get('r=blog&pg=1')).headers.get('location'), '/blog');
  const cat = await (await get('r=blog&cat=number-puzzles&pg=2')).text();
  assert.match(cat, /canonical" href="https:\/\/www.numfall.store\/blog\/category\/number-puzzles\/page\/2"/);
  const sm = await (await get('r=sitemap')).text();
  assert.ok(!sm.includes('/page/'), 'paginated pages are not in the sitemap');
  const feed = await (await get('r=rss')).text();
  assert.ok(feed.includes('<atom:link href="https://www.numfall.store/blog/feed.xml"'));
  assert.ok(p1.includes('"@type":"Organization"') && p1.includes('"@type":"WebSite"'));
});

test('robots.txt allows the main search and AI crawlers and keeps /admin and /api out', async () => {
  const { readFileSync } = await import('node:fs');
  const robots = readFileSync('site/src/robots.txt', 'utf8');
  for (const bot of ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Applebot']) assert.match(robots, new RegExp(`User-agent: ${bot}\\n`));
  assert.equal((robots.match(/Disallow: \/admin/g) ?? []).length, 2);
  assert.ok(!/Disallow: \/\n/.test(robots));
});

// The whole flow against fake Claude, Groq, GPTZero and Supabase servers.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Fake } from './fakes/server';

const fake = new Fake();
let runner: typeof import('../writer/server/runner');
let db: typeof import('../writer/server/db').db;
let pageApi: typeof import('../api/page');
let writerApi: typeof import('../api/writer');
let tickApi: typeof import('../api/tick');

before(async () => {
  await fake.start();
  Object.assign(process.env, fake.env());
  runner = await import('../writer/server/runner');
  db = (await import('../writer/server/db')).db;
  pageApi = await import('../api/page');
  writerApi = await import('../api/writer');
  tickApi = await import('../api/tick');
});
after(() => fake.stop());

beforeEach(() => {
  fake.articles.clear();
  fake.posts.length = 0;
  fake.usage.length = 0;
  fake.state.clear();
  fake.settings = { maxFailures: 3 };
  fake.calls = { claude: [], groq: 0, openrouter: [], gptzero: [], indexnow: [] };
  fake.groqMode = 'ok';
  fake.openrouterMode = 'ok';
  delete process.env.OPENROUTER_API_KEY;
  fake.claudeFail = null;
  // One live article to link to.
  fake.posts.push({
    id: 'old-id', article_id: 'old', slug: 'an-existing-live-post', title: 'Naked pairs in small grids', description: 'd', author: 'Ram Das', category: 'How-to and techniques', tags: [], html: '<p>x</p>', faq: [], headings: ['Rows first before boxes'], related: [], word_count: 500, reading_minutes: 2,
    status: 'published', publish_at: new Date(Date.now() - 86400_000).toISOString(), updated_at: new Date().toISOString(),
  });
});

async function drain(max = 10): Promise<void> {
  for (let i = 0; i < max; i++) {
    const r = await runner.tick(200_000, `test-${i}`);
    if (!r.worked.length) return;
  }
}

const cookie = async () => {
  const r = await writerApi.POST(new Request('http://x/api/writer', { method: 'POST', body: JSON.stringify({ action: 'login', password: 'pw' }) }));
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie')!.split(';')[0];
};

test('a scheduled batch is written one after another, scanned once, cleaned, and posts itself into its slots', async () => {
  const s = await db.getSettings();
  const made = await runner.createBatch({ topics: ['How to solve a 6×6 logic grid', 'Pencil marks for number puzzles'], mode: 'schedule', days: 7 }, s);
  assert.equal(made.length, 2);
  await drain();

  const rows = [...fake.articles.values()].map(r => r.data as unknown as import('../writer/shared/types').Article);
  for (const a of rows) {
    assert.equal(a.status, 'scheduled', `${a.options.topic}: ${a.step} ${a.error ?? ''}`);
    assert.equal(a.scanCount, 1, 'exactly one GPTZero scan');
    assert.ok((a.rewritten ?? 0) > 0, 'flagged sentences rewritten once');
    assert.ok(a.usage.costUsd > 0);
  }
  // One scan per article, never more.
  assert.equal(fake.calls.gptzero.length, 2);
  // Written one after another: every Claude call for article 1 comes before any for article 2.
  const firstOfSecond = fake.calls.claude.findIndex(c => c.article === 'Pencil marks for number puzzles');
  const lastPlanOfFirst = fake.calls.claude.map(c => c.step).indexOf('plan');
  assert.ok(firstOfSecond > lastPlanOfFirst);
  const t1 = rows.sort((a, b) => a.position - b.position);
  const lastCallFirst = Math.max(...fake.calls.claude.filter(c => c.at && t1[0].updatedAt && c.article && /6×6|How to solve/.test(c.article)).map(c => c.at));
  assert.ok(lastCallFirst <= fake.calls.claude[firstOfSecond].at);

  // Posts: scheduled, in the future, at least 4 hours apart, App Store link with the campaign token.
  assert.equal(fake.posts.length, 3);
  const mine = fake.posts.filter(p => p.article_id !== 'old');
  for (const p of mine) {
    assert.equal(p.status, 'scheduled');
    assert.ok(Date.parse(p.publish_at) > Date.now());
    const html = String(p.html);
    assert.ok(!/[–—]/.test(html), 'no long dashes');
    assert.ok(!/VERIFY|TODO|already covered|Keep exactly|Sudoku/i.test(html), 'nothing from "never publish"');
    assert.ok(!/4\.9 stars|million downloads/.test(html), 'invented app claims removed');
    assert.ok(html.includes(`ct=${p.slug}`), 'App Store link carries the article token');
    assert.ok((html.match(/NumFall/g) ?? []).length <= 2 + 0, 'at most 2 app mentions');
    assert.ok(String(p.title).length <= 60);
    assert.ok(String(p.description).length <= 155);
    assert.ok(!/Sudoku/i.test(String(p.title)), 'a title with another game name gets a fresh title');
    assert.match(String(p.slug), /^[a-z0-9]+(-[a-z0-9]+){2,5}$/);
    assert.ok((p.faq as unknown[]).length >= 3);
    assert.deepEqual((p.headings as string[]).filter(h => /[A-Z].*\b[A-Z][a-z]/.test(h.slice(1)) && !/NumFall|Daily|Drop/.test(h)), [], 'sentence case headings');
  }
  const [a, b] = mine.map(p => Date.parse(p.publish_at)).sort();
  assert.ok(b - a >= 4 * 3600_000);
  // The research fact dated after the article's date and the one without a URL were dropped.
  assert.ok(rows.every(r => r.research!.facts.length === 1));
  // A repeated heading from an existing article was changed.
  assert.ok(mine.every(p => !(p.headings as string[]).includes('Rows first before boxes')));
  // The noted sentence was verified with one web search and kept.
  assert.ok(fake.calls.claude.some(c => c.step === 'verify'));
  assert.ok(mine.some(p => String(p.html).includes("two rows and three columns")), mine.map(p => p.html).join("\n----\n") + JSON.stringify([...fake.articles.values()].map(r => (r.data as any).cleanReport)));
  // Internal link only to the live article.
  assert.ok(mine.every(p => !String(p.html).includes('not-live-yet-post')));
  assert.ok(mine.some(p => String(p.html).includes('href="/blog/an-existing-live-post"')));
  // Every paid call is in the usage log with a cost.
  const providers = new Set(fake.usage.map(u => u.provider));
  for (const p of ['anthropic', 'groq', 'gptzero']) assert.ok(providers.has(p), p);
  assert.ok(fake.usage.every(u => typeof u.cost_usd === 'number'));
  // The humanizer's meaning check put one rewrite back.
  assert.ok(rows.every(r => r.humanize!.units.some(u => u.state === 'reverted')));
});

test('scheduled posts 404 for visitors, preview for the admin, then go live with schema, sitemap and llms.txt', async () => {
  const s = await db.getSettings();
  await runner.createBatch({ topics: ['How to solve a 6×6 logic grid'], mode: 'schedule', days: 3 }, s);
  await drain();
  const p = fake.posts.find(x => x.article_id !== 'old')!;
  const url = (q: string) => new Request(`https://www.numfall.store/api/page?${q}`);
  let r = await pageApi.GET(url(`r=post&slug=${p.slug}`));
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const c = await cookie();
  r = await pageApi.GET(new Request(`https://www.numfall.store/api/page?r=post&slug=${p.slug}`, { headers: { cookie: c } }));
  assert.equal(r.status, 200);
  const preview = await r.text();
  assert.match(preview, /Preview: this article goes live on/);
  assert.match(preview, /noindex/);
  assert.ok(!/googletagmanager|gtag|id="consent"/.test(preview), 'no Google Analytics on admin previews');

  // Time passes: the 10-minute sweep marks it published.
  p.publish_at = new Date(Date.now() - 60_000).toISOString();
  await db.sweep();
  assert.equal(p.status, 'published');
  r = await pageApi.GET(url(`r=post&slug=${p.slug}`));
  assert.equal(r.status, 200);
  const html = await r.text();
  for (const needle of ['"@type":"Article"', '"@type":"FAQPage"', '"@type":"BreadcrumbList"', '"@type":"MobileApplication"', 'apple-itunes-app', 'class="app-card"', 'NumFall is made by the publisher of this site.', 'general information', `rel="canonical" href="https://www.numfall.store/blog/${p.slug}"`, `/og/${p.slug}.png`, 'class="sharebox"', 'class="byline-share"', 'wa.me', 'utm_source%3Dx', 'share-copy', 'Related articles']) {
    assert.ok(html.includes(needle), needle);
  }
  assert.equal((html.match(/class="app-card"/g) ?? []).length, 2, 'app card mid-article and at the end');
  assert.ok(!/aggregateRating|ratingValue/.test(html), 'no rating claimed');
  assert.ok(!html.includes('Preview:'));
  assert.ok(html.includes('googletagmanager'), 'public pages keep the consent-based analytics');

  const blog = await (await pageApi.GET(url('r=blog'))).text();
  assert.ok(blog.includes(`/blog/${p.slug}`));
  const sm = await (await pageApi.GET(url('r=sitemap'))).text();
  assert.ok(sm.includes(`https://www.numfall.store/blog/${p.slug}`) && sm.includes('https://www.numfall.store/support'));
  const llms = await (await pageApi.GET(url('r=llms'))).text();
  assert.ok(llms.includes(String(p.title)));
});

test('backdated batch: each article is written as of its own date and goes live at once', async () => {
  const s = await db.getSettings();
  const made = await runner.createBatch({ topics: ['Daily puzzle routines for focus', 'Puzzles for kids learning numbers', 'Offline puzzle games for flights'], mode: 'backdate', days: 10 }, s);
  await drain();
  for (const m of made) {
    const a = (fake.articles.get(m.id)!.data as unknown) as import('../writer/shared/types').Article;
    assert.equal(a.status, 'published');
    assert.ok(Date.parse(a.options.publishAt!) < Date.now());
    assert.equal(a.options.asOf, new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(a.options.publishAt!)));
  }
  const research = fake.calls.claude.filter(c => c.step === 'research');
  assert.equal(research.length, 3);
});

test('two runners never work the same article: the lease blocks the second', async () => {
  const s = await db.getSettings();
  const [a] = await runner.createBatch({ topics: ['Speed-solving habits'], mode: 'manual' }, s);
  const claimed = await db.claim(a.id, 'tab-A', 300);
  assert.ok(claimed);
  assert.equal(await db.claim(a.id, 'tab-B', 300), null);
  const r = await runner.runFromBrowser(a.id, 'tab-B', 200_000);
  assert.equal(r.busy, true);
  assert.equal(fake.calls.claude.length, 0, 'tab B paid for nothing');
  await assert.rejects(db.putArticle({ ...claimed!, step: 'x' }, 'tab-B'), /Another runner/);
});

test('automatic retries stop after a few failures so a stuck article cannot keep costing money', async () => {
  const s = await db.getSettings();
  const [a] = await runner.createBatch({ topics: ['Latin squares explained'], mode: 'manual' }, s);
  fake.claudeFail = step => step === 'plan';
  for (let i = 0; i < 6; i++) {
    const row = fake.articles.get(a.id)!;
    row.next_attempt_at = new Date(0).toISOString(); // skip the backoff wait
    await runner.tick(200_000, `t${i}`);
  }
  const after = fake.articles.get(a.id)!.data as unknown as import('../writer/shared/types').Article;
  assert.equal(after.stopped, true);
  assert.equal(after.status, 'failed');
  assert.equal(fake.calls.claude.filter(c => c.step === 'plan').length, 3, 'stopped at maxFailures');
  // Retry starts it again.
  fake.claudeFail = null;
  await runner.retry(a.id, 'me');
  await drain();
  const done = fake.articles.get(a.id)!.data as unknown as import('../writer/shared/types').Article;
  assert.equal(done.status, 'ready', done.error);
});

test('the humanizer pauses itself on a daily-limit error and articles carry on without it', async () => {
  fake.groqMode = 'daily';
  const s = await db.getSettings();
  const [a] = await runner.createBatch({ topics: ['Games without ads for iPad'], mode: 'manual' }, s);
  await drain();
  const done = fake.articles.get(a.id)!.data as unknown as import('../writer/shared/types').Article;
  assert.equal(done.status, 'ready', done.error);
  assert.match(done.humanize!.skipped!, /daily limit/);
  const pause = fake.state.get('humanizer_paused_until:groq') as { until: number };
  assert.ok(pause.until > Date.now());
  // The next article skips Groq entirely while paused.
  const groqBefore = fake.calls.groq;
  const [b] = await runner.createBatch({ topics: ['Puzzle games that sync across devices'], mode: 'manual' }, s);
  await drain();
  assert.equal(fake.calls.groq, groqBefore);
  assert.match((fake.articles.get(b.id)!.data as { humanize: { skipped: string } }).humanize.skipped, /paused/);
});

test('when Groq is out for the day, the free OpenRouter model takes over the humanizing', async () => {
  process.env.OPENROUTER_API_KEY = 'or-key';
  fake.groqMode = 'daily';
  const s = await db.getSettings();
  const [a] = await runner.createBatch({ topics: ['Accessible puzzle games with VoiceOver'], mode: 'manual' }, s);
  await drain();
  const done = fake.articles.get(a.id)!.data as unknown as import('../writer/shared/types').Article;
  assert.equal(done.status, 'ready', done.error);
  assert.equal(done.humanize!.skipped, undefined, 'not skipped: the fallback did it');
  assert.ok(done.humanize!.units.some(u => u.state === 'done' || u.state === 'reverted'));
  assert.ok(done.humanize!.via!.some(v => v.startsWith('openrouter openai/gpt-oss-20b:free')));
  assert.ok((fake.state.get('humanizer_paused_until:groq') as { until: number }).until > Date.now());
  // Free model, OpenRouter's reasoning format, cost 0 in the usage log.
  assert.ok(fake.calls.openrouter.every(c => c.model === 'openai/gpt-oss-20b:free' && (c.reasoning as { effort: string }).effort === 'low' && c.referer === 'https://www.numfall.store'));
  const orUsage = fake.usage.filter(u => u.provider === 'openrouter');
  assert.ok(orUsage.length > 0 && orUsage.every(u => u.cost_usd === 0));
});

test('when both humanizer providers are out for the day, articles carry on without it', async () => {
  process.env.OPENROUTER_API_KEY = 'or-key';
  fake.groqMode = 'daily';
  fake.openrouterMode = 'daily';
  const s = await db.getSettings();
  const [a] = await runner.createBatch({ topics: ['Puzzles for older adults'], mode: 'manual' }, s);
  await drain();
  const done = fake.articles.get(a.id)!.data as unknown as import('../writer/shared/types').Article;
  assert.equal(done.status, 'ready', done.error);
  assert.match(done.humanize!.skipped!, /groq daily limit reached; openrouter daily limit reached/);
  assert.ok((fake.state.get('humanizer_paused_until:openrouter') as { until: number }).until > Date.now());
});

test('manual article waits for you; "post now" publishes it; rescan stays off by default', async () => {
  const s = await db.getSettings();
  const [a] = await runner.createBatch({ topics: ['Earning three stars on Master boards'], mode: 'manual' }, s);
  await drain();
  let row = fake.articles.get(a.id)!.data as unknown as import('../writer/shared/types').Article;
  assert.equal(row.status, 'ready');
  assert.equal(fake.posts.filter(p => p.article_id === a.id).length, 0);
  assert.equal(fake.calls.gptzero.length, 1);
  const c = await cookie();
  const r = await writerApi.POST(new Request('http://x/api/writer', { method: 'POST', headers: { cookie: c }, body: JSON.stringify({ action: 'post', id: a.id, when: 'now' }) }));
  assert.equal(r.status, 200, await r.clone().text());
  row = fake.articles.get(a.id)!.data as unknown as import('../writer/shared/types').Article;
  assert.equal(row.status, 'published');
  assert.equal(fake.posts.find(p => p.article_id === a.id)!.status, 'published');
});

test('admin API and tick endpoint refuse callers without the cookie or secret', async () => {
  const r1 = await writerApi.GET(new Request('http://x/api/writer?action=list'));
  assert.equal(r1.status, 401);
  const r2 = await writerApi.POST(new Request('http://x/api/writer', { method: 'POST', body: JSON.stringify({ action: 'login', password: 'nope' }) }));
  assert.equal(r2.status, 401);
  const r3 = await tickApi.POST(new Request('http://x/api/tick', { method: 'POST' }));
  assert.equal(r3.status, 401);
});

test('the admin page never loads Google Analytics', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync('site/admin/index.html', 'utf8');
  assert.ok(!/googletagmanager|gtag|analytics/i.test(html));
  assert.ok(!/googletagmanager|gtag/.test(readFileSync('writer/ui/main.ts', 'utf8')));
});

test('RSS feed lists live articles; IndexNow gets everything once, then only new or changed pages', async () => {
  const { submitToIndexNow } = await import('../writer/server/indexnow');
  const url = (q: string) => new Request(`https://www.numfall.store/api/page?${q}`);
  const feed = await (await pageApi.GET(url('r=rss'))).text();
  assert.match(feed, /<rss version="2.0"/);
  assert.ok(feed.includes('<link>https://www.numfall.store/blog/an-existing-live-post</link>'));
  assert.ok(feed.includes('<dc:creator>Ram Das</dc:creator>'));

  const first = await submitToIndexNow();
  assert.equal(fake.calls.indexnow.length, 1);
  const sent = fake.calls.indexnow[0];
  assert.equal(sent.host, 'www.numfall.store');
  assert.match(sent.keyLocation, /^https:\/\/www\.numfall\.store\/[0-9a-f]{32}\.txt$/);
  assert.ok(sent.urlList.includes('https://www.numfall.store/') && sent.urlList.includes('https://www.numfall.store/blog/an-existing-live-post'));
  assert.equal(first.submitted, sent.urlList.length);

  // Nothing changed: no request at all.
  const second = await submitToIndexNow(new Date(Date.now() + 1000));
  assert.equal(fake.calls.indexnow.length, 1);
  assert.match(second.note, /nothing new/);

  // A post goes live: only it and /blog are sent.
  await new Promise(r => setTimeout(r, 20));
  const t = new Date().toISOString();
  fake.posts.push({ ...fake.posts[0], article_id: 'new', slug: 'brand-new-live-post', publish_at: t, updated_at: t });
  await submitToIndexNow(new Date(Date.now() + 5000));
  assert.deepEqual(fake.calls.indexnow[1].urlList, ['https://www.numfall.store/blog', 'https://www.numfall.store/blog/brand-new-live-post']);
});

test('blog manager: drafts stay private, publish and schedule work, HTML is cleaned, delete removes', async () => {
  const c = await cookie();
  const call = async (body: Record<string, unknown>) => {
    const r = await writerApi.POST(new Request('http://x/api/writer', { method: 'POST', headers: { cookie: c }, body: JSON.stringify(body) }));
    return { status: r.status, json: (await r.json()) as Record<string, unknown> };
  };
  const words = Array.from({ length: 130 }, (_, i) => `word${i}`).join(' ');
  const post = {
    title: 'Pencil marks on a 6×6 grid',
    slug: 'pencil-marks-six-grid',
    html: `<h2>First steps</h2><p onclick="x()">Solvers note candidates. ${words}</p><script>alert(1)</script><img src=x onerror=alert(1)><p><a href="javascript:alert(1)">bad</a> <a href="/blog/an-existing-live-post">good</a> https://apps.apple.com/app/id6820579220</p>`,
    excerpt: 'How solvers use pencil marks.',
    description: 'How solvers use pencil marks on a 6×6 grid.',
    meta_title: 'Pencil marks on 6×6 grids',
    author: 'Emily Carter',
    category: 'How-to and techniques',
    tags: ['6x6', 'notes'],
    faq: [{ q: 'what are pencil marks', a: 'Small notes of possible numbers. See https://www.numfall.store/ for the app.' }],
    sources: [{ name: 'Example', url: 'https://example.org/a' }, { name: 'Bad', url: 'javascript:1' }],
  };
  // Draft: saved, never public.
  const d = await call({ action: 'blog_save', intent: 'draft', post });
  assert.equal(d.status, 200, JSON.stringify(d.json));
  assert.equal(d.json.status, 'draft');
  const html = String(d.json.html);
  assert.ok(!/script|onclick|onerror|<img|javascript/i.test(html), html);
  assert.ok(html.includes('<a href="/blog/an-existing-live-post">good</a>'));
  assert.equal((d.json.sources as unknown[]).length, 1);
  assert.deepEqual(d.json.headings, ['First steps']);
  let r = await pageApi.GET(new Request('https://www.numfall.store/api/page?r=post&slug=pencil-marks-six-grid'));
  assert.equal(r.status, 404, 'drafts are not public');

  // Publish now: public, with TOC-ready headings, sources, linked bare URLs, meta title.
  const pub = await call({ action: 'blog_save', intent: 'publish', post: { ...post, id: d.json.id, publish_at: new Date(Date.now() - 1000).toISOString() } });
  assert.equal(pub.json.status, 'published');
  r = await pageApi.GET(new Request('https://www.numfall.store/api/page?r=post&slug=pencil-marks-six-grid'));
  assert.equal(r.status, 200);
  const page = await r.text();
  assert.match(page, /<title>Pencil marks on 6×6 grids \| NumFall<\/title>/);
  assert.match(page, /<h2 id="first-steps">First steps<\/h2>/);
  assert.match(page, /class="sources"[\s\S]*example\.org\/a/);
  assert.match(page, /<a href="https:\/\/apps\.apple\.com\/app\/id6820579220"[^>]*>NumFall on the App Store<\/a>/, 'bare App Store address became a link');
  assert.match(page, /<a href="https:\/\/www\.numfall\.store\/">numfall\.store<\/a>/, 'bare address in the FAQ became a link');
  const cat = await (await pageApi.GET(new Request('https://www.numfall.store/api/page?r=blog&cat=how-to-and-techniques'))).text();
  assert.ok(cat.includes('/blog/pencil-marks-six-grid') && cat.includes('class="gridmark'));

  // Future date: scheduled, 404 for visitors.
  const sch = await call({ action: 'blog_save', intent: 'publish', post: { ...post, id: d.json.id, publish_at: new Date(Date.now() + 86400_000).toISOString() } });
  assert.equal(sch.json.status, 'scheduled');
  // Duplicate slug and bad slug are refused with a plain message.
  const dup = await call({ action: 'blog_save', intent: 'draft', post: { ...post, slug: 'an-existing-live-post' } });
  assert.equal(dup.status, 409);
  const bad = await call({ action: 'blog_save', intent: 'draft', post: { ...post, slug: 'two-words' } });
  assert.equal(bad.status, 400);
  // List and delete.
  const list = (await (await writerApi.GET(new Request('http://x/api/writer?action=blog_list', { headers: { cookie: c } }))).json()) as { id: string }[];
  assert.ok(list.some(x => x.id === d.json.id));
  await call({ action: 'blog_delete', id: d.json.id });
  assert.ok(!fake.posts.some(p => p.id === d.json.id));
});

test('a cut-off links answer does not stop the article: it carries on without internal links', async () => {
  const s = await db.getSettings();
  const orig = (fake as unknown as { claude: (b: unknown) => [number, unknown] }).claude.bind(fake);
  (fake as unknown as { claude: (b: { messages: { content: string }[] }) => [number, unknown] }).claude = (b: { messages: { content: string }[] }) => {
    if (/Pick 2 or 3 of these live articles/.test(String(b.messages[0].content))) {
      fake.calls.claude.push({ step: 'links', model: 'x', at: Date.now() });
      return [200, { content: [{ type: 'text', text: '{"links": [{"slug": "an-exi' }], stop_reason: 'max_tokens', usage: { input_tokens: 100, output_tokens: 2500 } }];
    }
    return orig(b);
  };
  try {
    const [a] = await runner.createBatch({ topics: ['How gravity changes a classic 9x9 number puzzle'], mode: 'manual' }, s);
    await drain();
    const done = fake.articles.get(a.id)!.data as unknown as import('../writer/shared/types').Article;
    assert.equal(done.status, 'ready', done.error);
    assert.deepEqual(done.links, []);
    assert.equal(fake.calls.claude.filter(c => c.step === 'links').length, 1, 'tried once, no retry loop');
    assert.ok(fake.usage.some(u => u.step === 'pick links' && u.ok === false && /cut off/.test(String(u.note))));
  } finally {
    (fake as unknown as { claude: unknown }).claude = orig;
  }
});

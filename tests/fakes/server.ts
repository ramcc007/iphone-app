// One local HTTP server that stands in for Claude, Groq, GPTZero, the App Store lookup, the website and
// Supabase (writer_api and the public posts table). The database part mirrors supabase/001_numfall_articles.sql.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';

export interface Calls {
  claude: { step: string; model: string; article?: string; at: number }[];
  groq: number;
  openrouter: { model: string; reasoning: unknown; referer?: string }[];
  gptzero: { words: number; text: string }[];
  indexnow: { host: string; key: string; keyLocation: string; urlList: string[] }[];
}

type ArticleRow = { id: string; batch_id: string | null; position: number; status: string; stopped: boolean; next_attempt_at: string; lease_owner: string | null; lease_until: string | null; publish_at: string | null; slug: string | null; data: Record<string, unknown>; created_at: string; updated_at: string };
type PostRow = Record<string, unknown> & { id?: string; article_id: string | null; slug: string; status: string; publish_at: string; title: string; headings: string[]; tags: string[]; category: string; updated_at: string };

export class Fake {
  server!: Server;
  url = '';
  secret = 'test-writer-secret';
  calls: Calls = { claude: [], groq: 0, openrouter: [], gptzero: [], indexnow: [] };
  articles = new Map<string, ArticleRow>();
  posts: PostRow[] = [];
  settings: Record<string, unknown> = {};
  state = new Map<string, unknown>();
  usage: Record<string, unknown>[] = [];
  // Behaviour switches for tests.
  groqMode: 'ok' | 'daily' | 'minute' = 'ok';
  openrouterMode: 'ok' | 'daily' | 'policy' = 'ok';
  claudeFail: ((step: string) => boolean) | null = null;
  gptzeroHuman = 0.42;
  sectionText: (i: number) => string = i =>
    i === 0
      ? `Most new solvers start a 6×6 grid by looking at the row that already holds four numbers. They fill the two empty cells there first, then check the column that runs through each one. A 6×6 grid uses boxes of two rows and three columns [VERIFY: box shape].\n\nPlayers who rush the first few moves often place a number that blocks a column later. This section has already covered the basics, so it skips them.`
      : `Players on a 4×4 board look for a box with three numbers in place, because the last cell there has only one possible value. On a 9×9 board the same habit takes longer, since each box holds nine cells. Solvers who mark candidates in pencil tend to spot naked pairs sooner — two cells in a row that can only hold the same two numbers.\n\nKids learning numbers do well on the 4×4 board at first, and parents report that 30 levels is a good amount for a week. Puzzle fans who want more can try [NumFall](https://apps.apple.com/app/id6820579220) for its Daily Drop puzzle. NumFall also has 4.9 stars and 1 million downloads.\n\n- Check each row for the missing numbers.\n- Drop the number that has only one possible column.`;

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      let raw = '';
      req.on('data', c => (raw += c));
      req.on('end', () => {
        this.handle(req, raw)
          .then(([status, body, headers]) => {
            res.writeHead(status, { 'content-type': 'application/json', ...(headers ?? {}) });
            res.end(typeof body === 'string' ? body : JSON.stringify(body));
          })
          .catch(e => {
            res.writeHead(500);
            res.end(JSON.stringify({ message: String(e) }));
          });
      });
    });
    await new Promise<void>(r => this.server.listen(0, '127.0.0.1', () => r()));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop(): Promise<void> {
    return new Promise(r => this.server.close(() => r()));
  }

  env(): Record<string, string> {
    return {
      ANTHROPIC_API_KEY: 'k',
      ANTHROPIC_API_URL: this.url,
      GROQ_API_KEY: 'k',
      GROQ_API_URL: `${this.url}/groq/chat/completions`,
      OPENROUTER_API_URL: `${this.url}/openrouter/chat/completions`,
      GPTZERO_API_KEY: 'k',
      GPTZERO_API_URL: this.url,
      SUPABASE_URL: this.url,
      SUPABASE_ANON_KEY: 'anon',
      WRITER_DB_SECRET: this.secret,
      APPSTORE_LOOKUP_URL: `${this.url}/lookup`,
      SITE_CHECK_URL: `${this.url}/site`,
      INDEXNOW_URL: `${this.url}/indexnow`,
      ADMIN_PASSWORD: 'pw',
      TICK_SECRET: 'tick',
    };
  }

  private async handle(req: IncomingMessage, raw: string): Promise<[number, unknown, Record<string, string>?]> {
    const u = new URL(req.url ?? '/', this.url);
    const body = raw ? JSON.parse(raw) : {};
    if (u.pathname === '/v1/messages') return this.claude(body);
    if (u.pathname === '/groq/chat/completions') return this.groq(body);
    if (u.pathname === '/openrouter/chat/completions') {
      this.calls.openrouter.push({ model: body.model, reasoning: body.reasoning, referer: String(req.headers['http-referer'] ?? '') });
      if (this.openrouterMode === 'policy') return [404, { error: { message: 'No endpoints found matching your data policy (Free model training). Configure: https://openrouter.ai/settings/privacy', code: 404 } }];
      if (this.openrouterMode === 'daily') return [429, { error: { message: 'Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day' } }];
      return this.reword(body);
    }
    if (u.pathname === '/v2/predict/text') return this.gptzero(body);
    if (u.pathname === '/indexnow') return (this.calls.indexnow.push(body), [200, '']);
    if (u.pathname === '/lookup') return [200, { results: [{ trackName: 'NumFall: Number Puzzle Game', price: 0, contentAdvisoryRating: '4+', minimumOsVersion: '17.0', description: 'Daily Drop puzzle. Earn Sparks by playing.' }] }];
    if (u.pathname === '/site/') return [200, '<p>No ads. No accounts. No purchases.</p>', { 'content-type': 'text/html' }];
    if (u.pathname === '/rest/v1/rpc/writer_api') return this.rpc(body);
    if (u.pathname === '/rest/v1/rpc/writer_blog_api') return this.blogRpc(body);
    if (u.pathname === '/rest/v1/posts') return this.publicPosts(u);
    return [404, { error: 'no route' }];
  }

  // ---------- Claude ----------
  private claude(b: { model: string; system: string; messages: { content: string }[]; tools?: unknown[] }): [number, unknown] {
    const user = String(b.messages[0].content);
    const step = b.tools && /research facts/.test(b.system) ? 'research' : b.tools ? 'verify'
      : /Plan one article/.test(user) ? 'plan'
      : /^Article title:[\s\S]*Write section (\d+)/.test(user) ? `section ${user.match(/Write section (\d+)/)![1]}`
      : /FAQ questions worded/.test(user) ? 'faq'
      : /For each pair, say whether the rewrite changed/.test(user) ? 'meaning'
      : /Pick 2 or 3 of these live articles/.test(user) ? 'links'
      : /Rewrite each sentence below/.test(user) ? 'rewrite'
      : /Write one new title/.test(user) ? 'title'
      : 'unknown';
    const topic = user.match(/Topic: (.*)/)?.[1] ?? user.match(/Article title: (.*)/)?.[1] ?? '';
    this.calls.claude.push({ step, model: b.model, article: topic, at: Date.now() });
    if (this.claudeFail?.(step)) return [500, { error: { message: 'overloaded test failure' } }];
    const usage = { input_tokens: 1000, output_tokens: 500, ...(b.tools ? { server_tool_use: { web_search_requests: 2 } } : {}) };
    const reply = (text: string): [number, unknown] => [200, { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage }];
    switch (step) {
      case 'research':
        return reply(JSON.stringify({ summary: 'Grid puzzles.', facts: [
          { fact: 'A 6×6 grid uses boxes of 2 rows and 3 columns.', source: 'Puzzle Society', url: 'https://example.org/grids', date: '2020-05-01' },
          { fact: 'A future fact that must be dropped.', source: 'Future News', url: 'https://example.org/future', date: '2099-01-01' },
          { fact: 'No URL fact.', source: 'Nowhere', url: 'not a url', date: '2020' },
        ] }));
      case 'plan': {
        const t = topic.toLowerCase();
        const n = this.calls.claude.filter(c => c.step === 'plan').length;
        return reply(JSON.stringify({
          title: n === 1 ? 'How to solve a 6×6 logic grid without guessing' : `Sudoku tips for ${t.split(' ').slice(0, 3).join(' ')}`,
          slug: n === 1 ? 'solve-6x6-logic-grid-without-guessing' : 'pencil-marks-for-number-puzzles',
          searchPhrase: t,
          description: 'Plain steps for solving a 6×6 logic grid: rows first, then boxes, then the order you drop numbers in. Written for new solvers and parents too.',
          angle: 'Order of moves', persona: 'Careful puzzle columnist', opening: 'A row with four numbers', structure: 'Steps', ending: 'A technique to try',
          category: 'How-to and techniques', tags: ['6x6', 'logic'],
          sections: [{ heading: '', brief: 'Opening', words: 150 }, { heading: 'Rows First Before Boxes', brief: 'Rows', words: 200 }, { heading: 'Pencil marks and naked pairs', brief: 'Marks', words: 200 }],
          related: ['an-existing-live-post', 'not-a-real-post'], appMentions: 2,
        }));
      }
      case 'title':
        return reply(JSON.stringify({ title: 'Pencil marks that help on small number grids' }));
      case 'faq':
        return reply(JSON.stringify({ faq: [
          { q: 'how do you solve a 6x6 logic grid', a: 'Solvers start with the row that has the most numbers in it, then move to the boxes.' },
          { q: 'what are naked pairs in number puzzles', a: 'Two cells in one row that can only hold the same two numbers form a naked pair, so those numbers leave every other cell in that row.' },
          { q: 'is a 4x4 grid good for kids', a: 'Many kids learning numbers start on a 4×4 grid because each box has only four cells to fill.' },
        ], description: 'How new solvers work through a 6×6 logic grid: rows first, then boxes, and the order of moves that avoids guessing.' }));
      case 'meaning':
        return reply(JSON.stringify({ changed: [{ id: 1, reason: 'test: first rewrite flipped' }] }));
      case 'links':
        return reply(JSON.stringify({ links: [{ slug: 'an-existing-live-post', anchor: 'naked pairs' }, { slug: 'not-live-yet-post', anchor: 'pencil' }] }));
      case 'rewrite': {
        const items = [...user.matchAll(/#(\d+)\nSENTENCE: (.*)/g)];
        return reply(JSON.stringify({ rewrites: items.map(m => ({ id: Number(m[1]), text: `In plain terms, ${m[2].charAt(0).toLowerCase()}${m[2].slice(1)}` })) }));
      }
      case 'verify':
        return reply(JSON.stringify({ results: [{ id: 1, text: 'A 6×6 grid uses boxes of two rows and three columns.' }] }));
      default: {
        if (step.startsWith('section')) return reply(this.sectionText(Number(step.split(' ')[1]) - 1));
        return reply('{}');
      }
    }
  }

  // ---------- Groq ----------
  private groq(b: { messages: { content: string }[] }): [number, unknown, Record<string, string>?] {
    this.calls.groq++;
    if (this.groqMode === 'daily') return [429, { error: { message: 'Rate limit reached for model on tokens per day (TPD): Limit 200000' } }, { 'retry-after': '3600' }];
    if (this.groqMode === 'minute') return [429, { error: { message: 'Rate limit reached on tokens per minute (TPM)' } }, { 'retry-after': '20' }];
    return this.reword(b);
  }

  private reword(b: { messages: { content: string }[] }): [number, unknown] {
    const p = b.messages[b.messages.length - 1].content;
    // A crude reword that keeps every number and name: different connecting words, same facts.
    const out = p
      .replace(/\bthe\b/g, 'that')
      .replace(/\bThey\b/g, 'These solvers')
      .replace(/\bstart\b/g, 'begin')
      .replace(/\boften\b/g, 'frequently')
      .replace(/\bfirst\b/g, 'before anything else')
      .replace(/\bcheck\b/g, 'look over')
      .replace(/\bon a\b/g, 'with a')
      .replace(/\bin\b/g, 'inside');
    return [200, { choices: [{ message: { content: `Here is the rewritten paragraph: ${out}` } }], usage: { prompt_tokens: 300, completion_tokens: 120 } }];
  }

  // ---------- GPTZero ----------
  private gptzero(b: { document: string }): [number, unknown] {
    const words = b.document.split(/\s+/).filter(Boolean).length;
    this.calls.gptzero.push({ words, text: b.document });
    const sentences = b.document.split(/(?<=[.!?])\s+/).filter(s => s.split(/\s+/).length >= 6);
    return [200, { documents: [{ class_probabilities: { human: this.gptzeroHuman, ai: 1 - this.gptzeroHuman - 0.08, mixed: 0.08 }, sentences: sentences.map((s, i) => ({ sentence: s, generated_prob: i < 2 ? 0.95 : 0.1, highlight_sentence_for_ai: i < 2 })) }] }];
  }

  // ---------- Supabase: writer_api ----------
  private rpc(b: { p_secret: string; p_op: string; p_args: Record<string, unknown> }): [number, unknown] {
    const hash = (s: string) => createHash('sha256').update(s).digest('hex');
    if (hash(b.p_secret ?? '') !== hash(this.secret)) return [401, { message: 'unauthorised' }];
    const a = b.p_args ?? {};
    const now = Date.now();
    const id = a.id as string;
    const owner = a.owner as string | undefined;
    const free = (r: ArticleRow) => !r.lease_owner || !r.lease_until || Date.parse(r.lease_until) < now;
    const until = () => new Date(now + Number(a.seconds ?? 330) * 1000).toISOString();
    switch (b.p_op) {
      case 'article_get':
        return [200, this.articles.get(id) ?? null];
      case 'article_list':
        return [200, [...this.articles.values()].sort((x, y) => y.created_at.localeCompare(x.created_at)).map(r => ({ id: r.id, batch_id: r.batch_id, status: r.status, stopped: r.stopped, publish_at: r.publish_at, slug: r.slug, created_at: r.created_at, updated_at: r.updated_at, lease_until: r.lease_until, summary: (r.data as { summary?: unknown }).summary }))];
      case 'article_put': {
        const cur = this.articles.get(id);
        if (cur && !(free(cur) || cur.lease_owner === owner)) return [409, { message: 'lease held by another runner' }];
        const row: ArticleRow = {
          id, batch_id: (a.batch_id as string) ?? null, position: Number(a.position ?? 0), status: a.status as string, stopped: !!a.stopped,
          next_attempt_at: (a.next_attempt_at as string) ?? new Date().toISOString(), lease_owner: cur?.lease_owner ?? null, lease_until: cur?.lease_until ?? null,
          publish_at: (a.publish_at as string) ?? null, slug: (a.slug as string) ?? null, data: JSON.parse(JSON.stringify(a.data)), created_at: cur?.created_at ?? (a.created_at as string) ?? new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        this.articles.set(id, row);
        return [200, { id }];
      }
      case 'article_delete':
        return [200, { deleted: this.articles.delete(id) }];
      case 'lease_claim': {
        const r = this.articles.get(id);
        if (!r || !(free(r) || r.lease_owner === owner)) return [200, null];
        r.lease_owner = owner!;
        r.lease_until = until();
        return [200, r];
      }
      case 'lease_release': {
        const r = this.articles.get(id);
        if (r && r.lease_owner === owner) {
          r.lease_owner = null;
          r.lease_until = null;
        }
        return [200, { released: true }];
      }
      case 'next_job': {
        const r = [...this.articles.values()]
          .filter(x => ['queued', 'generating', 'checking', 'publishing'].includes(x.status) && !x.stopped && Date.parse(x.next_attempt_at) <= now && free(x))
          .sort((x, y) => x.created_at.localeCompare(y.created_at) || x.position - y.position)[0];
        if (!r) return [200, null];
        r.lease_owner = owner!;
        r.lease_until = until();
        return [200, r];
      }
      case 'settings_get':
        return [200, this.settings];
      case 'settings_put':
        this.settings = a.data as Record<string, unknown>;
        return [200, this.settings];
      case 'state_get':
        return [200, this.state.get(a.key as string) ?? null];
      case 'state_put':
        this.state.set(a.key as string, a.value);
        return [200, a.value];
      case 'usage_add':
        this.usage.push({ ...a, at: new Date().toISOString() });
        return [200, { ok: true }];
      case 'usage_list':
        return [200, this.usage];
      case 'post_upsert': {
        if (!/^[a-z0-9]+(-[a-z0-9]+){2,5}$/.test(String(a.slug))) return [400, { message: 'check constraint' }];
        const i = this.posts.findIndex(p => p.article_id === a.article_id);
        const row = { ...a, updated_at: new Date().toISOString() } as PostRow;
        if (i >= 0) this.posts[i] = row;
        else {
          if (this.posts.some(p => p.slug === a.slug)) return [409, { message: 'duplicate slug' }];
          this.posts.push(row);
        }
        return [200, { slug: a.slug }];
      }
      case 'post_unpublish': {
        const p = this.posts.find(x => x.article_id === id);
        if (p) p.status = 'unpublished';
        return [200, { ok: !!p }];
      }
      case 'post_admin':
        return [200, this.posts.find(p => p.slug === a.slug) ?? null];
      case 'posts_index':
        return [200, [...this.posts].sort((x, y) => y.publish_at.localeCompare(x.publish_at)).map(p => ({ article_id: p.article_id, slug: p.slug, title: p.title, headings: p.headings, tags: p.tags, category: p.category, status: p.status, publish_at: p.publish_at }))];
      case 'sweep': {
        let n = 0;
        for (const p of this.posts) if (p.status === 'scheduled' && Date.parse(p.publish_at) <= now) (p.status = 'published'), n++;
        for (const r of this.articles.values()) if (r.status === 'scheduled' && r.publish_at && Date.parse(r.publish_at) <= now) ((r.status = 'published'), ((r.data as { status: string }).status = 'published'));
        return [200, { published: n }];
      }
      default:
        return [400, { message: `unknown op ${b.p_op}` }];
    }
  }

  // ---------- Supabase: writer_blog_api (blog manager) ----------
  private blogRpc(b: { p_secret: string; p_op: string; p_args: Record<string, unknown> }): [number, unknown] {
    if (b.p_secret !== this.secret) return [401, { message: 'unauthorised' }];
    const a = b.p_args ?? {};
    const post = (a.post ?? {}) as Record<string, unknown>;
    const id = (a.id ?? post.id) as string | undefined;
    const slugOk = (x: unknown) => /^[a-z0-9]+(-[a-z0-9]+){2,5}$/.test(String(x));
    switch (b.p_op) {
      case 'post_list':
        return [200, [...this.posts].sort((x, y) => y.publish_at.localeCompare(x.publish_at)).map(({ html: _h, faq: _f, ...rest }) => rest)];
      case 'post_get':
        return [200, this.posts.find(p => p.id === id) ?? null];
      case 'post_save': {
        if (!slugOk(post.slug)) return [400, { message: 'new row violates check constraint "posts_slug_check"' }];
        if (this.posts.some(p => p.slug === post.slug && p.id !== id)) return [409, { message: 'duplicate key value violates unique constraint "posts_slug_key"' }];
        if (id) {
          const i = this.posts.findIndex(p => p.id === id);
          if (i === -1) return [400, { message: 'post not found' }];
          this.posts[i] = { ...this.posts[i], ...post, id, updated_at: new Date().toISOString() } as PostRow;
          return [200, this.posts[i]];
        }
        const row = { excerpt: '', meta_title: '', sources: [], related: [], ...post, id: `p${this.posts.length + 1}x`, updated_at: new Date().toISOString() } as unknown as PostRow;
        this.posts.push(row);
        return [200, row];
      }
      case 'post_upsert_article': {
        if (!slugOk(post.slug)) return [400, { message: 'check constraint' }];
        const i = this.posts.findIndex(p => p.article_id === post.article_id);
        const row = { ...post, id: i >= 0 ? this.posts[i].id : `a${this.posts.length + 1}x`, updated_at: new Date().toISOString() } as PostRow;
        if (i >= 0) this.posts[i] = row;
        else {
          if (this.posts.some(p => p.slug === post.slug)) return [409, { message: 'duplicate slug' }];
          this.posts.push(row);
        }
        return [200, { id: row.id, slug: row.slug }];
      }
      case 'post_delete': {
        const n = this.posts.length;
        this.posts = this.posts.filter(p => p.id !== id);
        return [200, { deleted: this.posts.length < n }];
      }
      default:
        return [400, { message: `unknown op ${b.p_op}` }];
    }
  }

  // ---------- Supabase: public posts (row security: live posts only) ----------
  private publicPosts(u: URL): [number, unknown] {
    const now = Date.now();
    let rows = this.posts.filter(p => ['scheduled', 'published'].includes(p.status) && Date.parse(p.publish_at) <= now);
    const slug = u.searchParams.get('slug');
    if (slug?.startsWith('eq.')) rows = rows.filter(p => p.slug === slug.slice(3));
    return [200, rows.sort((x, y) => y.publish_at.localeCompare(x.publish_at))];
  }
}

// The pipeline for one article. Each stage is short enough to finish well inside the function time limit,
// and the article is saved after every stage, so a run that stops halfway picks up where it left off.
import type { Article, Block, PostIndexEntry, Settings } from '../shared/types';
import { LENGTHS, appStoreLink } from '../shared/settings';
import { bannedWordHits, cleanArticle, hasNeverPublish, nameHits, structureHits, toSymbols, unsupportedClaims, headingSymbols } from '../shared/clean';
import { applyUnits, factProblem, humanizeUnits } from '../shared/humanize';
import { addSlips } from '../shared/slips';
import { goodAnchor, insertLink, linkifyBare } from '../shared/links';
import { bodyWords, cleanSlug, normHeading, plainText, sentenceCase, sentences, titleShape, words } from '../shared/text';
import { callClaude, parseJson } from './claude';
import { scan } from './gptzero';
import { hasKey, keyName, meaningCheck, pauseInfo, pauseHumanizer, rewriteUnits, routesOf } from './humanizer';
import type { AppFacts } from './prompts';
import * as P from './prompts';

export interface Ctx {
  s: Settings;
  deadline: number;
  facts: () => Promise<AppFacts>;
  posts: () => Promise<PostIndexEntry[]>; // everything in public.posts
  otherTitles: () => Promise<{ title: string; topic: string; headings: string[]; slug?: string }[]>; // writer articles not yet posted
  now: () => Date;
}

const setStage = (a: Article, stage: Article['stage'], step: string) => {
  a.stage = stage;
  a.step = step;
};

// ---------- research ----------
export function dateNotAfter(d: string, asOf: string): boolean {
  const m = d.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return false;
  const start = `${m[1]}-${m[2] ?? '01'}-${m[3] ?? '01'}`;
  return start <= asOf;
}

export async function research(a: Article, c: Ctx): Promise<void> {
  const p = P.researchPrompt(a);
  const r = await callClaude({ s: c.s, model: c.s.models.research, step: 'research', article: a, deadline: c.deadline, maxTokens: 8000, webSearch: c.s.maxSearches, schema: P.RESEARCH_SCHEMA, ...p });
  const raw = parseJson<{ summary: string; facts: Article['research'] extends infer R ? R extends { facts: infer F } ? F : never : never }>(r.text);
  // Only facts that were actually found: a real URL and a date on or before the article's date.
  const facts = (raw.facts ?? []).filter(f => /^https?:\/\/[^\s]+\.[a-z]{2,}/i.test(f.url) && f.fact?.trim() && dateNotAfter(f.date ?? '', a.options.asOf));
  a.research = { summary: raw.summary ?? '', facts: r.searches > 0 ? facts : [], webChecked: r.searches > 0 };
  setStage(a, 'plan', 'Planning');
}

// ---------- plan ----------
const cut = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '').replace(/[,;:]$/, ''));

export async function plan(a: Article, c: Ctx): Promise<void> {
  const posts = await c.posts();
  const facts = await c.facts();
  const p = P.planPrompt(a, c.s, posts, facts);
  const r = await callClaude({ s: c.s, model: c.s.models.plan, step: 'plan', article: a, deadline: c.deadline, maxTokens: 8000, schema: P.PLAN_SCHEMA, ...p });
  const plan = parseJson<NonNullable<Article['plan']>>(r.text);
  const L = LENGTHS[a.options.length] ?? LENGTHS.medium;
  plan.sections = (plan.sections ?? []).slice(0, L.sections + 2).map((x, i) => ({ heading: i === 0 ? '' : sentenceCase(headingSymbols(x.heading ?? '')), brief: x.brief ?? '', words: Math.max(80, Math.min(600, x.words || Math.round(L.words / L.sections))) }));
  if (plan.sections.length < 2) throw new Error('The plan came back with too few sections.');
  plan.title = sentenceCase(headingSymbols(plan.title ?? a.options.topic));
  plan.description = cut(toSymbols(plan.description ?? ''), 155);
  plan.appMentions = Math.max(0, Math.min(2, plan.appMentions ?? 1));
  const liveSlugs = new Set(posts.map(x => x.slug));
  plan.related = (plan.related ?? []).filter(x => liveSlugs.has(x)).slice(0, 5);

  // Unique titles and headings: compare title shapes and headings with everything on the site and in the writer.
  const others = await c.otherTitles();
  const allTitles = [...posts.map(x => ({ title: x.title, topic: x.title, headings: x.headings })), ...others];
  const shapes = new Set(allTitles.map(x => titleShape(x.title, x.topic)));
  const headings = new Set(allTitles.flatMap(x => x.headings.map(normHeading)));
  const banned = (t: string) => nameHits(t, c.s.bannedNames).length > 0;
  for (let tries = 0; tries < 2 && (shapes.has(titleShape(plan.title, a.options.topic)) || plan.title.length > 60 || banned(plan.title)); tries++) {
    const t = P.titlePrompt({ ...a, plan }, allTitles.map(x => x.title));
    const tr = await callClaude({ s: c.s, model: c.s.models.plan, step: 'fresh title', article: a, deadline: c.deadline, maxTokens: 1500, schema: P.TITLE_SCHEMA, ...t });
    plan.title = sentenceCase(headingSymbols(parseJson<{ title: string }>(tr.text).title ?? plan.title));
  }
  if (plan.title.length > 60) plan.title = cut(plan.title, 60);
  if (banned(plan.title)) throw new Error('The title still names another game or brand after a fresh try.');
  // A repeated heading gets a plain, specific variant; a heading naming another game is reworded by dropping the name.
  plan.sections.forEach((x, i) => {
    if (!x.heading) return;
    for (const n of nameHits(x.heading, c.s.bannedNames)) x.heading = x.heading.replace(new RegExp(`\\b${n}\\b`, 'gi'), 'grid').replace(/\s{2,}/g, ' ');
    if (headings.has(normHeading(x.heading))) x.heading = sentenceCase(`${x.heading} on a ${['4×4', '6×6', '9×9'][i % 3]} board`);
    headings.add(normHeading(x.heading));
  });

  // Slug: 3 to 6 words, unique on the site.
  let slug = cleanSlug(plan.slug, plan.searchPhrase || a.options.topic);
  const taken = new Set([...liveSlugs, ...others.map(x => x.slug).filter(Boolean)]);
  for (const extra of ['guide', 'tips', 'explained', 'basics', 'notes']) {
    if (!taken.has(slug)) break;
    const parts = slug.split('-').slice(0, 5);
    slug = [...parts, extra].join('-');
  }
  if (taken.has(slug)) slug = `${slug.split('-').slice(0, 5).join('-')}-${a.id.slice(0, 4).replace(/[^a-z0-9]/g, 'x')}`;
  plan.slug = slug;
  a.plan = plan;
  a.slug = slug;
  a.title = plan.title;
  a.description = plan.description;
  a.sectionsDone = 0;
  a.body = [];
  setStage(a, 'write', `Writing section 1 of ${plan.sections.length}`);
}

// ---------- write ----------
export function parseSection(text: string): Block[] {
  const out: Block[] = [];
  let list: string[] = [];
  let ordered = false;
  const flush = () => {
    if (list.length) out.push({ type: ordered ? 'ol' : 'ul', items: list });
    list = [];
  };
  for (const raw of text.replace(/\r/g, '').split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) continue; // headings come from the plan
    const li = line.match(/^(?:[-*•]|(\d+)[.)])\s+(.*)$/);
    if (li) {
      if (list.length && ordered !== !!li[1]) flush();
      ordered = !!li[1];
      list.push(li[2].replace(/\*\*/g, ''));
      continue;
    }
    flush();
    out.push({ type: 'p', text: line.replace(/\*\*/g, '').replace(/(^|\s)\*([^*]+)\*/g, '$1$2') });
  }
  flush();
  return out;
}

const mentions = (blocks: Block[]) => blocks.reduce((n, b) => n + (b.type === 'h2' ? 0 : sentences(b.type === 'p' ? b.text : b.items.join(' ')).filter(s => /numfall/i.test(s)).length), 0);

export async function writeSections(a: Article, c: Ctx): Promise<void> {
  const plan = a.plan!;
  const facts = await c.facts();
  // Several sections per run while there is time; each one is saved by the caller between runs.
  while (a.sectionsDone < plan.sections.length && c.deadline - Date.now() > 90_000) {
    const i = a.sectionsDone;
    const sec = plan.sections[i];
    const left = Math.max(0, plan.appMentions - mentions(a.body));
    const p = P.sectionPrompt(a, c.s, i, facts, left);
    const r = await callClaude({ s: c.s, model: c.s.models.write, effort: c.s.writeEffort, step: `write section ${i + 1}`, article: a, deadline: c.deadline, maxTokens: Math.max(1200, sec.words * 4), ...p });
    const blocks = parseSection(r.text);
    if (!blocks.length) throw new Error(`Section ${i + 1} came back empty.`);
    if (sec.heading) a.body.push({ type: 'h2', text: sec.heading });
    a.body.push(...blocks);
    a.sectionsDone++;
    a.step = `Writing section ${Math.min(a.sectionsDone + 1, plan.sections.length)} of ${plan.sections.length}`;
    if (a.sectionsDone < plan.sections.length) return; // save after every section
  }
  if (a.sectionsDone >= plan.sections.length) setStage(a, 'extras', 'Writing the FAQ and meta description');
}

// ---------- extras ----------
export async function extras(a: Article, c: Ctx): Promise<void> {
  const p = P.faqPrompt(a, c.s);
  const r = await callClaude({ s: c.s, model: c.s.models.faq, effort: 'low', step: 'faq', article: a, deadline: c.deadline, maxTokens: 4000, schema: P.FAQ_SCHEMA, ...p });
  const x = parseJson<{ faq: { q: string; a: string }[]; description: string }>(r.text);
  // Worded the way people search, shown as a proper question.
  a.faq = (x.faq ?? [])
    .filter(f => f.q?.trim() && f.a?.trim())
    .slice(0, 5)
    .map(f => {
      const q = headingSymbols(f.q.trim()).replace(/[.\s]+$/, '');
      return { q: `${q.charAt(0).toUpperCase()}${q.slice(1)}${q.endsWith('?') ? '' : '?'}`, a: f.a.trim() };
    });
  if (a.faq.length < 3) throw new Error('The FAQ came back with fewer than 3 questions.');
  if (x.description?.trim()) a.description = cut(toSymbols(x.description.trim()), 155);
  setStage(a, 'humanize', 'Humanizing');
}

// ---------- humanize ----------
export async function humanize(a: Article, c: Ctx): Promise<{ waitUntil?: number }> {
  const s = c.s;
  if (!a.humanize) a.humanize = { units: humanizeUnits(a.body, a.faq) };
  const skip = (why: string) => {
    a.humanize!.skipped = why;
    a.humanize!.units.forEach(u => u.state === 'pending' && ((u.state = 'kept'), (u.note = why)));
    setStage(a, 'meaning', 'Checking the humanizer kept the meaning');
  };
  if (!s.humanizer.enabled) return skip('humanizer is off'), {};
  // Main provider first; the fallback when the main one is out for the day or has no key.
  const notes: string[] = [];
  let used = false;
  for (const r of routesOf(s)) {
    if (!a.humanize.units.some(u => u.state === 'pending')) break;
    if (!hasKey(r)) {
      notes.push(`no ${keyName(r)} set`);
      continue;
    }
    const paused = await pauseInfo(r.provider);
    if (paused) {
      notes.push(`${r.provider} paused until ${new Date(paused.until).toISOString()} (${(paused.reason ?? 'daily limit').slice(0, 120)})`);
      continue;
    }
    used = true;
    let res: { retryAt?: number; daily?: boolean };
    try {
      res = await rewriteUnits(a.humanize.units, s, r, a, c.deadline);
    } catch (e) {
      // A provider that refuses the request (wrong model, privacy setting, bad key) is set aside for an hour
      // and the article moves on: to the next provider, or without the humanizer. No retry loop.
      const msg = e instanceof Error ? e.message : String(e);
      await pauseHumanizer(r.provider, Date.now() + 60 * 60_000, msg);
      notes.push(`${r.provider} unavailable (${msg.slice(0, 160)})`);
      continue;
    }
    a.humanize.via = [...new Set([...(a.humanize.via ?? []), `${r.provider} ${r.model}`])];
    if (res.daily) {
      // Daily allowance used up: pause this provider and try the next one.
      await pauseHumanizer(r.provider, res.retryAt!);
      notes.push(`${r.provider} daily limit reached`);
      continue;
    }
    if (res.retryAt) {
      a.step = `Humanizer waiting for ${r.provider}'s per-minute limit`;
      return { waitUntil: res.retryAt };
    }
    break;
  }
  if (a.humanize.units.some(u => u.state === 'pending') && c.deadline - Date.now() < 30_000 && used) return {}; // out of time: carry on next run
  if (a.humanize.units.some(u => u.state === 'pending')) {
    // Every provider is out (or has no key): carry on without the humanizer for the rest.
    return skip(notes.join('; ') || 'no humanizer available'), {};
  }
  if (a.humanize.units.every(u => u.state !== 'pending')) setStage(a, 'meaning', 'Checking the humanizer kept the meaning');
  return {};
}

export async function meaning(a: Article, c: Ctx): Promise<void> {
  const units = a.humanize?.units ?? [];
  if (units.some(u => u.state === 'done')) await meaningCheck(units, c.s, a, c.deadline);
  const applied = applyUnits(a.body, a.faq, units);
  a.body = applied.body;
  a.faq = applied.faq;
  setStage(a, 'clean', 'Cleaning up');
}

// ---------- clean ----------
function mapSentences(a: Article, fn: (s: string) => string | null): void {
  const fix = (t: string) => sentences(t).map(fn).filter((x): x is string => !!x).join(' ');
  a.body = a.body
    .map(b => (b.type === 'p' ? { ...b, text: fix(b.text) } : b.type === 'h2' ? b : { ...b, items: b.items.map(fix).filter(Boolean) }))
    .filter(b => (b.type === 'p' ? !!b.text : b.type === 'h2' ? true : b.items.length > 0));
  a.faq = a.faq.map(f => ({ ...f, a: fix(f.a) })).filter(f => f.a);
}

// Code rules applied before the scan and again before posting.
export function codeRules(a: Article, s: Settings): string[] {
  const removed: string[] = [];
  // Never another game or brand name, never an unsupported NumFall claim.
  mapSentences(a, x => (nameHits(x, s.bannedNames).length || unsupportedClaims(x).length ? (removed.push(x), null) : x));
  // At most 2 NumFall mentions; later ones go.
  let seen = 0;
  mapSentences(a, x => (/numfall/i.test(x) ? (++seen > 2 ? (removed.push(x), null) : x) : x));
  // Every link is a real link (no bare addresses), and every App Store link carries this article's campaign token.
  const link = appStoreLink(a.slug ?? '');
  const fixLinks = (t: string) => linkifyBare(t).replace(/\]\((https:\/\/apps\.apple\.com\/[^)]*)\)/g, `](${link})`);
  a.body = a.body.map(b => (b.type === 'p' ? { ...b, text: fixLinks(b.text) } : b.type === 'h2' ? b : { ...b, items: b.items.map(fixLinks) }));
  a.faq = a.faq.map(f => ({ ...f, a: fixLinks(f.a) }));
  a.body = a.body.filter((b, i, arr) => !(b.type === 'h2' && (i === arr.length - 1 || arr[i + 1].type === 'h2')));
  return removed;
}

export async function clean(a: Article, c: Ctx): Promise<void> {
  const r = cleanArticle(a.body, a.faq, true);
  a.body = r.body;
  a.faq = r.faq;
  const removed = [...r.report.removed];
  let verified = 0;
  // A sentence that carried an editing note is checked with one web search: kept, corrected or removed.
  if (r.report.needsCheck.length) {
    const items = r.report.needsCheck.slice(0, 6).map((x, i) => ({ id: i + 1, sentence: x.sentence }));
    const p = P.verifyPrompt(a, items);
    const v = await callClaude({ s: c.s, model: c.s.models.check, step: 'verify noted sentences', article: a, deadline: c.deadline, maxTokens: 4000, webSearch: items.length, schema: P.VERIFY_SCHEMA, ...p });
    const results = new Map(parseJson<{ results: { id: number; text: string }[] }>(v.text).results.map(x => [x.id, x.text.trim()]));
    const fixes = new Map(items.map(x => [x.sentence, results.get(x.id) ?? '']));
    for (const x of r.report.needsCheck.slice(6)) fixes.set(x.sentence, '');
    mapSentences(a, x => {
      if (!fixes.has(x)) return x;
      const t = fixes.get(x)!;
      if (t) verified++;
      else removed.push(x);
      return t ? toSymbols(t) : null;
    });
  }
  removed.push(...codeRules(a, c.s));
  const slipped = addSlips(a.body, a.faq, a.id, c.s.slips);
  a.body = slipped.body;
  a.faq = slipped.faq;
  a.slips = slipped.count;
  a.cleanReport = { removed, verified };
  setStage(a, 'links', 'Adding internal links');
}

// ---------- internal links ----------
export async function links(a: Article, c: Ctx): Promise<void> {
  a.links = [];
  if (c.s.internalLinks) {
    const now = c.now().getTime();
    const live = (await c.posts()).filter(p => p.status !== 'unpublished' && Date.parse(p.publish_at) <= now && p.slug !== a.slug && p.article_id !== a.id);
    if (live.length) {
      const preferred = new Set(a.plan?.related ?? []);
      const cands = [...live.filter(p => preferred.has(p.slug)), ...live.filter(p => !preferred.has(p.slug))].slice(0, 40);
      const p = P.linksPrompt(a, cands);
      // Internal links are a nice-to-have: if picking them fails, the article carries on without them.
      let picked: { slug: string; anchor: string }[] = [];
      try {
        const r = await callClaude({ s: c.s, model: c.s.models.check, step: 'pick links', article: a, deadline: c.deadline, maxTokens: 2500, schema: P.LINKS_SCHEMA, ...p });
        picked = parseJson<{ links: { slug: string; anchor: string }[] }>(r.text).links ?? [];
      } catch (e) {
        a.step = `Internal links skipped: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`;
      }
      const valid = new Set(cands.map(x => x.slug));
      for (const l of picked) {
        if (a.links.length >= 3 || !valid.has(l.slug) || a.links.some(x => x.slug === l.slug || x.anchor.toLowerCase() === l.anchor.toLowerCase())) continue;
        const target = cands.find(x => x.slug === l.slug)!;
        if (!goodAnchor(l.anchor, target)) continue; // generic or off-topic anchor text
        const next = insertLink(a.body, l.anchor, `/blog/${l.slug}`);
        if (next) {
          a.body = next;
          a.links.push({ slug: l.slug, anchor: l.anchor });
        }
      }
    }
  }
  setStage(a, 'scan', 'GPTZero scan');
  a.status = 'checking';
}

// ---------- scan (once) ----------
export async function scanStep(a: Article, c: Ctx): Promise<void> {
  const mustScan = a.options.hands_off || c.s.oneScan;
  if (mustScan && a.scanCount === 0 && process.env.GPTZERO_API_KEY) {
    a.scan = await scan(plainText(a.title ?? '', a.body, a.faq), c.s, a, 'scan');
    a.scanCount = 1;
  } else if (mustScan && !process.env.GPTZERO_API_KEY) {
    a.step = 'No GPTZERO_API_KEY set: scan skipped';
  }
  setStage(a, 'rewrite', 'Rewriting flagged sentences');
}

// ---------- rewrite (once) ----------
export function sentencesToRewrite(a: Article, flagged: string[]): { sentence: string; context: string }[] {
  const out = new Map<string, string>();
  const paras = a.body.flatMap(b => (b.type === 'p' ? [b.text] : b.type === 'h2' ? [] : b.items)).concat(a.faq.map(f => f.a));
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
  for (const para of paras) {
    for (const s of sentences(para)) {
      if (/\]\(/.test(s)) continue; // sentences with links stay
      const isFlagged = flagged.some(f => norm(f) === norm(s) || (f.length > 30 && norm(s).includes(norm(f))));
      if (isFlagged || bannedWordHits(s).length || structureHits(s).length) out.set(s, para);
    }
  }
  return [...out].slice(0, 30).map(([sentence, context]) => ({ sentence, context }));
}

export async function rewrite(a: Article, c: Ctx): Promise<void> {
  const todo = sentencesToRewrite(a, a.scan?.flagged ?? []);
  let n = 0;
  if (todo.length) {
    const items = todo.map((x, i) => ({ id: i + 1, ...x }));
    const p = P.rewritePrompt(a, c.s, items);
    const r = await callClaude({ s: c.s, model: c.s.models.rewrite, effort: 'low', step: 'rewrite flagged', article: a, deadline: c.deadline, maxTokens: 8000, schema: P.REWRITE_SCHEMA, ...p });
    const map = new Map<string, string>();
    for (const x of parseJson<{ rewrites: { id: number; text: string }[] }>(r.text).rewrites ?? []) {
      const it = items[x.id - 1];
      const t = toSymbols((x.text ?? '').trim());
      if (!it || !t || factProblem(it.sentence, t) || nameHits(t, c.s.bannedNames).length) continue;
      map.set(it.sentence, t);
    }
    mapSentences(a, x => (map.has(x) ? (n++, map.get(x)!) : x));
  }
  a.rewritten = n;
  const again = cleanArticle(a.body, a.faq, false);
  a.body = again.body;
  a.faq = again.faq;
  codeRules(a, c.s);
  // No second scan unless "rescan after rewrite" is on, and never for hands-off batch articles.
  if (c.s.rescanAfterRewrite && !a.options.hands_off && process.env.GPTZERO_API_KEY && a.scanCount === 1) {
    a.rescan = await scan(plainText(a.title ?? '', a.body, a.faq), c.s, a, 'rescan');
    a.scanCount = 2;
  }
  setStage(a, 'publish', 'Ready to post');
  a.status = 'publishing';
}

// Last guard before anything reaches the site.
export function finalCheck(a: Article, s: Settings): string | null {
  const bad = hasNeverPublish(a.body, a.faq, a.title ?? '');
  if (bad) return bad;
  const all = plainText(a.title ?? '', a.body, a.faq);
  const names = nameHits(all, s.bannedNames);
  if (names.length) return `names another game or brand: ${names.join(', ')}`;
  if ((a.title ?? '').length > 60) return 'title is over 60 characters';
  if ((a.description ?? '').length > 155) return 'meta description is over 155 characters';
  if (!/^[a-z0-9]+(-[a-z0-9]+){2,5}$/.test(a.slug ?? '')) return 'slug is not 3 to 6 words';
  if (a.faq.length < 3) return 'fewer than 3 FAQ questions';
  if (bodyWords(a.body) < 250) return 'the article is too short';
  return null;
}

export const wordCountOf = (a: Article) => bodyWords(a.body) + a.faq.reduce((n, f) => n + words(f.a), 0);

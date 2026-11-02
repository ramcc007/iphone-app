// Runs articles step by step under a lease, so two tabs or a tab and the background job never pay for the
// same step. Errors count up; after maxFailures in a row the article stops until you press Retry.
import { randomUUID } from 'node:crypto';
import type { Article, ArticleOptions, PostIndexEntry, Settings } from '../shared/types';
import { blocksToHtml } from '../shared/render';
import { readingMinutes } from '../shared/text';
import { backdateSlots, localDate, scheduleSlots } from '../shared/schedule';
import { appFacts } from './appfacts';
import { db, LeaseLost } from './db';
import { HttpError } from './http';
import * as S from './steps';

export const LEASE_SECONDS = 330; // longer than the function limit, so a crashed run frees the article
const BACKOFF_MIN = [1, 3, 10, 30];

export function newArticle(o: ArticleOptions, batchId: string | undefined, position: number, now: Date): Article {
  return {
    id: randomUUID().replace(/-/g, '').slice(0, 16),
    batchId,
    position,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    options: o,
    status: 'queued',
    stage: 'research',
    step: 'Waiting its turn',
    failures: 0,
    stopped: false,
    nextAttemptAt: now.toISOString(),
    sectionsDone: 0,
    body: [],
    faq: [],
    scanCount: 0,
    usage: { costUsd: 0, claudeIn: 0, claudeOut: 0, searches: 0, gptzeroWords: 0, humanizerUsd: 0 },
  };
}

export function summarise(a: Article): NonNullable<Article['summary']> {
  return {
    title: a.title ?? a.options.topic,
    topic: a.options.topic,
    author: a.options.author,
    status: a.status,
    stage: a.stage,
    step: a.step,
    human: a.scan?.human,
    costUsd: a.usage.costUsd,
    publishAt: a.options.publishAt,
    slug: a.slug,
    error: a.error,
    stopped: a.stopped,
  };
}

async function save(a: Article, owner: string | null): Promise<void> {
  a.updatedAt = new Date().toISOString();
  a.summary = summarise(a);
  await db.putArticle(a, owner);
}

export interface BatchInput {
  topics: string[];
  length?: Article['options']['length'];
  author?: string; // a name, or '' / 'random'
  mode: Article['options']['publishMode'];
  days?: number;
}

const FAR = '9999-01-01T00:00:00.000Z';

// Each topic becomes its own article, written one after another (only the first is woken now).
export async function createBatch(input: BatchInput, s: Settings, now = new Date(), rand: () => number = Math.random): Promise<Article[]> {
  const topics = input.topics.map(t => t.trim()).filter(Boolean);
  if (!topics.length) throw new HttpError(400, 'Add at least one topic.');
  if (topics.length > 50) throw new HttpError(400, 'At most 50 topics in one batch.');
  const posts = await db.postsIndex();
  let slots: Date[] = [];
  try {
    if (input.mode === 'backdate') slots = backdateSlots(topics.length, input.days ?? 30, s.timeZone, now, posts.filter(p => p.status !== 'unpublished').map(p => p.publish_at), rand);
    if (input.mode === 'schedule') {
      const pending = (await db.listArticles()).filter(x => x.publish_at && !['published', 'failed'].includes(x.status)).map(x => x.publish_at!);
      slots = scheduleSlots(topics.length, input.days ?? 14, s.timeZone, now, [...posts.filter(p => p.status === 'scheduled').map(p => p.publish_at), ...pending], rand);
    }
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : String(e));
  }
  const batchId = topics.length > 1 ? randomUUID().slice(0, 8) : undefined;
  const handsOff = topics.length > 1 || input.mode !== 'manual';
  const out: Article[] = [];
  for (const [i, topic] of topics.entries()) {
    const author = input.author && input.author !== 'random' ? input.author : s.authors[Math.floor(rand() * s.authors.length)];
    const at = slots[i];
    const a = newArticle(
      {
        topic,
        length: input.length ?? s.defaultLength,
        author,
        spelling: s.spelling,
        asOf: localDate(s.timeZone, input.mode === 'backdate' && at ? at : now),
        publishMode: input.mode,
        publishAt: at?.toISOString(),
        hands_off: handsOff,
      },
      batchId,
      i,
      new Date(now.getTime() + i), // keeps batch order
    );
    if (i > 0) a.nextAttemptAt = FAR;
    await save(a, null);
    out.push(a);
  }
  return out;
}

// When an article finishes or stops, the next one in its batch starts.
async function wakeNext(a: Article): Promise<void> {
  if (!a.batchId) return;
  const rows = (await db.listArticles()).filter(x => x.batch_id === a.batchId && x.status === 'queued' && !x.stopped);
  const next = rows.sort((x, y) => x.created_at.localeCompare(y.created_at))[0];
  if (!next) return;
  const n = await db.getArticle(next.id);
  if (!n) return;
  n.nextAttemptAt = new Date().toISOString();
  await save(n, null).catch(() => undefined);
}

function ctxFor(s: Settings, deadline: number, now: () => Date): S.Ctx {
  let posts: PostIndexEntry[] | undefined;
  return {
    s,
    deadline,
    now,
    facts: () => appFacts(),
    posts: async () => (posts ??= await db.postsIndex()),
    otherTitles: async () =>
      (await db.listArticles())
        .filter(x => x.summary && !['published', 'scheduled', 'failed'].includes(x.status))
        .map(x => ({ title: x.summary!.title, topic: x.summary!.topic, headings: [], slug: x.summary!.slug })),
  };
}

// Puts an article on the site (status scheduled/published), or leaves it ready for you.
export async function publishArticle(a: Article, s: Settings, when: 'auto' | 'now' | string, now = new Date()): Promise<void> {
  S.codeRules(a, s); // last pass: links, names, app claims (also fixes articles written before a rule was added)
  const problem = S.finalCheck(a, s);
  if (problem) throw new HttpError(422, `Not posted: ${problem}.`);
  const at = when === 'now' ? now : when === 'auto' ? (a.options.publishAt ? new Date(a.options.publishAt) : now) : new Date(when);
  if (Number.isNaN(at.getTime())) throw new HttpError(400, 'Bad publish time.');
  const live = at.getTime() <= now.getTime();
  const words = S.wordCountOf(a);
  // Sources: the research notes the article was written from (one per site, at most 8).
  const seen = new Set<string>();
  const sources = (a.research?.facts ?? [])
    .filter(f => { const h = (() => { try { return new URL(f.url).host; } catch { return ''; } })(); if (!h || seen.has(h)) return false; seen.add(h); return true; })
    .slice(0, 8)
    .map(f => ({ name: f.source, url: f.url }));
  await db.upsertArticlePost({
    article_id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    excerpt: a.description,
    sources,
    author: a.options.author,
    category: a.plan?.category ?? 'Number puzzles',
    tags: a.plan?.tags ?? [],
    html: blocksToHtml(a.body),
    faq: a.faq,
    headings: a.body.flatMap(b => (b.type === 'h2' ? [b.text] : [])),
    related: a.plan?.related ?? [],
    word_count: words,
    reading_minutes: readingMinutes(words),
    status: live ? 'published' : 'scheduled',
    publish_at: at.toISOString(),
  });
  a.options.publishAt = at.toISOString();
  a.status = live ? 'published' : 'scheduled';
  a.publishedAt = live ? at.toISOString() : undefined;
  a.stage = 'done';
  a.step = live ? 'Live on the site' : `Scheduled for ${at.toISOString()}`;
}

async function publishStep(a: Article, c: S.Ctx): Promise<void> {
  const s = c.s;
  // Batch articles post themselves into their slot. A single article waits for you unless it has a slot.
  const auto = a.options.hands_off ? s.autoPostBatches : a.options.publishMode !== 'manual';
  const blocked = s.requirePass && !a.options.hands_off && a.scan && a.scan.human < s.passMark;
  if (!auto || blocked || a.options.publishMode === 'manual') {
    a.status = 'ready';
    a.stage = 'done';
    a.step = blocked ? `Below the pass mark (${a.scan!.human}% human): edit or post it yourself` : 'Ready: post it when you want';
    const problem = S.finalCheck(a, s);
    if (problem) a.step = `Ready, but it can't be posted yet: ${problem}`;
    return;
  }
  await publishArticle(a, s, 'auto', c.now());
}

// One stage of one article. Returns true when the article reached a resting state.
async function runStage(a: Article, c: S.Ctx): Promise<{ wait?: number }> {
  if (a.status === 'queued') a.status = 'generating';
  switch (a.stage) {
    case 'research':
      a.step = 'Researching';
      await S.research(a, c);
      break;
    case 'plan':
      await S.plan(a, c);
      break;
    case 'write':
      await S.writeSections(a, c);
      break;
    case 'extras':
      await S.extras(a, c);
      break;
    case 'humanize': {
      const r = await S.humanize(a, c);
      if (r.waitUntil) return { wait: r.waitUntil };
      break;
    }
    case 'meaning':
      await S.meaning(a, c);
      break;
    case 'clean':
      await S.clean(a, c);
      break;
    case 'links':
      await S.links(a, c);
      break;
    case 'scan':
      await S.scanStep(a, c);
      break;
    case 'rewrite':
      await S.rewrite(a, c);
      break;
    case 'publish':
      await publishStep(a, c);
      break;
  }
  return {};
}

const resting = (a: Article) => a.stage === 'done' || a.stopped || ['ready', 'scheduled', 'published', 'failed'].includes(a.status);

// Works on one leased article until it rests or time runs short. Saves after every stage.
export async function work(a: Article, owner: string, deadline: number, now: () => Date = () => new Date()): Promise<Article> {
  const s = await db.getSettings();
  const c = ctxFor(s, deadline, now);
  try {
    while (!resting(a) && deadline - Date.now() > 60_000) {
      const before = `${a.stage}:${a.sectionsDone}`;
      try {
        const r = await runStage(a, c);
        a.error = undefined;
        a.failures = 0;
        if (r.wait) {
          a.nextAttemptAt = new Date(r.wait).toISOString();
          await save(a, owner);
          break;
        }
      } catch (e) {
        if (e instanceof LeaseLost) throw e;
        const msg = e instanceof Error ? e.message : String(e);
        // Running out of time in this run is not the article's fault: carry on next run, no strike.
        if (e instanceof HttpError && e.status === 504 && /time left|did not answer in time/.test(msg) && deadline - Date.now() < 70_000) {
          await save(a, owner);
          break;
        }
        a.failures++;
        a.error = msg;
        if (a.failures >= s.maxFailures) {
          a.stopped = true;
          a.status = 'failed';
          a.step = `Stopped after ${a.failures} errors in a row: press Retry`;
        } else {
          a.nextAttemptAt = new Date(Date.now() + BACKOFF_MIN[Math.min(a.failures - 1, BACKOFF_MIN.length - 1)] * 60_000).toISOString();
          a.step = `Error, retrying at ${a.nextAttemptAt.slice(11, 16)} UTC: ${msg.slice(0, 120)}`;
        }
        await save(a, owner);
        break;
      }
      a.nextAttemptAt = new Date().toISOString();
      await save(a, owner);
      if (before === `${a.stage}:${a.sectionsDone}` && !resting(a)) break; // no progress: don't spin
    }
  } finally {
    if (resting(a)) await wakeNext(a).catch(() => undefined);
  }
  return a;
}

// Background job: claim the next waiting article (any batch), work it, release, repeat until time runs out.
export async function tick(budgetMs: number, owner = `tick-${randomUUID().slice(0, 8)}`): Promise<{ worked: string[]; published: number }> {
  const deadline = Date.now() + budgetMs;
  const { published } = await db.sweep();
  const worked: string[] = [];
  while (deadline - Date.now() > 70_000) {
    const a = await db.nextJob(owner, LEASE_SECONDS);
    if (!a) break;
    try {
      await work(a, owner, deadline);
      worked.push(a.id);
    } catch (e) {
      if (!(e instanceof LeaseLost)) console.error('tick', a.id, e);
    } finally {
      await db.release(a.id, owner).catch(() => undefined);
    }
  }
  return { worked, published };
}

// Browser runner: work a given article (or the next waiting one) under this tab's lease.
export async function runFromBrowser(id: string | undefined, owner: string, budgetMs: number): Promise<{ article: Article | null; busy?: boolean }> {
  const deadline = Date.now() + budgetMs;
  const a = id ? await db.claim(id, owner, LEASE_SECONDS) : await db.nextJob(owner, LEASE_SECONDS);
  if (!a) return { article: id ? await db.getArticle(id) : null, busy: !!id };
  try {
    if (a.nextAttemptAt && Date.parse(a.nextAttemptAt) > Date.now() + 1000 && !a.stopped) return { article: a };
    return { article: await work(a, owner, deadline) };
  } finally {
    await db.release(a.id, owner).catch(() => undefined);
  }
}

export async function retry(id: string, owner: string): Promise<Article> {
  const a = await db.claim(id, owner, 30);
  if (!a) throw new HttpError(409, 'Another runner is working on this article right now.');
  a.stopped = false;
  a.failures = 0;
  a.error = undefined;
  if (a.status === 'failed') a.status = a.stage === 'scan' || a.stage === 'rewrite' ? 'checking' : a.stage === 'publish' ? 'publishing' : 'generating';
  a.nextAttemptAt = new Date().toISOString();
  a.step = 'Retrying';
  await save(a, owner);
  await db.release(id, owner);
  return a;
}

export async function postNow(id: string, owner: string, when: 'now' | string): Promise<Article> {
  const a = await db.claim(id, owner, 60);
  if (!a) throw new HttpError(409, 'Another runner is working on this article right now.');
  try {
    if (a.stage !== 'done' || !['ready', 'scheduled', 'published'].includes(a.status)) throw new HttpError(409, 'The article is not finished yet.');
    await publishArticle(a, await db.getSettings(), when);
    await save(a, owner);
    return a;
  } finally {
    await db.release(id, owner).catch(() => undefined);
  }
}

export async function unpublish(id: string, owner: string): Promise<Article> {
  const a = await db.claim(id, owner, 60);
  if (!a) throw new HttpError(409, 'Another runner is working on this article right now.');
  try {
    await db.unpublish(id);
    a.status = 'ready';
    a.step = 'Taken off the site';
    await save(a, owner);
    return a;
  } finally {
    await db.release(id, owner).catch(() => undefined);
  }
}

export { save as saveArticle };

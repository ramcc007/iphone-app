// Every 12 hours (pg_cron → /api/tick?job=submit): tell IndexNow search engines (Bing, Yandex, Naver,
// Seznam) about new or changed pages. Google does not take IndexNow and retired sitemap pings in 2023;
// it reads the sitemap from robots.txt and Search Console instead.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE } from '../shared/settings';
import { db } from './db';
import { optEnv } from './http';

const STATE = 'indexnow_last';

export interface SubmitResult {
  at: string;
  submitted: number;
  status: number | null;
  note: string;
}

const indexNowKey = (): string => {
  const cfg = JSON.parse(readFileSync(join(process.cwd(), 'site', 'site.config.json'), 'utf8')) as { indexNowKey?: string };
  return cfg.indexNowKey ?? '';
};

const livePosts = () => db.liveList<{ slug: string; publish_at: string; updated_at: string }>();

export function changedUrls(posts: { slug: string; publish_at: string; updated_at: string }[], since: string | null, staticPages: string[]): string[] {
  const t = since ? Date.parse(since) : 0;
  const changed = posts.filter(p => Math.max(Date.parse(p.publish_at), Date.parse(p.updated_at)) > t).map(p => `${SITE}/blog/${p.slug}`);
  const pages = since ? (changed.length ? ['/blog'] : []) : staticPages;
  return [...pages.map(p => `${SITE}${p === '/' ? '/' : p}`), ...changed];
}

export async function submitToIndexNow(now = new Date()): Promise<SubmitResult> {
  const last = await db.getState<SubmitResult & { through?: string }>(STATE).catch(() => null);
  const key = indexNowKey();
  const urls = changedUrls(await livePosts(), last?.through ?? null, ['/', '/support', '/privacy', '/terms', '/press', '/blog']).slice(0, 10_000);
  let out: SubmitResult;
  if (!key) out = { at: now.toISOString(), submitted: 0, status: null, note: 'no IndexNow key in site.config.json' };
  else if (!urls.length) out = { at: now.toISOString(), submitted: 0, status: null, note: 'nothing new or changed since the last submission' };
  else {
    const host = new URL(SITE).host;
    const r = await fetch(optEnv('INDEXNOW_URL', 'https://api.indexnow.org/indexnow'), {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${SITE}/${key}.txt`, urlList: urls }),
      signal: AbortSignal.timeout(20_000),
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }) as unknown as Response);
    // 200 accepted, 202 accepted while the key is being checked. Anything else is retried on the next run.
    const ok = r.status === 200 || r.status === 202;
    out = { at: now.toISOString(), submitted: ok ? urls.length : 0, status: r.status, note: ok ? `${urls.length} URLs accepted` : `refused: ${(await r.text().catch(() => '')).slice(0, 160)}` };
    if (ok) {
      await db.putState(STATE, { ...out, through: now.toISOString() });
      return out;
    }
  }
  await db.putState(STATE, { ...out, through: last?.through ?? (out.status === null && key ? now.toISOString() : undefined) });
  return out;
}

export const lastSubmission = () => db.getState<SubmitResult>(STATE).catch(() => null);

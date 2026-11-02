// The writer's only door to the database: public.writer_api(secret, op, args) over PostgREST with the
// publishable key. The key can read nothing but live posts; the secret opens only this function.
import type { Article, PostIndexEntry, Settings } from '../shared/types';
import { mergeSettings } from '../shared/settings';
import { HttpError, env } from './http';

export class LeaseLost extends Error {}

async function api<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const url = `${env('SUPABASE_URL')}/rest/v1/rpc/writer_api`;
  const key = env('SUPABASE_ANON_KEY');
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_secret: env('WRITER_DB_SECRET'), p_op: op, p_args: args }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new HttpError(502, `Could not reach the database: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await res.text();
  if (!res.ok) {
    if (/lease held/i.test(text)) throw new LeaseLost('Another runner is working on this article.');
    if (/unauthorised/i.test(text)) throw new HttpError(500, 'The database refused WRITER_DB_SECRET. Check it in Vercel.');
    throw new HttpError(502, `Database error ${res.status}: ${text.slice(0, 200)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

interface Row {
  id: string;
  data: Article;
  lease_owner: string | null;
  lease_until: string | null;
}

export const db = {
  async getArticle(id: string): Promise<Article | null> {
    const r = await api<Row | null>('article_get', { id });
    return r?.data ?? null;
  },
  async listArticles(): Promise<{ id: string; batch_id: string | null; status: string; stopped: boolean; publish_at: string | null; created_at: string; lease_until: string | null; summary: Article['summary'] }[]> {
    return api('article_list', { limit: 500 });
  },
  async putArticle(a: Article, owner: string | null): Promise<void> {
    await api('article_put', {
      id: a.id,
      owner,
      batch_id: a.batchId ?? null,
      position: a.position,
      status: a.status,
      stopped: a.stopped,
      next_attempt_at: a.nextAttemptAt ?? new Date().toISOString(),
      publish_at: a.options.publishAt ?? null,
      slug: a.slug ?? null,
      created_at: a.createdAt,
      data: a,
    });
  },
  deleteArticle: (id: string) => api('article_delete', { id }),
  async claim(id: string, owner: string, seconds: number): Promise<Article | null> {
    const r = await api<Row | null>('lease_claim', { id, owner, seconds });
    return r?.data ?? null;
  },
  release: (id: string, owner: string) => api('lease_release', { id, owner }),
  async nextJob(owner: string, seconds: number): Promise<Article | null> {
    const r = await api<Row | null>('next_job', { owner, seconds });
    return r?.data ?? null;
  },
  async getSettings(): Promise<Settings> {
    return mergeSettings(await api<Partial<Settings>>('settings_get'));
  },
  async putSettings(s: Settings): Promise<Settings> {
    const m = mergeSettings(s);
    await api('settings_put', { data: m });
    return m;
  },
  getState: <T>(key: string) => api<T | null>('state_get', { key }),
  putState: (key: string, value: unknown) => api('state_put', { key, value }),
  logUsage: (u: { article_id?: string; step: string; provider: string; model?: string; input_tokens?: number; output_tokens?: number; searches?: number; words?: number; cost_usd: number; ok: boolean; note?: string }) =>
    api('usage_add', u).catch(e => console.error('usage log failed', e)),
  usage: (from?: string, to?: string) => api<{ at: string; article_id: string | null; step: string; provider: string; model: string | null; input_tokens: number; output_tokens: number; searches: number; words: number; cost_usd: number; ok: boolean; note: string | null }[]>('usage_list', { from, to }),
  upsertPost: (p: Record<string, unknown>) => api('post_upsert', p),
  unpublish: (articleId: string) => api('post_unpublish', { id: articleId }),
  postAdmin: (slug: string) => api<Record<string, unknown> | null>('post_admin', { slug }),
  postsIndex: () => api<PostIndexEntry[]>('posts_index'),
  sweep: () => api<{ published: number }>('sweep'),
};

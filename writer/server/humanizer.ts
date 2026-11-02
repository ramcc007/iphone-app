// The humanizer: an open model on Groq (free tier) or OpenRouter rewrites each paragraph once, with one
// before/after example. Code rejects any rewrite that loses a number or name, isn't English or carries a
// translation note; one cheap Claude call puts back any paragraph whose meaning flipped.
import type { Article, HumanizeUnit, Settings } from '../shared/types';
import { cleanRewrite, factProblem, sameness } from '../shared/humanize';
import { priceOf } from '../shared/settings';
import { addCost, callClaude, parseJson } from './claude';
import { db } from './db';
import { HttpError, optEnv } from './http';

const PROVIDERS = {
  groq: { key: 'GROQ_API_KEY', url: 'GROQ_API_URL', base: 'https://api.groq.com/openai/v1/chat/completions', name: 'Groq' },
  openrouter: { key: 'OPENROUTER_API_KEY', url: 'OPENROUTER_API_URL', base: 'https://openrouter.ai/api/v1/chat/completions', name: 'OpenRouter' },
} as const;

// One provider and model the humanizer can call. The main one comes first; the fallback is used when the
// main one is out for the day or has no key.
export interface Route {
  provider: 'groq' | 'openrouter';
  model: string;
}
const providerInfo = (r: Route) => PROVIDERS[r.provider === 'openrouter' ? 'openrouter' : 'groq'];
export const hasKey = (r: Route) => !!process.env[providerInfo(r).key];
export const routesOf = (s: Settings): Route[] => {
  const main: Route = { provider: s.humanizer.provider, model: s.humanizer.model };
  const fb = s.humanizer.fallback;
  return fb?.enabled && fb.model && !(fb.provider === main.provider && fb.model === main.model) ? [main, { provider: fb.provider, model: fb.model }] : [main];
};
export const keyName = (r: Route) => providerInfo(r).key;

export class HumanizerBusy extends Error {
  retryAfterMs: number;
  daily: boolean;
  constructor(ms: number, daily: boolean) {
    super(daily ? 'The humanizer\'s free daily allowance is used up' : 'The humanizer\'s per-minute limit was reached');
    this.retryAfterMs = ms;
    this.daily = daily;
  }
}

// Each provider has its own daily allowance, so each is paused on its own.
const pauseKey = (provider: string) => `humanizer_paused_until:${provider}`;
export async function pausedUntil(provider: string): Promise<number> {
  const v = await db.getState<{ until: number }>(pauseKey(provider)).catch(() => null);
  return v?.until && v.until > Date.now() ? v.until : 0;
}
export const pauseHumanizer = (provider: string, until: number, reason = 'daily limit') => db.putState(pauseKey(provider), { until, reason, at: new Date().toISOString() });
export async function pauseInfo(provider: string): Promise<{ until: number; reason?: string } | null> {
  const v = await db.getState<{ until: number; reason?: string }>(pauseKey(provider)).catch(() => null);
  return v?.until && v.until > Date.now() ? v : null;
}

const SYSTEM = `You reword one paragraph from a puzzle website for ordinary readers. Rewrite it in your own words in plain, literal, everyday English, the way a careful newspaper puzzle columnist writes. Change the words and the sentence order. Keep every number, name and fact, and the same level of certainty. Do not add anything and do not leave anything out. No idioms, no metaphors, no clever lines, no dashes, no words like furthermore, moreover, additionally, crucial or "it is worth noting". Write the paragraph text only: no heading, no label, no quotation marks around it, no note.`;

const EXAMPLE = {
  original:
    'On a 6×6 board, most new players start by looking for the row that already has four numbers in it. Filling the last two cells there is quick, and it often opens up the column next to it as well.',
  rewrite:
    'Most players who are new to the 6×6 board look first for a row with four numbers already in place. The last two cells in that row take little time to fill, and doing that often makes the column beside it easier too.',
};

interface Totals {
  input: number;
  output: number;
  calls: number;
  failed: number;
}

async function chat(paragraph: string, s: Settings, r: Route, t: Totals, temperature: number): Promise<string> {
  const p = providerInfo(r);
  const key = process.env[p.key];
  if (!key) throw new HttpError(500, `Missing ${p.key}. Add it in Vercel, or turn the humanizer off in Settings.`);
  let res: Response;
  try {
    res = await fetch(optEnv(p.url, p.base), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        ...(r.provider === 'openrouter' ? { 'HTTP-Referer': 'https://www.numfall.store', 'X-Title': 'NumFall Writer' } : {}),
      },
      body: JSON.stringify({
        model: r.model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: EXAMPLE.original },
          { role: 'assistant', content: EXAMPLE.rewrite },
          { role: 'user', content: paragraph },
        ],
        temperature,
        top_p: s.humanizer.topP,
        // Short thinking for reasoning models: Groq takes reasoning_effort, OpenRouter takes a reasoning object.
        ...(r.model.includes('gpt-oss')
          ? r.provider === 'openrouter'
            ? { reasoning: { effort: s.humanizer.reasoningEffort, exclude: true } }
            : { reasoning_effort: s.humanizer.reasoningEffort }
          : {}),
        max_tokens: Math.min(3000, paragraph.split(/\s+/).length * 3 + 600),
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    t.failed++;
    throw new HttpError(502, `${p.name} did not answer in time.`);
  }
  t.calls++;
  if (res.status === 429) {
    t.failed++;
    const after = Number(res.headers.get('retry-after'));
    const msg = await res.text().catch(() => '');
    const wait = Number.isFinite(after) && after > 0 ? after * 1000 : 60_000;
    // "Rate limit reached ... tokens per day (TPD)" / "requests per day (RPD)", or a long wait, is the daily limit.
    // OpenRouter free models: "free-models-per-day" when the 50 or 1,000 a day are used up.
    const daily = /per[ -]day|\bTPD\b|\bRPD\b|daily/i.test(msg) || wait > 120_000;
    throw new HumanizerBusy(daily ? Math.max(wait, 30 * 60_000) : Math.min(wait, 65_000), daily);
  }
  if (res.status === 401 || res.status === 403) {
    t.failed++;
    throw new HttpError(500, `${p.name} rejected the API key. Check ${p.key} in Vercel.`);
  }
  if (!res.ok) {
    t.failed++;
    // The provider's own reason (e.g. OpenRouter's "No endpoints found matching your data policy") says what to change.
    const detail = await res
      .json()
      .then(j => (j as { error?: { message?: string } } | null)?.error?.message ?? '')
      .catch(() => '');
    throw new HttpError(502, `${p.name} error ${res.status}${detail ? `: ${String(detail).slice(0, 200)}` : ''}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  t.input += data.usage?.prompt_tokens ?? 0;
  t.output += data.usage?.completion_tokens ?? 0;
  return data.choices?.[0]?.message?.content ?? '';
}

async function rewriteUnit(u: HumanizeUnit, s: Settings, r: Route, t: Totals): Promise<void> {
  let why = '';
  for (const temp of [s.humanizer.temperature, Math.max(0.7, s.humanizer.temperature - 0.3)]) {
    const text = cleanRewrite(await chat(u.original, s, r, t, temp), u.original);
    const problem = sameness(u.original, text) > 0.8 ? 'came back almost unchanged' : factProblem(u.original, text);
    if (!problem) {
      u.text = text;
      u.state = 'done';
      u.note = undefined;
      return;
    }
    why = problem;
  }
  u.state = 'kept';
  u.note = `kept the original: ${why}`;
}

// Rewrites pending units, three at a time, until done or out of time.
export async function rewriteUnits(units: HumanizeUnit[], s: Settings, r: Route, a: Article, deadline: number): Promise<{ retryAt?: number; daily?: boolean }> {
  const t: Totals = { input: 0, output: 0, calls: 0, failed: 0 };
  const queue = units.filter(u => u.state === 'pending');
  let busy: HumanizerBusy | undefined;
  const worker = async () => {
    while (queue.length && Date.now() < deadline - 25_000 && !busy) {
      const u = queue.shift()!;
      try {
        await rewriteUnit(u, s, r, t);
      } catch (e) {
        u.state = 'pending';
        if (e instanceof HumanizerBusy) busy = e;
        else throw e;
      }
    }
  };
  try {
    await Promise.all([worker(), worker(), worker()]);
  } finally {
    if (t.calls) {
      const p = r.model.endsWith(':free') ? { inPerM: 0, outPerM: 0 } : priceOf(s, r.model);
      const usd = Math.round(((t.input / 1e6) * p.inPerM + (t.output / 1e6) * p.outPerM) * 1e6) / 1e6;
      addCost(a, usd, { humanizerUsd: usd });
      await db.logUsage({ article_id: a.id, step: 'humanize', provider: r.provider, model: r.model, input_tokens: t.input, output_tokens: t.output, cost_usd: usd, ok: t.failed < t.calls, note: `${t.calls} calls${t.failed ? `, ${t.failed} failed` : ''}` });
    }
  }
  return busy ? { retryAt: Date.now() + busy.retryAfterMs, daily: busy.daily } : {};
}

const MEANING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['changed'],
  properties: { changed: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'reason'], properties: { id: { type: 'integer' }, reason: { type: 'string' } } } } },
};

// A cheap Claude call lists rewrites whose meaning flipped; those go back to the original.
export async function meaningCheck(units: HumanizeUnit[], s: Settings, a: Article, deadline: number): Promise<number> {
  const done = units.filter(u => u.state === 'done' && u.text);
  if (!done.length) return 0;
  const r = await callClaude({
    s,
    model: s.models.check,
    step: 'meaning check',
    article: a,
    deadline,
    maxTokens: 6000,
    schema: MEANING_SCHEMA,
    system: 'You compare an original paragraph with a reworded one and only judge facts and meaning, never style or grammar.',
    user: `For each pair, say whether the rewrite changed the meaning: a number, rule, name or step; what a player does or in what order; how certain something is; a claim added or a fact dropped. Rewording, odd phrasing and small grammar mistakes are fine.\n\n${done
      .map((u, i) => `#${i + 1}\nORIGINAL: ${u.original}\nREWRITE: ${u.text}`)
      .join('\n\n')}\n\nList only the pairs whose meaning changed. An empty list is normal.`,
  });
  let n = 0;
  for (const c of parseJson<{ changed: { id: number; reason: string }[] }>(r.text).changed ?? []) {
    const u = done[c.id - 1];
    if (!u) continue;
    u.state = 'reverted';
    u.note = `meaning changed: ${c.reason}`;
    u.text = undefined;
    n++;
  }
  return n;
}

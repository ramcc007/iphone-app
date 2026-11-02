// One GPTZero scan per article (your existing API plan). The key stays on the server.
import type { Article, Score, Settings } from '../shared/types';
import { words } from '../shared/text';
import { addCost } from './claude';
import { db } from './db';
import { HttpError, env, optEnv } from './http';

interface Doc {
  completely_generated_prob?: number;
  class_probabilities?: { ai?: number; human?: number; mixed?: number };
  sentences?: { sentence?: string; generated_prob?: number; highlight_sentence_for_ai?: boolean }[];
}

const pct = (x: number) => Math.max(0, Math.min(100, Math.round(x * 100)));

export async function scan(text: string, s: Settings, a: Article, step: string): Promise<Score> {
  const doc = text.trim();
  const n = words(doc);
  const usd = Math.round((n / 1000) * s.gptzeroPer1kWords * 1e6) / 1e6;
  let res: Response;
  try {
    res = await fetch(`${optEnv('GPTZERO_API_URL', 'https://api.gptzero.me')}/v2/predict/text`, {
      method: 'POST',
      headers: { 'x-api-key': env('GPTZERO_API_KEY'), 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ document: doc }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    await db.logUsage({ article_id: a.id, step, provider: 'gptzero', words: 0, cost_usd: 0, ok: false, note: 'no answer' });
    throw new HttpError(502, `Could not reach GPTZero: ${e instanceof Error ? e.message : String(e)}`);
  }
  const body = await res.text();
  if (!res.ok) {
    await db.logUsage({ article_id: a.id, step, provider: 'gptzero', words: 0, cost_usd: 0, ok: false, note: `HTTP ${res.status}` });
    if (res.status === 401 || res.status === 403) throw new HttpError(500, 'GPTZero rejected the API key. Check GPTZERO_API_KEY in Vercel.');
    if (res.status === 402 || res.status === 429) throw new HttpError(429, 'GPTZero says the plan is out of words or busy.');
    throw new HttpError(502, `GPTZero error ${res.status}: ${body.slice(0, 200)}`);
  }
  addCost(a, usd, { gptzeroWords: n });
  await db.logUsage({ article_id: a.id, step, provider: 'gptzero', words: n, cost_usd: usd, ok: true });
  const d = (JSON.parse(body) as { documents?: Doc[] }).documents?.[0];
  if (!d) throw new HttpError(502, 'GPTZero returned no result.');
  const human = d.class_probabilities?.human ?? 1 - (d.completely_generated_prob ?? 1);
  const ai = d.class_probabilities?.ai ?? d.completely_generated_prob ?? 0;
  const mixed = d.class_probabilities?.mixed ?? Math.max(0, 1 - human - ai);
  const all = (d.sentences ?? [])
    .map(x => ({ t: (x.sentence ?? '').trim(), p: x.generated_prob ?? 0, hl: !!x.highlight_sentence_for_ai }))
    .filter(x => x.t.split(/\s+/).length >= 5)
    .sort((x, y) => y.p - x.p);
  let flagged = all.filter(x => x.hl || x.p >= 0.5);
  // GPTZero sometimes calls the whole text AI without highlighting single sentences: take the most AI-like.
  if (!flagged.length && pct(human) < s.passMark) flagged = all.slice(0, 12);
  return { human: pct(human), ai: pct(ai), mixed: pct(mixed), flagged: flagged.slice(0, 30).map(x => x.t), words: n, at: new Date().toISOString() };
}

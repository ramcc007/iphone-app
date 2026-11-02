// Claude over plain fetch. Every call is written to the usage log with its cost, including failures.
import type { Article, Effort, Settings } from '../shared/types';
import { priceOf } from '../shared/settings';
import { db } from './db';
import { HttpError, env, optEnv } from './http';

export interface ClaudeCall {
  s: Settings;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  effort?: Effort;
  schema?: Record<string, unknown>;
  webSearch?: number; // max searches
  article?: Article;
  step: string;
  deadline: number; // ms epoch; the call is abandoned before the function's time limit
}

export interface ClaudeResult {
  text: string;
  input: number;
  output: number;
  searches: number;
  costUsd: number;
}

interface ApiBlock {
  type: string;
  text?: string;
}
interface ApiMessage {
  content: ApiBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number; server_tool_use?: { web_search_requests?: number } };
}

async function post(body: Record<string, unknown>, deadline: number): Promise<ApiMessage> {
  const left = deadline - Date.now();
  if (left < 8_000) throw new HttpError(504, 'Not enough time left in this run; the step will continue on the next run.');
  let res: Response;
  try {
    res = await fetch(`${optEnv('ANTHROPIC_API_URL', 'https://api.anthropic.com')}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(left - 3_000),
    });
  } catch (e) {
    throw new HttpError(504, `Claude did not answer in time (${e instanceof Error ? e.name : 'error'}).`);
  }
  const text = await res.text();
  if (res.status === 401) throw new HttpError(500, 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.');
  if (res.status === 429 || res.status === 529) throw new HttpError(429, `Claude is busy (${res.status}). The step will be retried.`);
  if (!res.ok) throw new HttpError(res.status >= 500 ? 502 : 400, `Claude API error ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as ApiMessage;
}

export async function callClaude(c: ClaudeCall): Promise<ClaudeResult> {
  const body: Record<string, unknown> = {
    model: c.model,
    max_tokens: c.maxTokens,
    system: c.system,
    messages: [{ role: 'user', content: c.user }],
    output_config: { effort: c.effort ?? 'low', ...(c.schema ? { format: { type: 'json_schema', schema: c.schema } } : {}) },
    ...(c.webSearch ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: c.webSearch }] } : {}),
  };
  let input = 0;
  let output = 0;
  let searches = 0;
  const p = priceOf(c.s, c.model);
  const cost = () => Math.round(((input / 1e6) * p.inPerM + (output / 1e6) * p.outPerM + (searches / 1000) * c.s.searchPer1k) * 1e6) / 1e6;
  try {
    let msg: ApiMessage;
    try {
      msg = await post(body, c.deadline);
    } catch (e) {
      // If structured output is refused for this model, ask for JSON in the prompt instead.
      if (c.schema && e instanceof HttpError && e.status === 400 && /output_config|format|schema|effort/i.test(e.message)) {
        msg = await post(
          { ...body, output_config: undefined, messages: [{ role: 'user', content: `${c.user}\n\nReply with only a JSON object matching this schema, no other text:\n${JSON.stringify(c.schema)}` }] },
          c.deadline,
        );
      } else throw e;
    }
    const content = [...msg.content];
    const add = (m: ApiMessage) => {
      input += m.usage.input_tokens + (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0);
      output += m.usage.output_tokens;
      searches += m.usage.server_tool_use?.web_search_requests ?? 0;
    };
    add(msg);
    let guard = 0;
    while (msg.stop_reason === 'pause_turn' && guard++ < 3) {
      msg = await post({ ...body, messages: [...(body.messages as unknown[]), { role: 'assistant', content: msg.content }] }, c.deadline);
      add(msg);
      content.push(...msg.content);
    }
    const text = content.filter(b => b.type === 'text').map(b => b.text ?? '').join('');
    const r = { text, input, output, searches, costUsd: cost() };
    if (c.article) addCost(c.article, r.costUsd, { claudeIn: input, claudeOut: output, searches });
    await db.logUsage({ article_id: c.article?.id, step: c.step, provider: 'anthropic', model: c.model, input_tokens: input, output_tokens: output, searches, cost_usd: r.costUsd, ok: true });
    return r;
  } catch (e) {
    await db.logUsage({ article_id: c.article?.id, step: c.step, provider: 'anthropic', model: c.model, input_tokens: input, output_tokens: output, searches, cost_usd: cost(), ok: false, note: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    if (c.article) addCost(c.article, cost(), { claudeIn: input, claudeOut: output, searches });
    throw e;
  }
}

export function addCost(a: Article, usd: number, extra: Partial<Omit<Article['usage'], 'costUsd'>> = {}): void {
  const u = a.usage;
  a.usage = {
    costUsd: Math.round((u.costUsd + usd) * 1e6) / 1e6,
    claudeIn: u.claudeIn + (extra.claudeIn ?? 0),
    claudeOut: u.claudeOut + (extra.claudeOut ?? 0),
    searches: u.searches + (extra.searches ?? 0),
    gptzeroWords: u.gptzeroWords + (extra.gptzeroWords ?? 0),
    humanizerUsd: Math.round((u.humanizerUsd + (extra.humanizerUsd ?? 0)) * 1e6) / 1e6,
  };
}

export function parseJson<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(t) as T;
  } catch {
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s !== -1 && e > s) {
      try {
        return JSON.parse(t.slice(s, e + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new HttpError(502, 'Claude returned something that was not valid JSON. The step will be retried.');
  }
}

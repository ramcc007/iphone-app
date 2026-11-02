// Background job, called by the database's pg_cron (every minute while articles are waiting, and every
// 10 minutes to mark due scheduled posts as published and sweep up leftovers). Answers at once and keeps
// working in the background for up to about 4.5 minutes.
import { waitUntil } from '@vercel/functions';
import { isTick } from '../writer/server/auth';
import { json } from '../writer/server/http';
import { tick } from '../writer/server/runner';

const BUDGET_MS = 270_000;

export async function POST(req: Request): Promise<Response> {
  if (!isTick(req)) return json({ error: 'Not allowed.' }, 401);
  waitUntil(tick(BUDGET_MS).then(r => console.log('tick', JSON.stringify(r))).catch(e => console.error('tick failed', e)));
  return json({ ok: true }, 202);
}

export const GET = POST;

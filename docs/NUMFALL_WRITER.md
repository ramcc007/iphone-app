# NumFall Writer

A private tool at **https://www.numfall.store/admin** that researches, writes, humanizes, checks and posts articles to **numfall.store/blog/<slug>**. It is built to bring search traffic that turns into App Store downloads.

## Using it
1. **Batch input.** On **New batch**, paste up to 50 topics, one per line, and pick the length, the author (Random by default) and the publish dates:
   - **I post each one myself:** articles stop at Ready and wait for you.
   - **Schedule:** random times in the next N days, 9 am to 9 pm in your time zone (Settings), at most 2 a day and at least 4 hours apart. Posts already scheduled count toward those limits.
   - **Backdate:** random dates in the last N days, at most 3 on one date. Each article is researched and written as of its own date.
2. **Order and posting.** Articles are written one after another. Batch articles always get one GPTZero scan and one rewrite, then post themselves into their slot.
3. **Background running.** The database calls the writer every minute while articles are waiting, and every 10 minutes it marks due scheduled posts as published. Nothing needs to stay open. An open admin tab helps too, and leases stop it and the background job from paying for the same step.
4. **Previews.** Scheduled posts return 404 to visitors until their time. While you are signed in, the same URL shows a preview with the go-live time.
5. **Spending.** The **Usage** page lists every paid call and its cost.

## Setup (Vercel → numfall-site → Settings → Environment Variables)
| Name | What |
|---|---|
| `ADMIN_PASSWORD` | the password for /admin (mark as sensitive) |
| `ANTHROPIC_API_KEY` | Claude |
| `GROQ_API_KEY` | humanizer, free tier (console.groq.com → API Keys) |
| `OPENROUTER_API_KEY` | optional, only if you switch the humanizer to OpenRouter |
| `GPTZERO_API_KEY` | your GPTZero API key |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | the numfall Supabase project (set already) |
| `WRITER_DB_SECRET` | opens `writer_api`; only its hash is in the database (set already) |
| `TICK_SECRET` | lets the database's pg_cron call `/api/tick`; the same value is in `writer_private.config.tick_secret` (set already) |

Redeploy after changing a variable.

## Development
```sh
npm ci
npm test        # unit tests + the full flow against fake Claude, Groq, GPTZero and Supabase
npm run build   # typecheck, tests, site, admin page (what Vercel runs)
```
Code:
- `writer/shared`: pure logic: clean-up, humanizer guards, slips, scheduling, links, HTML.
- `writer/server`: the pipeline and API clients.
- `writer/site`: the blog pages.
- `writer/ui`: the admin page.
- `api/`: Vercel functions.
- `supabase/`: the SQL.

The findings and changes log is in `docs/AUDIT.md`.

# NumFall Writer and the numfall.store admin

One repository, two Vercel projects (since 3 November 2026):

| Project | Address | What it serves |
|---|---|---|
| `numfall-site` | **www.numfall.store** | the public site and blog, OG images, and the **admin area** at `/admin` (dashboard, blog management) |
| `numfall-writer` (`APP_ROLE=writer`) | **https://numfall-writer.vercel.app** | the **article writer**: research, write, humanize, check and post articles (`/admin`, `/api/writer`, `/api/tick`). No custom domain, noindex, password login |

The writer's old addresses on numfall.store (`/api/writer`, `/api/tick`) answer **410 Gone**. On the writer project, public pages, OG images and `/api/admin` answer 404.

## numfall.store admin (`/admin`)
- **Sign in** with `ADMIN_PASSWORD`. 5 wrong tries from one address lock it for 15 minutes. Signing in marks the device: Google Analytics never loads there (your visits are not counted), and the public header shows an **Admin** link.
- **Dashboard:** GA4 traffic for Today, Yesterday, Last 7 days or Last 30 days.
  - Tiles: active users, new users, sessions, page views and average session.
  - Lists: top pages, devices and top locations.
  - Shortcuts to the blog and the writer.
- **Manage blog** (`/admin/blog`):
  - Tabs: All, Published, Scheduled and Drafts.
  - Search, a category filter and sorting, all kept in the URL.
  - Each row has View or Preview, Edit, Delete and, on scheduled rows, Publish now.
- **Editor:**
  - TipTap text editor: headings, bold, italic, lists, links, quotes and the App Store card.
  - Fields: title, slug, excerpt, category, tags, author, meta title and description (with a Google preview), key takeaways ("In short"), FAQ and sources.
  - Publish box: Save draft, Publish/Update, Publish now, Move to drafts and Delete.
- **Publishing rule:** a post is live when it is scheduled or published and its date has come. The database checks this on every read, so scheduled posts appear on time without a job. Back-dated dates work. Drafts and scheduled posts are 404 for visitors and a preview for you.
- **API:** `/api/admin/*` (see the header of `api/admin.ts`). Every route except login, logout and me checks the admin cookie on the server.

## Article writer (numfall-writer.vercel.app)
1. **Batch input.** On **New batch**, paste up to 50 topics, one per line. Then pick the length, the author (Random by default) and the publish dates:
   - **I post each one myself:** articles stop at Ready and wait for you.
   - **Schedule:** random times in the next N days, 9 am to 9 pm in your time zone (Settings). At most 2 a day, at least 4 hours apart, counting posts already scheduled.
   - **Backdate:** random dates in the last N days, at most 3 on one date. Each article is researched and written as of its own date.
2. **Order and posting.** Articles are written one after another. Batch articles always get one GPTZero scan and one rewrite, then post themselves into their slot.
3. **Background running.** The database calls `https://numfall-writer.vercel.app/api/tick` every minute while articles are waiting. Every 10 minutes it marks due scheduled posts as published.
4. **Publish now** on a scheduled article puts it live at once. "Edit in Blog" opens the post in the numfall.store admin.
5. **Spending.** The **Usage** page lists every paid call and its cost.

## Environment variables
**numfall-site** (Vercel → numfall-site → Settings → Environment Variables):

| Name | What |
|---|---|
| `ADMIN_PASSWORD` | the password for numfall.store/admin (sensitive) |
| `SESSION_SECRET` | optional; signs the admin cookie (changing it signs everyone out) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | the numfall Supabase project |
| `WRITER_DB_SECRET` | opens the secret-checked database functions; only its hash is in the database |
| `GA4_PROPERTY_ID` | the GA4 property number (GA4 → Admin → Property details) |
| `GA4_SERVICE_ACCOUNT_EMAIL` | the service account's email |
| `GA4_SERVICE_ACCOUNT_PRIVATE_KEY` | its private key (from the JSON key file; `\n` in the text is fine) |

**numfall-writer** (Vercel → numfall-writer → Settings → Environment Variables):

| Name | What |
|---|---|
| `APP_ROLE` | `writer` (set) |
| `ADMIN_PASSWORD`, `SESSION_SECRET` | the writer's own login |
| `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GPTZERO_API_KEY` | the AI and checker services |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WRITER_DB_SECRET` | same values as numfall-site |
| `TICK_SECRET` | lets the database's pg_cron call `/api/tick`; the same value is in `writer_private.config.tick_secret` |

Redeploy after changing a variable.

## Development
```sh
npm ci
npm test        # unit tests, the full writer flow and the admin API against fakes
npm run build   # typecheck, lint, tests, site, admin page (what Vercel runs; APP_ROLE=writer builds the writer)
```
Code:
- `admin/ui`: the numfall.store admin (dashboard, `ContentAdminList`, TipTap editor).
- `writer/server/admin`: admin API logic (post checks, GA4).
- `writer/shared`: pure logic: clean-up, humanizer guards, slips, scheduling, links, HTML.
- `writer/server`: the writer pipeline and API clients.
- `writer/site`: the blog pages.
- `writer/ui`: the writer's screens.
- `api/`: Vercel functions (`admin`, `page`, `og` for the site; `writer`, `tick` for the writer).
- `supabase/`: the SQL.

The findings and changes log is in `docs/AUDIT.md`.

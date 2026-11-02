# NumFall Writer and blog: audit log

Every finding and change, newest first.

## 2026-11-02: first build

### Findings before building
- numfall.store is a static site built by `tools/site/build.js` from `site/src`, on the Vercel project `numfall-site` (Hobby plan), deploying from branch `claude/happy-ride-mm490y`. No database behind it.
- **Vercel Hobby cron jobs run at most once a day.** The 10-minute job and the step runner therefore run from **Supabase pg_cron** (free), which calls `/api/tick`.
- **Name rule clash:** `CLAUDE.md` bans "Sudoku" and any other game or brand name in public text, and the site build fails on it. The brief's topic list includes "Sudoku variants" and "KenKen-style rules". Owner's decision: keep the ban. Articles describe the rule instead, and code removes any sentence that names a banned game, app or brand (list editable in Settings).
- **App facts differing from the brief:**
  - The App Store page (checked 2 November 2026) does not list Apple Vision Pro. Mac needs macOS 14 and Apple silicon. Vision Pro is left out of the facts used in articles, and code removes any article sentence that pairs NumFall with Vision Pro. The existing site footer and `llms.txt` still mention Vision Pro (not changed here).
  - The app has 4 ratings, averaging 5.0. No rating goes in the structured data.
  - Version 1.2 has opt-in Google ad measurement. "No ads, no accounts, no purchases" stays true, but articles never say "no tracking" (removed by code).

### Owner's decisions (2 November 2026)
- Articles live at **numfall.store/blog/<slug>**, with the list at **/blog** (changed from the brief's domain-root URLs).
- A new free Supabase project, **numfall** (us-east-1), holds the articles.
- The writer lives in this repository at **/admin**, behind a password.
- The site deploys from **main**.
- Author list for now: the Scripwise names (editable in Settings).

### What was built
- `supabase/001_numfall_articles.sql` (approved and applied):
  - `public.posts`: visitors can read only live rows (row-level security).
  - Private `writer_private` tables: articles, settings, state and a usage log with costs.
  - `public.writer_api(secret, op, args)`: checks the secret against a SHA-256 hash and is the writer's only door.
  - pg_cron jobs `numfall-tick` (every minute, calls the writer only when an article is waiting) and `numfall-sweep` (every 10 minutes, marks due scheduled posts as published).
- Pipeline (`writer/server/steps.ts`), one stage per call, saved after every stage:
  1. Research: cheap model with web search. Code drops facts with no URL or dated after the article's date.
  2. Plan: sees all existing titles and headings. A code check on title shape triggers one small call for a fresh title. Repeated headings are changed. Slugs are kept unique.
  3. Write: one section at a time, with the better model.
  4. FAQ and meta description.
  5. Humanize: Groq or OpenRouter paraphrase, guarded as described below.
  6. Meaning check.
  7. Clean-up in code: symbols and dashes, plus everything under "Never publish". A sentence that carried an editing note is checked with one web search, then kept, corrected or removed.
  8. Grammar slips.
  9. 2 or 3 internal links, using phrases already in the text.
  10. One GPTZero scan.
  11. One rewrite of flagged sentences, with no second scan.
  12. Publish or schedule.
- **Leases:** an article is claimed for 330 seconds (longer than the 300-second function limit), so two tabs, or a tab and the background job, never pay for the same step.
- **Retry cap:** an article stops after `maxFailures` errors in a row (default 4), with backoff of 1, 3, 10 and 30 minutes.
- **Usage log:** every Claude, Groq/OpenRouter and GPTZero call goes into `writer_private.usage_log` with its cost, including failed calls.
- **Humanizer safeguards:**
  - A daily-limit 429 pauses the humanizer (state `humanizer_paused_until`), and articles carry on without it.
  - A per-minute 429 makes the article wait about a minute.
  - The fact guard keeps the original paragraph if a number or name is lost, the rewrite isn't English, or it carries a translation note.
- **Site (`api/page.ts`, `writer/site/blog.ts`):**
  - `/blog`, with pagination and categories.
  - `/blog/<slug>`, with: byline, app card mid-article and at the end, FAQ, disclosure, health disclaimer, share buttons and 3 related articles.
  - Structured data: Article, FAQPage, BreadcrumbList and MobileApplication (no rating).
  - Smart App Banner and canonical URL.
  - A per-article OG image at `/og/<slug>.png`.
  - Dynamic `sitemap.xml` and `llms.txt`.
  - Scheduled posts return an uncached 404. A signed-in admin sees a preview with the go-live time.
  - Links to articles that aren't live yet render as plain text.
- **Tests:** `tests/shared.test.ts` (11) and `tests/e2e.test.ts` (8) run against fake Claude, Groq, GPTZero, App Store, website and Supabase servers. `npm run build` typechecks everything, runs the tests, then builds the site and admin page. Vercel runs it on every push.

### Known limits (stated, not hidden)
- **Backdated articles:** "written as of its own date" means the prompts give that date and code drops sources dated after it. Web search shows the web as it is today, not as it was on that date.
- **Prices:** the usage log's Haiku 5.5 and Groq prices are estimates in Settings, so check them against your price pages. Sonnet 5.5 uses Scripwise Writer's figure. Web search is $10 per 1,000 searches, and GPTZero is $0.15 per 1,000 words ($45 per 300,000).
- **App fact checks:** the App Store and website checks run at most once a day. They can catch a changed price, age rating, minimum iOS version, a dropped Daily Drop or Sparks mention, and a website that stops saying "no ads, no accounts, no purchases". They cannot read new features into the facts. New facts are added by editing `BASE_APP_FACTS` in `writer/server/prompts.ts`.

## 2026-11-02: first production deploy fix
- **Finding:** on the first production deploy, `/blog`, `/blog/<slug>` and `/sitemap.xml` crashed with "Cannot use import statement outside a module". Vercel compiled the TypeScript functions as ES modules (tsconfig `module: ESNext`), but the repository's package.json is CommonJS. Root `"type": "module"` would break the existing `require()` scripts in `tools/`. The static pages were not affected.
- **Change:** tsconfig now compiles to CommonJS (`module: CommonJS`, `moduleResolution: Node10`). Checked by compiling every function the same way and loading each with plain Node before pushing.

## 2026-11-02: humanizer fallback to OpenRouter's free model
- **Owner's decision:** when the main humanizer provider (Groq) runs out for the day, fall back automatically to OpenRouter's free model instead of skipping the humanizer.
- **Finding:** the old OpenRouter option used `openai/gpt-oss-20b`, which is the paid listing on OpenRouter. The free listing is `openai/gpt-oss-20b:free` (checked on openrouter.ai, 2 November 2026). OpenRouter's free models allow 20 requests a minute and 50 a day, or 1,000 a day after a one-time purchase of $10 in credits (as published in October 2026). One article's humanizer step is roughly 20 to 50 requests.
- **Changes:**
  - Settings now have `humanizer.fallback` (on, OpenRouter, `openai/gpt-oss-20b:free`).
  - Each provider has its own daily pause (`humanizer_paused_until:groq`, `humanizer_paused_until:openrouter`).
  - The humanize step tries the main provider, then the fallback. It skips only when both are out or have no key.
  - OpenRouter calls send `reasoning: { effort, exclude }` (Groq keeps `reasoning_effort`), plus the HTTP-Referer and X-Title headers.
  - Free models are logged at $0.
  - The admin page shows which provider humanized each article and which providers are paused.
- **Tests added:**
  - Groq out for the day: OpenRouter's free model does the work, and its calls are logged at $0.
  - Both providers out: the article carries on without the humanizer, and both are paused.

## 2026-11-02: no Google Analytics on admin pages
- **Owner's request:** no Google Analytics code on any admin page.
- **Finding:** `/admin` (the writer) never had the analytics snippet. The only admin-only page that loaded it was the signed-in preview of a scheduled article, which uses the public layout.
- **Change:** previews are rendered without the consent banner and analytics script. Public pages keep the consent-based analytics as before.
- **Tests:**
  - The preview contains no analytics.
  - A live article still contains the consent-based snippet.
  - The admin page source contains no analytics.

## 2026-11-02: RSS feed and 12-hour search engine submission
- **Owner's request:** an RSS feed, plus llms.txt and the sitemap built and submitted automatically every 12 hours.
- **Findings (checked 2 November 2026):**
  - Google retired its sitemap "ping" endpoint in 2023 (pings return 404). Google reads sitemaps from robots.txt and Search Console instead, so nothing can submit to Google automatically without Search Console API access.
  - IndexNow covers Bing, Yandex, Naver and Seznam. Google does not take part.
- **Changes:**
  - `/blog/rss.xml` (also `/feed.xml`) serves the latest 50 live articles in RSS 2.0. The feed link is in every page's head and in llms.txt.
  - The sitemap, llms.txt and RSS are built from the database on each request (cached for at most 5 minutes), so they are always current and never need a scheduled rebuild.
  - `/api/tick?job=submit` sends new or changed URLs to IndexNow (the first run sends every page). It sends nothing when nothing changed.
  - The IndexNow key is public by design and lives in `site/site.config.json` and `site/src/static/<key>.txt`.
  - The admin page shows the last submission.
- **Test added:**
  - The RSS feed contains the live articles.
  - The first submission sends everything.
  - A second run with no changes sends nothing.
  - A newly live post sends only itself and /blog.

## 2026-11-02: blog manager, text-only theme, links always clickable
- **Owner's requests:**
  - A blog manager with the same options as Scripwise's.
  - A good theme for text-only posts written in bulk.
  - Every link in an article should be a real hyperlink.
- **Finding:** an FAQ answer showed the App Store address as plain text, for two reasons:
  1. The model wrote a bare URL.
  2. FAQ answers were rendered with links stripped.
- **Database (approved):** `supabase/002_blog_manager.sql` adds:
  - a `draft` status;
  - `excerpt`, `meta_title` and `sources` columns;
  - `writer_blog_api`, a secret-checked function to list, get, save (by id, including hand-written posts), delete and post articles.
  
  Visitor access is unchanged.
- **Admin Blog tab:**
  - **List:** status tabs with counts, search, category filter, sort, "next goes live", and View/Preview, Edit and Delete on each post.
  - **Editor:**
    - formatting toolbar: paragraph, H2, H3, bold, italic, underline, strikethrough, lists, quote, divider, link, undo/redo, HTML view;
    - excerpt, an FAQ editor and a sources editor;
    - publish controls: draft, publish or update, a future date to schedule, unpublish, delete;
    - author, category and tags;
    - SEO: slug, meta title (counted against 60), meta description (counted against 155) and a Google snippet preview.
  - "Key takeaways" is left out on purpose: the writing rules ban that phrase and summary boxes.
- **Safety:** editor HTML is sanitized on the server. Only text tags and safe links are kept; scripts, event handlers, images and iframes are removed.
- **Links:**
  - The writing rules now ask for markdown links on descriptive words.
  - Code turns any bare address into a link, in the pipeline, at posting and when pages are rendered. Pages already posted are covered too.
  - FAQ answers now render links.
- **Theme (text-only):**
  - Blog list: header band, category pages at `/blog/category/<slug>` (also in the sitemap), a featured latest post, cards with a CSS number-grid mark per post (no images), and numbered pages.
  - Article: header with summary line and author initials, a contents box for 3+ headings, accented H2s, a 720px reading width, a Sources section, and related-article cards.
  - The visible "Updated" date was removed, because it would show on backdated posts. The page's search data still records when a post last changed.
- **Writer:** posts now carry their research sources (one per site, at most 8) and an excerpt.
- **Tests:** 26 passing. New ones cover the blog manager flow, the sanitizer and link fixing.

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

## 2026-11-02: sitemap format
- **Owner's request:** no `<lastmod>`; give every URL `<changefreq>` and `<priority>`, in the same layout as Scripwise's sitemap.

  | Pages | changefreq | priority |
  |---|---|---|
  | Home | weekly | 1.0 |
  | /blog | daily | 0.9 |
  | Category pages | weekly | 0.5 |
  | Articles | monthly | 0.7 |
  | Support | monthly | 0.4 |
  | Press | monthly | 0.3 |
  | Privacy, Terms | yearly | 0.2 |
- **Note:** Google has said it does not use changefreq or priority but does use an accurate lastmod (Search Central blog, June 2023). The IndexNow submission still sends changed pages every 12 hours, whatever the sitemap says.

## 2026-11-02: false "non-English text" block
- **Finding:** a batch article ("Are logic puzzles good for older adults? what studies show") could not be posted. The final check called the English FAQ question "Do crosswords help older adults think better?" non-English. The check scored text by the share of words from a short list of common English words, and a 7-word question can contain none of them.
- **Change:** the check now flags any non-Latin script at once. For Latin-script text it judges word share only on 12+ words, against a fuller list of English function words (threshold 12%), so short headings and questions are never judged that way. Spanish and Hindi-in-Latin paragraphs are still caught.
- **Test added:** the exact question, other short English lines, plus Spanish, Hindi-in-Latin, Chinese and Russian samples.

## 2026-11-02: internal-links step cut off at its token cap
- **Finding:** the batch article "How gravity changes a classic 9x9 number puzzle" failed 3 times at "pick links" with "not valid JSON". The usage log shows exactly 600 output tokens each time, which was the cap, so the answer was cut off. The meaning check was also close to its cap (1,415 of 1,500).
- **Changes:**
  - Output caps raised: links 2,500, fresh title 1,500, meaning check 6,000, verify 4,000, FAQ 4,000, research, plan and rewrite 8,000. Caps only limit; they cost nothing unless used.
  - A JSON answer cut off at the cap is now reported as "cut off at the N-token cap" in the error and the usage log.
  - Internal links are now optional: if picking them fails, the article carries on without them instead of retrying.
- **Test added:** a cut-off links answer is tried once, logged as cut off, and the article finishes without internal links.

## 2026-11-02: share panel and keyword anchors for internal links
- **Share UI:**
  - A "Share this article" panel at the end of each article.
  - A Share button that opens the device's share sheet (shown only where the browser supports it).
  - Buttons for X, Facebook, LinkedIn, Reddit, WhatsApp and email, plus Copy link with a "Copied" confirmation (falls back to a copy prompt).
  - A Share button next to the byline.
  - Shared links carry `utm_source=<network>&utm_medium=social&utm_campaign=share`, so Analytics shows which network brought each visit. The canonical URL stays clean.
  - No third-party scripts.
  - Networks are labelled by name rather than drawn as logos.
- **Internal links:**
  - The link picker is told to use as anchor the words a person would search to find the linked article, judged from its title and tags. Anchors are 2 to 5 words, never generic ("this article", "read more"), each different, and leaving a link out beats a weak one.
  - Code check `goodAnchor`: an anchor must share a meaningful word or grid size with the target's title, tags or slug, and generic anchors are rejected.
- **Tests:** anchor rules, and the share panel's presence on live articles. 30 passing.

## 2026-11-02: cost, and OpenRouter 404 stopping articles
- **Cost finding** (usage log, 17 articles, about $0.33 each):

  | Step | Per article |
  |---|---|
  | GPTZero scan (owner's existing plan, counted at $0.15 per 1,000 words) | ~$0.16 |
  | Research (Haiku with web search) | ~$0.06 |
  | Section writing (Sonnet) | ~$0.045 |
  | Post-scan rewrite (Sonnet) | ~$0.024 |
  | Plan, FAQ, meaning check, links | ~$0.045 |
- **Owner's choice:** of the options offered, use Haiku for the FAQ and the one post-scan rewrite. New settings `models.faq` and `models.rewrite` (default `claude-haiku-5-5`). The article body stays on Sonnet.
- **GPTZero:** one scan per article, confirmed in the log (15 scans for 15 articles). There is no rescan.
- **OpenRouter finding:** once Groq's daily allowance ran out, the fallback `openai/gpt-oss-20b:free` returned 404 on every call, and that error counted as an article failure. A 404 there usually means the account's privacy settings exclude free endpoints whose host may train on prompts (openrouter.ai/settings/privacy). OpenRouter's own message is now shown, so the reason can be confirmed.
- **Change:** a humanizer provider that refuses the request (404, a policy refusal, a bad key) is set aside for an hour with its reason. The article moves to the next provider, or carries on without the humanizer, with no strike and no retry loop. The admin page shows the reason.
- **Tests:** the 404 policy refusal, and which model each step uses. 32 passing.
- **Follow-up (same evening):** OpenRouter's real 404 reason, now shown, was "This model is unavailable for free. The paid version is available now", so the free `gpt-oss-20b` had been withdrawn. My earlier guess about privacy settings was wrong.
- **Owner's choice:** fall back to `openrouter/free` (OpenRouter's free router, which picks any available free model on each call), logged at $0. The fact guard and meaning check still apply to every rewrite.
- **Data changes:** the saved settings were updated to the new fallback, and OpenRouter's one-hour pause was cleared.
- **Pause notes:** these now show the real reason, not always "daily limit".
- **Articles:** four that hit the humanizer error were restarted. They finished without the humanizer, because both providers were out at the time.

## 2026-11-02: game name in an FAQ question blocked posting
- **Finding:** "Daily puzzles easier to stick with when kept small" was stopped by the final check because an FAQ question said "What is a classic Sudoku grid made of?". The clean-up removed banned names from paragraphs and FAQ answers but never checked FAQ questions or section headings. The final check worked as intended: nothing with the name was posted.
- **Change:** the clean-up now:
  - swaps a banned name in a heading for "number grid";
  - drops an FAQ item whose question names a banned game or brand, or rewords it the same way when only 3 questions would be left;
  - applies the same safeguard to the title.
- **Test added.** 33 passing.

## 2026-11-02: error log and scheduled error check
- **Owner's request:** keep a log of errors and fix them without the owner reporting each one.
- **Database (approved):** `supabase/003_error_log.sql` adds `writer_private.error_log` and `writer_errors_api` (secret-checked: add, list, resolve).
- **What gets logged:**
  - every failed article step, with stage and attempt number;
  - articles stopped at the retry cap (`stopped`);
  - final-check blocks (`blocked`);
  - humanizer providers set aside (`warning`);
  - background-run crashes;
  - public page failures.
- **Admin:** a new Errors tab (open or all; mark one or all resolved), and a warning on the Articles page when there are open errors.
- **Scheduled check every 3 hours** (owner's choice: fix and deploy if tests pass). A fresh session:
  1. reads open errors;
  2. restarts stuck articles once the cause is fixed;
  3. fixes code with a test;
  4. deploys only when `npm run build` passes;
  5. records the fix here;
  6. marks the errors resolved with what it did.
  - **Later the same day:** the owner cancelled the 3-hour check once all articles were done.

## 2026-11-02: full website audit (numfall.store)
Checked:
- live pages (home, support, privacy, terms, press, blog, an article, categories, sitemap, robots, llms.txt, RSS);
- every published and scheduled post in the database;
- Supabase security and performance advisors, cron jobs and the error log;
- `npm audit` and a secret scan of the repo and the build;
- Playwright plus axe-core on every page at 390 px (light) and 1280 px (dark).

**Passing:**
- no console errors and no sideways scrolling;
- the sitemap (62 URLs, no lastmod), llms.txt and RSS all list the 51 live articles;
- IndexNow accepted the last submission (202);
- analytics load only after Accept;
- no ratings or download counts claimed;
- row-level security lets visitors read live posts only;
- the three public database functions are secret-checked;
- the admin cookie is HttpOnly, Secure and SameSite=Lax;
- no secrets in the repo or the build.

**Fixed in code:**
- **Critical, game names in Sources lists.** About 30 live articles listed Sudoku, KenKen, Kakuro and Wordle sites as sources (for example "SudokuPro blog", "Wikipedia (Glossary of Sudoku)").
  - Sources whose name or address contains a banned name are now never shown (`safeSources`, applied at render) and are dropped at publish time and in the blog manager.
  - The research prompt now avoids such sources and prefers encyclopedias, universities, journals, government and health bodies, and news outlets.
  - The stored rows were left as they are (owner's choice); the render filter hides them.
- **High, banned names inside longer words.** "Eversudoku" got past the check because names were matched as whole words only. One-word names of 5+ letters now match inside a longer word or address (`nameRe`); short and multi-word names still match as whole words, so a short name added in Settings can't flag ordinary words.
- **Medium, admin login had no limit.** After 5 wrong passwords in 15 minutes from one address, that address waits 15 minutes. Failures are counted in the existing `writer_api` state store, so no schema change; there is an in-memory fallback. Each wrong password also waits 0.8 s.
- **Medium, missing browser security headers.** Added on all paths:
  - Content-Security-Policy: inline scripts allowed only by SHA-256 hash, plus Google Analytics hosts; `frame-ancestors 'none'`; `object-src 'none'`.
  - Strict-Transport-Security: max-age 2 years.
  - Permissions-Policy.
  - X-Frame-Options: DENY.
  - Cross-Origin-Opener-Policy: same-origin.
  - A test now fails the build if any inline script on the article page, blog index, 404 page, consent snippet or static pages is missing from the policy.
  - Checked in Chromium with the headers on: consent banner, Google Analytics loading after Accept, copy-link share button and the admin page all work, with no policy violations.
- **Low, accessibility:**
  - Footer headings no longer skip levels.
  - Static pages are wrapped in a `<main>` landmark.
  - The two App Store boxes in each article have different labels.
  - axe (WCAG 2 A/AA plus best practice) now reports no issues on any public page.
  - The admin login screen itself passes; the earlier flag came from the offline "can't reach server" screen.

**Database (approved):** the live article *offline-puzzle-games-long-flights* (and its writer copy) no longer says "according to the Eversudoku history guide". The sentence now ends "…under the name Number Place." No post title, description, FAQ, tag or body contains a banned name any more.

**New page (approved):** `/about`, built only from the verified app facts. Linked in the footer, sitemap (monthly, 0.5) and llms.txt.

**Owner's decisions (no change):**
- Bylines stay as they are, even though the named authors are personas and the articles carry no AI disclosure. Flagged as a trust risk with Google.
- The privacy policy stays as it is. Not added: that the host (Vercel) processes visitors' IP addresses, and that the blog follows the same consent rules.
- The internal-links step was not re-run. 14 posts (3 live) have no in-text links to other articles; they still show Related articles.

**Accepted risks:**
- **`npm audit`, moderate: satori SVG escaping (GHSA-wx4j-mvgx-mqwp), via @vercel/og 0.8.5.**
  - Version 1.0.3, the only fixed release, ships without `hb.wasm` and cannot draw images on Node.
  - Version 1.0.1 bundles the same old satori code.
  - The issue needs untrusted text in SVG output. Our share images are PNGs drawn from our own post titles, so it can't be exploited here. Re-check when a working fixed release ships.
- **Supabase advisor: pg_net in the public schema.** pg_net can't be moved in place. Moving it means dropping and recreating it, which would break the cron jobs. Left as is.
- **The slug *free-puzzle-games-kids-ipad-no* was cut at the 6-word limit.** Left as is: a live address change would need a redirect.

**Tests:** 36 passing:
- banned names inside words and web addresses;
- hidden game-name sources and separate app-card labels;
- login lockout per address;
- every inline script covered by the CSP.

## 2026-11-03: mobile-first pass (all pages)
**Tested:**
- Pages: home, about, support, privacy, terms, press, 404, blog list, page 2, a category page, an article and the blog 404.
- Sizes: 360×800, 390×844, 430×932, 844×390 (landscape) and 768×1024, in light and dark mode. Run with `tools/site/mobile-check.cjs` (Playwright).
- Lighthouse 12 mobile (slow 4G, 4× CPU) on five page types.

**Found and fixed (CSS only, `site/src/style.css`):**
- **Header nav wrapped to two rows on phones up to 390 px**, making the sticky header 99 px tall (12% of the screen). It's now one 63 px row from 360 px up: tighter link padding and a slightly smaller wordmark. In landscape (height ≤ 500 px) the header no longer sticks, so it doesn't cover a sixth of the screen.
- **Tap targets under 44 px:**
  - wordmark (34 px);
  - footer links (34 px, touching);
  - category chips (40);
  - pager numbers (40) and Newer/Older (27);
  - breadcrumbs (17);
  - cookie buttons (40).
  - All are now at least 44 px. Breadcrumbs keep their look with a larger invisible hit area and wider separators.
  - The footer uses two link columns on phones, so the taller links don't make it longer.
- **Article text was 19-20 px on phones (about 33 characters a line).** It's now 18 px with 1.7 line height (about 35-40 characters), and stays 19 px on larger screens.
- **The homepage's falling-number animation kept running invisibly on phones** (opacity 0). It's now switched off below 820 px. Lighthouse blocking time on home went from 150 ms to 0.
- **The cookie notice is more compact on phones:** 124 px instead of 154 px at 390.
- **iOS landscape text inflation:** text-size-adjust set to 100%.
- **Images, icons and videos** are now cached for 7 days (`vercel.json`).

**Checked and already fine:**
- no sideways scrolling at any size;
- no text under 12 px;
- the viewport allows zoom;
- phone and desktop pages have the same text, headings, links and structured data (nothing important hidden on small screens);
- contents/FAQ links land headings 21 px below the sticky header;
- no autoplaying video (the gameplay videos are download links);
- copy-link and the share sheet work.

**Lighthouse mobile after the fixes:** every page scored 100 in performance, accessibility, best practices and SEO.
- Largest Contentful Paint: 1.1-1.3 s.
- Layout shift: 0.
- Blocking time: 0-30 ms.
- Page weight: 35-68 KB.

## 2026-11-03: "Publish now" for scheduled posts
- **Owner's request:** publish any scheduled post ahead of its date.
- **Where:** a **Publish now** button in three places:
  - each scheduled row in **Blog**;
  - the **Blog** editor of a scheduled post (saves any edits on screen too);
  - the article page in **Articles**.
  - Each asks for confirmation first.
- **What it does** (`publish_now` in `api/writer.ts`, `publishNow` in `writer/server/blog.ts`):
  - the post goes live at once and its publish date becomes now, so the site never shows a future date;
  - the writer article it came from is marked live ("Live on the site (published early)");
  - IndexNow is told straight away (free);
  - the sitemap, RSS and llms.txt pick it up immediately because they are built live;
  - the /blog list can take up to 5 minutes to refresh (CDN cache).
  - Drafts and live posts are refused with a clear message.
  - The editor path also covers moving a scheduled post's date to now or earlier and pressing Update. Before this, its article kept showing "Scheduled".
- **No database change:** it uses the existing secret-checked `post_save` and article lease.
- **Also fixed:**
  - the admin's "Reload" button on its error screen used an inline `onclick`, which the 2 November Content-Security-Policy blocks; it is now a normal listener;
  - the error-log text no longer mentions the 3-hour check (cancelled by the owner);
  - a live article's page says "live since" instead of "goes live";
  - `escapeHtml` tolerates a missing value.
- **Tests:** 38 passing (2 new: Publish now from the list and from the article page, refusals and IndexNow; date moved to now in the editor). The three buttons were also checked end to end in Chromium against the real admin bundle.
- **Deploy note:** the first production build failed on Vercel and production stayed on the previous version. One new test assumed the next scheduled slot is always more than an hour away, which depends on the time of day. It now only checks that the slot is in the future, and passes under UTC, New York, Kolkata and Auckland clocks. The second build is live.

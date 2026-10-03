# Fail-safe review: Dropku (before building the app)

Date: 3 October 2026. Scope: the approved game plan, the 14 screens on the design canvas, the playable prototype logic, the level data, the economy, App Store rules and the technical build.

**How it was tested**
- **Automated:** 24 gameplay tests on Level 12 (`tools/failsafe/game.test.js`), 7 tutorial tests (`tools/failsafe/tutorial.test.js`), and a level validator run on every board (`tools/levelgen/validate.py`).
- **Validator self-check:** it was also fed 4 deliberately broken levels to prove it rejects them.
- **Manual:** a walkthrough of each screen and rule, asking "what happens if…?"

Status key:
- ✅ **Fixed**: changed in the canvas or docs, and tested
- 📐 **Build spec**: can't be shown in a mock-up, so it becomes a rule the iPhone app must follow
- ❓ **Your decision**

Severity:
- **Critical**: breaks the game, loses paid items or blocks App Review
- **High**: an exploit, or a fairness problem players will review-bomb
- **Medium**: friction
- **Low**: polish

---

## Test results

| Suite | Before fixes | After fixes |
|---|---|---|
| Gameplay (Level 12) | 11 / 13 passed: **no time limit**, **Sparks farming via undo** | **24 / 24** (11 new timer tests added) |
| Tutorial (3 lessons) | 7 / 7 | 7 / 7 |
| Level validator (6 boards) | 6 / 6 | 6 / 6 |
| Validator self-check (4 broken levels) | all 4 correctly rejected | all 4 correctly rejected |

---

## A. Rules, timer and fairness

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| A1 | **No time limit.** A level could run forever, and stars referred to a "target time" that didn't end anything. (Found by you.) | High | Hard countdown in seconds per level (table in `GAME_PLAN.md` §2). At 0s: "Time's up!", board locks. Warnings at 30s (amber) and 10s (red). | ✅ |
| A2 | **Sparks farming:** undo then redo a drop that completes a row, and it pays again, forever. | High | Each row, column and box pays once per attempt. | ✅ |
| A3 | Pay forever to keep guessing: unlimited "+1 heart" or "+30s" would let anyone brute-force a level by guessing. | High | Each continue at most **once per attempt**. Retry is always the main, free button. | ✅ time · 📐 hearts |
| A4 | The clock keeps running during a phone call, notification, app switch or screen lock. | High | Pause automatically whenever the app leaves the foreground. Resuming needs a tap. | 📐 |
| A5 | Pausing to think for free. | Medium | The board is hidden or blurred while paused (shown on the Pause screen). The "?" help screen also pauses and hides it. | ✅ design · 📐 |
| A6 | Force-quitting the app to dodge "Time's up" or a lost heart. | High | Save the attempt (board, hearts, seconds left) after every drop and every second. Relaunching restores the same attempt, paused. | 📐 |
| A7 | A drop tapped at 1s lands after the clock hits 0. | Medium | A drop counts if tapped before 0s. The landing animation doesn't eat time. Win is checked before time-up. | ✅ tested |
| A8 | A fat-finger tap on the wrong column costs a heart. | Medium | The drop happens on finger lift, and sliding off cancels it (standard iOS behaviour). Taps during the 0.25s landing animation are ignored. | 📐 |
| A9 | "Wrong" is judged against the stored answer. If a level had 2 solutions, a correct move could be punished. | Critical | The validator requires **exactly one solution** for every level and every daily puzzle. Shipping is blocked otherwise. | ✅ |
| A10 | A gap under a given number can never be filled. | Critical | The validator rejects any gap below a given. This is why "Stones" became "Locks". | ✅ |
| A11 | A level needs guessing because gravity hides the deduction. | High | The validator requires the level to be solvable by logic using only the lowest gap of each column. | ✅ |
| A12 | The hint gives a correct but non-deducible move, which feels like cheating, or wastes 40 Sparks. | Medium | The real solver returns the next *logical* step plus a one-line reason ("Row 2 is only missing a 5"). | 📐 |
| A13 | **Hard timer vs accessibility:** some players can't meet any countdown (dyslexia, motor impairments, anxiety). Apple promotes accessibility, and it shows on the store page. | High | **Relaxed mode** in Settings: no countdown, at most 2 stars, no time bonus. | ❓ (shown in Settings) |
| A14 | The last heart is lost at the same moment as 0s. | Low | The first event wins. A wrong drop is resolved before the clock tick. | 📐 |

## B. Levels and difficulty

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| B1 | Time limits too tight or too loose. | High | The tier table starts it. The validator enforces at least 6s per gap. Beta analytics record *why* each level fails (time vs hearts), and levels with a first-try clear rate under about 50% are re-tuned. | ✅ table · 📐 tuning |
| B2 | Difficulty spikes when the grid grows (Level 11: 4×4 → 6×6; Level 71: 6×6 → 9×9). | Medium | A big time jump at each grid change. The first level of a new size is easy, with a one-screen intro. | ✅ table · 📐 |
| B3 | Queue levels (Chapters 4 and 7) where the given number order can't actually be completed. | Critical | The validator must also simulate the queue. To be added before those chapters are generated. | 📐 |
| B4 | Tilt and Locks rules are not fully defined yet. | Medium | Write exact rules and validator checks before generating Chapters 3 and 6. | 📐 |
| B5 | A 9×9 board on iPhone SE or mini: 9 columns at about 38pt is under Apple's 44pt touch target, and 9 tray tiles don't fit. | High | Full-height column hit areas, a 2-row tray, an enlarged highlight under the finger. Test on the smallest supported iPhone. | 📐 |

## C. Economy (Sparks)

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| C1 | Replaying Level 1 forever to earn skips. | High | Full Sparks only on first clear. Replays pay only for improved stars. | 📐 |
| C2 | Milestone chest gave "free hints", a second currency nothing else used. | Medium | Chest now gives Sparks, a chapter-stars bonus and a cosmetic. | ✅ |
| C3 | Paying to skip a milestone level to grab its chest. | Medium | The chest only opens once the level is actually cleared. | 📐 |
| C4 | Unlimited rewarded ads or Daily Drop replays. | Medium | Ads capped at 3 a day. The Daily Drop pays once a day. | 📐 |
| C5 | Skips too cheap or too expensive. | Medium | Measured: a perfect level is about 52 Sparks, so a skip (400) is about 8 perfect levels. Tune in beta. | ✅ measured |
| C6 | Screens showed numbers that didn't add up (e.g. wallet 384 vs actual earnings). | Low | All screens now use the simulated numbers (+52, wallet 320 → 372). | ✅ |

## D. Purchases and App Store

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| D1 | **Bought Sparks vanish after a reinstall or on a new iPhone.** Apple can't restore consumables. This is a classic 1-star review and refund issue. | Critical | Keep the Sparks wallet in iCloud as a ledger (earned and spent totals), so two devices merge without loss or double-spend. | 📐 |
| D2 | The app is killed mid-purchase, "Ask to Buy" stays pending, or there's a refund. | High | StoreKit 2: listen for transaction updates at every launch, show the pending state, handle revoked purchases. | 📐 |
| D3 | Hard-coded prices that are wrong in other countries. | Medium | Prices always come from StoreKit. The canvas uses [PRICE] placeholders. | ✅ |
| D4 | **Hidden features (Guideline 2.3.1).** A secret "unlock all levels" for reviewers would get the app rejected. | Critical | No hidden unlocks in release builds. Give App Review notes plus a video of later chapters instead. | 📐 |
| D5 | Ads SDKs collect data, so the privacy label is no longer "Data Not Collected", a tracking prompt may be needed, and ad content must match the age rating. | High | Option: launch with **no ads** (Sparks plus purchases only) and add rewarded ads later. | ❓ |
| D6 | "Sudoku" in the app name. Nikoli holds the "Sudoku" trademark in Japan. | Medium | Keep "Sudoku" out of the app name. Use it only in the description [Check with a trademark search]. | 📐 |
| D7 | Pay buttons louder than the free option (manipulative design, especially for under-18s). | Medium | "Start again · free" is always the main button. Paid options are secondary. | ✅ |

## E. Saving and data

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| E1 | A save file is corrupted by a crash or a full disk. | High | Atomic writes, a versioned save format, migration on app updates. Keep a backup copy. | 📐 |
| E2 | Levels re-ordered in an update scramble players' progress. | High | Store progress by permanent level ID, not position. | 📐 |
| E3 | iCloud off or full, or two devices played offline. | Medium | The local save always works. Merging keeps the best of both (highest stars, all cleared levels, Sparks ledger). | 📐 |
| E4 | Changing the phone's clock to cheat the timer, or the daily streak. | Low | The level timer uses the device's uptime clock, which isn't affected by date changes. The daily streak uses the local date with 1 grace day. | 📐 |
| E5 | No internet. | Medium | Everything works offline. 365 days of Daily Drops are bundled and validated. | 📐 |

## F. Accessibility and UX

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| F1 | VoiceOver users can't "see" columns or where a number will land. | High | Each column announces its contents and its landing gap. The 30s, 10s and time's-up warnings are announced. | 📐 |
| F2 | Shakes and flashes bother motion-sensitive players. | Medium | Respect Reduce Motion: fades instead of shakes and flashes. | 📐 |
| F3 | Colour-only signals. | Medium | Digits are always on tiles. Timer warnings include text. | ✅ |
| F4 | The demo didn't mention the timer. | Medium | The demo's step 4 now explains the countdown, stars and Sparks. The tutorial has no timer while learning. | ✅ |

## G. Limits of the canvas prototype (not app bugs)
- Each canvas screen keeps its own state, so Pause → Resume restarts Level 12. The real app keeps one game state.
- The canvas uses tap-number-then-tap-column. Dragging is for the real app.
- The clock doesn't pause when you open the "?" screen on the canvas. The real app does (A4, A5).

---

## Decisions needed from you
1. **Relaxed mode** (A13): approve a no-countdown option for accessibility (at most 2 stars, no time bonus)?
2. **Ads at launch** (D5): launch with no ads (simpler privacy, cleaner review), or with rewarded ads?
3. **Time table** (A1, B1): happy with 60s/75s for 4×4, 150s+ for 6×6 and 360s+ for 9×9 as the starting point?

## Before every release (repeat these)
- `python3 tools/levelgen/validate.py`: every level and daily puzzle passes.
- `node tools/failsafe/game.test.js` and `node tools/failsafe/tutorial.test.js` pass.
- Walk through `docs/APP_STORE_COMPLIANCE.md`.

# Fail-safe review: NumFall (before building the app)

Date: 3 October 2026. Scope: the approved game plan, the 14 screens on the design canvas, the playable prototype logic, the level data, the economy, App Store rules and the technical build.

**How it was tested**
- **Automated:** 26 gameplay tests on Classic Level 12 (`tools/failsafe/game.test.js`), 7 tutorial tests (`tools/failsafe/tutorial.test.js`), engine tests on all 230 levels, Swift rule tests, a real-browser test on 6 screen sizes, and a level validator run on every level (`tools/levelgen/validate.py`).
- **Validator self-check:** it was also fed 4 deliberately broken levels to prove it rejects them.
- **Manual:** a walkthrough of each screen and rule, asking "what happens if…?"

Status key:
- ✅ **Fixed**: changed in the canvas or docs, and tested
- 📐 **Build spec**: can't be shown in a mock-up, so it becomes a rule the iPhone app must follow
- ❓ **Your decision**
- ⏸ **Later**: only applies once purchases are added (not in v1)

Severity:
- **Critical**: breaks the game, loses paid items or blocks App Review
- **High**: an exploit, or a fairness problem players will review-bomb
- **Medium**: friction
- **Low**: polish

---

## Test results

| Suite | Before fixes | After fixes |
|---|---|---|
| Gameplay (Classic Level 12, iPhone) | 11 / 13 passed: **no time limit**, **Sparks farming via undo** | **26 / 26** (timer, time's up and skip tests added) |
| Gameplay (Classic Level 12, iPad landscape) | — | **26 / 26** (same engine, same tests) |
| Tutorial (3 lessons) | 7 / 7 | 7 / 7 |
| Game engine on all 230 levels of the 3 boards (`engine.test.js`) | — | **16 / 16**: every level solvable by following logical hints only, time tables, harder from first chapter to last, timer, hearts, undo, continue, stars, economy |
| Swift rules on Linux (`tools/swift/linux-swift.sh`, Swift 6.0) | — | **37 / 37**: the same rules and all 230 levels, plus saving, iCloud merge, player profile and session history |
| Real browser, iPhone SE to iPad 13" (`web.e2e.js`) | 43 / 49: on small screens the number tray wrapped and buttons went off-screen | **99 / 99**, including the intro (name only), session history, time-up options, the board picker and 9×9 layouts on every device |
| Level validator (all 230 levels + 6 design boards) | 6 / 6 | **236 / 236** |
| Validator self-check (4 broken levels) | all 4 correctly rejected | all 4 correctly rejected |

Updated 3 October 2026 for the three boards (Quick 4×4, Classic 6×6, Master 9×9) and the new time tables.

---

## A. Rules, timer and fairness

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| A1 | **No time limit.** A level could run forever, and stars referred to a "target time" that didn't end anything. (Found by you.) | High | Hard countdown in seconds per level (table in `GAME_PLAN.md` §2). At 0s: "Time's up!", board locks. Warnings at 30s (amber) and 10s (red). | ✅ |
| A2 | **Sparks farming:** undo then redo a drop that completes a row, and it pays again, forever. | High | Each row, column and box pays once per attempt. | ✅ |
| A3 | Pay forever to keep guessing: unlimited continues would let anyone brute-force a level by guessing. | High | No extra time at all (owner's decision: the timer is the challenge). "+1 heart" (60 earned Sparks) at most **once per attempt**. Start again is always the main button. | ✅ time · 📐 hearts |
| A4 | The clock keeps running during a phone call, notification, app switch or screen lock. | High | Pause automatically whenever the app leaves the foreground. Resuming needs a tap. | 📐 |
| A5 | Pausing to think for free. | Medium | The board is hidden or blurred while paused (shown on the Pause screen). The "?" help screen also pauses and hides it. | ✅ design · 📐 |
| A6 | Force-quitting the app to dodge "Time's up" or a lost heart. | High | Save the attempt (board, hearts, seconds left) after every drop and every second. Relaunching restores the same attempt, paused. | 📐 |
| A7 | A drop tapped at 1s lands after the clock hits 0. | Medium | A drop counts if tapped before 0s. The landing animation doesn't eat time. Win is checked before time-up. | ✅ tested |
| A8 | A fat-finger tap on the wrong column costs a heart. | Medium | The drop happens on finger lift, and sliding off cancels it (standard iOS behaviour). Taps during the 0.25s landing animation are ignored. | 📐 |
| A9 | "Wrong" is judged against the stored answer. If a level had 2 solutions, a correct move could be punished. | Critical | The validator requires **exactly one solution** for every level and every daily puzzle. Shipping is blocked otherwise. | ✅ |
| A10 | A gap under a given number can never be filled. | Critical | The validator rejects any gap below a given. This is why "Stones" became "Locks". | ✅ |
| A11 | A level needs guessing because gravity hides the deduction. | High | The validator requires the level to be solvable by logic using only the lowest gap of each column. | ✅ |
| A12 | The hint gives a correct but non-deducible move, which feels like cheating, or wastes 40 Sparks. | Medium | The real solver returns the next *logical* step plus a one-line reason ("Row 2 is only missing a 5"). | 📐 |
| A13 | Hard timer vs accessibility: some players can't meet any countdown. | Medium | **Owner's decision: no untimed mode in v1.** Mitigation: the player picks the board (Quick is short and forgiving), warnings in text and haptics, and the tutorial has no timer. Early limits were tightened on 3 October 2026 after the owner found the levels too easy. Revisit after launch feedback. | ✅ decided |
| A14 | The last heart is lost at the same moment as 0s. | Low | The first event wins. A wrong drop is resolved before the clock tick. | 📐 |

## B. Levels and difficulty

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| B1 | Time limits too tight or too loose. | High | One table per board starts it. The validator enforces at least 4s (Quick), 5s (Classic) or 6s (Master) per gap. Beta analytics record *why* each level fails (time vs hearts), and levels with a first-try clear rate under about 50% are re-tuned. | ✅ table · 📐 tuning |
| B2 | Difficulty spikes when the grid grows. | Medium | Gone: each grid size is now its own board with its own curve, starting easy. The player chooses when to try a bigger grid. | ✅ |
| B3 | Queue levels (Chapters 4 and 7) where the given number order can't actually be completed. | Critical | The validator must also simulate the queue. To be added before those chapters are generated. | 📐 |
| B4 | Tilt and Locks rules are not fully defined yet. | Medium | Write exact rules and validator checks before generating Chapters 3 and 6. | 📐 |
| B5 | A 9×9 board on iPhone SE or mini: 9 columns at about 31–38pt is under Apple's 44pt touch target, and 9 tray tiles don't fit. | High | Full-height column hit areas. The board is sized from its measured space. The tray uses 2 rows on tall phones and 1 row of 9 on short ones. The browser test checks iPhone SE: 9×9 board fits, columns ≥ 30px, number tiles ≥ 32px. Still to do: try it on a real iPhone SE. | ✅ web · 📐 device |
| B6 | Gap ceiling: with bottom-stacked givens, logic alone stops being able to finish a board above about 9 gaps (4×4), 21 (6×6) and 41 (9×9). Random gap placement almost never gave a valid 9×9 board. (Found while generating levels.) | High | The dig-holes generator (`tools/levelgen/dig.py`) removes one cell at a time and keeps only boards logic can finish, so every board is valid by construction. Difficulty also comes from a measured score (fewer moves per step, hidden singles) and the timer. | ✅ |
| B7 | Early levels felt untimed: 6 to 20 seconds per gap. | High | Per-board tables start much lower (Quick 28s, Classic 90s, Master 240s after the 5 Oct 2026 retunes). The validator enforces a minimum of seconds per gap. Tune from "time's up" rates in TestFlight. | ✅ table · 📐 tuning |
| B8 | The name field: empty, very long, emoji, or a paste with line breaks. (The age field was removed on 5 October 2026.) | Medium | One cleaning rule in Swift and JS: trim, collapse spaces, drop control characters, 20 characters, name required. The button stays disabled until the name is valid. Tested in `web.e2e.js` and `NumfallCoreTests`. | ✅ |
| B9 | An old or newer save file fails to load and the player loses everything. | High | Every field of the saved progress decodes with a default, a broken session record is dropped instead of failing the file, and `{}` loads. Tested. | ✅ |
| B10 | "Delete my data" leaves the profile alive in iCloud, so another device brings it back. | Medium | Known: a reset on one device writes an empty save, but another device that still holds the profile merges it back (the same as stars). A reset marker is needed before launch. | 📐 |
| B11 | Session history grows without limit. | Low | Only the newest 300 sessions are kept, on the device and in iCloud (the iCloud key-value store is limited to 1 MB per app). | ✅ |

## C. Economy (Sparks)

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| C1 | Replaying Level 1 forever to earn skips. | High | Full Sparks only on first clear. Replays pay only for improved stars. | 📐 |
| C2 | Milestone chest gave "free hints", a second currency nothing else used. | Medium | Chest now gives Sparks, a chapter-stars bonus and a cosmetic. | ✅ |
| C3 | Paying to skip a milestone level to grab its chest. | Medium | The chest only opens once the level is actually cleared. | 📐 |
| C4 | Daily Drop replayed for Sparks. | Medium | The Daily Drop pays once a day. (No ads in v1, so no ad farming.) | 📐 |
| C5 | Skips too cheap or too expensive. | Medium | Measured: a perfect level is about 52 Sparks, so a skip (400) is about 8 perfect levels. Tune in beta. | ✅ measured |
| C6 | Screens showed numbers that didn't add up (e.g. wallet 384 vs actual earnings). | Low | All screens now use the simulated numbers (+52, wallet 320 → 372). | ✅ |

## D. Purchases and App Store

| # | What can go wrong | Severity | Fix | Status |
|---|---|---|---|---|
| D1 | **Earned Sparks and progress vanish after a reinstall or on a new iPhone/iPad.** Players would lose hours of play. | Critical | Sparks wallet and progress in iCloud, with the wallet stored as a ledger (earned and spent totals) so two devices merge without loss or double-spend. | 📐 |
| D2 | Purchase edge cases (killed mid-purchase, Ask to Buy, refunds). | — | **Not applicable to v1: no In-App Purchases.** Needed when purchases are added: StoreKit 2 transaction listener, pending state, revocations. | ⏸ later |
| D3 | Hard-coded prices that are wrong in other countries. | — | **Not applicable to v1.** Later: prices always from StoreKit. | ⏸ later |
| D4 | **Hidden features (Guideline 2.3.1).** A secret "unlock all levels" for reviewers would get the app rejected. | Critical | No hidden unlocks in release builds. Give App Review notes plus a video of later chapters instead. | 📐 |
| D5 | Ads SDKs collect data and change the privacy label. | — | **Owner's decision: no ads in v1.** No third-party SDKs at all, so the App Privacy label can be "Data Not Collected". | ✅ decided |
| D6 | "Sudoku" in the app name. Nikoli holds the "Sudoku" trademark in Japan. | Medium | Keep "Sudoku" out of the app name. Use it only in the description [Check with a trademark search]. | 📐 |
| D7 | Pay or spend buttons louder than the free option. | Medium | "Start again" is always the main button. Spending Sparks is secondary. No real-money buttons in v1. | ✅ |

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
| F5 | **iPad:** the iPhone layout stretched on a big screen looks cheap. Window sizes change with Split View and iPadOS 26 windowing. | High | Dedicated iPad layouts (screens 15 and 16). The layout switches by available width, not device type, and narrow windows use the iPhone layout. Tile size is computed from the window, up to 96pt. | ✅ design · 📐 |
| F6 | **Mac and Vision Pro** run the iPad app: no touch, so taps become clicks and keyboard input. | Medium | Keyboard support (1–9 picks a number, ← → chooses a column, Return drops) and hover highlight. Or opt out in App Store Connect. | 📐 |
| F7 | Blurry or pixelated graphics on high-resolution screens. | Medium | Everything is vector or drawn in code. Only raster: the 1024 px app icon master (screens 17 and 18). | ✅ |

## G. Limits of the canvas prototype (not app bugs)
- Each canvas screen keeps its own state, so Pause → Resume restarts Level 12. The real app keeps one game state.
- The canvas uses tap-number-then-tap-column. Dragging is for the real app.
- The clock doesn't pause when you open the "?" screen on the canvas. The real app does (A4, A5).

---

## Decisions (resolved 3 October 2026)
1. **Relaxed mode** (A13): **No.** The timer is always on. When time runs out, a pop-up restarts the same level.
2. **Ads at launch** (D5): **No ads in v1**, and **no In-App Purchases in v1** either. Purchases may come in a later version.
3. **Time table** (A1, B1): **Approved** as the starting point.

## Before every release (repeat these)
- `python3 tools/levelgen/validate.py`: every level and daily puzzle passes.
- `node tools/failsafe/game.test.js` and `node tools/failsafe/tutorial.test.js` pass.
- Walk through `docs/APP_STORE_COMPLIANCE.md`.

# Game Plan v2: "Dropku" (working title), Sudoku where numbers fall

Status: **approved 3 October 2026.** Screens designed (canvas "Dropku – Game Screens", 18 screens incl. iPad). v1 decisions recorded in section 11.
**Update 3 October 2026:** after playtesting the web version ("levels feel too easy"), the game now has **three boards to choose from** (Quick 4×4, Classic 6×6, Master 9×9), 230 levels in all, harder levels and tighter clocks. See sections 2 and 7.
Previous concept ("Spill") was scrapped and moved to `docs/archive/`.
Last updated: 3 October 2026.

---

## 1. The brief

**Dropku is Sudoku with gravity.**
- The rule everyone already knows stays the same: every row, column and box must contain each number exactly once.
- The twist: **you never tap a cell.** You choose a number and **drop it into a column**, and it falls to the lowest empty space.
- To get a number high up in a column, you must first fill the cells beneath it, in an order that never breaks the rules.

Sudoku asks *what* goes where. Dropku also asks **in what order**. That ordering is the new layer of challenge, and it makes every level feel like a small strategy puzzle rather than a fill-in exercise.

- **Audience:** 16–30. Also accessible to anyone who has seen a Sudoku.
- **Session length:** under a minute (Quick) to about 5 minutes (Master) per level. The player picks the board.
- **Mental benefit:** logic, planning ahead and working memory, plus mental arithmetic in later chapters (sum clues). We'll describe this honestly as "a workout for logic and planning" and make no medical or "proven brain training" claims, which Apple and advertising rules restrict.

---

## 2. How to play

### The three boards
The player chooses a board on the home screen. **All three are open from the start**, and each is its own path of levels with its own progress, stars and milestone chests.

| Board | Grid | Boxes | Levels | Gaps per level | Clock per level |
|---|---|---|---|---|---|
| **Quick** | 4×4 | 2×2 | 30 | 5 → 9 | 20s → 45s |
| **Classic** (starting choice) | 6×6 | 2×3 | 100 | 12 → 21 | 55s → 150s |
| **Master** | 9×9 | 3×3 | 100 | 28 → 41 | 180s → 275s |

- The tutorial is always on a 4×4 grid. When it ends, the player picks a board. Classic is selected by default.
- Inside a board, levels unlock one after another (or by skipping). Clearing a Quick level never unlocks Classic levels.

### The grid
- **Given numbers** are already fixed in place, shown as grey tiles. Every column is a stack, so givens always sit at the bottom of their column and dropped numbers land on top of them.
- **Locks** (from Chapter 3): some columns start padlocked and open when you complete the box next to them.

### Your move
1. **Pick a number** from the tray at the bottom of the screen. The tray shows how many of each number are left.
2. **Tap a column** (or drag the number onto it). The number falls to the lowest empty cell in that column.
3. A **ghost preview** shows where it will land before you let go.

### The rules
- **Sudoku rule:** each number appears once per row, once per column and once per box.
- **Gravity rule:** numbers always fall as far down as they can. You can't place one in mid-air.

### Win
Fill the whole grid so every row, column and box is correct. You get 1–3 stars:
- ★ cleared
- ★★ cleared with no mistakes
- ★★★ cleared with no mistakes **and** at least 25% of the time still left

### Lose
You have **3 hearts** per level.
- **Wrong drop:** if the number doesn't belong in the gap it lands in, it **cracks and bounces out**, and you lose 1 heart.
  - The game explains why: "There's already a 5 in that row", or "A 5 can't go there: dead end" when the drop is legal but leads to no solution.
  - Players are never left stuck without knowing it.
- **0 hearts → level failed.** Retry is free. There are no lives or waiting timers outside the level.
- **Time's up → level failed.** See the time limit below.

### Time limit (countdown in seconds)
Every level has a hard countdown, shown in seconds (e.g. "85s"). The timer is always on: playing against the clock **is** the game. When it reaches **0s** the board locks and a pop-up says **"Time's up!"**, with:
- **Start Level X again:** a fresh board and the full time. This is the main action.
- **Skip this level · 400 Sparks** (earned Sparks only). The button is always shown, greyed with "Unlocks after 2 tries" until the second failed attempt.
- A one-line **tip**, and **Switch board or level**.

There is no way to buy or earn extra time.

Warnings: the clock turns **amber at 30s** ("30 seconds left") and **red at 10s**, with a soft haptic tick each second. The warnings are text as well as colour.

Each board has its own table. The limit is the same for each block of 5 levels, then rises by 5 seconds. Each move also needs more thinking as you go (fewer obvious moves, more hidden singles):

| Board | Levels 1–5 | Step every 5 levels | Last block | Seconds per gap (first → last level) |
|---|---|---|---|---|
| Quick 4×4 | 20s | +5s | 45s (levels 26–30) | about 4 → 5 |
| Classic 6×6 | 55s | +5s | 150s (levels 96–100) | about 4.6 → 7 |
| Master 9×9 | 180s | +5s | 275s (levels 96–100) | about 6.4 → 6.7 |

The early levels are the tightest on purpose (4 seconds per gap on Quick level 1): they are easy to solve, so the clock is what makes them a race. The validator rejects any level under 3 (Quick), 4 (Classic) or 6 (Master) seconds per gap. The tutorial is the only untimed play.

The first table (60s for the first 4×4 levels, 150s and more for 6×6) left 10–20 seconds per gap, which is why the early levels felt too easy. The new tables give 5–10 seconds per gap. Later levels also need more thinking per move (see section 7).

Fail-safes (details in `docs/FAILSAFE_REVIEW.md`):
- The clock pauses whenever the app leaves the screen, on Pause and on the "?" help screen.
- The board is hidden while paused, so pausing can't buy thinking time.
- A drop tapped before 0s counts.
- The validator rejects any level with fewer than 3 (Quick), 4 (Classic) or 6 (Master) seconds per gap.
- The table is the starting point. Real per-level times are tuned in beta from "time's up" rates.
- No relaxed or untimed mode in v1 (owner's decision).

### Undo
- 3 free undos per level. Extra undos cost points (section 6).

---

## 3. Is it original? An honest check

I checked before choosing:

| Idea | Already exists? |
|---|---|
| Swap numbers to fix a filled grid | **Yes:** Swapoku, Sudoku Swipe |
| Cats or colours instead of numbers | **Yes:** Meowdoku |
| Sum cages, thermometers, arrows | **Yes:** Killer Sudoku and many variant apps (classic puzzle types, free for anyone to use) |
| Falling Sudoku blocks, arcade style | **Partly:** an obscure web game, "Falling Sudoku" (Tetris-style, real-time) |
| **Turn-based level puzzles where you plan the drop order, plus a number queue, board rotation and the dead-end rule** | **Not found on the App Store** |

Game mechanics can't be owned (copyright protects code, art, text and names, not rules). Our protection is an original combination, our own art and code, and a cleared name. "Dropku" still needs a trademark and App Store name search [Check].

---

## 4. What makes it addictive

**The "hit" moments (every 10–30 seconds):**
- **Line clear:** finishing a row, column or box makes it flash, with a rising chime, a haptic thump and Points flying to the counter.
- **Double / Triple:** one drop that completes a row *and* a column *and* a box gives a combo bonus and a bigger celebration.
- **Perfect level:** 3 stars, a confetti burst, and a "Perfect!" streak counter.

**Why players come back:**
- **Visible progress:** each board's map is split into chapters of 10 levels, with a milestone chest at the end of each. Quick has 3 chapters, Classic and Master have 10 each.
- **"One more level":** levels are short, and the next one starts with one tap.
- **Daily Drop:** one puzzle a day, the same for everyone, with a streak, a leaderboard and a spoiler-free share card.
- **Collections:** number skins and board themes unlocked with stars.

**Ethical guardrails:** these are required for Apple and under-18 players, and they protect reviews.
- No fake timers, no loot boxes, and no lives or energy that block play.
- Points can be earned for free. Paying is only ever a shortcut.

---

## 5. Teaching at the start

**30-second animated demo (skippable):**
1. "Sudoku rule: each number once per row, column and box." A 4×4 grid fills itself.
2. "But here, numbers fall." A number drops down a column and lands.
3. "So the order matters." It shows a number that can't reach the top until the cells below are filled.

**First run, before the demo: "Who's playing?"** The player enters a name and an age (5 to 99). They are saved on the device and in the player's own iCloud (never on our servers), the name shows at the top of the home screen, and every level attempt is saved as a session (level, result, time used, date) so the player can review their history. Both can be changed or deleted in Settings. See `docs/APP_STORE_COMPLIANCE.md` section 4.

**Then 3 playable tutorial levels** (called "Tutorial · Level 1 of 3") on a 4×4 grid. Each has one instruction, the right column highlighted, and a hand pointer:
1. **Drop it:** choose a number and tap a column. Only 3 numbers are missing.
2. **Order matters:** the top cell needs a 4, so fill the cells below first.
3. **Mistakes and hearts:** a deliberately tempting wrong drop. It cracks, you lose a heart, and the tutorial explains why.

**Help in every level:**
- a "?" button that replays the demo
- a hint button, which costs points
- a goal line: "Fill the grid. Each number once per row, column and box."

---

## 6. Points ("Sparks"), milestones and skipping

"Sparks" is the working name for the points you earn and spend.

### Earning [Estimate, to be tuned in beta]

| Action | Sparks |
|---|---|
| Clear a level | 10 |
| No mistakes | +10 |
| Time bonus | 1 per 5 seconds left (max 20) |
| Each row, column or box completed | +1 |
| Combo (Double / Triple) | +3 / +8 total |
| Daily Drop completed | +25 (+streak bonus) |
| **Milestone chest** every 10 levels on each board (23 in all) | 150 Sparks (only once the level is actually cleared, not skipped). Cosmetics later |
| First 3-star clear of a chapter | +50 |

Measured in simulation (no mistakes, steady pace): 25–50 Sparks on a 4×4 level, 40–70 on 6×6, 50–90 on 9×9. An average run earns less.
Replaying a level only pays for improving its stars, so easy levels can't be farmed.

### Spending

| Item | Cost |
|---|---|
| Hint (reveals one correct drop) | 40 |
| Extra undo | 15 |
| +1 heart, keep this board (once per attempt) | 60 |
| **Skip level** | **400** (about 8 perfect levels or 12–15 average ones) |

### v1: no ads, no purchases
Version 1 has **no ads and no In-App Purchases**. Every Spark is earned by playing. The goal of v1 is for people to enjoy the game and recommend it.

**Possible later versions** (not in v1, to be decided after launch):
- **Skip now:** a single skip bought with real money.
- **Sparks packs:** for example 500 / 1,500 / 4,000 Sparks.
- **Dropku Complete:** a one-time purchase that unlocks all themes and gives bonus Sparks.
- **Rewarded ads:** watch an ad for Sparks.

Because v1 players will have earned everything by playing, any later purchases must only be optional shortcuts. Levels must never be made harder to push people towards paying.

**Rules we'll follow:**
- The skip button only appears after 2 failed attempts, so skipping stays a safety net rather than the main way to progress.
- Skipped levels show on the map as "skipped", and can be replayed for stars later.

---

## 7. Difficulty curve (three boards, 230 levels)

**Pattern in each chapter of 10 levels, on every board:**
- each normal level is at least as hard as the one before
- a **breather** level at x6 (fewer gaps, easier)
- a **milestone** level at x0: the chapter's hardest, with a chest

**What makes a level harder** (measured by the generator, `tools/levelgen/dig.py`):
- **more gaps**, rising steadily from the first level of a board to the last
- **fewer obvious moves:** at each step, how many gaps can be worked out right now. On hard levels there is often only one
- **hidden singles:** steps where no gap has only one possible number, so you must spot that a number has only one place left in a row, column or box
- **a tighter clock** per gap (section 2)

Difficulty score = Σ(1 / moves available at each step) + 0.15 × gaps + 0.5 × steps that need a hidden single.

**How levels are made:** start from a truly random full grid, then dig gaps from the tops of columns one cell at a time. A gap is kept only if the board can still be finished by logic, playing only the lowest gap of each column. Logic that finishes the board proves there is exactly one solution, and `validate.py` checks that again separately.

**Design finding (3 October 2026):** because every column is a stack (givens sit at the bottom), a board can only have so many gaps before logic alone can't finish it: about **9 on 4×4, 21 on 6×6 and 41 on 9×9**. Removing gaps at random almost never gave a valid 9×9 board (0 of 200 at 42 gaps); digging one cell at a time makes every board valid by construction, about 0.3 seconds each.

**Later, not in this version:** the chapter twists from the original plan (Locks, the Queue, Sum clues, Tilt) can come back as extra boards or special chapters once the core game is tested.

The whole set is generated deterministically (`python3 tools/levelgen/build_levels.py` → `levels/levels.json`, seed 2026) and every level is validated before it ships.

---

## 8. Look and feel
- Clean, modern and tactile, aimed at 16–30 year olds rather than the newspaper-puzzle feel.
- Chunky rounded number tiles with a weighty drop and a soft bounce. Colours are distinct per number, but every tile always shows its digit, which keeps it colour-blind safe.
- Dark and light themes, haptics on every landing, and line-clear sound and light effects.
- It reuses the decisions already made: no sign-up, automatic saving on the device and in iCloud, Pause → Exit to Home, and the App Store compliance checklist.
- **Universal app:** designed iPhone-first, and fully supported on iPad (all orientations, resizable windows). It also runs on Apple silicon Macs and Vision Pro as an iPad app.
- **Always sharp:** everything is drawn as vectors or in code, so it's crisp on every screen. Only the 1024 × 1024 app icon is an image. See `docs/DEVICES_AND_ASSETS.md`.

---

## 9. App Store notes for this design
- **v1 has no In-App Purchases and no ads**, so StoreKit, Restore Purchases, the Paid Apps Agreement and ad privacy disclosures are not needed for v1. When purchases are added later, they must use StoreKit 2 with Restore Purchases.
- Earned Sparks never expire.
- The age rating should stay low. There's no gambling-style mechanic: chests have **fixed** contents, not random ones. If chests ever become random, odds must be shown.
- No "brain training" health claims in the store listing.

---

## 10. Next steps after approval
1. ~~Design the screens on a new canvas.~~ Done (18 screens, including iPad, app icon and device spec).
2. ~~Generate and validate the real level set.~~ Done: 230 levels on three boards.
3. ~~Make a playable web version.~~ Done (`prototype/web`, published as a private link).
4. iPhone/iPad app in SwiftUI (`ios/`). The game rules (`DropkuCore`) now compile and pass their tests on Linux (`tools/swift/linux-swift.sh`). The screens still need their first build in Xcode on a Mac. Then: sound, Game Center and the Daily Drop.

---

## 11. Decisions confirmed at approval
- Working name: **Dropku** (trademark and App Store search still pending).
- 3 hearts per level. A wrong drop costs 1 heart. Retry is always free.
- **Timer always on** (decided after the fail-safe review): every level has a hard countdown in seconds. At 0s, "Time's up!" and the same level starts again. No relaxed mode, no paid or earned extra time.
- **v1: no ads and no In-App Purchases.** Sparks are earned only. Purchases may come in a later version.
- **Universal app:** iPhone first, iPad fully supported, Mac and Vision Pro automatically (as an iPad app).
- ~~Time table approved: 60s/75s for 4×4, 150s and up for 6×6, 360s and up for 9×9, 480s finale.~~ Replaced on 3 October 2026 by one table per board (section 2), after the owner found the levels too easy. [Check] The new tables are a first guess, to be tuned in TestFlight from "time's up" rates.
- **Three boards** (owner's idea, 3 October 2026): Quick 4×4 (30 levels), Classic 6×6 (100) and Master 9×9 (100), all open from the start. 4×4 instead of 3×3, because a 3×3 grid can't hold boxes.
- Reward balance after simulating a full 6×6 level: line +1, Double +3, Triple +8. A perfect level earns about 52 Sparks (measured), so a 400-Spark skip takes about 8 perfect levels.
- Level generator prototype: `tools/levelgen/gen.py`. It builds bottom-stacked levels with a unique solution that can be solved by logic while respecting gravity.
- **Shorter clocks, intro and player profile** (owner's feedback, 4 October 2026): the first levels of each board get much less time (Quick 20s, Classic 55s, Master 180s, +5s every 5 levels) so the player races the clock from the start. First run asks for a name and an age, saved on the device and in the player's own iCloud, with the name shown on the home screen and every attempt kept as a session record. Time's up always shows Skip (locked until the 2nd try), a tip and a way to switch board. The tutorial's steps are called levels. [Check] The age field has no function yet and needs a legal check for young players (see the compliance doc).

# Game Plan v2: "Dropku" (working title), Sudoku where numbers fall

Status: **approved 3 October 2026.** Screens designed (canvas "Dropku – Game Screens", 18 screens incl. iPad). v1 decisions recorded in section 11.
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
- **Session length:** 2–6 minutes per level. Small grids early, 9×9 only at the end.
- **Mental benefit:** logic, planning ahead and working memory, plus mental arithmetic in later chapters (sum clues). We'll describe this honestly as "a workout for logic and planning" and make no medical or "proven brain training" claims, which Apple and advertising rules restrict.

---

## 2. How to play

### The board
- A grid of columns: 4×4 early on, then 6×6, then 9×9 by the end.
- The board is split into **boxes**: 2×2 boxes on a 4×4 grid, 2×3 boxes on a 6×6 grid, 3×3 boxes on a 9×9 grid.
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
Every level has a hard countdown, shown in seconds (e.g. "150s"). The timer is always on: playing against the clock **is** the game. When it reaches **0s** the board locks and a pop-up says **"Time's up!"**, with:
- **Start Level X again:** a fresh board and the full time. This is the main action.
- After 2 failed attempts: **Skip this level · 400 Sparks** (earned Sparks only).
- Back to the map.

There is no way to buy or earn extra time.

Warnings: the clock turns **amber at 30s** ("30 seconds left") and **red at 10s**, with a soft haptic tick each second. The warnings are text as well as colour.

The limit is the same for each block of 5 levels and rises as the grids get bigger and harder:

| Levels | Grid | Time limit | Step |
|---|---|---|---|
| 1–5 | 4×4 | 60s | |
| 6–10 | 4×4 | 75s | +15s |
| 11–15 | 6×6 (first) | 150s | jump for the bigger grid |
| 16–70 | 6×6 | 160s → 260s | +10s every 5 levels |
| 71–75 | 9×9 (first) | 360s | jump for the bigger grid |
| 76–99 | 9×9 | 375s → 435s | +15s every 5 levels |
| 100 | 9×9 finale | 480s | |

Fail-safes (details in `docs/FAILSAFE_REVIEW.md`):
- The clock pauses whenever the app leaves the screen, on Pause and on the "?" help screen.
- The board is hidden while paused, so pausing can't buy thinking time.
- A drop tapped before 0s counts.
- The validator rejects any level with fewer than 6 seconds per gap.
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
- **Visible progress:** a level map in 10 chapters, each with a theme and a milestone chest at the end.
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

**Then 3 playable tutorial levels** on a 4×4 grid. Each has one instruction, the right column highlighted, and a hand pointer:
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
| **Milestone chest** every 10 levels | 100 to 250 Sparks, plus a cosmetic (only once the level is actually cleared, not skipped) |
| First 3-star clear of a chapter | +50 |

Measured in simulation: a perfect 6×6 level earns about 52 Sparks. An average run earns about 25–35.
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

## 7. Difficulty curve (100 levels, 10 chapters)

**Pattern in each chapter:**
- the first level introduces the idea
- difficulty builds
- a **breather** level at x6
- a **milestone** level at x0, with a chest

| Levels | Chapter | Grid | New idea | Time limit |
|---|---|---|---|---|
| 1–10 | First Drops | 4×4 | Drop and gravity. Free choice of number | 60s / 75s |
| 11–20 | Planning | 6×6 | First 6×6 grids, longer drop orders | 150s / 160s |
| 21–30 | Locks | 6×6 | Padlocked columns open when you complete the neighbouring box | 170s / 180s |
| 31–40 | The Queue | 6×6 | Numbers arrive in a fixed order, next 3 shown (Tetris-style) | 190s / 200s |
| 41–50 | Sums | 6×6 | Sum clues on some rows or boxes. Mental arithmetic begins | 210s / 220s |
| 51–60 | Tilt | 6×6 | **Rotate the board** to change the drop direction (limited rotations) | 230s / 240s |
| 61–70 | Blind Queue | 6×6 | Only the next number is shown | 250s / 260s |
| 71–80 | Big Board | 9×9 (partly pre-filled) | Bigger grids, more givens | 360s / 375s |
| 81–90 | Mixed | 9×9 | Locks, sums and tilt combined | 390s / 405s |
| 91–100 | Master | 9×9 | Fewest givens, queue plus tilt. Level 100 is a showcase finale | 420s / 435s, finale 480s |

**Level creation:** a generator builds a valid solution. A solver then confirms:
- the puzzle has exactly one solution
- a legal drop order exists, with the queue order too in queue levels
- a difficulty score, from the number of decision points and dead-end traps

Hand-made levels: tutorials, the first level of each chapter and the milestone levels. The rest are generated, then hand-picked and ordered by difficulty score.

**Design finding from generating the real levels (3 October 2026):** because every column is a stack (givens sit at the bottom), a level can only have so many gaps before it stops having exactly one solution: about **8 on 4×4** and **17 on 6×6**. So difficulty does not come from removing ever more numbers. It comes from:
- **fewer obvious moves per step:** the difficulty score counts how many logical drops are available at each step
- **the timer**
- **the later chapters' extra clues.** Sum clues and locks add information, which allows more gaps.

Levels 1–20 are generated (`tools/levelgen/build_levels.py` → `levels/levels.json`). Each is validated, and they're ordered so each normal level is a small step harder, with an easier breather at x6, the hardest at x0, and an easy first 6×6 level at 11.

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
2. Generate and validate the real level set (chapters 1–2 first, as they use only the core rules).
3. Make a playable web version of those levels to test with friends on iPhone and iPad.
4. Build the iPhone/iPad app in Swift (game engine first, with unit tests, then the screens).

---

## 11. Decisions confirmed at approval
- Working name: **Dropku** (trademark and App Store search still pending).
- 3 hearts per level. A wrong drop costs 1 heart. Retry is always free.
- **Timer always on** (decided after the fail-safe review): every level has a hard countdown in seconds. At 0s, "Time's up!" and the same level starts again. No relaxed mode, no paid or earned extra time.
- **v1: no ads and no In-App Purchases.** Sparks are earned only. Purchases may come in a later version.
- **Universal app:** iPhone first, iPad fully supported, Mac and Vision Pro automatically (as an iPad app).
- **Time table approved:** 60s/75s for 4×4, 150s and up for 6×6, 360s and up for 9×9, 480s finale.
- Reward balance after simulating a full 6×6 level: line +1, Double +3, Triple +8. A perfect level earns about 52 Sparks (measured), so a 400-Spark skip takes about 8 perfect levels.
- Level generator prototype: `tools/levelgen/gen.py`. It builds bottom-stacked levels with a unique solution that can be solved by logic while respecting gravity.

# Game Plan: an original iPhone numbers puzzle (working title: "Spill")

Status: planning only. No code has been written yet.
Last updated: 3 October 2026.

Labels used in this plan:
- **[Verified]**: confirmed in an October 2026 web search. Sources are listed at the end.
- **[Estimate]**: my judgement or typical industry ranges. Check before relying on it.
- **[Check]**: needs a manual check by you, for example by looking at the App Store on your phone.

---

## 0. Uniqueness and legal protection

This is a short summary of how it works, not legal advice.

- **You can't own a game mechanic.** In the US, copyright protects how a game is expressed (code, art, sound, text, level layouts), not the rules or ideas behind it. Patents on game mechanics are rare and expensive. No mechanic can stop others legally, and nobody can stop you using a mechanic either.
- **What can get you into trouble:**
  - using someone else's name or logo (trademark)
  - copying their art, characters, sounds or code
  - copying a game's overall look so closely that it seems like a clone ("trade dress")
  - Apple rejecting the app as a copycat (guideline 4.1)
- **How we stay safe:**
  - every asset is made by us or properly licensed
  - the look is original
  - the name is searched on USPTO (tmsearch.uspto.gov) and the App Store before we commit to it
  - the mechanic is checked against the App Store, which I've done below
- **Mechanic check.** Before choosing a concept I searched for similar games. Several ideas I would have suggested already exist:

| Idea I considered | Existing game I found | Verdict |
|---|---|---|
| Fold paper so stacked numbers add up | **FOLD: Puzzle Game** (App Store) | Taken, dropped |
| Draw a path, running total hits a target | **Number Path**, **Matexo**, **Zip** | Taken, dropped |
| Tap or stamp to reduce all cells to zero | **Zero Fill**, **ZERO+** | Taken, dropped |
| Time-loop ghost repeats your moves | **Loopling**, **Loop Ghost** | Taken, dropped |
| Balance a hanging mobile with weights | **Weighting Game**, **Balance: Number Puzzle** | Taken, dropped |
| Mancala-style "sowing" on a 2D grid, with overflow chain reactions and exact targets | Nothing close found | **Open. This is the recommended concept** |

---

## 1. Market research

### 1.1 The market right now

- Mobile puzzle games earned **about $4.9B in player spending in H1 2026**, which is **44% of casual game revenue** [Verified, AppMagic / PocketGamer.biz].
- **Match-3** still earns the most (**about $2.5B, 51% of puzzle revenue**), but revenue was flat year on year [Verified].
- **Merge** games grew **74% year on year**, led by Gossip Harbor [Verified].
- **Sort, Screw and Block puzzles** are the growth area, with **about $600M IAP revenue in H1 2026**. Sort puzzles more than tripled. More than 2,000 new Block puzzles were released in H1 2026 alone [Verified].
- Match-3, Merge and Blast once made up 75% of puzzle installs. They are now **under 25%** [Verified].
- **What this means for us:**
  - Players are moving to simple, hybrid-casual logic games.
  - Block and Sort puzzles are now very crowded, so a fresh mechanic stands out.

### 1.2 Top 10 puzzle games on the US App Store (October 2026)

This is a mix of the top-grossing and top-free puzzle charts.

Colour notes are **approximate descriptions from store art** [Estimate]. Exact hex codes need a screenshot and an eyedropper tool [Check]. Brief summaries of reviews are [Estimate] from typical review themes. Verify them on the App Store or in AppMagic.

| # | Game (developer) | Core mechanic | Monetisation | Art style and palette | Reviews praise / complain |
|---|---|---|---|---|---|
| 1 | **Royal Match** (Dream Games). #1 grossing, about $1.3B in 2025 [Verified] | Match-3 plus decorating a castle | IAP (coins, boosters, lives), no forced ads | Glossy cartoon royal style. Gold (~#F7C844), royal blue (~#2B5BD7), red accents | Polished, fast, rewarding / later levels become paywalls, lives system |
| 2 | **Gossip Harbor** (Microfun). #2 grossing [Verified] | Merge items plus a story | IAP, energy | Warm illustrated seaside. Teal, coral and cream | Story, cosy feel / energy runs out, slow progress |
| 3 | **Candy Crush Saga** (King). #3 grossing [Verified] | Match-3 | IAP, lives, boosters | Candy pastels. Pink, purple, bright primaries | Nostalgia, huge level count / "pay to pass" levels |
| 4 | **Toon Blast** (Peak). #5 grossing [Verified] | Tap blast on same-colour groups | IAP, lives | Bright cartoon. Primary colours on sky blue | Easy, social teams / difficulty spikes |
| 5 | **Gardenscapes** (Playrix). #6 grossing [Verified] | Match-3 plus garden renovation | IAP, lives, ads | Lush, painterly greens and warm wood | Charming / ads don't match the actual gameplay |
| 6 | **Royal Kingdom** (Dream Games). Growth leader [Verified] | Match-3 plus a kingdom meta-game | IAP | Similar to Royal Match: purple and gold | Polish / same as Royal Match |
| 7 | **Block Blast!** (Hungry Studio). Most downloaded game of 2025 [Verified] | Place blocks to clear lines | Ads plus IAP | Wood or jewel-toned blocks on dark blue (~#1E2A5A) | Relaxing, no levels or pressure / too many ads |
| 8 | **Meowdoku!**. #1 top-free puzzle, 4.81★ [Verified] | Sudoku-style logic with cats | Ads plus IAP [Check] | Cute cat theme [Check palette] | [Check] |
| 9 | **Block Out! – Color Sort Puzzle**. #2 top-free, 4.73★ [Verified] | Colour-block sorting | Ads plus IAP [Check] | Saturated block colours [Check] | [Check] |
| 10 | **Woodoku Blast**. Top 10 free, 4.88★ [Verified] | Block puzzle on a Sudoku-style grid | Ads plus IAP | Warm wood and cream, minimal | Calm, tactile / ads |

**Common design patterns among the leaders [Estimate]:**
- **Very clear game boards**, with a high-contrast board against a soft background.
- **Rounded, chunky shapes** and big touch targets that are easy to hit with a thumb.
- **A satisfying reaction to every move:** particles, a little bounce, a sound, a haptic tick.
- **Short levels** of 1–3 minutes, with a clear "one more" button at the end.
- **Two visual camps:**
  - warm and cosy (wood, gardens, cats)
  - glossy and bright (candy, jewels)
- **Very few are moody, modern or design-led**, which is a gap for 16–30 year olds.

### 1.3 Gaps in the market for 16–30 year olds [Estimate]

1. **Design-led looks are rare.** The top grossers look like they're aimed at age 35+. Young adults respond to the clean, moody style of Monument Valley, Alto's Odyssey and the NYT Games apps.
2. **Players dislike lives and energy timers.** Waiting systems are a common complaint. A puzzle game you can always play has an advantage.
3. **Sharing is fun.** Wordle and NYT Connections showed that a daily puzzle with a spoiler-free result card spreads by word of mouth.
4. **Chain reactions feel great but are rare in logic games.** Players love Block Blast's combos, but logic puzzles rarely deliver that payoff. A *deterministic* chain reaction gives you both thinking and spectacle.
5. **Native iOS polish is uncommon.** Few top games use iOS 26's **Liquid Glass** design, Core Haptics and Game Center well. We can.

### 1.4 Free sources you can check yourself

- **AppMagic** (appmagic.rocks): free top charts with download and revenue estimates. Its free *Casual Games Report H1 2026* is worth reading.
- **Apple's RSS feeds**: rss.marketingtools.apple.com (top 100 per country), plus `itunes.apple.com/us/rss/topgrossingapplications/limit=100/genre=7012/json` (7012 = Puzzle).
- **App Store charts on your iPhone**: open the App Store, go to Games, then Top Charts and Puzzle.
- **Appfigures Top Charts** and **Sensor Tower's free app pages**: rank history.
- **Gamigion** and **Mobidictum**: free trend articles on puzzle subgenres.

---

## 2. Five original game concepts

All five avoid the "taken" mechanics in section 0. The last three still need an App Store search before we pick them [Check]. The scores are my judgement.

### Concept A: **Spill** (Mancala sowing plus chain reactions) ⭐ Recommended
- **Hook:** "Pour one cup and watch the whole board ripple."
- **How a round plays:**
  1. The board is a grid of glass cups. Each cup holds 0–3 glowing droplets.
  2. Swipe a cup in any direction. It empties, dropping **one droplet into each of the next cups** in that direction, like sowing seeds in Mancala.
  3. If a cup reaches **4 droplets, it overflows** and sends one droplet to each of its 4 neighbours. That can set off more overflows: a chain reaction.
  4. Win by making every **target ring** show its exact number at the same time, within a move limit.
- **Why it's different:**
  - Mancala is a one-dimensional, two-player game.
  - Here sowing becomes a 2D solo puzzle with directional swipes, cascading overflows and exact targets.
  - It's fully predictable. There's no luck, so every chain can be planned.
- **How it scales to 100 levels:** grid size, number of targets, move limits, and new tiles: walls, drains, arrows, anti-droplets, portals and fog.
- **Scores:** Novelty 9 · Ease of learning 8 · Depth 9 · "One more try" 9

### Concept B: **Gearwork** (number gears)
- **Hook:** "Every number turns its neighbours."
- **How a round plays:**
  - Numbered gears touch each other.
  - Turning one gear clockwise adds 1 to it and subtracts 1 from every gear touching it, because neighbouring gears turn the opposite way.
  - Get every gear to its target number.
- **Why it's different:** It's a physical, mechanical number puzzle. Ripple effects come from gear direction.
- **How it scales:** gear chains, locked gears, gears of different sizes (×2 effect) and belts.
- **Scores:** Novelty 8 · Ease 7 · Depth 8 · One more 7

### Concept C: **Tidecraft** (raise the land, control the water)
- **Hook:** "Shape the terrain so the water settles at exactly the right depth."
- **How a round plays:**
  - Each cell is a column of land with a height.
  - You raise or lower columns, then water pours from a spring.
  - Win when the water settles at an exact depth in the marked pools.
- **Why it's different:** It's a numbers puzzle built on water flow, not merging or matching.
- **How it scales:** multiple springs, evaporation tiles, dams and limited edits.
- **Scores:** Novelty 8 · Ease 6 · Depth 9 · One more 7. The water simulation is harder to build.

### Concept D: **Prism Count** (light that carries numbers)
- **Hook:** "Split the light to deliver exact numbers."
- **How a round plays:**
  - A beam carries a value. Prisms split it in half, lenses double it and filters subtract.
  - Rotate pieces so that each target receives its exact value.
- **Why it's different:** Laser puzzles exist, but beams that carry arithmetic are rare [Check].
- **How it scales:** more pieces, colour mixing, mirrors and multiple beams.
- **Scores:** Novelty 7 · Ease 7 · Depth 8 · One more 7

### Concept E: **Shift Lock** (numbers that rewrite the rules)
- **Hook:** "Every move changes the rule for the next one."
- **How a round plays:**
  - Tap two neighbouring tiles to combine them under the current rule (+, −, ×, ÷).
  - The result decides the next rule. For example, an even result switches the rule to ×.
  - Finish with one tile showing the target.
- **Why it's different:** The rule itself is part of the puzzle.
- **How it scales:** longer rule cycles and hidden rules you have to work out.
- **Scores:** Novelty 9 · Ease 5 · Depth 9 · One more 6. It's hard to learn and could feel like homework.

### Recommendation: **Concept A, Spill**

- **Learnable in one swipe.** Level 1 is literally "swipe this cup towards that ring".
- **Payoff without luck.** Overflow chains give a Block Blast-style rush, but every one can be planned. That gives both a thinking hook and a spectacle hook.
- **Built for iPhone:**
  - swipes work one-handed in portrait
  - each droplet can have its own haptic tick
  - chains can play as a rising run of musical notes, so a big chain "plays a melody"
- **Easy to verify:** the rules are fully predictable and the state space is small. A computer solver can check every level and work out its par.
- **Shareable:** "Spill #142 💧💧💧 3 moves, 7-cup chain" makes a natural daily share card.
- **Backup choice:** Concept B (Gearwork), if Spill fails the paper prototype test.

---

## 3. Game design document: Spill

### 3.1 Core loop
1. Look at the board and the target rings.
2. Plan a swipe. **Press and hold** to preview faint "ghost droplets" showing where the pour will land, without chain reactions in Hard levels.
3. Release to pour. Droplets fall one by one, overflows burst and chains play out.
4. Repeat until all targets match → **Level complete** screen: 1–3 stars, chain score, then **Next**.
5. Between sessions: daily puzzle, streaks, achievements.

### 3.2 Rules
- **Cups** hold 0–3 droplets. The overflow limit is normally 4. Later levels add cups with a smaller limit.
- **Pour (your move):** swipe a non-empty cup up, down, left or right.
  - The cup empties, and its droplets go one per cup into the following cups in that direction.
  - Droplets that run past the board's edge are lost, unless a wall bounces them back (from level 21).
- **Overflow (from level 11):** any cup that reaches its limit bursts. It drops to 0 and sends 1 droplet to each orthogonal neighbour.
  - Bursts resolve in a fixed order, so results are always the same.
  - Each extra burst in a chain counts towards the **chain score**.
- **Goal types:**
  - **Fill:** every ring shows its exact target at once (the main mode).
  - **Drain:** clear every droplet off the board (variety levels).
  - **Mixed:** fill the rings *and* leave every other cup empty (late game).
- **Win:** goal met within the move limit.
- **Lose:** out of moves.
  - Options: Retry (always free), or use a hint, an extra move or a skip (see section 4).
  - **Undo is unlimited and free.** It removes frustration, and the move counter rolls back.
- **Stars:**
  - ★★★ = solved in par moves (par = the solver's best solution)
  - ★★ = par + 1–2 moves
  - ★ = solved within the move limit

### 3.3 Controls
- **Swipe** from a cup: pour in that direction.
- **Press and hold** a cup, then drag: preview the pour.
- **Two-finger tap**, or the undo button within easy thumb reach: undo.
- All controls fit the lower two-thirds of the screen for one-handed play.

### 3.4 Difficulty curve (levels 1–100)

**Pattern within each block of 10 levels:**
- **x1:** introduces a new mechanic, very easy, taught by doing rather than text
- **x2–x5:** gradual increase
- **x6:** breather, an easy and showy level
- **x7–x9:** harder
- **x0:** "Showcase" level, the hardest in the block. It unlocks a cosmetic reward.

| Levels | New mechanic | Grid | Targets | Move limit (par → limit) | Notes |
|---|---|---|---|---|---|
| 1–10 | Pour (sowing) and Fill goals | 1×4 → 4×4 | 1 → 2 | 1→2 … 3→5 | Levels 1–3 are the tutorial. No overflows yet |
| 11–20 | **Overflow and chain reactions** | 4×4 → 5×5 | 2 → 3 | 2→4 … 4→6 | First "wow" moment at 11. Level 16 is a breather built for a big chain |
| 21–30 | **Walls** (droplets bounce back) and edge loss | 5×5 | 2 → 3 | 3→5 … 5→7 | Drain goal type appears at 25 |
| 31–40 | **Drains** (droplets vanish) and **locked cups** (can't be swiped) | 5×5 → 5×6 | 3 | 3→5 … 6→8 | Blocking and routing problems |
| 41–50 | **Anti-droplets** (dark droplets cancel normal ones) | 5×6 | 3 → 4 | 4→6 … 6→8 | Subtraction enters the game |
| 51–60 | **Arrow cups** (redirect a pour by 90°) | 6×6 | 3 → 4 | 4→6 … 7→9 | Routing becomes spatial |
| 61–70 | **Small cups** (overflow at 2 or 3) | 6×6 | 4 | 5→7 … 7→9 | Chains become dense and tactical |
| 71–80 | **Portals** (paired cups pass droplets between them) | 6×6 → 6×7 | 4 | 5→7 … 8→10 | Long-range combos |
| 81–90 | **Fog** (cup values hidden until a droplet touches them) | 6×7 | 4 → 5 | 6→8 … 8→10 | Deduction and risk |
| 91–100 | Combinations of everything, plus Mixed goals | 7×7 | 5 | 7→9 … 10→12 | Level 100 is a multi-stage final level |

Breathers: 6, 16, 26 … 96. Showcases: 10, 20 … 100.

We'll tune with real data: if more than 40% of players fail a level on their first 3 tries, smooth it out [Estimate threshold].

### 3.5 Onboarding (no walls of text)
- **Level 1:** a single row. One cup holds 2 droplets and a ring two cells away needs 1. A pulsing finger hint shows the swipe. The player wins in one move.
- **Level 2:** two rings and one pour that fills both. This teaches "one per cup".
- **Level 3:** the first wrong-direction trap, plus a hint shown on screen: "Undo is free." This teaches planning and undo.
- Later mechanics each get a 1-sentence tooltip and a demo animation on their first level.

### 3.6 Engagement and retention
- **Stars and the chain score** on every level. Total stars unlock cosmetic droplet "inks" (colour themes).
- **Daily Spill:** one generated puzzle per day, the same for everyone. Keeps a streak counter, with 1 free "streak freeze" a week.
- **Share card,** spoiler-free:
  `Spill #142 · 💧💧💧 3/3 moves · 🔗 chain 7 · 🔥 12-day streak`
- **Game Center:**
  - leaderboards for total stars, Daily Spill moves and longest chain
  - about 30 achievements
- **Hints:** 3 free to start, earn 1 per showcase level, and more by watching rewarded ads or buying them (section 4).
- **Collections:** cosmetic glass and ink sets earned by playing. Never pay-to-win.
- **Post-launch:** new 20-level "chapters" every 6–8 weeks to bring players back.

### 3.7 Level creation: hand-designed plus a generator, verified by a solver
- **Hand-designed:** tutorial levels (1–3), the first level of each block (x1), breathers (x6) and showcases (x0). That's about 30 levels where storytelling matters.
- **Generated:** the other 70.
  1. A level generator writes random boards with the right mechanics for that block.
  2. A **solver** checks every one by trying every possible sequence of moves up to the move limit (breadth-first search). Boards are at most 7×7 with values up to 3, which is small enough to search.
  3. The solver records **par**, the **number of distinct solutions** and the **first-move branching**, which approximates difficulty.
  4. We keep boards with a clear difficulty score and few "lucky" solutions, then hand-pick and order them.
- **Guarantee:** a level only ships if the solver has proved it can be solved within its move limit. The Daily Spill uses the same pipeline, generated ahead of time.

---

## 4. Monetisation strategy

### 4.1 An honest look at "pay to unlock the next level"
- **What's good:** it's simple, players opt in, and it doesn't block anyone who keeps playing.
- **What's weak:**
  - It sells the *absence* of the game. Players who pay to skip see less content and leave sooner.
  - Puzzle fans often take pride in solving things themselves, so few will buy [Estimate].
  - With a single small purchase per level, revenue per player stays low.
  - If levels *feel* designed to push skips, reviews will call it "pay to win".
- **Verdict:** **keep it as one option, not the whole model.** Players who get stuck should be offered something cheaper and more satisfying first: a hint.

### 4.2 How the alternatives compare [Estimate]

| Model | Revenue potential | Player goodwill | Fit for Spill |
|---|---|---|---|
| Pay to skip a level | Low | Medium | Keep as a minor option |
| Hints and extra moves | Medium–High | High (helps without spoiling) | ✅ Main earner |
| Lives / energy timers | High in match-3 | **Low** (most common complaint) | ❌ Avoid |
| Rewarded ads (opt-in) | Medium | High | ✅ Yes |
| Forced ads between levels | Medium | Low | ❌ Avoid, or keep very rare and removable |
| One-time "Unlock everything / Remove ads" | Medium | Very high | ✅ Yes |
| Paid app up front | Low on discoverability | High | ❌ Shrinks downloads |
| Subscription | Possible later | Mixed | ⏳ Later only, e.g. "Spill+" for unlimited daily archive |

### 4.3 Recommended model: free to play, fair, no timers

| Product | What it does | Typical genre price [Estimate] |
|---|---|---|
| Free play | Levels 1–100 unlock by clearing the previous one. No lives, no waiting | Free |
| **Hint packs** (consumable) | A hint shows the next correct pour | 5 hints ≈ $0.99 · 20 ≈ $2.99 · 60 ≈ $6.99 |
| **Skip token** (consumable): your original idea | Skip the current level. Shown only after 3 failed attempts | 1 ≈ $0.99, or 3 hints' worth |
| **Extra moves** (consumable) | +3 moves when you run out | $0.99, or watch 1 rewarded ad |
| **Spill Complete** (one-time purchase) | Removes all ads, 30 hints, all chapters including future ones, exclusive ink | $4.99–$7.99 |
| Rewarded ads (opt-in) | Watch an ad to get 1 hint or +3 moves, up to N times a day | Free for the player |
| Cosmetic packs (optional, later) | Glass and ink themes | $1.99–$2.99 |

Rule of thumb: **no forced ads during the first 20 levels**, and if we add forced ads later, never during a level.

### 4.4 App Store rules that apply
- **Guideline 3.1.1:** digital items (hints, skips, unlocks) **must** use Apple In-App Purchase, implemented with StoreKit 2. Apple takes 15–30%. The **Small Business Program** at 15% applies to under $1M a year in revenue.
- **Clear pricing.** No misleading timers, no surprise subscriptions, and a **Restore Purchases** button for non-consumables.
- **Age rating.** Apple's current questionnaire has 4+, 9+, 13+, 16+ and 18+ ratings [Verified in general; check the current form in App Store Connect]. Spill should rate low (likely 4+ or 9+). Your ads must match that rating.
- **Don't choose the Kids category.** It brings strict limits on ads and tracking that don't fit a 16–30 audience.
- **Under-18 players:** purchases go through Family Sharing "Ask to Buy". Avoid manipulative design such as fake countdown timers or confusing currencies. Some regions (UK, EU) have extra rules about how games treat minors [Check].
- **Privacy:**
  - fill in the App Privacy "nutrition label"
  - show Apple's App Tracking Transparency prompt if the ad network tracks users
  - include a privacy policy URL
- **No loot boxes are planned.** If we ever add one, Apple requires the odds to be shown.

---

## 5. Visual and UX design

### 5.1 Three visual directions (original palettes)

**Option 1: "Glow Glass" ⭐ Recommended**
- **Mood:** calm, premium, nighttime. Glass cups filled with liquid light, which fits iOS 26 Liquid Glass.
- **Palette:**

| Role | Hex |
|---|---|
| Background | `#0E1020` |
| Surface | `#1A1D33` |
| Glass edge | `#FFFFFF` at 18% opacity |
| Droplet | `#5CE1E6` (aqua) |
| Anti-droplet | `#7A5CFF` (violet) |
| Target ring | `#FFC857` (amber) |
| Success | `#9BF6A1` |
| Accent / CTA | `#FF7AB6` |
| Text | `#F4F6FF` |
| Muted text | `#9AA0C3` |

- **Light mode:** background `#F3F5FC`, surface `#FFFFFF`, droplet `#0BA5B0`, ring `#D98A00`, text `#121530`.
- **Typography:** SF Pro Rounded for numbers and headings, SF Pro Text for body text. Both are free on Apple platforms and support Dynamic Type.
- **Animation:**
  - droplets arc and splash
  - overflowing cups wobble, then burst with a soft ring wave
  - big chains briefly brighten the background
- **Haptics and sound:**
  - a light tick for each droplet
  - a stronger tap on overflow
  - every step in a chain rises one note in a pentatonic scale, so chains always sound musical

**Option 2: "Night Garden."** Seeds are sown in glowing soil, a nod to Mancala's origins.
- Background `#0B1A14`, soil `#1F3B2D`, seed `#F2D06B`, bloom `#E86A92`, leaf `#7FD99A`, text `#EDF5EE`.
- Cosier, nature-themed. Fits the "calm" trend.

**Option 3: "Paper & Ink."** Minimal, light, editorial, close to the NYT Games feel.
- Background `#F6F1E7`, ink `#1E2A3A`, accent `#E4572E`, secondary `#2E86AB`, highlight `#F3A712`.
- Clean and very shareable, but less of a spectacle.

**Why Glow Glass:**
- It looks the least like any top-10 game.
- Dark-first designs suit 16–30 year olds playing at night or on commutes.
- It makes chain reactions the visual star.
- It lines up with Apple's current design language, which helps the app feel native and has a better chance of being featured.

### 5.2 Screen list

| Screen | Purpose | Layout notes |
|---|---|---|
| Splash / launch | Brand moment, under 1 second | Logo droplet falls into a cup |
| Home | Continue, Daily Spill, Collection, Settings | Big "Continue · Level 37" button in the thumb zone. Daily Spill card with streak flame |
| Level map | Pick a level and see progress | Vertical winding path of glass cups, 10 per chapter. Stars under each cup. Locked cups frosted |
| Gameplay | Play | Top: level number, move counter, target summary. Middle: board, centred. Bottom bar: Undo · Hint · Restart. Pause in top corner |
| Pause | Resume, Restart, Settings, Home | Liquid Glass sheet over a blurred board |
| Level complete | Reward and keep the momentum | Star fill animation, chain score, share button, big **Next** |
| Level failed | Low-friction recovery | "Out of moves". Buttons: Retry (main) · +3 moves (ad or $) · Hint. Skip appears only after 3 fails |
| Store | Hints, Skip, Spill Complete, cosmetics | Clear prices, Restore Purchases, no fake "limited time" pressure |
| Daily Spill | Daily puzzle and share card | Calendar strip, streak, countdown to the next puzzle |
| Collection | Inks and glass themes | Grid of swatches with unlock conditions |
| Settings | Sound, music, haptics, colour-blind mode, reduced motion, iCloud sync, privacy, credits | Standard iOS grouped list |

### 5.3 iOS specifics
- **Safe areas:** keep the board clear of the Dynamic Island and the home indicator.
- **Dynamic Type:** menus scale with the player's text size. In-cup numbers scale within the cup.
- **Dark and light mode:** both palettes above. Dark is the default.
- **Haptics** with Core Haptics, which players can turn off.
- **Reduce Motion:** swap particle bursts for fades.
- **Accessibility:**
  - colour is never the only signal: numbers are always shown and anti-droplets have a distinct shape
  - colour-blind-safe palette mode
  - VoiceOver labels such as "Cup row 2 column 3, 2 droplets, target 3"
  - an alternative tap-to-select-then-tap-direction control for players who can't swipe

### 5.4 App icon and App Store screenshots
- **Icon:** a single glass cup on a deep navy background (`#0E1020`), with an aqua droplet mid-fall and a faint amber ring. Readable at small sizes. Provide light, dark and tinted iOS icon variants.
- **Screenshots (6), each with a short caption:**
  1. "One swipe. A whole board of chain reactions." (a big chain mid-burst)
  2. "100 handcrafted levels"
  3. "No lives. No waiting. Ever."
  4. "Daily Spill: share your streak"
  5. "Easy to learn, hard to master" (a late-game board)
  6. "Feel every drop" (a haptics and sound callout)
- **App preview video:** a 15–20 second clip of 3 levels, ending on a big chain.

---

## 6. Technical plan (high level, no code)

### 6.1 Stack
- **Swift and SwiftUI** for the app shell: menus, map, store, settings. This gives native Liquid Glass, Dynamic Type and accessibility for free.
- **SpriteKit**, embedded in SwiftUI, for the game board: droplet physics-style animation, particles and smooth 60/120 fps.
- **Why not Unity:**
  - a bigger app
  - weaker native iOS UI
  - an extra engine to learn
  - we only target iPhone at launch
- Swift also gives the most direct access to StoreKit 2, Game Center and Core Haptics.

### 6.2 Key systems
- **Level format:** one JSON file per level, containing:
  - grid size
  - cups (value, type, overflow limit)
  - walls, drains, arrows, portals
  - goal type and targets
  - par, move limit
  - solver stats (difficulty)
- **Game engine:** a pure, predictable model of board → move → new board, kept separate from rendering. The app and the solver share the same rules code, so they never disagree.
- **Solver and generator:** offline tools run on the Mac. They are not shipped in the app.
- **Saving progress:**
  - locally on the device (SwiftData or a small file)
  - synced through iCloud (CloudKit or iCloud key-value store), so progress survives a new phone
- **Purchases:** StoreKit 2, plus a StoreKit configuration file for local testing.
- **Game Center:** leaderboards and achievements.
- **Analytics:** privacy-friendly tracking of level start, win, fail, hint used and purchases. TelemetryDeck is light and privacy-first. Firebase is an alternative.
- **Ads:** one network, rewarded ads only at first. AppLovin MAX or Google AdMob. Add an ATT prompt only if needed.
- **Daily Spill:** puzzles generated in advance and bundled in the app, with optional updates from a small JSON file you host.

### 6.3 Tools and accounts
- **A Mac** (Apple silicon) with **Xcode 26**. This is required: you can't build iOS apps on Windows or Linux.
- **An iPhone** for testing haptics and feel.
- **Apple Developer Program:** $99 a year, needed for TestFlight and the App Store.
- **App Store Connect:** IAP products, TestFlight, listing.
- **Figma** (free tier): screen mockups.
- **Sound:** made in GarageBand, or licensed sound effects with proof of licence.
- **GitHub:** this repo, for version control.
- **A privacy policy page:** a free GitHub Pages site works.

---

## 7. Roadmap

Estimates assume a **solo developer working part-time (~15–20 h a week) with Claude**. They are [Estimate] and will change with your experience level.

| Phase | Output | Duration |
|---|---|---|
| 0. Paper / web prototype | Test the mechanic with 5–10 people aged 16–30, using a quick browser prototype or paper cups and tokens. Pass condition: testers ask "one more?" | 1 week |
| 1. Grey-box iPhone prototype | Rules engine, swipe input, overflow chains, 10 rough levels, no art | 2–3 weeks |
| 2. Solver and generator | Offline solver, par calculation, difficulty scoring, first 30 verified levels | 2 weeks |
| 3. MVP (levels 1–20) | Glow Glass art, sound, haptics, home, map, complete and fail screens, saving | 4–6 weeks |
| 4. TestFlight beta | 20–50 testers. Track fail rates per level, session length and day-1 / day-7 return rates | 3–4 weeks (in parallel with phase 5) |
| 5. Full game | Levels 21–100, all mechanics, StoreKit 2 store, rewarded ads, Game Center, Daily Spill, iCloud, accessibility | 6–8 weeks |
| 6. Launch | Icon, screenshots, preview video, store text, privacy label, App Review (usually 1–3 days) | 2 weeks |
| 7. Post-launch | Fix bugs, balance hard levels, 20-level chapters every 6–8 weeks, optional seasonal events | Ongoing |

**Total to launch: roughly 4–6 months part-time.**

### Top risks and how to test them early

| Risk | Early test | Fallback |
|---|---|---|
| The mechanic isn't fun | Phase 0 prototype with target-age players before building on iPhone | Move to Concept B (Gearwork) |
| Chains feel random or confusing | Hold-to-preview, slow-motion first chains, a clear burst order | Limit chains in early levels |
| Difficulty spikes or walls | Solver difficulty scores plus beta fail-rate data per level | Re-order levels, loosen move limits |
| Monetisation earns too little | Beta purchase-intent survey, then a soft launch in one smaller country first | Change hint pricing, add cosmetic packs |
| Name or trademark clash | USPTO and App Store search before branding | Shortlist: Spill, Brim, Pourline, Overflow Cups, Drip Logic [Check all] |
| A copycat after launch | Ship polish and the Daily Spill community quickly. Register the trademark once the name is final | Keep releasing content |

---

## 8. Open questions: your decisions

1. **Concept:** go with **Spill**, or prefer one of B–E?
2. **Visual direction:** Glow Glass (recommended), Night Garden, or Paper & Ink?
3. **Name:** happy with "Spill" as a working title, or do you have a name in mind? I'll run the trademark and App Store checks on the shortlist.
4. **Monetisation:** OK with *hints first, skip as an option, plus a one-time "Spill Complete" purchase*, with no lives and no forced ads in the first 20 levels?
5. **Hardware:** do you have a **Mac** and an **iPhone** for development and testing? (Required.)
6. **Experience:** have you built or shipped an app before? This sets how detailed the build steps should be.
7. **Time and budget:** hours per week, and any budget for sound effects, art help or ads?
8. **Prototype first?** Shall I build a **browser prototype** of the mechanic first, so you and a few friends can test the fun before we start on Xcode?
9. **Launch market:** US only, or worldwide (this affects localisation and pricing tiers)?

---

## Sources (searched 3 October 2026)

- AppMagic: *Casual Games Report H1 2026*: https://appmagic.rocks/research/casual-report-H12026/?hl=en
- PocketGamer.biz: *Puzzle accounts for 44% of casual mobile earnings in H1 2026*: https://www.pocketgamer.biz/puzzle-accounts-for-44-of-casual-mobile-earnings-in-h1-2026/
- Gamigion: *New Puzzle Order: The Rise of Sort, Block, and Screw*: https://www.gamigion.com/new-puzzle-order-the-rise-of-sort-block-and-screw/
- Mobidictum: *Sort, block, and screw mechanics are reshaping the puzzle games market*: https://mobidictum.com/sort-block-screw-mechanics-puzzle-games-market/
- Business of Apps: *Top Grossing Games (2026)*: https://www.businessofapps.com/data/top-grossing-games/
- Udonis: *Top Grossing Mobile Games 2026*: https://www.blog.udonis.co/mobile-marketing/mobile-games/top-grossing-mobile-games
- 9to5Mac: *iPhone's most downloaded apps and games of 2025*: https://9to5mac.com/2025/12/10/here-are-iphones-most-downloaded-apps-and-games-of-2025/
- GameDropDaily: *Top Free iPhone Games (Oct 2, 2026)*: https://gamedropdaily.com/mobile/
- App Store listings for the clash check: FOLD: Puzzle Game, Number Path, Matexo, Zero Fill, ZERO+, Loopling, Weighting Game, Balance: Number Puzzle

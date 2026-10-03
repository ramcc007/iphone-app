# Dropku (working title)

Sudoku with gravity: pick a number, drop it into a column, and it falls to the lowest gap. An original puzzle game for iPhone and iPad.

| Where | What |
|---|---|
| `docs/GAME_PLAN.md` | The approved game plan: rules, timer table, Sparks economy, chapters, v1 decisions |
| `docs/FAILSAFE_REVIEW.md` | Fail-safe review: what can go wrong, severity, fix, status |
| `docs/APP_STORE_COMPLIANCE.md` | App Store checklist (v1: free, no ads, no purchases, universal) |
| `docs/DEVICES_AND_ASSETS.md` | iPhone/iPad/Mac layouts, tile sizes, sharpness rules, store assets |
| `design/canvas/` | Snapshot of the design canvas (18 screens, including iPad and app icon) |
| `levels/levels.json` | The generated, validated levels (1–20 so far) |
| `prototype/web/` | Playable web version: tutorial and levels 1–20 (engine + page) |
| `tools/levelgen/` | Level generator, builder and validator |
| `tools/failsafe/` | Automated tests |

## Checks (run before every change)
```sh
python3 tools/levelgen/validate.py          # every level: one solution, reachable gaps, logic-solvable, time per gap
node tools/failsafe/engine.test.js          # game engine on all 20 real levels
node tools/failsafe/game.test.js            # Level 12 prototype logic (iPhone canvas screen)
node tools/failsafe/game.test.js design/canvas/iPadGame.dc.html   # same tests on the iPad screen
node tools/failsafe/tutorial.test.js        # 3 tutorial lessons
NODE_PATH=$(npm root -g) node tools/failsafe/web.e2e.js           # real browser: iPhone SE to iPad 13", needs Playwright
```

Rebuild levels (deterministic): `python3 tools/levelgen/build_levels.py`

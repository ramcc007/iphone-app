# Numfall (working title)

A number puzzle with gravity: pick a number, drop it into a column, and it falls to the lowest gap. An original puzzle game for iPhone and iPad.

| Where | What |
|---|---|
| `docs/GAME_PLAN.md` | The approved game plan: rules, three boards, time tables, Sparks economy, v1 decisions |
| `docs/FAILSAFE_REVIEW.md` | Fail-safe review: what can go wrong, severity, fix, status |
| `docs/APP_STORE_COMPLIANCE.md` | App Store checklist (v1: free, no ads, no purchases, universal) |
| `docs/DEVICES_AND_ASSETS.md` | iPhone/iPad/Mac layouts, tile sizes, sharpness rules, store assets |
| `design/canvas/` | Snapshot of the design canvas (18 screens, including iPad and app icon) |
| `levels/levels.json` | The generated, validated levels: Quick 4×4 (30), Classic 6×6 (100), Master 9×9 (100) |
| `prototype/web/` | Playable web version: tutorial, board picker and all 230 levels (engine + page) |
| `ios/` | The iPhone/iPad app in SwiftUI, with the `NumfallCore` rules package and its unit tests (see `ios/README.md`) |
| `design/icon/` | App icon master (1024 px PNG) and its source |
| `tools/levelgen/` | Level generator (`dig.py`), builder and validator |
| `tools/swift/` | Runs the Swift rule tests on Linux (no Mac needed) |
| `tools/failsafe/` | Automated tests |

## Checks (run before every change)
```sh
python3 tools/levelgen/validate.py          # every level: one solution, reachable gaps, logic-solvable, time per gap
node tools/failsafe/engine.test.js          # game engine on all 230 real levels
node tools/failsafe/game.test.js            # Classic Level 12 prototype logic (iPhone canvas screen)
node tools/failsafe/game.test.js design/canvas/iPadGame.dc.html   # same tests on the iPad screen
node tools/failsafe/tutorial.test.js        # 3 tutorial lessons
NODE_PATH=$(npm root -g) node tools/failsafe/web.e2e.js           # real browser: iPhone SE to iPad 13", needs Playwright
tools/swift/linux-swift.sh                                         # Swift rules on Linux (or: cd ios/NumfallCore && swift test on a Mac)
```

Rebuild levels (deterministic): `python3 tools/levelgen/build_levels.py`

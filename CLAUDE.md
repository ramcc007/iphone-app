# Dropku (working title): project rules for Claude

An original iPhone numbers puzzle game, Sudoku with gravity (see `docs/GAME_PLAN.md`). The earlier "Spill" concept was scrapped (`docs/archive/`).
It **will be published on the Apple App Store**, and a marketing/support website will follow.

## v1 scope (owner's decisions, 3 October 2026)
- **Universal app:** iPhone first, fully supported on iPad (all orientations, resizable windows), and available on Mac/Vision Pro as an iPad app. Layouts adapt to window size. See `docs/DEVICES_AND_ASSETS.md`.
- **High quality on every screen:** vector or code-drawn graphics only (the app icon master is the only raster), crisp at every resolution, 120 Hz animation.
- **No ads and no In-App Purchases in v1.** Sparks are earned by playing only. No third-party SDKs, so the privacy label is "Data Not Collected".
- **Player profile (owner's decision, 4 October 2026):** the first-run screen asks for a name and an age. Both, and the session history, live only on the device and in the player's own iCloud (never a developer server). See `docs/APP_STORE_COMPLIANCE.md` section 4 before changing this.
- **The timer is always on.** At 0s: "Time's up!" and the same level starts again. No untimed mode, no extra time.
- **Three boards, all open from the start:** Quick 4×4 (30 levels), Classic 6×6 (100), Master 9×9 (100). Each has its own time table (`BOARDS` in `tools/levelgen/validate.py`, `engine.js` and `Level.swift` must match).
- Before any change ships: `python3 tools/levelgen/validate.py`, `node tools/failsafe/engine.test.js`, `game.test.js`, `tutorial.test.js` and `web.e2e.js` must pass, and the Swift rule tests (`tools/swift/linux-swift.sh` on Linux, or `swift test` in `ios/DropkuCore` on a Mac).
- The Swift rules (`ios/DropkuCore`) must stay identical to `prototype/web/engine.js`. Change both together, and keep their tests in step.

## Always
- **App Store compliance comes first.** Every design, feature and code change must pass App Review. Check it against `docs/APP_STORE_COMPLIANCE.md` and the current App Review Guidelines (developer.apple.com/app-store/review/guidelines). If a request would break a guideline, say so and propose a compliant alternative before doing it.
- Follow Apple's Human Interface Guidelines: native iOS controls and patterns, safe areas, Dynamic Type, dark mode, VoiceOver, Reduce Motion, 44pt minimum touch targets.
- **Privacy by default:** no accounts, no cross-app tracking, and no personal data beyond the player's own name and age kept on their device and iCloud, unless the owner explicitly decides otherwise. Any new data use must update the privacy policy, the App Privacy label and `PrivacyInfo.xcprivacy`.
- When purchases are added (not in v1), they go through StoreKit 2 (In-App Purchase), with Restore Purchases and clear prices. Never fake urgency or loot boxes without published odds.
- Only original or properly licensed art, sound, fonts and code. Never copy another game's name, look or assets.
- Keep the website in mind: the privacy policy, terms, support page and marketing page must exist at public URLs before submission.
- Flag anything that needs a human decision or legal check rather than guessing.
- Planning documents live in `docs/`.

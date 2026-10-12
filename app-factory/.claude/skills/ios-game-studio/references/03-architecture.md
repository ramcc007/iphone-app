# Phase 3: Architecture (proven on NumFall)

Reference implementation: `https://github.com/ramcc007/iphone-app` (public). Clone it read-only into the scratchpad and copy patterns; adapt names. Key paths are listed per layer.

## Repo layout of every app

```
CLAUDE.md                     app rules (from template/CLAUDE.md.template)
prototype/web/                engine.js (pure rules), index.html (playable prototype), levels/*.json
tools/levelgen/               generator + validate.py (all levels solvable, curve checked)
tools/failsafe/               node tests: engine, game flow, tutorial, web e2e (Playwright)
tools/swift/linux-swift.sh    run Swift package tests on Linux (no Mac)
tools/ci/                     asc_signing.py, screenshots.sh, scenes.txt
tools/appstore/               frame.py + shots.json (store screenshots), header.js, fonts/
tools/site/build.js           static website generator with SEO checks
ios/project.yml               XcodeGen spec (the .xcodeproj is generated, never committed)
ios/<Target>Core/             Swift package: rules, levels, progress, achievements (no UI) + tests
ios/<Target>/                 SwiftUI app
site/                         website source; Vercel builds site/dist
docs/                         plan, compliance, listing, review reply, Game Center setup
design/                       canvas, icon master, Game Center images, App Store header art
.github/workflows/            ios.yml (test, build, screenshots), testflight.yml (sign + upload)
```

## Rules engine twice, kept identical

- `prototype/web/engine.js` and `ios/<Target>Core` implement the same rules with the same tests (same fixtures and expected results). Any rule change edits both plus tests in one commit.
- Levels are JSON produced by `tools/levelgen`, validated by `validate.py`, copied into the Swift package's `Resources/` and loaded by both engines.
- Determinism: seeded random for daily puzzles and level "variants" (shuffle symbols on restart so players solve rather than memorise) - same seed gives the same puzzle on web and iOS.

## Swift app structure (NumFall file → purpose)

| File | Purpose |
|---|---|
| `NumfallApp.swift` | App entry; `.preferredColorScheme`, tint, Dynamic Type cap, `.screenshotChrome()` |
| `AppModel.swift` | `@MainActor ObservableObject`: route, selected mode, `PlayerProgress`, persistence (UserDefaults + `NSUbiquitousKeyValueStore`, merge on external change: keep best per level, union history), Game Center reporting |
| `GameSession.swift` | One level in play: timer, hearts, undo stack, hints, win/lose, haptics/sound triggers |
| `Theme.swift` | Colour/radius/type tokens, tile styles, `AnimatedBackground` (frozen in screenshot mode) |
| `GameCenter.swift` | Optional sign-in (never blocks play), submit leaderboard scores, report achievements, queue while offline |
| `Reminders.swift` | Opt-in local notification for the daily challenge; asked in context; auto-stops after 14 idle days |
| `Sound.swift` | Procedural sounds synthesised with AVAudioEngine (no audio assets to license); `.ambient` session respects silent switch |
| `ScreenshotScene.swift` | Debug-only: `-ScreenshotScene <name>` launch argument opens a demo state with sample progress, plays a few correct moves, `-ScreenshotPick N` pre-selects; hides status bar and home indicator; pre-fills the name on first-run; freezes decorative animation |
| `Views/*` | Welcome, Home, Game, Overlays (win/lose/pause/confetti), Daily, Menus (Settings, legal links, feedback mail) |

Platform rules:
- iOS 17+ deployment target, SwiftUI only, Swift 5 mode, `TARGETED_DEVICE_FAMILY 1,2` (iPhone + iPad).
- No third-party SDKs in v1 (keeps the privacy label at "Data Not Collected" and avoids SDK privacy manifests).
- Persistence: local first, iCloud key-value store second (1 MB limit, small JSON); never a developer server.
- Everything works offline and without Game Center.

## project.yml essentials (template has them)

- `entitlements.properties` lists every entitlement (Game Center, iCloud KVS). Do not rely on a hand-written entitlements file: XcodeGen rewrites it from properties.
- Info: `CFBundleDisplayName`, `LSApplicationCategoryType`, `ITSAppUsesNonExemptEncryption: false`, launch screen colour, iPad orientations (all four), iPhone portrait.
- Release config: manual signing, `CODE_SIGN_IDENTITY: Apple Distribution`, `PROVISIONING_PROFILE_SPECIFIER: $(APP_PROFILE_NAME)` (set by the TestFlight workflow). Debug stays automatic.
- `SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD: YES` only if keyboard/pointer were considered; otherwise opt out in App Store Connect.

## Tests that must pass before any push that ships

1. `python3 tools/levelgen/validate.py`
2. `node tools/failsafe/engine.test.js`, `game.test.js`, `tutorial.test.js`, `web.e2e.js` (Playwright, Chromium preinstalled; phone + iPad widths; min font 11 px; no truncation; links)
3. Swift package tests (Linux script locally, `swift test` on CI)
4. iOS workflow green: simulator build + screenshots

## Screenshot scene contract

Every scene name in `tools/ci/scenes.txt` must be handled in `ScreenshotScene.apply`. A scene must show a real, colourful, mid-game state with sample progress (a placeholder name like "Alex", stars, streak). The CI script launches each scene, waits, and captures; `frame.py` then produces plain and headline versions at all store sizes from `tools/appstore/shots.json`.

# Dropku: iPhone and iPad app (SwiftUI)

**Status:** the game rules package (`DropkuCore`) compiles and passes all its tests with Swift 6.0 on Linux (`tools/swift/linux-swift.sh`). The SwiftUI screens (`Dropku/`) need Apple's SDK, so their first build happens in Xcode on a Mac. They pass a syntax check, but that first build may still surface small type errors to fix. The game rules are a line-by-line port of the web engine, which passes 13 engine tests and 49 real-browser checks, and they come with their own unit tests (below).

## What you need
- A Mac with **Xcode 26** (free from the Mac App Store)
- An **Apple Developer account** for running on a real iPhone/iPad and for iCloud sync ($99/year; a free Apple ID can run it on your own device for 7 days, without iCloud)
- **XcodeGen**, which turns `project.yml` into an Xcode project: `brew install xcodegen`

## Build and run
```sh
cd ios
xcodegen                 # creates Dropku.xcodeproj from project.yml
open Dropku.xcodeproj
```
Then in Xcode:
1. Select the **Dropku** target → **Signing & Capabilities** → choose your Team.
2. Change the bundle identifier from `com.example.dropku` to your own (it must match App Store Connect).
3. Pick an iPhone or iPad simulator and press **Run** (⌘R).

## Run the rule tests
On Linux (fetches Swift 6.0.3 from Ubuntu's package archive once, about 500 MB):
```sh
tools/swift/linux-swift.sh
```
On a Mac:
```sh
cd ios/DropkuCore
swift test               # 37 tests: rules on all 230 levels of the 3 boards, timer, hearts, undo, stars, economy, saving, iCloud merge, player profile, session history, fail-safe loading of old saves
```

## How it's organised
| Folder | What |
|---|---|
| `DropkuCore/` | Swift package with no UI: levels (`Resources/levels.json`), rules (`Game.swift`), hints and scoring, tutorial lessons, Sparks economy, saved progress, the player profile (name) and the session history |
| `Dropku/AppModel.swift` | Loads levels and progress, saves after every change (atomic file plus iCloud key-value sync), navigation (Welcome, tutorial, home, level) |
| `Dropku/GameSession.swift` | One attempt: countdown that pauses in the background, drops, hints, undo, continue, skip, win/lose, and one session-history record per attempt |
| `Dropku/Views/` | Screens: Welcome (name, first launch), gameplay (adaptive iPhone/iPad layout), pop-ups, home with level map, How to play, Settings (Player section, recent sessions) |
| `Dropku/Theme.swift` | Colours, glossy vector tiles, rounded system font, haptics, the drifting-tiles background and pulse effects (all code-drawn, still under Reduce Motion) |
| `Dropku/Resources/` | App icon (1024 px master), colours, privacy manifest |

## Player name and session history (privacy)
- The first launch shows a **Welcome** screen that asks for a name (up to 20 characters). Both can be changed in Settings, Player.
- Every attempt at a real level (not the tutorial) is recorded: board and level, outcome (won, time's up, out of hearts, left early), stars, Sparks, time used and date. The newest 300 are kept; Settings lists the latest 30.
- All of it is saved exactly like the rest of the progress: an atomic file in Application Support on the device, plus the player's **own** iCloud key-value store. There is **no developer server**, so the privacy label stays "Data Not Collected". Do not add any network upload without updating the privacy policy, the App Privacy label and `PrivacyInfo.xcprivacy`.
- "Reset all progress" deletes the name and session history too, and returns to the Welcome screen.
- Saved files are decoded fail-safe: a file from an older or newer version of the app (missing or unknown fields) always loads.

## Before submitting to the App Store
- Replace the placeholder links in `Dropku/Views/MenuViews.swift` (`AppLinks`) with your real privacy, terms and support pages.
- Set your own bundle identifier in `project.yml`.
- Work through `docs/APP_STORE_COMPLIANCE.md`.

## Not in this first version yet
- Sound effects (the web version has them; native sound files or synthesis come next)
- Game Center leaderboards, the Daily Drop and the milestone chest animation
- The chapter twists from the original plan (Locks, Queue, Sums, Tilt) as extra boards or chapters

## Dynamic Type (text size)
- Text uses `.scaledFont(size, weight)` (see `Theme.swift`), which scales every design size with the player's text-size setting in proportion to the nearest system text style. Fonts inside the fixed-size game tiles and number tray keep their size so the board stays usable.
- The whole app follows the system up to the largest Accessibility size (`accessibility3`). The game screen is capped at `xxxLarge` so the board, tray and controls always fit; pop-ups and menus scroll and keep scaling.
- Buttons and capsules use minimum heights, so they grow with the text.
- To test in Xcode: run in the simulator and change Settings > Accessibility > Display & Text Size > Larger Text, or use the Xcode environment overrides, and check every screen at the smallest and largest sizes on an iPhone SE and an iPad. [Check, not yet run on a device.]

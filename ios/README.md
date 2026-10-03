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
swift test               # 25 tests: rules on all 230 levels of the 3 boards, timer, hearts, undo, stars, economy, saving, iCloud merge
```

## How it's organised
| Folder | What |
|---|---|
| `DropkuCore/` | Swift package with no UI: levels (`Resources/levels.json`), rules (`Game.swift`), hints and scoring, tutorial lessons, Sparks economy and saved progress |
| `Dropku/AppModel.swift` | Loads levels and progress, saves after every change (atomic file plus iCloud key-value sync), navigation |
| `Dropku/GameSession.swift` | One attempt: countdown that pauses in the background, drops, hints, undo, continue, skip, win/lose |
| `Dropku/Views/` | Screens: gameplay (adaptive iPhone/iPad layout), pop-ups, home with level map, How to play, Settings |
| `Dropku/Theme.swift` | Colours, glossy vector tiles, rounded system font, haptics |
| `Dropku/Resources/` | App icon (1024 px master), colours, privacy manifest |

## Before submitting to the App Store
- Replace the placeholder links in `Dropku/Views/MenuViews.swift` (`AppLinks`) with your real privacy, terms and support pages.
- Set your own bundle identifier in `project.yml`.
- Work through `docs/APP_STORE_COMPLIANCE.md`.

## Not in this first version yet
- Sound effects (the web version has them; native sound files or synthesis come next)
- Game Center leaderboards, the Daily Drop and the milestone chest animation
- The chapter twists from the original plan (Locks, Queue, Sums, Tilt) as extra boards or chapters

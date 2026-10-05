import Foundation
import NumfallCore

#if DEBUG
/// Test-only helper: lets the CI Mac open the app straight on a given screen with demo progress, so screenshots can be taken
/// with `xcrun simctl launch ... -NumfallScene level-classic`. Compiled only in Debug builds, so it can never ship in the App Store build.
/// Scenes: welcome, tutorial, home-quick|classic|master, level-quick|classic|master. Optional `-NumfallPick 3` picks a number on a level.
@MainActor
enum ScreenshotScene {
    private static func argument(_ key: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: key), args.indices.contains(i + 1) else { return nil }
        return args[i + 1]
    }

    static var pickNumber: Int? { argument("-NumfallPick").flatMap(Int.init) }

    static func apply(to app: AppModel) {
        guard let scene = argument("-NumfallScene") else { return }
        let parts = scene.split(separator: "-").map(String.init)
        let board = parts.count > 1 ? BoardKind(rawValue: parts[1]) : nil
        let levelIndex = 11   // Level 12

        app.update { p in
            p = PlayerProgress()
            guard scene != "welcome" else { return }
            _ = p.setProfile(name: "Alex", now: 0)
            if scene != "tutorial" { p.finishTutorial(device: "screenshots") }
            p.earn(420, device: "screenshots")
            if parts.first == "daily" || parts.first == "home" {
                let today = DayKey(date: Date())
                for back in 1...3 { p.dailyResults[today.adding(days: -back).string] = DailyResult(stars: 3 - back % 2, seconds: 38 + back * 4) }
            }
            for kind in BoardKind.allCases {
                let cleared = (kind == .classic) ? 23 : 8
                for (i, level) in app.levels(kind).enumerated() where i < cleared {
                    p.bestStars[level.id] = [3, 2, 3, 1, 3, 2][i % 6]
                }
            }
        }

        switch parts.first {
        case "welcome": app.route = .welcome
        case "tutorial": app.route = .tutorial(lesson: 0)
        case "daily": app.playDaily()
        case "home":
            if let board { app.selectedBoard = board }
            app.route = .home
        case "level":
            let kind = board ?? .classic
            app.selectedBoard = kind
            app.route = .level(board: kind, index: levelIndex)
        default: break
        }
    }

    /// Called when a game screen appears: optionally picks a number so the ghost tiles show where it would land.
    static func afterGameAppears(_ session: GameSession) {
        guard let value = pickNumber else { return }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 800_000_000)
            session.pick(value)
        }
    }
}
#endif

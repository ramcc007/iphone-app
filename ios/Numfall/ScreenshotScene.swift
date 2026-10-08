import Foundation
import SwiftUI
import NumfallCore

extension View {
    /// Store screenshots show the app without the status bar (time, signal, battery). Debug builds started by CI only;
    /// release builds always keep the system status bar.
    func screenshotChrome() -> some View {
        #if DEBUG
        let shooting = ProcessInfo.processInfo.arguments.contains("-NumfallScene")
        return statusBarHidden(shooting).persistentSystemOverlays(shooting ? .hidden : .automatic)
        #else
        self
        #endif
    }
}

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

    /// Called when a game screen appears: plays a few correct drops so the board shows the colourful player tiles (as in a
    /// real game, not only grey starting numbers), then optionally picks a number so the ghost tiles show where it would land.
    static func afterGameAppears(_ session: GameSession) {
        guard argument("-NumfallScene") != nil, argument("-NumfallScene") != "tutorial" else { return }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 800_000_000)
            let level = session.level
            for _ in 0..<(level.size + 2) {
                // The column with the most gaps next, so the drops spread across the board; never fill the last gap.
                let columns = (0..<level.size).compactMap { c in session.game.landingRow(column: c).map { (c, $0) } }
                let gaps = session.game.grid.joined().filter { $0 == 0 }.count
                guard gaps > level.size, let (column, row) = columns.max(by: { $0.1 < $1.1 }) else { break }
                let value = level.solution[row][column]
                if session.selected != value { session.pick(value) }
                session.drop(column: column)
            }
            session.selected = nil
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            if let value = pickNumber {
                let available = session.game.remaining(value) > 0 ? value : (1...level.size).first { session.game.remaining($0) > 0 }
                if let available { session.pick(available) }
            }
        }
    }
}
#endif

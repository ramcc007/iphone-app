import Foundation
import SwiftUI
import NumfallCore

/// Where the app is: first-run Welcome screen, the tutorial, home (board picker and level map), or playing a level.
enum Route: Hashable {
    case welcome
    case tutorial(lesson: Int)
    case home
    case level(board: BoardKind, index: Int)
}

/// Owns the boards and levels, the player's saved progress and navigation.
@MainActor
final class AppModel: ObservableObject {
    let boards: [Board] = LevelLibrary.bundled()
    @Published private(set) var progress: PlayerProgress
    @Published var route: Route
    /// The board shown on the home screen. A per-device preference, so it is not synced.
    @Published var selectedBoard: BoardKind {
        didSet { UserDefaults.standard.set(selectedBoard.rawValue, forKey: "numfall.board") }
    }

    let deviceID: String
    private let fileURL: URL
    private let cloud = NSUbiquitousKeyValueStore.default
    private let cloudKey = "numfall.progress.v1"

    init() {
        // Local values only until every stored property is set (Swift class initialisation rules).
        let defaults = UserDefaults.standard
        let id = defaults.string(forKey: "numfall.deviceID") ?? UUID().uuidString
        defaults.set(id, forKey: "numfall.deviceID")
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let url = support.appendingPathComponent("progress.json")
        let store = NSUbiquitousKeyValueStore.default

        var loaded = PlayerProgress()
        if let data = try? Data(contentsOf: url), let local = try? JSONDecoder().decode(PlayerProgress.self, from: data) {
            loaded = local
        }
        if let data = store.data(forKey: "numfall.progress.v1"),
           let remote = try? JSONDecoder().decode(PlayerProgress.self, from: data) {
            loaded = loaded.merged(with: remote)
        }

        deviceID = id
        fileURL = url
        progress = loaded
        selectedBoard = defaults.string(forKey: "numfall.board").flatMap(BoardKind.init(rawValue:)) ?? .classic
        route = Self.startRoute(for: loaded)

        NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                               object: store, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.pullFromCloud() }
        }
        store.synchronize()
        #if DEBUG
        ScreenshotScene.apply(to: self)   // CI screenshots only; not compiled into release builds
        #endif
    }

    /// First launch (no profile yet) starts at the Welcome screen; after that the tutorial (once), then home.
    private static func startRoute(for progress: PlayerProgress) -> Route {
        if progress.profile == nil { return .welcome }
        return progress.tutorialDone ? .home : .tutorial(lesson: 0)
    }

    /// Change progress and save it immediately (fail-safe A6: progress is never only in memory).
    func update(_ change: (inout PlayerProgress) -> Void) {
        change(&progress)
        save()
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(progress) else { return }
        try? data.write(to: fileURL, options: [.atomic])   // atomic: a crash mid-write never corrupts the save
        cloud.set(data, forKey: cloudKey)
    }

    private func pullFromCloud() {
        guard let data = cloud.data(forKey: cloudKey),
              let remote = try? JSONDecoder().decode(PlayerProgress.self, from: data) else { return }
        let merged = progress.merged(with: remote)
        if merged != progress {
            progress = merged
            save()
            // Another device of the same player already answered the Welcome questions.
            if route == .welcome, merged.profile != nil { route = Self.startRoute(for: merged) }
        }
    }

    // MARK: - Navigation

    func levels(_ board: BoardKind) -> [Level] {
        boards.first { $0.id == board.rawValue }?.levels ?? []
    }

    func play(_ board: BoardKind, _ index: Int) {
        let list = levels(board)
        guard list.indices.contains(index), progress.isUnlocked(index, in: list) else { return }
        selectedBoard = board
        route = .level(board: board, index: index)
    }

    func goHome() {
        route = .home
    }

    func startTutorial() {
        route = .tutorial(lesson: 0)
    }

    func finishTutorial() {
        update { $0.finishTutorial(device: deviceID) }
    }

    /// Saves the player's name (it must be valid). From the Welcome screen it moves on to the
    /// tutorial (first time) or home; from Settings it only saves. Stays on this device and the player's own iCloud.
    @discardableResult
    func saveProfile(name: String) -> Bool {
        var updated = progress
        guard updated.setProfile(name: name, now: Date().timeIntervalSince1970) else { return false }
        progress = updated
        save()
        if route == .welcome { route = progress.tutorialDone ? .home : .tutorial(lesson: 0) }
        return true
    }

    /// Adds one finished attempt at a real level to the session history.
    func recordSession(levelID: String, startedAt: Double, seconds: Int, outcome: SessionRecord.Outcome, stars: Int, sparks: Int) {
        let record = SessionRecord(levelID: levelID, startedAt: startedAt, seconds: max(0, seconds),
                                   outcome: outcome, stars: stars, sparks: sparks)
        update { $0.record(record) }
    }

    /// Removes everything, including the name and session history, and starts again at Welcome.
    func resetProgress() {
        progress = PlayerProgress()
        save()
        route = .welcome
    }
}

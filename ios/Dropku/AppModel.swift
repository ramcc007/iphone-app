import Foundation
import SwiftUI
import DropkuCore

/// Where the app is: first-run tutorial, home (level map), or playing a level.
enum Route: Hashable {
    case tutorial(lesson: Int)
    case home
    case level(index: Int)
}

/// Owns the levels, the player's saved progress and navigation.
@MainActor
final class AppModel: ObservableObject {
    let levels: [Level] = LevelLibrary.bundled()
    @Published private(set) var progress: PlayerProgress
    @Published var route: Route

    let deviceID: String
    private let fileURL: URL
    private let cloud = NSUbiquitousKeyValueStore.default
    private let cloudKey = "dropku.progress.v1"

    init() {
        // Local values only until every stored property is set (Swift class initialisation rules).
        let defaults = UserDefaults.standard
        let id = defaults.string(forKey: "dropku.deviceID") ?? UUID().uuidString
        defaults.set(id, forKey: "dropku.deviceID")
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let url = support.appendingPathComponent("progress.json")
        let store = NSUbiquitousKeyValueStore.default

        var loaded = PlayerProgress()
        if let data = try? Data(contentsOf: url), let local = try? JSONDecoder().decode(PlayerProgress.self, from: data) {
            loaded = local
        }
        if let data = store.data(forKey: "dropku.progress.v1"),
           let remote = try? JSONDecoder().decode(PlayerProgress.self, from: data) {
            loaded = loaded.merged(with: remote)
        }

        deviceID = id
        fileURL = url
        progress = loaded
        route = loaded.tutorialDone ? .home : .tutorial(lesson: 0)

        NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                               object: store, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.pullFromCloud() }
        }
        store.synchronize()
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
        }
    }

    // MARK: - Navigation

    func play(_ index: Int) {
        guard levels.indices.contains(index), progress.isUnlocked(index, in: levels) else { return }
        route = .level(index: index)
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

    func resetProgress() {
        progress = PlayerProgress()
        save()
        route = .tutorial(lesson: 0)
    }
}

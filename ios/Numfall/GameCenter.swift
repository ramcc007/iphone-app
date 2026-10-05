import GameKit
import UIKit
import NumfallCore

/// Game Center: sign-in, achievements and two leaderboards (total stars, longest Daily Drop streak).
/// Everything is optional: with no Game Center account the app works exactly the same, and nothing is sent anywhere
/// except to Apple's own Game Center. The developer receives no data.
/// The identifiers below must be created in App Store Connect (Services > Game Center) before they show anything.
@MainActor
final class GameCenterService: ObservableObject {
    static let shared = GameCenterService()

    static let starsLeaderboard = "numfall.stars"
    static let streakLeaderboard = "numfall.streak"

    @Published private(set) var signedIn = false

    private var started = false
    private var latest: PlayerProgress?
    private let defaults = UserDefaults.standard
    private let reportedKey = "numfall.gc.reported"
    private let starsKey = "numfall.gc.stars"
    private let streakKey = "numfall.gc.streak"

    /// Starts sign-in. Called once the player has passed the Welcome screen, so no sign-in sheet covers it.
    func start() {
        guard !started else { return }
        started = true
        GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, _ in
            Task { @MainActor in
                if let viewController { Self.present(viewController) }
                self?.signedIn = GKLocalPlayer.local.isAuthenticated
                if let self, self.signedIn, let progress = self.latest { self.sync(progress) }
            }
        }
    }

    /// Reports new achievements and a better score. Cheap to call after every save: it only talks to Game Center when something is new.
    func sync(_ progress: PlayerProgress) {
        latest = progress
        guard signedIn else { return }
        var reported = Set(defaults.stringArray(forKey: reportedKey) ?? [])
        let fresh = Achievement.unlocked(in: progress).filter { !reported.contains($0.id) }
        let stars = progress.totalStars
        let streak = progress.bestDailyStreak
        let starsToSend = stars > defaults.integer(forKey: starsKey) ? stars : nil
        let streakToSend = streak > defaults.integer(forKey: streakKey) ? streak : nil
        guard !fresh.isEmpty || starsToSend != nil || streakToSend != nil else { return }
        Task {
            if !fresh.isEmpty {
                let list = fresh.map { achievement -> GKAchievement in
                    let item = GKAchievement(identifier: achievement.id)
                    item.percentComplete = 100
                    item.showsCompletionBanner = true
                    return item
                }
                if (try? await GKAchievement.report(list)) != nil {
                    reported.formUnion(fresh.map(\.id))
                    defaults.set(Array(reported), forKey: reportedKey)
                }
            }
            if let starsToSend,
               (try? await GKLeaderboard.submitScore(starsToSend, context: 0, player: GKLocalPlayer.local,
                                                    leaderboardIDs: [Self.starsLeaderboard])) != nil {
                defaults.set(starsToSend, forKey: starsKey)
            }
            if let streakToSend,
               (try? await GKLeaderboard.submitScore(streakToSend, context: 0, player: GKLocalPlayer.local,
                                                    leaderboardIDs: [Self.streakLeaderboard])) != nil {
                defaults.set(streakToSend, forKey: streakKey)
            }
        }
    }

    func show(_ state: GKGameCenterViewControllerState) {
        guard signedIn else { return }
        GKAccessPoint.shared.trigger(state: state) {}
    }

    private static func present(_ viewController: UIViewController) {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        top?.present(viewController, animated: true)
    }
}

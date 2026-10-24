import Foundation

/// Decides when to ask for an App Store rating: only right after a happy moment, at most once per app version.
/// Apple's own limit (three prompts a year) still applies on top, and the system may choose not to show it.
enum ReviewPrompt {
    private static let askedVersionKey = "numfall.reviewAskedVersion"
    /// Levels a player must have cleared before the first ask, so they know the game.
    static let minimumLevelsCleared = 6
    /// Daily Drop streak that counts as a happy moment.
    static let minimumStreak = 3

    private static var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
    }

    /// True when this overlay is a good moment and we haven't asked in this version yet.
    static func shouldAsk(after overlay: GameSession.Overlay?, levelsCleared: Int) -> Bool {
        guard !isTakingScreenshots,
              UserDefaults.standard.string(forKey: askedVersionKey) != appVersion else { return false }
        switch overlay {
        case let .won(result, reward)?:
            return !reward.wasReplay && result.stars == 3 && levelsCleared >= minimumLevelsCleared
        case let .dailyWon(_, reward)?:
            return reward.firstClearToday && reward.streak >= minimumStreak
        default:
            return false
        }
    }

    static func markAsked() {
        UserDefaults.standard.set(appVersion, forKey: askedVersionKey)
    }
}

import Foundation

/// Goals that unlock from progress alone (derived, never stored), so they are identical on every device and can be
/// reported to Game Center as often as needed. `id` is the Game Center achievement identifier.
public enum Achievement: String, CaseIterable, Identifiable, Sendable {
    case firstClear, clear10, clear50, clear100
    case threeStars10, masterClear, chest
    case dailyFirst, streak3, streak7

    public var id: String { "numfall.ach.\(rawValue)" }

    public var title: String {
        switch self {
        case .firstClear: "First drop"
        case .clear10: "Getting warm"
        case .clear50: "Half a hundred"
        case .clear100: "Centurion"
        case .threeStars10: "Perfectionist"
        case .masterClear: "Big board"
        case .chest: "Treasure"
        case .dailyFirst: "Daily habit"
        case .streak3: "Three in a row"
        case .streak7: "Week streak"
        }
    }

    public var detail: String {
        switch self {
        case .firstClear: "Clear your first level."
        case .clear10: "Clear 10 levels."
        case .clear50: "Clear 50 levels."
        case .clear100: "Clear 100 levels."
        case .threeStars10: "Earn three stars on 10 levels."
        case .masterClear: "Clear a Master (9\u{00D7}9) level."
        case .chest: "Open a milestone chest."
        case .dailyFirst: "Clear a Daily Drop."
        case .streak3: "Clear the Daily Drop 3 days in a row."
        case .streak7: "Clear the Daily Drop 7 days in a row."
        }
    }

    /// How far along the player is, and the target.
    public func progress(in p: PlayerProgress) -> (current: Int, target: Int) {
        let cleared = p.bestStars.count
        switch self {
        case .firstClear: return (min(cleared, 1), 1)
        case .clear10: return (min(cleared, 10), 10)
        case .clear50: return (min(cleared, 50), 50)
        case .clear100: return (min(cleared, 100), 100)
        case .threeStars10: return (min(p.bestStars.values.filter { $0 >= 3 }.count, 10), 10)
        case .masterClear: return (p.bestStars.keys.contains { $0.hasPrefix("master-") } ? 1 : 0, 1)
        case .chest: return (min(p.chestsOpened.count, 1), 1)
        case .dailyFirst: return (min(p.dailiesCleared, 1), 1)
        case .streak3: return (min(p.bestDailyStreak, 3), 3)
        case .streak7: return (min(p.bestDailyStreak, 7), 7)
        }
    }

    public func isUnlocked(in p: PlayerProgress) -> Bool {
        let value = progress(in: p)
        return value.current >= value.target
    }

    public static func unlocked(in p: PlayerProgress) -> [Achievement] { allCases.filter { $0.isUnlocked(in: p) } }
}

extension PlayerProgress {
    /// Total stars over all boards: the number the Game Center leaderboard ranks.
    public var totalStars: Int { bestStars.values.reduce(0, +) }
}

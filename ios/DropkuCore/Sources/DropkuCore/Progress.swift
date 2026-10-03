import Foundation

/// Prices and rewards, all in Sparks (earned only in v1: no ads, no purchases).
public enum Economy {
    public static let hint = 40
    public static let extraUndo = 15
    public static let extraHeart = 60
    public static let skip = 400
    public static let skipAfterFailedAttempts = 2
    public static let milestoneChest = 150
    public static let welcomeGift = 50
    /// Replays only pay for improving a level's stars.
    public static let sparksPerNewStar = 10
}

/// Everything saved for the player: on the device, and synced through their own iCloud.
public struct PlayerProgress: Codable, Equatable, Sendable {
    /// Sparks are stored as a per-device ledger (earned and spent totals), never as a single balance,
    /// so two devices that played offline merge without losing or double-spending anything.
    public var earnedByDevice: [String: Int] = [:]
    public var spentByDevice: [String: Int] = [:]
    public var bestStars: [String: Int] = [:]
    public var skipped: Set<String> = []
    public var failedAttempts: [String: Int] = [:]
    public var chestsOpened: Set<String> = []
    public var tutorialDone = false
    public var soundOn = true
    public var hapticsOn = true

    public init() {}

    public var sparks: Int {
        earnedByDevice.values.reduce(0, +) - spentByDevice.values.reduce(0, +)
    }

    public mutating func earn(_ amount: Int, device: String) {
        guard amount > 0 else { return }
        earnedByDevice[device, default: 0] += amount
    }

    /// Returns false (and spends nothing) when the player can't afford it.
    @discardableResult
    public mutating func spend(_ amount: Int, device: String) -> Bool {
        guard amount > 0, sparks >= amount else { return false }
        spentByDevice[device, default: 0] += amount
        return true
    }

    // MARK: - Level flow

    public func isUnlocked(_ index: Int, in levels: [Level]) -> Bool {
        guard index > 0 else { return true }
        let previous = levels[index - 1].id
        return bestStars[previous] != nil || skipped.contains(previous)
    }

    /// The level the big "Play" button should open.
    public func nextLevelIndex(in levels: [Level]) -> Int {
        for (index, level) in levels.enumerated()
        where isUnlocked(index, in: levels) && bestStars[level.id] == nil && !skipped.contains(level.id) {
            return index
        }
        return max(0, levels.count - 1)
    }

    public struct WinReward: Equatable, Sendable {
        public let sparks: Int
        public let chest: Int
        public let wasReplay: Bool
    }

    /// First clear pays the full result; a replay only pays for new stars. Milestone chests open once.
    public mutating func recordWin(_ level: Level, result: LevelResult, device: String) -> WinReward {
        let previous = bestStars[level.id] ?? 0
        let award = previous > 0 ? max(0, result.stars - previous) * Economy.sparksPerNewStar : result.earned
        var chest = 0
        if level.role == .milestone, !chestsOpened.contains(level.id) {
            chest = Economy.milestoneChest
            chestsOpened.insert(level.id)
        }
        earn(award + chest, device: device)
        bestStars[level.id] = max(previous, result.stars)
        skipped.remove(level.id)
        failedAttempts[level.id] = 0
        return WinReward(sparks: award, chest: chest, wasReplay: previous > 0)
    }

    public mutating func recordFailure(_ level: Level) {
        failedAttempts[level.id, default: 0] += 1
    }

    public func canOfferSkip(_ level: Level) -> Bool {
        (failedAttempts[level.id] ?? 0) >= Economy.skipAfterFailedAttempts
    }

    @discardableResult
    public mutating func skip(_ level: Level, device: String) -> Bool {
        guard canOfferSkip(level), spend(Economy.skip, device: device) else { return false }
        skipped.insert(level.id)
        return true
    }

    public mutating func finishTutorial(device: String) {
        guard !tutorialDone else { return }
        tutorialDone = true
        earn(Economy.welcomeGift, device: device)
    }

    // MARK: - Merging two copies (this device + iCloud)

    /// Keeps the best of both: highest stars, every cleared or skipped level, and the
    /// larger running total per device (totals only ever grow, so max is always correct).
    public func merged(with other: PlayerProgress) -> PlayerProgress {
        var result = self
        result.earnedByDevice.merge(other.earnedByDevice) { max($0, $1) }
        result.spentByDevice.merge(other.spentByDevice) { max($0, $1) }
        result.bestStars.merge(other.bestStars) { max($0, $1) }
        result.skipped = skipped.union(other.skipped).subtracting(result.bestStars.keys)
        result.failedAttempts.merge(other.failedAttempts) { max($0, $1) }
        result.chestsOpened = chestsOpened.union(other.chestsOpened)
        result.tutorialDone = tutorialDone || other.tutorialDone
        return result
    }
}

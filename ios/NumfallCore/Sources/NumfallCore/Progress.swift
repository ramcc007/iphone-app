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

/// Who is playing. Asked once on the Welcome screen. Saved on the device and in the player's OWN iCloud only:
/// there is no developer server, so the name is never received by anyone else. (No age is asked or stored.)
public struct PlayerProfile: Codable, Equatable, Sendable {
    public var name: String
    /// Seconds since 1970.
    public var createdAt: Double
    public var updatedAt: Double

    public init(name: String, createdAt: Double, updatedAt: Double) {
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public static let maxNameLength = 20
    /// Trims, turns every run of whitespace into one space, drops control characters and keeps at most
    /// 20 characters (by Character, so an emoji is never cut in half). Returns nil when nothing is left.
    public static func cleanName(_ raw: String) -> String? {
        var collapsed = ""
        var lastWasSpace = true   // true at the start, so leading whitespace is dropped
        for character in raw {
            if character.isWhitespace {
                if !lastWasSpace { collapsed.append(" ") }
                lastWasSpace = true
            } else if character.unicodeScalars.allSatisfy({ $0.properties.generalCategory == .control }) {
                continue
            } else {
                collapsed.append(character)
                lastWasSpace = false
            }
        }
        var name = String(collapsed.prefix(maxNameLength))
        while name.last == " " { name.removeLast() }
        return name.isEmpty ? nil : name
    }

    /// Which of two copies of the profile wins when two devices disagree: the newer one.
    /// Equal times fall back to a fixed order so that merging never depends on which copy is "self".
    fileprivate static func newer(_ a: PlayerProfile?, _ b: PlayerProfile?) -> PlayerProfile? {
        guard let a else { return b }
        guard let b else { return a }
        if a.updatedAt != b.updatedAt { return a.updatedAt > b.updatedAt ? a : b }
        return a.name >= b.name ? a : b
    }
}

/// One attempt at a real level (never the tutorial), kept so the player can look back at their sessions.
public struct SessionRecord: Codable, Equatable, Identifiable, Sendable {
    public enum Outcome: String, Codable, Sendable {
        case won, timeUp, outOfHearts, left
    }

    public let id: String
    public let levelID: String
    /// Seconds since 1970.
    public let startedAt: Double
    /// Time used on the clock.
    public let seconds: Int
    public let outcome: Outcome
    public let stars: Int
    public let sparks: Int

    public init(id: String = UUID().uuidString, levelID: String, startedAt: Double, seconds: Int,
                outcome: Outcome, stars: Int, sparks: Int) {
        self.id = id
        self.levelID = levelID
        self.startedAt = startedAt
        self.seconds = seconds
        self.outcome = outcome
        self.stars = stars
        self.sparks = sparks
    }

    /// An outcome written by a newer version of the app reads as "left" instead of failing the whole save.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        levelID = try c.decode(String.self, forKey: .levelID)
        startedAt = (try? c.decode(Double.self, forKey: .startedAt)) ?? 0
        seconds = (try? c.decode(Int.self, forKey: .seconds)) ?? 0
        outcome = (try? c.decode(Outcome.self, forKey: .outcome)) ?? .left
        stars = (try? c.decode(Int.self, forKey: .stars)) ?? 0
        sparks = (try? c.decode(Int.self, forKey: .sparks)) ?? 0
    }

    private enum CodingKeys: String, CodingKey {
        case id, levelID, startedAt, seconds, outcome, stars, sparks
    }
}

/// Decodes one array element without letting a single bad element fail the whole array.
private struct Lossy<Value: Decodable>: Decodable {
    let value: Value?
    init(from decoder: Decoder) throws {
        value = try? Value(from: decoder)
    }
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
    /// Asked once on the Welcome screen. nil until then (and again after "Reset all progress").
    public var profile: PlayerProfile?
    /// Most recent last. Only the newest 300 are kept.
    public var sessions: [SessionRecord] = []
    /// One result per calendar day ("2026-10-05") for the Daily Drop. Streaks and achievements are derived from this.
    public var dailyResults: [String: DailyResult] = [:]

    public static let maxSessions = 300

    public init() {}

    private enum CodingKeys: String, CodingKey {
        case earnedByDevice, spentByDevice, bestStars, skipped, failedAttempts, chestsOpened
        case tutorialDone, soundOn, hapticsOn, profile, sessions, dailyResults
    }

    /// Fail-safe: every field is optional on disk, so a saved file from an older or newer version
    /// of the app always loads (missing or unreadable fields fall back to their defaults).
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        earnedByDevice = (try? c.decodeIfPresent([String: Int].self, forKey: .earnedByDevice)) ?? [:]
        spentByDevice = (try? c.decodeIfPresent([String: Int].self, forKey: .spentByDevice)) ?? [:]
        bestStars = (try? c.decodeIfPresent([String: Int].self, forKey: .bestStars)) ?? [:]
        skipped = (try? c.decodeIfPresent(Set<String>.self, forKey: .skipped)) ?? []
        failedAttempts = (try? c.decodeIfPresent([String: Int].self, forKey: .failedAttempts)) ?? [:]
        chestsOpened = (try? c.decodeIfPresent(Set<String>.self, forKey: .chestsOpened)) ?? []
        tutorialDone = (try? c.decodeIfPresent(Bool.self, forKey: .tutorialDone)) ?? false
        soundOn = (try? c.decodeIfPresent(Bool.self, forKey: .soundOn)) ?? true
        hapticsOn = (try? c.decodeIfPresent(Bool.self, forKey: .hapticsOn)) ?? true
        profile = try? c.decodeIfPresent(PlayerProfile.self, forKey: .profile)
        let lossy = (try? c.decodeIfPresent([Lossy<SessionRecord>].self, forKey: .sessions)) ?? []
        sessions = Array(lossy.compactMap(\.value).suffix(Self.maxSessions))
        dailyResults = (try? c.decodeIfPresent([String: DailyResult].self, forKey: .dailyResults)) ?? [:]
    }

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

    // MARK: - Profile and sessions

    /// Saves the player's name if it is valid (see PlayerProfile). Editing keeps `createdAt`.
    @discardableResult
    public mutating func setProfile(name: String, now: Double) -> Bool {
        guard let clean = PlayerProfile.cleanName(name) else { return false }
        profile = PlayerProfile(name: clean, createdAt: profile?.createdAt ?? now, updatedAt: now)
        return true
    }

    /// Adds one finished attempt. Only the newest 300 are kept; the same record is never added twice.
    public mutating func record(_ session: SessionRecord) {
        guard !sessions.contains(where: { $0.id == session.id }) else { return }
        sessions.append(session)
        if sessions.count > Self.maxSessions { sessions.removeFirst(sessions.count - Self.maxSessions) }
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
        result.profile = PlayerProfile.newer(profile, other.profile)
        var byID: [String: SessionRecord] = [:]
        for session in sessions + other.sessions where byID[session.id] == nil { byID[session.id] = session }
        let ordered = byID.values.sorted { $0.startedAt != $1.startedAt ? $0.startedAt < $1.startedAt : $0.id < $1.id }
        result.sessions = Array(ordered.suffix(Self.maxSessions))
        result.dailyResults.merge(other.dailyResults) { mine, theirs in theirs.isBetter(than: mine) ? theirs : mine }
        return result
    }
}

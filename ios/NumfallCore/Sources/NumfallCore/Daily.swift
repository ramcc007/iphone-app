import Foundation

/// A calendar day (year, month, day) without a time zone. The Daily Drop is "today's puzzle": everyone who has
/// the same calendar date gets the same puzzle, with no server involved.
public struct DayKey: Hashable, Comparable, Sendable {
    public let dayNumber: Int   // days since 1970-01-01

    public init(dayNumber: Int) { self.dayNumber = dayNumber }

    public init?(year: Int, month: Int, day: Int) {
        guard (1...12).contains(month), (1...31).contains(day), year >= 1970 else { return nil }
        let number = Self.daysFromCivil(year, month, day)
        let back = Self.civilFromDays(number)
        guard back.0 == year, back.1 == month, back.2 == day else { return nil }   // rejects 31 February and so on
        dayNumber = number
    }

    /// The calendar date in the given calendar (the player's own, by default).
    public init(date: Date, calendar: Calendar = .current) {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        dayNumber = Self.daysFromCivil(parts.year ?? 1970, parts.month ?? 1, parts.day ?? 1)
    }

    /// "2026-10-05"
    public init?(string: String) {
        let parts = string.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, let key = DayKey(year: parts[0], month: parts[1], day: parts[2]) else { return nil }
        self = key
    }

    public var year: Int { Self.civilFromDays(dayNumber).0 }
    public var month: Int { Self.civilFromDays(dayNumber).1 }
    public var day: Int { Self.civilFromDays(dayNumber).2 }

    public var string: String {
        let (y, m, d) = Self.civilFromDays(dayNumber)
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    public func adding(days: Int) -> DayKey { DayKey(dayNumber: dayNumber + days) }
    public static func < (a: DayKey, b: DayKey) -> Bool { a.dayNumber < b.dayNumber }

    // Howard Hinnant's civil-calendar algorithms: exact for every date, with no Calendar or time zone.
    private static func daysFromCivil(_ year: Int, _ month: Int, _ day: Int) -> Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    private static func civilFromDays(_ days: Int) -> (Int, Int, Int) {
        let z = days + 719468
        let era = (z >= 0 ? z : z - 146096) / 146097
        let doe = z - era * 146097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return (yoe + era * 400 + (m <= 2 ? 1 : 0), m, d)
    }
}

/// What the player achieved in one Daily Drop.
public struct DailyResult: Codable, Equatable, Sendable {
    public var stars: Int
    public var seconds: Int

    public init(stars: Int, seconds: Int) {
        self.stars = stars
        self.seconds = seconds
    }

    /// More stars wins; with equal stars the faster time wins.
    func isBetter(than other: DailyResult) -> Bool {
        stars != other.stars ? stars > other.stars : seconds < other.seconds
    }
}

public enum DailyDrop {
    public static let rewardBase = 25
    /// Extra Sparks for keeping a streak: +5 per day of streak after the first, capped at +30 (a 7-day streak).
    public static func streakBonus(_ streak: Int) -> Int { min(max(streak - 1, 0), 6) * 5 }

    /// Classic levels 31 to 90 (index 30..<90): a fair mid-difficulty pool for the day's puzzle.
    static let poolStart = 30
    static let poolEnd = 90

    /// Which Classic level is the Daily Drop on a day. Stable forever: it only depends on the date text,
    /// hashed with 64-bit FNV-1a, so every device and every version of the app agrees.
    public static func levelIndex(for day: DayKey, classicCount: Int) -> Int {
        var hash: UInt64 = 14695981039346656037
        for byte in "numfall-daily-\(day.string)".utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 1099511628211
        }
        let end = min(poolEnd, classicCount)
        let start = min(poolStart, max(0, end - 1))
        return start + Int(hash % UInt64(max(1, end - start)))
    }

    public static func level(for day: DayKey, classic: [Level]) -> Level? {
        guard !classic.isEmpty else { return nil }
        return classic[levelIndex(for: day, classicCount: classic.count)]
    }
}

public struct DailyReward: Equatable, Sendable {
    public let sparks: Int
    public let streak: Int
    /// False for a replay on the same day (replays improve the result but pay nothing).
    public let firstClearToday: Bool
}

extension PlayerProgress {
    public func dailyResult(on day: DayKey) -> DailyResult? { dailyResults[day.string] }
    public func dailyDone(on day: DayKey) -> Bool { (dailyResults[day.string]?.stars ?? 0) > 0 }

    private var clearedDays: [Int] {
        dailyResults.compactMap { key, value in value.stars > 0 ? DayKey(string: key)?.dayNumber : nil }.sorted()
    }

    /// Consecutive days with a cleared Daily Drop, counting back from today. A streak is still alive when today is
    /// not played yet but yesterday was.
    public func dailyStreak(asOf today: DayKey) -> Int {
        let days = Set(clearedDays)
        var cursor = today.dayNumber
        if !days.contains(cursor) { cursor -= 1 }
        var streak = 0
        while days.contains(cursor) {
            streak += 1
            cursor -= 1
        }
        return streak
    }

    /// The longest run of consecutive cleared days ever (it never drops, so achievements built on it stay unlocked).
    public var bestDailyStreak: Int {
        var best = 0, run = 0, previous: Int?
        for day in clearedDays {
            run = (previous != nil && day == previous! + 1) ? run + 1 : 1
            best = max(best, run)
            previous = day
        }
        return best
    }

    public var dailiesCleared: Int { clearedDays.count }

    /// Records a finished Daily Drop. The first clear of a day pays the level's own result plus the daily and streak
    /// bonus; a replay only keeps the better result.
    @discardableResult
    public mutating func recordDaily(day: DayKey, result: LevelResult, seconds: Int, device: String) -> DailyReward {
        let new = DailyResult(stars: result.stars, seconds: max(0, seconds))
        let existing = dailyResults[day.string]
        let first = (existing?.stars ?? 0) == 0
        if existing == nil || new.isBetter(than: existing!) { dailyResults[day.string] = new }
        guard first else { return DailyReward(sparks: 0, streak: dailyStreak(asOf: day), firstClearToday: false) }
        let streak = dailyStreak(asOf: day)
        let sparks = result.earned + DailyDrop.rewardBase + DailyDrop.streakBonus(streak)
        earn(sparks, device: device)
        return DailyReward(sparks: sparks, streak: streak, firstClearToday: true)
    }
}

import XCTest
@testable import NumfallCore

/// Daily Drop, streaks, achievements and result formatting. Run with `swift test` (Mac, GitHub Actions) or tools/swift/linux-swift.sh.
final class DailyTests: XCTestCase {
    let classic = LevelLibrary.bundled().first { $0.id == "classic" }!.levels

    private func day(_ y: Int, _ m: Int, _ d: Int) -> DayKey { DayKey(year: y, month: m, day: d)! }

    /// A genuine winning result, played with the hint engine.
    private func winResult() -> LevelResult {
        var game = Game(level: classic[11])
        for _ in 0..<400 where game.status == .playing {
            guard let hint = game.hint() else { break }
            _ = game.drop(value: hint.value, column: hint.position.column)
        }
        return game.result()!
    }

    func testDayKeyNumbersAndStrings() {
        XCTAssertEqual(day(1970, 1, 1).dayNumber, 0)
        XCTAssertEqual(day(2026, 10, 5).dayNumber, 20731)
        XCTAssertEqual(day(2024, 2, 29).dayNumber, 19782)
        XCTAssertEqual(day(2000, 3, 1).dayNumber, 11017)
        XCTAssertEqual(day(2026, 10, 5).string, "2026-10-05")
        XCTAssertEqual(DayKey(string: "2024-02-29"), day(2024, 2, 29))
        XCTAssertNil(DayKey(string: "2026-02-30"))
        XCTAssertNil(DayKey(string: "2025-02-29"))
        XCTAssertNil(DayKey(string: "nonsense"))
        XCTAssertNil(DayKey(year: 2026, month: 13, day: 1))
    }

    func testAddingDaysCrossesMonthYearAndLeapDay() {
        XCTAssertEqual(day(2026, 12, 31).adding(days: 1), day(2027, 1, 1))
        XCTAssertEqual(day(2024, 2, 28).adding(days: 1), day(2024, 2, 29))
        XCTAssertEqual(day(2024, 2, 29).adding(days: 1), day(2024, 3, 1))
        XCTAssertEqual(day(2025, 2, 28).adding(days: 1), day(2025, 3, 1))
        XCTAssertEqual(day(2026, 3, 1).adding(days: -1), day(2026, 2, 28))
        XCTAssertEqual(day(2026, 10, 5).adding(days: 365), day(2027, 10, 5))
    }

    func testDayKeyFromDateUsesTheGivenCalendar() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Kolkata")!
        // 2026-10-05 20:30 UTC is already 2026-10-06 in India.
        let date = Date(timeIntervalSince1970: Double(day(2026, 10, 5).dayNumber) * 86400 + 20.5 * 3600)
        XCTAssertEqual(DayKey(date: date, calendar: calendar), day(2026, 10, 6))
        calendar.timeZone = TimeZone(identifier: "UTC")!
        XCTAssertEqual(DayKey(date: date, calendar: calendar), day(2026, 10, 5))
    }

    func testDailyPuzzleIsStableAndInRange() {
        // These values must never change: every device must pick the same puzzle for the same date.
        XCTAssertEqual(DailyDrop.levelIndex(for: day(2026, 10, 5), classicCount: 100), 63)
        XCTAssertEqual(DailyDrop.levelIndex(for: day(2026, 10, 6), classicCount: 100), 30)
        XCTAssertEqual(DailyDrop.levelIndex(for: day(2026, 12, 31), classicCount: 100), 34)
        XCTAssertEqual(DailyDrop.levelIndex(for: day(2027, 1, 1), classicCount: 100), 82)
        var seen = Set<Int>()
        for offset in 0..<400 {
            let index = DailyDrop.levelIndex(for: day(2026, 1, 1).adding(days: offset), classicCount: 100)
            XCTAssertTrue((30..<90).contains(index))
            seen.insert(index)
        }
        XCTAssertGreaterThan(seen.count, 50, "the daily puzzle should vary")
        XCTAssertEqual(DailyDrop.level(for: day(2026, 10, 5), classic: classic)?.id, classic[63].id)
        XCTAssertNil(DailyDrop.level(for: day(2026, 10, 5), classic: []))
    }

    func testStreakCountsConsecutiveClearedDays() {
        var p = PlayerProgress()
        let today = day(2026, 10, 5)
        XCTAssertEqual(p.dailyStreak(asOf: today), 0)
        for back in [3, 2, 1] { p.dailyResults[today.adding(days: -back).string] = DailyResult(stars: 2, seconds: 30) }
        XCTAssertEqual(p.dailyStreak(asOf: today), 3, "today not played yet: the streak is still alive")
        p.dailyResults[today.string] = DailyResult(stars: 1, seconds: 50)
        XCTAssertEqual(p.dailyStreak(asOf: today), 4)
        XCTAssertEqual(p.dailyStreak(asOf: today.adding(days: 2)), 0, "two days without a clear breaks the streak")
        XCTAssertEqual(p.dailiesCleared, 4)
        XCTAssertEqual(p.bestDailyStreak, 4)
    }

    func testBestStreakSurvivesABreak() {
        var p = PlayerProgress()
        let start = day(2026, 1, 1)
        for offset in [0, 1, 2, 3, 4, 10, 11] { p.dailyResults[start.adding(days: offset).string] = DailyResult(stars: 1, seconds: 40) }
        XCTAssertEqual(p.bestDailyStreak, 5)
        XCTAssertEqual(p.dailyStreak(asOf: start.adding(days: 11)), 2)
        p.dailyResults[start.adding(days: 6).string] = DailyResult(stars: 0, seconds: 40)   // a failed try never counts
        XCTAssertEqual(p.dailiesCleared, 7)
    }

    func testFirstDailyClearPaysAndReplayDoesNot() {
        var p = PlayerProgress()
        let result = winResult()
        let today = day(2026, 10, 5)
        p.dailyResults[today.adding(days: -1).string] = DailyResult(stars: 3, seconds: 20)
        let first = p.recordDaily(day: today, result: result, seconds: 44, device: "d")
        XCTAssertTrue(first.firstClearToday)
        XCTAssertEqual(first.streak, 2)
        XCTAssertEqual(first.sparks, result.earned + DailyDrop.rewardBase + DailyDrop.streakBonus(2))
        XCTAssertEqual(p.sparks, first.sparks)
        XCTAssertEqual(p.dailyResult(on: today), DailyResult(stars: result.stars, seconds: 44))
        let replay = p.recordDaily(day: today, result: result, seconds: 30, device: "d")
        XCTAssertFalse(replay.firstClearToday)
        XCTAssertEqual(replay.sparks, 0)
        XCTAssertEqual(p.sparks, first.sparks, "a replay pays nothing")
        XCTAssertEqual(p.dailyResult(on: today)?.seconds, 30, "a faster replay is kept")
        _ = p.recordDaily(day: today, result: result, seconds: 90, device: "d")
        XCTAssertEqual(p.dailyResult(on: today)?.seconds, 30, "a slower replay is not")
    }

    func testStreakBonusIsCapped() {
        XCTAssertEqual(DailyDrop.streakBonus(0), 0)
        XCTAssertEqual(DailyDrop.streakBonus(1), 0)
        XCTAssertEqual(DailyDrop.streakBonus(2), 5)
        XCTAssertEqual(DailyDrop.streakBonus(7), 30)
        XCTAssertEqual(DailyDrop.streakBonus(100), 30)
    }

    func testDailyResultsMergeKeepsTheBest() {
        var a = PlayerProgress(), b = PlayerProgress()
        a.dailyResults["2026-10-01"] = DailyResult(stars: 2, seconds: 40)
        b.dailyResults["2026-10-01"] = DailyResult(stars: 3, seconds: 55)
        a.dailyResults["2026-10-02"] = DailyResult(stars: 1, seconds: 50)
        b.dailyResults["2026-10-02"] = DailyResult(stars: 1, seconds: 35)
        b.dailyResults["2026-10-03"] = DailyResult(stars: 1, seconds: 60)
        let merged = a.merged(with: b)
        XCTAssertEqual(merged.dailyResults["2026-10-01"]?.stars, 3)
        XCTAssertEqual(merged.dailyResults["2026-10-02"]?.seconds, 35)
        XCTAssertNotNil(merged.dailyResults["2026-10-03"])
        XCTAssertEqual(merged, b.merged(with: a), "merging must not depend on the order")
    }

    func testOldSavesWithoutDailyDataStillLoad() throws {
        let old = #"{"earnedByDevice":{"x":10},"tutorialDone":true}"#.data(using: .utf8)!
        let p = try JSONDecoder().decode(PlayerProgress.self, from: old)
        XCTAssertEqual(p.sparks, 10)
        XCTAssertTrue(p.dailyResults.isEmpty)
        var q = PlayerProgress()
        q.dailyResults["2026-10-05"] = DailyResult(stars: 2, seconds: 33)
        let back = try JSONDecoder().decode(PlayerProgress.self, from: JSONEncoder().encode(q))
        XCTAssertEqual(back, q)
        let broken = #"{"dailyResults":"garbage"}"#.data(using: .utf8)!
        XCTAssertTrue(try JSONDecoder().decode(PlayerProgress.self, from: broken).dailyResults.isEmpty)
    }

    func testAchievementsUnlockFromProgress() {
        var p = PlayerProgress()
        XCTAssertTrue(Achievement.unlocked(in: p).isEmpty)
        p.bestStars["classic-001"] = 3
        XCTAssertTrue(Achievement.firstClear.isUnlocked(in: p))
        XCTAssertFalse(Achievement.clear10.isUnlocked(in: p))
        XCTAssertEqual(Achievement.clear10.progress(in: p).current, 1)
        for n in 2...10 { p.bestStars["classic-\(String(format: "%03d", n))"] = 3 }
        XCTAssertTrue(Achievement.clear10.isUnlocked(in: p))
        XCTAssertTrue(Achievement.threeStars10.isUnlocked(in: p))
        XCTAssertFalse(Achievement.masterClear.isUnlocked(in: p))
        p.bestStars["master-001"] = 1
        XCTAssertTrue(Achievement.masterClear.isUnlocked(in: p))
        XCTAssertFalse(Achievement.chest.isUnlocked(in: p))
        p.chestsOpened.insert("quick-010")
        XCTAssertTrue(Achievement.chest.isUnlocked(in: p))
        for offset in 0..<7 { p.dailyResults[day(2026, 3, 1).adding(days: offset).string] = DailyResult(stars: 1, seconds: 30) }
        XCTAssertTrue(Achievement.dailyFirst.isUnlocked(in: p))
        XCTAssertTrue(Achievement.streak3.isUnlocked(in: p))
        XCTAssertTrue(Achievement.streak7.isUnlocked(in: p))
        XCTAssertEqual(p.totalStars, 3 * 10 + 1)
        XCTAssertEqual(Set(Achievement.allCases.map(\.id)).count, Achievement.allCases.count)
    }

    func testResultFormat() {
        XCTAssertEqual(ResultFormat.stars(3), "\u{2605}\u{2605}\u{2605}")
        XCTAssertEqual(ResultFormat.stars(1), "\u{2605}\u{2606}\u{2606}")
        XCTAssertEqual(ResultFormat.stars(9), "\u{2605}\u{2605}\u{2605}")
        XCTAssertEqual(ResultFormat.stars(-2), "\u{2606}\u{2606}\u{2606}")
        XCTAssertEqual(ResultFormat.clock(41), "0:41")
        XCTAssertEqual(ResultFormat.clock(125), "2:05")
        XCTAssertEqual(ResultFormat.clock(-5), "0:00")
        XCTAssertEqual(ResultFormat.clockRange(28, 53), "28s to 53s")
        XCTAssertEqual(ResultFormat.clockRange(90, 185), "1:30 to 3:05")
        XCTAssertEqual(ResultFormat.clockRange(240, 335), "4:00 to 5:35")
    }
}

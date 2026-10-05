import XCTest
@testable import NumfallCore

/// Mirrors tools/failsafe/engine.test.js so the Swift rules behave exactly like the tested web engine.
/// Run on a Mac: `cd ios/NumfallCore && swift test`, or on Linux: `tools/swift/linux-swift.sh`
final class GameRulesTests: XCTestCase {
    let boards = LevelLibrary.bundled()
    var levels: [Level] { boards.flatMap(\.levels) }
    func board(_ kind: BoardKind) -> [Level] { boards.first { $0.id == kind.rawValue }?.levels ?? [] }
    /// A mid-size 6x6 level used by the rule tests.
    var classic12: Level { board(.classic)[11] }

    private func solveWithHints(_ game: inout Game) -> (won: Bool, usedFallback: Bool) {
        var fallback = false
        for _ in 0..<400 where game.status == .playing {
            guard let hint = game.hint() else { return (false, fallback) }
            if hint.reason.hasPrefix("This gap needs") { fallback = true }
            guard case .placed = game.drop(value: hint.value, column: hint.position.column) else { return (false, fallback) }
        }
        return (game.status == .won, fallback)
    }

    private func wrongValue(_ game: Game, column: Int) -> Int {
        let row = game.landingRow(column: column)!
        return game.level.solution[row][column] % game.size + 1
    }

    private func firstOpenColumn(_ game: Game) -> Int {
        (0..<game.size).first { game.landingRow(column: $0) != nil }!
    }

    func testBundledBoardsLoad() {
        XCTAssertEqual(boards.map(\.id), BoardKind.allCases.map(\.rawValue))
        XCTAssertEqual(boards.map(\.id), ["quick", "classic", "master"])
        for board in boards {
            let kind = try! XCTUnwrap(board.kind)
            XCTAssertEqual(board.levels.count, kind.levelCount, board.id)
            XCTAssertEqual(board.levels.map(\.number), Array(1...kind.levelCount), board.id)
            XCTAssertTrue(board.levels.allSatisfy { $0.board == board.id && $0.size == kind.size && $0.size == board.size }, board.id)
        }
        XCTAssertEqual(levels.count, 230)
        XCTAssertEqual(Set(levels.map(\.id)).count, 230, "level ids must be unique across boards")
    }

    func testEveryLevelSolvableByLogicalHintsOnly() {
        for level in levels {
            var game = Game(level: level)
            let outcome = solveWithHints(&game)
            XCTAssertTrue(outcome.won, "\(level.id) not solved by hints")
            XCTAssertFalse(outcome.usedFallback, "\(level.id) needed a non-logical hint")
        }
    }

    func testTimeLimitsMatchTable() {
        for level in levels {
            let kind = try! XCTUnwrap(BoardKind(rawValue: level.board))
            XCTAssertEqual(level.timeLimit, TimeTable.limit(board: kind, level: level.number), level.id)
        }
        XCTAssertEqual(TimeTable.limit(board: .quick, level: 1), 28)
        XCTAssertEqual(TimeTable.limit(board: .quick, level: 5), 28)
        XCTAssertEqual(TimeTable.limit(board: .quick, level: 6), 33)
        XCTAssertEqual(TimeTable.limit(board: .quick, level: 30), 53)
        XCTAssertEqual(TimeTable.limit(board: .classic, level: 1), 90)
        XCTAssertEqual(TimeTable.limit(board: .classic, level: 12), 100)
        XCTAssertEqual(TimeTable.limit(board: .classic, level: 100), 185)
        XCTAssertEqual(TimeTable.limit(board: .master, level: 1), 240)
        XCTAssertEqual(TimeTable.limit(board: .master, level: 6), 245)
        XCTAssertEqual(TimeTable.limit(board: .master, level: 100), 335)
    }

    func testTimeUpLocksBoardAndClockNeverNegative() {
        var game = Game(level: classic12)
        for _ in 0..<(game.level.timeLimit - 1) { game.tick() }
        XCTAssertEqual(game.status, .playing)
        XCTAssertTrue(game.tick())
        game.tick(seconds: 50)
        XCTAssertEqual(game.status, .timeUp)
        XCTAssertEqual(game.timeLeft, 0)
        let openColumn = firstOpenColumn(game)
        let afterTimeUp = game.drop(value: 1, column: openColumn)
        XCTAssertEqual(afterTimeUp, .inactive)
        XCTAssertNil(game.hint())
    }

    func testClockStopsAfterWinAndLoss() {
        var won = Game(level: board(.quick)[0])
        _ = solveWithHints(&won)
        let left = won.timeLeft
        won.tick(seconds: 5)
        XCTAssertEqual(won.timeLeft, left)

        var lost = Game(level: board(.quick)[0])
        for _ in 0..<3 { let c = firstOpenColumn(lost); _ = lost.drop(value: wrongValue(lost, column: c), column: c) }
        XCTAssertEqual(lost.status, .lost)
        let lostLeft = lost.timeLeft
        lost.tick(seconds: 5)
        XCTAssertEqual(lost.timeLeft, lostLeft)
    }

    func testWrongDropCostsHeartAndExplains() {
        var game = Game(level: classic12)
        let before = game.grid
        let column = firstOpenColumn(game)
        let wrong = wrongValue(game, column: column)
        guard case let .wrong(_, _, reason, lostLast) = game.drop(value: wrong, column: column) else {
            return XCTFail("expected a wrong drop")
        }
        XCTAssertFalse(lostLast)
        XCTAssertEqual(game.hearts, 2)
        XCTAssertEqual(game.grid, before)
        XCTAssertTrue([.row, .column, .box, .deadEnd].contains(reason))
    }

    func testHeartsNeverBelowZero() {
        var game = Game(level: classic12)
        for _ in 0..<6 { let c = firstOpenColumn(game); _ = game.drop(value: wrongValue(game, column: c), column: c) }
        XCTAssertEqual(game.hearts, 0)
        XCTAssertEqual(game.status, .lost)
    }

    func testHeartContinueOncePerAttempt() {
        var game = Game(level: classic12)
        func loseAll() { for _ in 0..<3 where game.status == .playing { let c = firstOpenColumn(game); _ = game.drop(value: wrongValue(game, column: c), column: c) } }
        loseAll()
        XCTAssertTrue(game.continueWithHeart())
        XCTAssertEqual(game.hearts, 1)
        loseAll()
        XCTAssertFalse(game.continueWithHeart())
        XCTAssertEqual(game.status, .lost)
    }

    func testUndoCannotFarmSparks() {
        var game = Game(level: classic12)
        for _ in 0..<50 where game.status == .playing {
            let hint = game.hint()!
            guard case let .placed(placement) = game.drop(value: hint.value, column: hint.position.column) else { return XCTFail() }
            if placement.sparksGained > 0, game.status == .playing {
                let after = game.lineSparks
                XCTAssertTrue(game.undo())
                _ = game.drop(value: hint.value, column: hint.position.column)
                XCTAssertEqual(game.lineSparks, after, "undo + redo paid again")
                return
            }
        }
        XCTFail("no completing drop found")
    }

    func testOnlyThreeFreeUndos() {
        var game = Game(level: classic12)
        var undone = 0
        for _ in 0..<6 {
            let hint = game.hint()!
            _ = game.drop(value: hint.value, column: hint.position.column)
            if game.undo() { undone += 1 }
        }
        XCTAssertEqual(undone, 3)
    }

    func testFullColumnRefusedWithoutHeartLoss() {
        guard let level = board(.classic).first(where: { level in
            (0..<level.size).contains { column in level.givens.allSatisfy { $0[column] != 0 } }
        }) else {
            return XCTFail("no Classic level starts with a full column")
        }
        var game = Game(level: level)
        let full = (0..<game.size).first { game.landingRow(column: $0) == nil }!
        let outcome = game.drop(value: 1, column: full)
        XCTAssertEqual(outcome, .columnFull)
        XCTAssertEqual(game.hearts, 3)
    }

    func testStarThresholds() {
        let level = classic12
        let limit = level.timeLimit
        let quarter = Int((Double(limit) * 0.25).rounded(.up))
        var fast = Game(level: level); fast.tick(seconds: limit - quarter); _ = solveWithHints(&fast)
        var slow = Game(level: level); slow.tick(seconds: limit - quarter + 1); _ = solveWithHints(&slow)
        var sloppy = Game(level: level)
        let c = firstOpenColumn(sloppy); _ = sloppy.drop(value: wrongValue(sloppy, column: c), column: c)
        _ = solveWithHints(&sloppy)
        XCTAssertEqual(fast.result()?.stars, 3)
        XCTAssertEqual(slow.result()?.stars, 2)
        XCTAssertEqual(sloppy.result()?.stars, 1)
    }

    func testEconomyRangeAtStrongPace() {
        // No mistakes at 2/3/4 seconds per gap on 4x4/6x6/9x9, same as engine.test.js.
        let pace = [4: 2, 6: 3, 9: 4]
        let ranges = [4: 30...50, 6: 40...70, 9: 50...85]
        for level in levels {
            var game = Game(level: level)
            game.tick(seconds: level.gaps * pace[level.size]!)
            _ = solveWithHints(&game)
            let earned = game.result()!.earned
            XCTAssertTrue(ranges[level.size]!.contains(earned), "\(level.id) earned \(earned)")
        }
    }

    func testUntimedTutorialNeverTimesOut() {
        var game = Game(level: Lesson.all[2].level, timed: false)
        XCTAssertFalse(game.tick(seconds: 9999))
        XCTAssertEqual(game.status, .playing)
    }

    func testTutorialLessonsCompleteInGuidedOrder() {
        for lesson in Lesson.all where !lesson.steps.isEmpty {
            var game = Game(level: lesson.level, timed: false)
            for step in lesson.steps { _ = game.drop(value: step.value, column: step.column) }
            XCTAssertEqual(game.status, .won, lesson.title)
        }
    }
}

final class ProgressTests: XCTestCase {
    let boards = LevelLibrary.bundled()
    /// The Quick board: 30 levels, milestone at 10.
    var levels: [Level] { boards[0].levels }

    private func perfectResult(_ level: Level) -> LevelResult {
        var game = Game(level: level)
        while game.status == .playing, let hint = game.hint() { _ = game.drop(value: hint.value, column: hint.position.column) }
        return game.result()!
    }

    func testReplayOnlyPaysForNewStars() {
        var progress = PlayerProgress()
        let level = levels[0]
        let first = progress.recordWin(level, result: LevelResult(stars: 1, breakdown: [RewardLine(label: "x", sparks: 30)]), device: "A")
        XCTAssertEqual(first.sparks, 30)
        let replaySame = progress.recordWin(level, result: LevelResult(stars: 1, breakdown: [RewardLine(label: "x", sparks: 30)]), device: "A")
        XCTAssertEqual(replaySame.sparks, 0)
        let replayBetter = progress.recordWin(level, result: perfectResult(level), device: "A")
        XCTAssertEqual(replayBetter.sparks, 2 * Economy.sparksPerNewStar)
        XCTAssertEqual(progress.bestStars[level.id], 3)
    }

    func testMilestoneChestOpensOnce() {
        var progress = PlayerProgress()
        let milestone = levels[9]
        XCTAssertEqual(milestone.role, .milestone)
        XCTAssertEqual(progress.recordWin(milestone, result: perfectResult(milestone), device: "A").chest, Economy.milestoneChest)
        XCTAssertEqual(progress.recordWin(milestone, result: perfectResult(milestone), device: "A").chest, 0)
    }

    func testSkipNeedsTwoFailuresAndEnoughSparks() {
        var progress = PlayerProgress()
        let level = levels[7]
        progress.earn(1000, device: "A")
        progress.recordFailure(level)
        XCTAssertFalse(progress.skip(level, device: "A"))
        progress.recordFailure(level)
        XCTAssertTrue(progress.skip(level, device: "A"))
        XCTAssertEqual(progress.sparks, 600)
        XCTAssertTrue(progress.isUnlocked(8, in: levels))

        var poor = PlayerProgress()
        poor.recordFailure(level); poor.recordFailure(level)
        poor.earn(399, device: "A")
        XCTAssertFalse(poor.skip(level, device: "A"))
        XCTAssertEqual(poor.sparks, 399)
    }

    func testCannotSpendMoreThanYouHave() {
        var progress = PlayerProgress()
        progress.earn(30, device: "A")
        XCTAssertFalse(progress.spend(Economy.hint, device: "A"))
        XCTAssertEqual(progress.sparks, 30)
    }

    func testUnlockingAndNextLevel() {
        var progress = PlayerProgress()
        // The first five levels are open from the start, in any order.
        for index in 0..<PlayerProgress.freeLevels { XCTAssertTrue(progress.isUnlocked(index, in: levels), "level \(index + 1)") }
        XCTAssertFalse(progress.isUnlocked(5, in: levels))
        XCTAssertEqual(progress.nextLevelIndex(in: levels), 0)
        _ = progress.recordWin(levels[2], result: perfectResult(levels[2]), device: "A")   // playing level 3 first is fine
        XCTAssertEqual(progress.nextLevelIndex(in: levels), 0, "the Play button still starts at the first level not yet cleared")
        XCTAssertFalse(progress.isUnlocked(5, in: levels), "level 6 waits for level 5")
        _ = progress.recordWin(levels[4], result: perfectResult(levels[4]), device: "A")
        XCTAssertTrue(progress.isUnlocked(5, in: levels))
        XCTAssertFalse(progress.isUnlocked(6, in: levels))
        _ = progress.recordWin(levels[5], result: perfectResult(levels[5]), device: "A")
        XCTAssertTrue(progress.isUnlocked(6, in: levels))
    }

    func testEachBoardIsItsOwnPath() {
        var progress = PlayerProgress()
        let quick = boards[0].levels, classic = boards[1].levels, master = boards[2].levels
        // All three boards are open from the start.
        XCTAssertTrue(progress.isUnlocked(0, in: classic))
        XCTAssertTrue(progress.isUnlocked(0, in: master))
        _ = progress.recordWin(quick[0], result: perfectResult(quick[0]), device: "A")
        XCTAssertTrue(progress.isUnlocked(1, in: quick))
        XCTAssertFalse(progress.isUnlocked(5, in: classic), "clearing Quick 1 must not unlock Classic 6")
        XCTAssertEqual(progress.nextLevelIndex(in: quick), 1)
        XCTAssertEqual(progress.nextLevelIndex(in: classic), 0)
        XCTAssertEqual(progress.nextLevelIndex(in: master), 0)
    }

    func testWelcomeGiftOnlyOnce() {
        var progress = PlayerProgress()
        progress.finishTutorial(device: "A")
        progress.finishTutorial(device: "A")
        XCTAssertEqual(progress.sparks, Economy.welcomeGift)
    }

    /// Fail-safe D1: two devices played offline must merge without losing or double-spending Sparks.
    func testTwoDevicesMergeWithoutLosingSparks() {
        var shared = PlayerProgress()
        shared.earn(500, device: "iPhone")
        var phone = shared, pad = shared
        phone.earn(100, device: "iPhone")
        XCTAssertTrue(phone.spend(400, device: "iPhone"))
        pad.earn(70, device: "iPad")
        XCTAssertTrue(pad.spend(40, device: "iPad"))
        let merged = phone.merged(with: pad)
        XCTAssertEqual(merged.sparks, 500 + 100 - 400 + 70 - 40)
        XCTAssertEqual(merged, pad.merged(with: phone), "merge must not depend on order")
        XCTAssertEqual(merged.merged(with: merged), merged, "merging twice changes nothing")
    }

    func testMergeKeepsBestStarsAndClearsSkippedOnceBeaten() {
        var a = PlayerProgress(), b = PlayerProgress()
        a.bestStars["classic-001"] = 2
        b.bestStars["classic-001"] = 3
        a.skipped.insert("classic-002")
        b.bestStars["classic-002"] = 1
        let merged = a.merged(with: b)
        XCTAssertEqual(merged.bestStars["classic-001"], 3)
        XCTAssertFalse(merged.skipped.contains("classic-002"))
    }

    func testProgressRoundTripsThroughJSON() throws {
        var progress = PlayerProgress()
        progress.earn(123, device: "A")
        progress.bestStars["classic-001"] = 3
        progress.skipped.insert("classic-002")
        let data = try JSONEncoder().encode(progress)
        XCTAssertEqual(try JSONDecoder().decode(PlayerProgress.self, from: data), progress)
    }
}

final class ProfileAndSessionTests: XCTestCase {
    private func session(_ id: String, at start: Double, outcome: SessionRecord.Outcome = .won) -> SessionRecord {
        SessionRecord(id: id, levelID: "quick-001", startedAt: start, seconds: 12, outcome: outcome, stars: 2, sparks: 30)
    }

    func testCleanNameTrimsAndCollapsesSpaces() {
        XCTAssertEqual(PlayerProfile.cleanName("  Ada   Lovelace \n"), "Ada Lovelace")
        XCTAssertEqual(PlayerProfile.cleanName("Ada\tB"), "Ada B")
        XCTAssertEqual(PlayerProfile.cleanName("A\u{0007}da"), "Ada")
    }

    func testCleanNameLimitsLengthAndKeepsEmoji() {
        let long = String(repeating: "a", count: 25)
        XCTAssertEqual(PlayerProfile.cleanName(long), String(repeating: "a", count: 20))
        XCTAssertEqual(PlayerProfile.cleanName(String(repeating: "\u{1F600}", count: 25))?.count, 20)
        XCTAssertEqual(PlayerProfile.cleanName("Sam \u{1F680}"), "Sam \u{1F680}")
        // Cutting at 20 never leaves a trailing space.
        XCTAssertEqual(PlayerProfile.cleanName(String(repeating: "a", count: 19) + " bbbb"), String(repeating: "a", count: 19))
    }

    func testCleanNameRejectsEmpty() {
        XCTAssertNil(PlayerProfile.cleanName(""))
        XCTAssertNil(PlayerProfile.cleanName("   \n\t "))
        XCTAssertNil(PlayerProfile.cleanName("\u{0007}\u{0008}"))
    }

    func testOldSaveWithAnAgeStillLoadsAndTheAgeIsDropped() throws {
        let old = #"{"profile":{"name":"Ada","age":30,"createdAt":1,"updatedAt":2}}"#
        let progress = try JSONDecoder().decode(PlayerProgress.self, from: Data(old.utf8))
        XCTAssertEqual(progress.profile, PlayerProfile(name: "Ada", createdAt: 1, updatedAt: 2))
        let again = String(decoding: try JSONEncoder().encode(progress), as: UTF8.self)
        XCTAssertFalse(again.contains("age"), "re-saving must not write the age back")
    }

    func testSetProfileValidatesAndEditKeepsCreatedAt() {
        var progress = PlayerProgress()
        XCTAssertNil(progress.profile)
        XCTAssertFalse(progress.setProfile(name: "  ", now: 1))
        XCTAssertNil(progress.profile)
        XCTAssertTrue(progress.setProfile(name: "  Ada  ", now: 100))
        XCTAssertEqual(progress.profile, PlayerProfile(name: "Ada", createdAt: 100, updatedAt: 100))
        XCTAssertTrue(progress.setProfile(name: "Ada L", now: 500))
        XCTAssertEqual(progress.profile, PlayerProfile(name: "Ada L", createdAt: 100, updatedAt: 500))
        XCTAssertFalse(progress.setProfile(name: "", now: 900))
        XCTAssertEqual(progress.profile?.updatedAt, 500, "a refused edit changes nothing")
    }

    func testMergePicksNewerProfile() {
        var a = PlayerProgress(), b = PlayerProgress()
        _ = a.setProfile(name: "Old", now: 100)
        _ = b.setProfile(name: "New", now: 200)
        XCTAssertEqual(a.merged(with: b).profile?.name, "New")
        XCTAssertEqual(b.merged(with: a).profile?.name, "New")
        XCTAssertEqual(a.merged(with: PlayerProgress()).profile?.name, "Old", "nil loses to a profile")
        XCTAssertEqual(PlayerProgress().merged(with: a).profile?.name, "Old")
        XCTAssertNil(PlayerProgress().merged(with: PlayerProgress()).profile)
    }

    func testMergeUnionsSessionsWithoutDuplicates() {
        var a = PlayerProgress(), b = PlayerProgress()
        a.record(session("s1", at: 10)); a.record(session("s3", at: 30))
        b.record(session("s2", at: 20)); b.record(session("s3", at: 30))
        let merged = a.merged(with: b)
        XCTAssertEqual(merged.sessions.map(\.id), ["s1", "s2", "s3"])
        XCTAssertEqual(merged, b.merged(with: a), "merge must not depend on order")
        XCTAssertEqual(merged.merged(with: merged), merged)
    }

    func testSessionsCapAtNewest300() {
        var progress = PlayerProgress()
        for i in 0..<305 { progress.record(session("s\(i)", at: Double(i))) }
        XCTAssertEqual(progress.sessions.count, 300)
        XCTAssertEqual(progress.sessions.first?.id, "s5")
        XCTAssertEqual(progress.sessions.last?.id, "s304")
        progress.record(session("s304", at: 304))
        XCTAssertEqual(progress.sessions.count, 300, "the same record is never added twice")

        var other = PlayerProgress()
        for i in 305..<330 { other.record(session("s\(i)", at: Double(i))) }
        let merged = progress.merged(with: other)
        XCTAssertEqual(merged.sessions.count, 300)
        XCTAssertEqual(merged.sessions.first?.id, "s30")
        XCTAssertEqual(merged.sessions.last?.id, "s329")
    }

    func testProfileAndSessionsRoundTripThroughJSON() throws {
        var progress = PlayerProgress()
        progress.earn(50, device: "A")
        _ = progress.setProfile(name: "Ada", now: 1_700_000_000)
        progress.record(session("s1", at: 1_700_000_100, outcome: .timeUp))
        progress.record(session("s2", at: 1_700_000_200, outcome: .outOfHearts))
        let data = try JSONEncoder().encode(progress)
        XCTAssertEqual(try JSONDecoder().decode(PlayerProgress.self, from: data), progress)
    }

    func testOldSaveWithoutProfileOrSessionsStillLoads() throws {
        let old = #"{"earnedByDevice":{"A":120},"spentByDevice":{"A":20},"bestStars":{"quick-001":3},"skipped":[],"failedAttempts":{},"chestsOpened":[],"tutorialDone":true,"soundOn":true,"hapticsOn":false}"#
        let progress = try JSONDecoder().decode(PlayerProgress.self, from: Data(old.utf8))
        XCTAssertEqual(progress.sparks, 100)
        XCTAssertEqual(progress.bestStars["quick-001"], 3)
        XCTAssertTrue(progress.tutorialDone)
        XCTAssertFalse(progress.hapticsOn)
        XCTAssertNil(progress.profile)
        XCTAssertTrue(progress.sessions.isEmpty)
    }

    func testEmptyOrFutureSaveStillLoads() throws {
        XCTAssertEqual(try JSONDecoder().decode(PlayerProgress.self, from: Data("{}".utf8)), PlayerProgress())
        // A newer app wrote an unknown outcome, an unknown field, and one broken session: nothing else is lost.
        let future = #"{"bestStars":{"quick-001":2},"newField":1,"sessions":[{"id":"a","levelID":"quick-001","startedAt":1,"seconds":3,"outcome":"somethingNew","stars":0,"sparks":0},{"nonsense":true}]}"#
        let progress = try JSONDecoder().decode(PlayerProgress.self, from: Data(future.utf8))
        XCTAssertEqual(progress.bestStars["quick-001"], 2)
        XCTAssertEqual(progress.sessions.map(\.id), ["a"])
        XCTAssertEqual(progress.sessions.first?.outcome, .left)
    }

    func testResetProgressHasNoProfileOrSessions() {
        var progress = PlayerProgress()
        _ = progress.setProfile(name: "Ada", now: 1)
        progress.record(session("s1", at: 1))
        progress = PlayerProgress()   // what AppModel.resetProgress does
        XCTAssertNil(progress.profile)
        XCTAssertTrue(progress.sessions.isEmpty)
    }
}

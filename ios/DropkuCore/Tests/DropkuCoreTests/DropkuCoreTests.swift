import XCTest
@testable import DropkuCore

/// Mirrors tools/failsafe/engine.test.js so the Swift rules behave exactly like the tested web engine.
/// Run on a Mac: `cd ios/DropkuCore && swift test`
final class GameRulesTests: XCTestCase {
    let levels = LevelLibrary.bundled()

    private func solveWithHints(_ game: inout Game) -> (won: Bool, usedFallback: Bool) {
        var fallback = false
        for _ in 0..<200 where game.status == .playing {
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

    func testBundledLevelsLoad() {
        XCTAssertEqual(levels.count, 20)
        XCTAssertEqual(levels.map(\.number), Array(1...20))
    }

    func testEveryLevelSolvableByLogicalHintsOnly() {
        for level in levels {
            var game = Game(level: level)
            let outcome = solveWithHints(&game)
            XCTAssertTrue(outcome.won, "Level \(level.number) not solved by hints")
            XCTAssertFalse(outcome.usedFallback, "Level \(level.number) needed a non-logical hint")
        }
    }

    func testTimeLimitsMatchTable() {
        for level in levels {
            XCTAssertEqual(level.timeLimit, TimeTable.limit(forLevel: level.number), "Level \(level.number)")
        }
        XCTAssertEqual(TimeTable.limit(forLevel: 1), 60)
        XCTAssertEqual(TimeTable.limit(forLevel: 6), 75)
        XCTAssertEqual(TimeTable.limit(forLevel: 11), 150)
        XCTAssertEqual(TimeTable.limit(forLevel: 70), 260)
        XCTAssertEqual(TimeTable.limit(forLevel: 71), 360)
        XCTAssertEqual(TimeTable.limit(forLevel: 99), 435)
        XCTAssertEqual(TimeTable.limit(forLevel: 100), 480)
    }

    func testTimeUpLocksBoardAndClockNeverNegative() {
        var game = Game(level: levels[11])
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
        var won = Game(level: levels[0])
        _ = solveWithHints(&won)
        let left = won.timeLeft
        won.tick(seconds: 5)
        XCTAssertEqual(won.timeLeft, left)

        var lost = Game(level: levels[0])
        for _ in 0..<3 { let c = firstOpenColumn(lost); _ = lost.drop(value: wrongValue(lost, column: c), column: c) }
        XCTAssertEqual(lost.status, .lost)
        let lostLeft = lost.timeLeft
        lost.tick(seconds: 5)
        XCTAssertEqual(lost.timeLeft, lostLeft)
    }

    func testWrongDropCostsHeartAndExplains() {
        var game = Game(level: levels[11])
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
        var game = Game(level: levels[11])
        for _ in 0..<6 { let c = firstOpenColumn(game); _ = game.drop(value: wrongValue(game, column: c), column: c) }
        XCTAssertEqual(game.hearts, 0)
        XCTAssertEqual(game.status, .lost)
    }

    func testHeartContinueOncePerAttempt() {
        var game = Game(level: levels[11])
        func loseAll() { for _ in 0..<3 where game.status == .playing { let c = firstOpenColumn(game); _ = game.drop(value: wrongValue(game, column: c), column: c) } }
        loseAll()
        XCTAssertTrue(game.continueWithHeart())
        XCTAssertEqual(game.hearts, 1)
        loseAll()
        XCTAssertFalse(game.continueWithHeart())
        XCTAssertEqual(game.status, .lost)
    }

    func testUndoCannotFarmSparks() {
        var game = Game(level: levels[11])
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
        var game = Game(level: levels[11])
        var undone = 0
        for _ in 0..<6 {
            let hint = game.hint()!
            _ = game.drop(value: hint.value, column: hint.position.column)
            if game.undo() { undone += 1 }
        }
        XCTAssertEqual(undone, 3)
    }

    func testFullColumnRefusedWithoutHeartLoss() {
        var game = Game(level: levels[11])
        guard let full = (0..<game.size).first(where: { game.landingRow(column: $0) == nil }) else {
            return XCTFail("level has no full column")
        }
        let outcome = game.drop(value: 1, column: full)
        XCTAssertEqual(outcome, .columnFull)
        XCTAssertEqual(game.hearts, 3)
    }

    func testStarThresholds() {
        let level = levels[11]
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
        for level in levels {
            var game = Game(level: level)
            game.tick(seconds: level.gaps * 4)
            _ = solveWithHints(&game)
            let earned = game.result()!.earned
            let range = level.size == 4 ? 30...50 : 45...70
            XCTAssertTrue(range.contains(earned), "Level \(level.number) earned \(earned)")
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
    let levels = LevelLibrary.bundled()

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
        let level = levels[3]
        progress.earn(1000, device: "A")
        progress.recordFailure(level)
        XCTAssertFalse(progress.skip(level, device: "A"))
        progress.recordFailure(level)
        XCTAssertTrue(progress.skip(level, device: "A"))
        XCTAssertEqual(progress.sparks, 600)
        XCTAssertTrue(progress.isUnlocked(4, in: levels))

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
        XCTAssertTrue(progress.isUnlocked(0, in: levels))
        XCTAssertFalse(progress.isUnlocked(1, in: levels))
        XCTAssertEqual(progress.nextLevelIndex(in: levels), 0)
        _ = progress.recordWin(levels[0], result: perfectResult(levels[0]), device: "A")
        XCTAssertTrue(progress.isUnlocked(1, in: levels))
        XCTAssertEqual(progress.nextLevelIndex(in: levels), 1)
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
        a.bestStars["c1-l001"] = 2
        b.bestStars["c1-l001"] = 3
        a.skipped.insert("c1-l002")
        b.bestStars["c1-l002"] = 1
        let merged = a.merged(with: b)
        XCTAssertEqual(merged.bestStars["c1-l001"], 3)
        XCTAssertFalse(merged.skipped.contains("c1-l002"))
    }

    func testProgressRoundTripsThroughJSON() throws {
        var progress = PlayerProgress()
        progress.earn(123, device: "A")
        progress.bestStars["c1-l001"] = 3
        progress.skipped.insert("c1-l002")
        let data = try JSONEncoder().encode(progress)
        XCTAssertEqual(try JSONDecoder().decode(PlayerProgress.self, from: data), progress)
    }
}

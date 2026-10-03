import XCTest
@testable import DropkuCore

/// Mirrors tools/failsafe/engine.test.js so the Swift rules behave exactly like the tested web engine.
/// Run on a Mac: `cd ios/DropkuCore && swift test`, or on Linux: `tools/swift/linux-swift.sh`
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
        XCTAssertEqual(TimeTable.limit(board: .quick, level: 1), 30)
        XCTAssertEqual(TimeTable.limit(board: .quick, level: 5), 30)
        XCTAssertEqual(TimeTable.limit(board: .quick, level: 6), 35)
        XCTAssertEqual(TimeTable.limit(board: .quick, level: 30), 55)
        XCTAssertEqual(TimeTable.limit(board: .classic, level: 1), 75)
        XCTAssertEqual(TimeTable.limit(board: .classic, level: 12), 85)
        XCTAssertEqual(TimeTable.limit(board: .classic, level: 100), 170)
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
        // No mistakes at 3/5/7 seconds per gap on 4x4/6x6/9x9, same as engine.test.js.
        let pace = [4: 3, 6: 5, 9: 7]
        let ranges = [4: 25...50, 6: 40...70, 9: 50...90]
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

    func testEachBoardIsItsOwnPath() {
        var progress = PlayerProgress()
        let quick = boards[0].levels, classic = boards[1].levels, master = boards[2].levels
        // All three boards are open from the start.
        XCTAssertTrue(progress.isUnlocked(0, in: classic))
        XCTAssertTrue(progress.isUnlocked(0, in: master))
        _ = progress.recordWin(quick[0], result: perfectResult(quick[0]), device: "A")
        XCTAssertTrue(progress.isUnlocked(1, in: quick))
        XCTAssertFalse(progress.isUnlocked(1, in: classic), "clearing Quick 1 must not unlock Classic 2")
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

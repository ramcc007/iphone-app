import XCTest
@testable import NumfallCore

/// "Same puzzle, new numbers": a restarted level must be exactly as hard, but not the same board.
final class VariantTests: XCTestCase {
    let levels = LevelLibrary.bundled().flatMap(\.levels)
    let seeds: [UInt64] = [1, 7, 12345, 99999, 4_000_000_000]

    private func box(_ level: Level, _ r: Int, _ c: Int) -> [(Int, Int)] {
        let r0 = r / level.boxRows * level.boxRows, c0 = c / level.boxCols * level.boxCols
        return (r0..<r0 + level.boxRows).flatMap { i in (c0..<c0 + level.boxCols).map { (i, $0) } }
    }

    private func isValidSolution(_ level: Level) -> Bool {
        let n = level.size, all = Array(1...n)
        for i in 0..<n {
            if level.solution[i].sorted() != all { return false }
            if (0..<n).map({ level.solution[$0][i] }).sorted() != all { return false }
        }
        for r in stride(from: 0, to: n, by: level.boxRows) {
            for c in stride(from: 0, to: n, by: level.boxCols) {
                if box(level, r, c).map({ level.solution[$0.0][$0.1] }).sorted() != all { return false }
            }
        }
        return true
    }

    private func gapsPerColumn(_ level: Level) -> [Int] {
        (0..<level.size).map { c in level.givens.filter { $0[c] == 0 }.count }.sorted()
    }

    private func isBottomStacked(_ level: Level) -> Bool {
        (0..<level.size).allSatisfy { c in
            var sawGiven = false
            for r in 0..<level.size {
                if level.givens[r][c] != 0 { sawGiven = true } else if sawGiven { return false }
            }
            return true
        }
    }

    func testEveryVariantKeepsTheExactPuzzle() {
        for level in levels {
            for seed in seeds {
                let v = level.variant(seed: seed)
                XCTAssertEqual(v.id, level.id)
                XCTAssertEqual(v.timeLimit, level.timeLimit, level.id)
                XCTAssertEqual(v.gaps, level.gaps, level.id)
                XCTAssertTrue(isValidSolution(v), "\(level.id)#\(seed) solution")
                XCTAssertTrue(isBottomStacked(v), "\(level.id)#\(seed) stacked")
                XCTAssertEqual(gapsPerColumn(v), gapsPerColumn(level), "\(level.id)#\(seed) gaps per column")
                for r in 0..<v.size { for c in 0..<v.size where v.givens[r][c] != 0 {
                    XCTAssertEqual(v.givens[r][c], v.solution[r][c], "\(level.id)#\(seed) given matches solution")
                } }
            }
        }
    }

    func testEveryVariantIsSolvedByLogicAlone() {
        for level in levels {
            for seed in seeds.prefix(3) {
                var game = Game(level: level.variant(seed: seed))
                var usedFallback = false
                for _ in 0..<400 where game.status == .playing {
                    guard let hint = game.hint() else { break }
                    if hint.reason.hasPrefix("This gap needs") { usedFallback = true }
                    guard case .placed = game.drop(value: hint.value, column: hint.position.column) else { break }
                }
                XCTAssertEqual(game.status, .won, "\(level.id)#\(seed)")
                XCTAssertFalse(usedFallback, "\(level.id)#\(seed) needed a non-logical hint")
            }
        }
    }

    func testSameSeedSameBoardAndDifferentSeedsDiffer() {
        for level in levels {
            XCTAssertEqual(level.variant(seed: 5), level.variant(seed: 5), level.id)
            let different = seeds.filter { level.variant(seed: $0).givens != level.givens }.count
            XCTAssertGreaterThanOrEqual(different, 4, "\(level.id) should change for most seeds")
        }
    }

    func testFreshVariantNeverRepeatsTheBoardOnScreen() {
        var generator = SystemRandomNumberGenerator()
        for level in levels {
            let shown = level.freshVariant(using: &generator)
            let next = level.freshVariant(avoiding: shown, using: &generator)
            XCTAssertNotEqual(next.givens, shown.givens, level.id)
        }
    }

    func testThereAreManyDifferentVariants() {
        let quick = levels.first { $0.board == "quick" && $0.number == 6 }!
        let classic = levels.first { $0.board == "classic" && $0.number == 6 }!
        let master = levels.first { $0.board == "master" && $0.number == 6 }!
        func distinct(_ level: Level) -> Int { Set((0..<4000).map { level.variant(seed: UInt64($0) &* 2654435761).givens }).count }
        XCTAssertGreaterThanOrEqual(distinct(quick), 150)
        XCTAssertGreaterThanOrEqual(distinct(classic), 3000)
        XCTAssertGreaterThanOrEqual(distinct(master), 3900)
    }

    func testSeededGeneratorIsStable() {
        var a = SeededGenerator(seed: 42), b = SeededGenerator(seed: 42)
        XCTAssertEqual((0..<5).map { _ in a.next() }, (0..<5).map { _ in b.next() })
        var c = SeededGenerator(seed: 0)
        XCTAssertEqual(c.next(), 0xE220A8397B1DCDAF)   // the published first SplitMix64 output for seed 0
    }
}

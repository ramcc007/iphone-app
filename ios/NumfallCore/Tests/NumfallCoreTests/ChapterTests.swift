import XCTest
@testable import NumfallCore

final class ChapterTests: XCTestCase {
    let boards = LevelLibrary.bundled()

    func testEveryChapterOfEveryBoardHasAUniqueName() {
        for board in boards {
            let kind = BoardKind(rawValue: board.id)!
            let chapters = Set(board.levels.map(\.chapter)).sorted()
            XCTAssertEqual(Chapters.names[kind]?.count, chapters.count, "\(board.id): one name per chapter")
            let names = chapters.map { Chapters.name(board: kind, chapter: $0) }
            XCTAssertEqual(Set(names).count, names.count, "\(board.id): names are unique")
            for name in names {
                XCTAssertNotEqual(name, "More levels", "\(board.id): a real name, not the fallback")
                XCTAssertFalse(name.localizedCaseInsensitiveContains("chapter"), "the word chapter is never shown")
                XCTAssertLessThanOrEqual(name.count, 22, "\(name) must fit on a small phone")
            }
        }
    }

    func testFlamesRiseSteadilyFromOneToFive() {
        for count in [3, 10] {
            let flames = (1...count).map { Chapters.flames(chapter: $0, of: count) }
            XCTAssertEqual(flames.first, 1)
            XCTAssertEqual(flames.last, Chapters.maxFlames)
            // Never goes down; a board with enough chapters rises one flame at a time, and Quick's 3 chapters spread out as 1, 3, 5.
            let biggestStep = count >= 5 ? 1 : 2
            for (a, b) in zip(flames, flames.dropFirst()) {
                XCTAssertTrue(b >= a && b - a <= biggestStep, "\(count) chapters: \(flames) rises steadily")
            }
        }
        XCTAssertEqual((1...10).map { Chapters.flames(chapter: $0, of: 10) }, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
        XCTAssertEqual((1...3).map { Chapters.flames(chapter: $0, of: 3) }, [1, 3, 5])
    }

    func testFlamesNeverLeaveTheRange() {
        XCTAssertEqual(Chapters.flames(chapter: 1, of: 1), 1)
        XCTAssertEqual(Chapters.flames(chapter: 0, of: 10), 1)
        XCTAssertEqual(Chapters.flames(chapter: 99, of: 10), 5)
    }

    func testNameFallsBackToTheChapterNumber() {
        XCTAssertEqual(Chapters.name(board: .classic, chapter: 11), "More levels")
        XCTAssertEqual(Chapters.name(board: .quick, chapter: 1), "Quick Start")
    }

    func testFlamesFollowTheRealDifficultyRamp() {
        // The meter is a promise: a chapter with more flames must not be easier than one with fewer.
        for board in boards {
            let chapters = Set(board.levels.map(\.chapter)).sorted()
            let averages = chapters.map { ch -> Double in
                let ds = board.levels.filter { $0.chapter == ch && $0.role == .normal }.map(\.difficulty)
                return ds.reduce(0, +) / Double(ds.count)
            }
            for (a, b) in zip(averages, averages.dropFirst()) { XCTAssertLessThan(a, b, "\(board.id) gets harder chapter by chapter") }
        }
    }
}

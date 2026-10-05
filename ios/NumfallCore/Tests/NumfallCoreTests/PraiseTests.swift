import XCTest
@testable import NumfallCore

final class PraiseTests: XCTestCase {
    func testTwentyFourTitlesInStrictProgression() {
        XCTAssertEqual(Praise.titles.count, 24)
        XCTAssertEqual(Praise.titles.first?.levelsCleared, 1)
        XCTAssertEqual(Praise.titles.last?.levelsCleared, 230, "the last title is for clearing every level")
        for (a, b) in zip(Praise.titles, Praise.titles.dropFirst()) { XCTAssertLessThan(a.levelsCleared, b.levelsCleared) }
        XCTAssertEqual(Set(Praise.titles.map(\.text)).count, 24, "no title repeats")
    }

    func testTheRequestedPhrasesAppearInTheRightOrder() {
        func position(_ text: String) -> Int { Praise.titles.firstIndex { $0.text == text }! }
        XCTAssertLessThan(position("You\u{2019}re a Pro!"), position("You\u{2019}re an achiever!"))
        XCTAssertLessThan(position("You\u{2019}re an achiever!"), position("You\u{2019}re a genius!"))
    }

    func testHeadlineFollowsTheNumberOfClearedLevels() {
        XCTAssertEqual(Praise.headline(cleared: 1), "Nice start!")
        XCTAssertEqual(Praise.headline(cleared: 4), "Smooth drop!")
        XCTAssertEqual(Praise.headline(cleared: 25), "You\u{2019}re a Pro!")
        XCTAssertEqual(Praise.headline(cleared: 44), "Unstoppable!")
        XCTAssertEqual(Praise.headline(cleared: 80), "You\u{2019}re a genius!")
        XCTAssertEqual(Praise.headline(cleared: 230), "You cleared everything!")
        XCTAssertEqual(Praise.headline(cleared: 0), "Nice start!", "never empty")
        XCTAssertEqual(Praise.headline(cleared: 9999), "You cleared everything!")
    }

    func testNewTitleOnlyAtTheThreshold() {
        XCTAssertTrue(Praise.isNewTitle(cleared: 25))
        XCTAssertFalse(Praise.isNewTitle(cleared: 26))
        XCTAssertTrue(Praise.isNewTitle(cleared: 1))
    }

    func testReplayLines() {
        XCTAssertEqual(Praise.replayHeadline(improved: true), "Better than before!")
        XCTAssertEqual(Praise.replayHeadline(improved: false), "Nice replay!")
    }
}

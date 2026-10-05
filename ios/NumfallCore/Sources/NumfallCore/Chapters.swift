import Foundation

/// A name and a difficulty meter (1 to 5 flames) for every chapter, a block of 10 levels, on each board.
/// Mirrors `chapterName` and `chapterFlames` in prototype/web/engine.js.
public enum Chapters {
    public static let maxFlames = 5

    /// One name per chapter, in order. Quick has 3 chapters, Classic and Master have 10 each.
    public static let names: [BoardKind: [String]] = [
        .quick: ["Quick Start", "Picking Up Pace", "Lightning Round"],
        .classic: ["First Drops", "Finding Your Feet", "Picking Up Speed", "Steady Hands", "Sharp Eyes",
                   "Clever Moves", "Cool Under Pressure", "Pattern Hunters", "Razor Focus", "Grand Finale"],
        .master: ["Base Camp", "Rising Ground", "The Long Climb", "Thin Air", "Sharp Ridge",
                  "Above the Clouds", "Storm Front", "Sky High", "Final Ascent", "The Summit"],
    ]

    public static func name(board: BoardKind, chapter: Int) -> String {
        let list = names[board] ?? []
        return list.indices.contains(chapter - 1) ? list[chapter - 1] : "Chapter \(chapter)"
    }

    /// 1 to 5 flames. The first chapter of a board is 1 and the last is 5, with steady steps in between
    /// (a 10-chapter board goes 1, 1, 2, 2, 3, 3, 4, 4, 5, 5). The levels themselves already get harder
    /// in a straight ramp, so the meter is the chapter's place on that ramp.
    public static func flames(chapter: Int, of count: Int) -> Int {
        guard count > 1 else { return 1 }
        let position = min(max(chapter, 1), count) - 1
        return 1 + (8 * position + (count - 1)) / (2 * (count - 1))
    }
}

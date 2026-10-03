import Foundation

/// The three guided 4x4 lessons shown on first launch (no timer).
public struct Lesson: Sendable, Identifiable {
    public struct Step: Sendable, Equatable {
        public let value: Int
        public let column: Int
    }

    public let id: Int
    public let title: String
    public let instructions: String
    public let costsHearts: Bool
    public let steps: [Step]
    public let stepTexts: [String]
    public let winText: String
    public let level: Level

    public static let solution = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]]

    static func board(gaps: [(Int, Int)]) -> Level {
        let givens = solution.enumerated().map { row, values in
            values.enumerated().map { column, value in
                gaps.contains(where: { $0.0 == row && $0.1 == column }) ? 0 : value
            }
        }
        return Level(id: "tutorial", board: "tutorial", number: 0, chapter: 0, role: .normal, size: 4, boxRows: 2, boxCols: 2,
                     timeLimit: 0, gaps: gaps.count, difficulty: 0, givens: givens, solution: solution)
    }

    public static let all: [Lesson] = [
        Lesson(id: 0, title: "Drop a number",
               instructions: "The top row is missing a 2 and a 4. Column 2 already has a 4, so it needs the 2. Tap 2, then tap column 2.",
               costsHearts: false,
               steps: [Step(value: 2, column: 1), Step(value: 4, column: 3)],
               stepTexts: ["Tap 2, then the glowing column", "Now the 4 into the last gap"],
               winText: "That\u{2019}s the basic move: pick a number, tap a column, and it drops in.",
               level: board(gaps: [(0, 1), (0, 3)])),
        Lesson(id: 1, title: "Order matters",
               instructions: "Column 4 has two gaps. The TOP one needs a 4, but numbers fall to the LOWEST gap first. Try dropping the 4 first if you\u{2019}re curious.",
               costsHearts: false,
               steps: [Step(value: 2, column: 3), Step(value: 4, column: 3), Step(value: 3, column: 2)],
               stepTexts: ["Fill the lower gap first: drop the 2", "Now the 4 lands on top", "Last one: which number does column 3 need?"],
               winText: "You planned the order: lower gaps first. That\u{2019}s the heart of Dropku.",
               level: board(gaps: [(0, 3), (1, 3), (0, 2)])),
        Lesson(id: 2, title: "On your own",
               instructions: "No more help. A wrong drop cracks and costs a heart. Lose all 3 and you start again. Fill the grid!",
               costsHearts: true, steps: [], stepTexts: [],
               winText: "Real levels add a countdown, and seconds left turn into Sparks. Now pick a board: Quick 4\u{00D7}4, Classic 6\u{00D7}6 or Master 9\u{00D7}9.",
               level: board(gaps: [(0, 0), (1, 0), (0, 2), (0, 3), (1, 3)]))
    ]
}

import Foundation

/// One puzzle. Generated and validated by tools/levelgen (see levels/levels.json).
public struct Level: Codable, Identifiable, Hashable, Sendable {
    public enum Role: String, Codable, Sendable {
        case normal, breather, milestone
    }

    public let id: String
    /// The board this level belongs to ("quick", "classic" or "master"; "tutorial" for lessons).
    public let board: String
    public let number: Int
    public let chapter: Int
    public let role: Role
    public let size: Int
    public let boxRows: Int
    public let boxCols: Int
    public let timeLimit: Int
    public let gaps: Int
    public let difficulty: Double
    /// Rows top to bottom. 0 = gap. Givens are always stacked at the bottom of each column.
    public let givens: [[Int]]
    public let solution: [[Int]]

    public init(id: String, board: String, number: Int, chapter: Int, role: Role, size: Int, boxRows: Int, boxCols: Int,
                timeLimit: Int, gaps: Int, difficulty: Double, givens: [[Int]], solution: [[Int]]) {
        self.id = id
        self.board = board
        self.number = number
        self.chapter = chapter
        self.role = role
        self.size = size
        self.boxRows = boxRows
        self.boxCols = boxCols
        self.timeLimit = timeLimit
        self.gaps = gaps
        self.difficulty = difficulty
        self.givens = givens
        self.solution = solution
    }
}

/// The three boards, all open from the start. Each is its own path of levels.
/// Must match tools/levelgen/validate.py (BOARDS) and prototype/web/engine.js (BOARDS).
public enum BoardKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case quick, classic, master

    public var id: String { rawValue }

    public var name: String {
        switch self {
        case .quick: "Quick"
        case .classic: "Classic"
        case .master: "Master"
        }
    }

    public var size: Int {
        switch self {
        case .quick: 4
        case .classic: 6
        case .master: 9
        }
    }

    public var levelCount: Int {
        switch self {
        case .quick: 30
        case .classic, .master: 100
        }
    }

    /// Seconds for levels 1-5, and how much each later block of 5 levels adds.
    var firstLimit: Int {
        switch self {
        case .quick: 28
        case .classic: 70
        case .master: 180
        }
    }

    var step: Int { 5 }

    public var blurb: String {
        switch self {
        case .quick: "Short and snappy. Great for a coffee break."
        case .classic: "The full Numfall workout, and the best place to start."
        case .master: "Big 9\u{00D7}9 boards, tight clocks. For number-puzzle fans."
        }
    }
}

/// One board's levels, in order.
public struct Board: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let size: Int
    public let boxRows: Int
    public let boxCols: Int
    public let levels: [Level]

    public init(id: String, name: String, size: Int, boxRows: Int, boxCols: Int, levels: [Level]) {
        self.id = id
        self.name = name
        self.size = size
        self.boxRows = boxRows
        self.boxCols = boxCols
        self.levels = levels
    }

    public var kind: BoardKind? { BoardKind(rawValue: id) }
}

public struct LevelPack: Codable, Sendable {
    public let version: Int
    public let seed: Int
    public let boards: [Board]
}

public enum LevelLibrary {
    public static func decode(_ data: Data) throws -> [Board] {
        try JSONDecoder().decode(LevelPack.self, from: data).boards
    }

    /// The boards and levels shipped inside the app.
    public static func bundled() -> [Board] {
        guard let url = Bundle.module.url(forResource: "levels", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let boards = try? decode(data) else { return [] }
        return boards
    }
}

public enum TimeTable {
    /// Seconds allowed for a level: the same for each block of 5 levels, then +5s.
    /// See docs/GAME_PLAN.md, "Time limit". Must match tools/levelgen/validate.py.
    public static func limit(board: BoardKind, level: Int) -> Int {
        board.firstLimit + board.step * ((level - 1) / 5)
    }
}

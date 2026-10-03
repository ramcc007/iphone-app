import Foundation

/// One puzzle. Generated and validated by tools/levelgen (see levels/levels.json).
public struct Level: Codable, Identifiable, Hashable, Sendable {
    public enum Role: String, Codable, Sendable {
        case normal, breather, milestone
    }

    public let id: String
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

    public init(id: String, number: Int, chapter: Int, role: Role, size: Int, boxRows: Int, boxCols: Int,
                timeLimit: Int, gaps: Int, difficulty: Double, givens: [[Int]], solution: [[Int]]) {
        self.id = id
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

public struct LevelPack: Codable, Sendable {
    public let version: Int
    public let seed: Int
    public let levels: [Level]
}

public enum LevelLibrary {
    public static func decode(_ data: Data) throws -> [Level] {
        try JSONDecoder().decode(LevelPack.self, from: data).levels
    }

    /// The levels shipped inside the app.
    public static func bundled() -> [Level] {
        guard let url = Bundle.module.url(forResource: "levels", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let levels = try? decode(data) else { return [] }
        return levels
    }
}

public enum TimeTable {
    /// Seconds allowed for a level. Same for each block of 5 levels, rising with difficulty
    /// (docs/GAME_PLAN.md, "Time limit"). Must match tools/levelgen/validate.py.
    public static func limit(forLevel level: Int) -> Int {
        if level <= 10 { return level <= 5 ? 60 : 75 }
        if level <= 70 { return 150 + 10 * ((level - 11) / 5) }
        if level < 100 { return 360 + 15 * ((level - 71) / 5) }
        return 480
    }
}

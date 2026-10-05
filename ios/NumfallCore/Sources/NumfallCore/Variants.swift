import Foundation

/// A small, fixed random generator (SplitMix64): the same seed always gives the same numbers, on every device and every Swift version.
public struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    public init(seed: UInt64) { state = seed }

    public mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}

extension Level {
    /// The same puzzle in disguise, used when a level is started again so the board cannot be memorised.
    /// Two changes keep it exactly as hard (same prototype/web/engine.js `variant`):
    ///  1. Relabel the digits (every 3 becomes a 5, and so on): every rule treats the numbers alike.
    ///  2. Shuffle whole columns: swap columns inside a box-wide group, and swap the groups. Each column keeps its own stack, so the
    ///     gravity order, the gaps per column, the box rules and the single solution all stay the same.
    /// Rows are never moved: givens are stacked at the bottom of each column and moving rows would break that.
    /// The level's id, number, time limit, gaps and difficulty are unchanged, so progress and stars still belong to the same level.
    public func variant(seed: UInt64) -> Level {
        var rng = SeededGenerator(seed: seed)
        let digits = [0] + Self.shuffled(Array(1...size), using: &rng)            // digits[v] = the new number for v
        let groups = size / boxCols
        var columns: [Int] = []                                                    // columns[k] = which old column now sits at position k
        for group in Self.shuffled(Array(0..<groups), using: &rng) {
            columns += Self.shuffled(Array(0..<boxCols).map { group * boxCols + $0 }, using: &rng)
        }
        func remap(_ grid: [[Int]]) -> [[Int]] {
            grid.map { row in columns.map { column in row[column] == 0 ? 0 : digits[row[column]] } }
        }
        return Level(id: id, board: board, number: number, chapter: chapter, role: role, size: size,
                     boxRows: boxRows, boxCols: boxCols, timeLimit: timeLimit, gaps: gaps, difficulty: difficulty,
                     givens: remap(givens), solution: remap(solution))
    }

    /// A variant that looks different from the board now on screen (a rare repeat is re-rolled).
    public func freshVariant<G: RandomNumberGenerator>(avoiding shown: Level? = nil, using generator: inout G) -> Level {
        for _ in 0..<8 {
            let candidate = variant(seed: UInt64.random(in: 0...UInt64.max, using: &generator))
            if shown == nil || candidate.givens != shown!.givens { return candidate }
        }
        return variant(seed: UInt64.random(in: 0...UInt64.max, using: &generator))
    }

    /// Fisher-Yates with our own generator, so the result never depends on how the standard library shuffles.
    private static func shuffled(_ values: [Int], using rng: inout SeededGenerator) -> [Int] {
        var a = values
        guard a.count > 1 else { return a }
        for i in stride(from: a.count - 1, to: 0, by: -1) {
            let j = Int(rng.next() % UInt64(i + 1))
            a.swapAt(i, j)
        }
        return a
    }
}

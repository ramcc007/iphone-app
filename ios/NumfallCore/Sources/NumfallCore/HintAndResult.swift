import Foundation

public struct Hint: Equatable, Sendable {
    public let position: Game.Position
    public let value: Int
    /// Plain-English reason shown to the player, so a hint teaches rather than just answers.
    public let reason: String
}

public struct RewardLine: Equatable, Sendable {
    public let label: String
    public let sparks: Int
}

public struct LevelResult: Equatable, Sendable {
    public let stars: Int
    public let breakdown: [RewardLine]
    public var earned: Int { breakdown.reduce(0) { $0 + $1.sparks } }
}

extension Game {
    /// The next logical move on a playable (lowest) gap: a naked single first, then a hidden single.
    /// Levels are validated to always have one, so the last-resort answer should never be needed.
    public func hint() -> Hint? {
        guard status == .playing else { return nil }
        var candidates: [Position: [Int]] = [:]
        for row in 0..<size {
            for column in 0..<size where grid[row][column] == 0 {
                candidates[Position(row: row, column: column)] = (1...size).filter {
                    conflict(row: row, column: column, value: $0) == nil
                }
            }
        }
        var playable: [Position] = []
        for column in 0..<size {
            if let row = landingRow(column: column) { playable.append(Position(row: row, column: column)) }
        }

        for position in playable {
            if let options = candidates[position], options.count == 1 {
                return Hint(position: position, value: options[0],
                            reason: "Only \(options[0]) fits here. Its row, column and box already have every other number.")
            }
        }

        var units: [(name: String, cells: [Position])] = []
        for row in 0..<size { units.append((name: "row", cells: (0..<size).map { Position(row: row, column: $0) })) }
        for column in 0..<size { units.append((name: "column", cells: (0..<size).map { Position(row: $0, column: column) })) }
        for boxRow in stride(from: 0, to: size, by: level.boxRows) {
            for boxColumn in stride(from: 0, to: size, by: level.boxCols) {
                units.append((name: "box", cells: boxCells(row: boxRow, column: boxColumn)))
            }
        }
        for unit in units {
            for value in 1...size {
                let spots = unit.cells.filter { candidates[$0]?.contains(value) == true }
                if spots.count == 1, playable.contains(spots[0]) {
                    return Hint(position: spots[0], value: value,
                                reason: "\(value) has nowhere else to go in this \(unit.name).")
                }
            }
        }

        if let position = playable.first {
            let value = level.solution[position.row][position.column]
            return Hint(position: position, value: value, reason: "This gap needs a \(value).")
        }
        return nil
    }

    /// Stars and Sparks for a won attempt.
    /// 3 stars = no mistakes and at least 25% of the time left. Time bonus = 1 Spark per 5 seconds left (max 20).
    public func result() -> LevelResult? {
        guard status == .won else { return nil }
        let noMistakes = mistakes == 0
        let fast = !isTimed || timeLeft >= Int((Double(level.timeLimit) * 0.25).rounded(.up))
        let stars = 1 + (noMistakes ? 1 : 0) + (noMistakes && fast ? 1 : 0)
        let timeBonus = isTimed ? min(20, timeLeft / 5) : 0
        var lines = [RewardLine(label: "Level cleared", sparks: 10)]
        if lineSparks > 0 { lines.append(RewardLine(label: "Rows, columns & boxes", sparks: lineSparks)) }
        if noMistakes { lines.append(RewardLine(label: "No mistakes", sparks: 10)) }
        if timeBonus > 0 { lines.append(RewardLine(label: "Time bonus (\(timeLeft)s left)", sparks: timeBonus)) }
        return LevelResult(stars: stars, breakdown: lines)
    }
}

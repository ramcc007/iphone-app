import Foundation

/// The rules of one attempt at a level. A value type: every move returns what happened,
/// so the UI can animate it and tests can check it. Ported from prototype/web/engine.js,
/// which is covered by tools/failsafe/engine.test.js.
public struct Game: Sendable {
    public enum Status: Sendable, Equatable {
        case playing, won, lost, timeUp
    }

    public enum WrongReason: String, Sendable, Equatable {
        case row, column, box, deadEnd
    }

    public enum Combo: Sendable, Equatable {
        case line, double, triple
    }

    public struct Position: Hashable, Sendable {
        public let row: Int
        public let column: Int
        public init(row: Int, column: Int) {
            self.row = row
            self.column = column
        }
    }

    public struct Placement: Equatable, Sendable {
        public let position: Position
        public let value: Int
        /// Rows, columns and boxes this drop completed (for the glow effect).
        public let completedUnits: [[Position]]
        public let combo: Combo?
        public let sparksGained: Int
        public let won: Bool
    }

    public enum DropOutcome: Equatable, Sendable {
        case placed(Placement)
        case wrong(position: Position, value: Int, reason: WrongReason, lostLastHeart: Bool)
        case columnFull
        case noNumber
        case inactive
    }

    public static let startingHearts = 3
    public static let freeUndos = 3
    public static let sparksPerUnit = 1
    /// Extra Sparks when one drop completes 2 or 3 units at once (Double = 3 total, Triple = 8 total).
    public static func comboBonus(units: Int) -> Int { units == 3 ? 5 : units == 2 ? 1 : 0 }

    public let level: Level
    public let isTimed: Bool
    public private(set) var grid: [[Int]]
    public private(set) var placedByPlayer: [[Bool]]
    public private(set) var hearts: Int
    public private(set) var timeLeft: Int
    public private(set) var status: Status = .playing
    public private(set) var undosLeft: Int
    public private(set) var history: [Position] = []
    public private(set) var awardedUnits: Set<String> = []
    public private(set) var lineSparks = 0
    public private(set) var mistakes = 0
    public private(set) var heartContinueUsed = false

    public var size: Int { level.size }

    public init(level: Level, timed: Bool = true) {
        self.level = level
        self.isTimed = timed
        self.grid = level.givens
        self.placedByPlayer = level.givens.map { row in row.map { _ in false } }
        self.hearts = Game.startingHearts
        self.timeLeft = level.timeLimit
        self.undosLeft = Game.freeUndos
    }

    // MARK: - Reading the board

    /// The lowest gap in a column: the only place a number dropped there can land.
    public func landingRow(column: Int) -> Int? {
        for row in stride(from: size - 1, through: 0, by: -1) where grid[row][column] == 0 {
            return row
        }
        return nil
    }

    /// How many more of this number the board still needs.
    public func remaining(_ value: Int) -> Int {
        size - grid.reduce(0) { total, row in total + row.filter { $0 == value }.count }
    }

    public var isFull: Bool { grid.allSatisfy { row in row.allSatisfy { $0 != 0 } } }

    func boxCells(row: Int, column: Int) -> [Position] {
        let r0 = (row / level.boxRows) * level.boxRows
        let c0 = (column / level.boxCols) * level.boxCols
        var cells: [Position] = []
        for r in r0..<(r0 + level.boxRows) {
            for c in c0..<(c0 + level.boxCols) {
                cells.append(Position(row: r, column: c))
            }
        }
        return cells
    }

    /// Which Sudoku rule a value would break at a cell, if any.
    public func conflict(row: Int, column: Int, value: Int) -> WrongReason? {
        if grid[row].contains(value) { return .row }
        if (0..<size).contains(where: { grid[$0][column] == value }) { return .column }
        if boxCells(row: row, column: column).contains(where: { grid[$0.row][$0.column] == value }) { return .box }
        return nil
    }

    // MARK: - Moves

    public mutating func drop(value: Int, column: Int) -> DropOutcome {
        guard status == .playing else { return .inactive }
        guard value >= 1, value <= size, remaining(value) > 0 else { return .noNumber }
        guard let row = landingRow(column: column) else { return .columnFull }
        let position = Position(row: row, column: column)

        if level.solution[row][column] != value {
            let reason = conflict(row: row, column: column, value: value) ?? .deadEnd
            hearts = max(0, hearts - 1)
            mistakes += 1
            if hearts == 0 { status = .lost }
            return .wrong(position: position, value: value, reason: reason, lostLastHeart: status == .lost)
        }

        grid[row][column] = value
        placedByPlayer[row][column] = true
        history.append(position)

        var units: [[Position]] = []
        var keys: [String] = []
        if grid[row].allSatisfy({ $0 != 0 }) {
            units.append((0..<size).map { Position(row: row, column: $0) })
            keys.append("r\(row)")
        }
        if (0..<size).allSatisfy({ grid[$0][column] != 0 }) {
            units.append((0..<size).map { Position(row: $0, column: column) })
            keys.append("c\(column)")
        }
        let box = boxCells(row: row, column: column)
        if box.allSatisfy({ grid[$0.row][$0.column] != 0 }) {
            units.append(box)
            keys.append("b\(row / level.boxRows)\(column / level.boxCols)")
        }
        // Each row, column and box pays once per attempt, so undo + redo cannot farm Sparks.
        let fresh = keys.filter { !awardedUnits.contains($0) }
        var gain = fresh.count * Game.sparksPerUnit
        if fresh.count >= 2 { gain += Game.comboBonus(units: fresh.count) }
        awardedUnits.formUnion(fresh)
        lineSparks += gain

        let combo: Combo? = units.count == 3 ? .triple : units.count == 2 ? .double : units.count == 1 ? .line : nil
        let won = isFull
        if won { status = .won }
        return .placed(Placement(position: position, value: value, completedUnits: units,
                                 combo: combo, sparksGained: gain, won: won))
    }

    /// Advances the countdown. Returns true on the tick that runs the clock out.
    @discardableResult
    public mutating func tick(seconds: Int = 1) -> Bool {
        guard status == .playing, isTimed else { return false }
        timeLeft = max(0, timeLeft - seconds)
        if timeLeft == 0 {
            status = .timeUp
            return true
        }
        return false
    }

    @discardableResult
    public mutating func undo() -> Bool {
        guard status == .playing, undosLeft > 0, let last = history.popLast() else { return false }
        grid[last.row][last.column] = 0
        placedByPlayer[last.row][last.column] = false
        undosLeft -= 1
        return true
    }

    /// After the 3 free undos, the player can pay Sparks for one more (the caller charges them).
    public mutating func grantExtraUndo() {
        undosLeft += 1
    }

    /// "+1 heart, keep this board": once per attempt, only after losing every heart.
    @discardableResult
    public mutating func continueWithHeart() -> Bool {
        guard status == .lost, !heartContinueUsed else { return false }
        heartContinueUsed = true
        hearts = 1
        status = .playing
        return true
    }

    /// Tutorial lessons 1 and 2 don't cost hearts.
    public mutating func forgiveMistakes() {
        hearts = Game.startingHearts
        mistakes = 0
        if status == .lost { status = .playing }
    }
}

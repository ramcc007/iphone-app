import SwiftUI
import UIKit
import DropkuCore

/// One attempt at a level or tutorial lesson: the rules (Game) plus what the screen shows.
@MainActor
final class GameSession: ObservableObject {
    enum Mode: Equatable {
        case level(index: Int)
        case lesson(index: Int)
    }

    enum Overlay: Equatable {
        case won(LevelResult, PlayerProgress.WinReward)
        case lost
        case timeUp
        case skipped
        case lessonWon
        case lessonLost
    }

    struct Flash: Equatable {
        enum Tone { case info, good, gold, pink, bad }
        let text: String
        let tone: Tone
    }

    struct Crack: Equatable {
        let position: Game.Position
        let value: Int
    }

    @Published private(set) var game: Game
    @Published var selected: Int?
    @Published var hintColumn: Int?
    @Published var hintText: String?
    @Published var flash: Flash?
    @Published var crack: Crack?
    @Published var glow: Set<Game.Position> = []
    @Published var justPlaced: Game.Position?
    @Published var paused = false
    @Published var overlay: Overlay?
    @Published var lessonStep = 0

    let mode: Mode
    private let app: AppModel
    private var timerTask: Task<Void, Never>?

    init(mode: Mode, app: AppModel) {
        self.mode = mode
        self.app = app
        switch mode {
        case .level(let index):
            game = Game(level: app.levels[index])
        case .lesson(let index):
            game = Game(level: Lesson.all[index].level, timed: false)
        }
    }

    var level: Level { game.level }

    var lesson: Lesson? {
        if case .lesson(let index) = mode { return Lesson.all[index] }
        return nil
    }

    var levelIndex: Int? {
        if case .level(let index) = mode { return index }
        return nil
    }

    /// The guided step the tutorial is waiting for, if any.
    var guideStep: Lesson.Step? {
        guard let lesson, game.status == .playing, lessonStep < lesson.steps.count else { return nil }
        return lesson.steps[lessonStep]
    }

    var guideText: String {
        if let hintText { return hintText }
        if let lesson, lessonStep < lesson.stepTexts.count { return lesson.stepTexts[lessonStep] }
        if game.status == .timeUp { return "The clock ran out" }
        if let selected { return "Tap a column to drop the \(selected). The dashed tile shows where it lands." }
        return "Pick a number, then tap a column"
    }

    // MARK: - Clock (fail-safe A4: it only runs while the level is on screen and unpaused)

    func start() {
        timerTask?.cancel()
        timerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                self?.tickIfRunning()
            }
        }
    }

    func stop() {
        timerTask?.cancel()
        timerTask = nil
    }

    func pause() {
        guard game.status == .playing, overlay == nil, game.isTimed else { return }
        paused = true
    }

    func resume() {
        paused = false
    }

    private func tickIfRunning() {
        guard overlay == nil, !paused, game.status == .playing, game.isTimed else { return }
        if game.tick() {
            onTimeUp()
            return
        }
        switch game.timeLeft {
        case 30: show("30 seconds left", .gold)
        case 10: show("10 seconds left!", .bad)
        case ..<10: Haptics.tick()
        default: break
        }
    }

    // MARK: - Moves

    func pick(_ value: Int) {
        guard game.status == .playing, !paused, game.remaining(value) > 0 else { return }
        selected = selected == value ? nil : value
        flash = nil
    }

    func drop(column: Int) {
        guard overlay == nil, !paused, game.status == .playing else { return }
        guard let value = selected else {
            show("Pick a number first", .info)
            return
        }
        switch game.drop(value: value, column: column) {
        case .columnFull:
            show("That column is full", .info)

        case let .wrong(position, wrongValue, reason, _):
            var text = reason == .deadEnd
                ? "A \(wrongValue) can\u{2019}t go there: it leads to a dead end."
                : "There\u{2019}s already a \(wrongValue) in that \(reason.rawValue)."
            if case .lesson(1) = mode, wrongValue == 4, column == 3 {
                text = "See? The 4 fell to the LOWER gap, where it doesn\u{2019}t fit. Fill the lower gap first."
            }
            if let lesson, !lesson.costsHearts {
                game.forgiveMistakes()
            } else {
                text += " (\u{2212}1 heart)"
            }
            crack = Crack(position: position, value: wrongValue)
            hintColumn = nil
            show("Crack! " + text, .bad)
            Haptics.crack()
            Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(650))
                self?.crack = nil
            }
            if game.status == .lost { onLost() }

        case let .placed(placement):
            justPlaced = placement.position
            hintColumn = nil
            hintText = nil
            if lesson != nil, !(lesson?.steps.isEmpty ?? true) { lessonStep += 1 }
            glow = Set(placement.completedUnits.flatMap { $0 })
            switch placement.combo {
            case .triple?:
                show("TRIPLE!! +\(placement.sparksGained) Sparks", .pink)
                Haptics.line()
            case .double?:
                show("DOUBLE! +\(placement.sparksGained) Sparks", .gold)
                Haptics.line()
            case .line?:
                show(placement.sparksGained > 0 ? "Line complete! +1 Spark" : "Line complete!", .good)
                Haptics.line()
            case nil:
                flash = nil
                Haptics.land()
            }
            if game.remaining(value) == 0 || !(lesson?.steps.isEmpty ?? true) { selected = nil }
            Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(800))
                self?.glow = []
            }
            if placement.won { onWon() }

        case .noNumber, .inactive:
            break
        }
    }

    func undo() {
        guard game.status == .playing, !paused else { return }
        guard !game.history.isEmpty else {
            show("Nothing to undo", .info)
            return
        }
        if game.undosLeft == 0 {
            if lesson == nil {
                guard app.progress.sparks >= Economy.extraUndo else {
                    show("Extra undos cost \(Economy.extraUndo) Sparks", .info)
                    return
                }
                app.update { $0.spend(Economy.extraUndo, device: app.deviceID) }
            }
            game.grantExtraUndo()
        }
        if game.undo() {
            if lesson != nil, lessonStep > 0 { lessonStep -= 1 }
            show("Undone", .info)
        }
    }

    func hint() {
        guard lesson == nil, game.status == .playing, !paused else { return }
        guard app.progress.sparks >= Economy.hint else {
            show("Hints cost \(Economy.hint) Sparks. You have \(app.progress.sparks).", .gold)
            return
        }
        guard let hint = game.hint() else { return }
        app.update { $0.spend(Economy.hint, device: app.deviceID) }
        selected = hint.value
        hintColumn = hint.position.column
        hintText = "Hint: drop the \(hint.value) in column \(hint.position.column + 1). \(hint.reason)"
        flash = nil
    }

    func restart() {
        game = Game(level: game.level, timed: game.isTimed)
        selected = nil
        hintColumn = nil
        hintText = nil
        flash = nil
        crack = nil
        glow = []
        justPlaced = nil
        paused = false
        overlay = nil
        lessonStep = 0
    }

    var canBuyHeart: Bool {
        overlay == .lost && !game.heartContinueUsed && app.progress.sparks >= Economy.extraHeart
    }

    func continueWithHeart() {
        guard canBuyHeart, game.continueWithHeart() else { return }
        app.update { $0.spend(Economy.extraHeart, device: app.deviceID) }
        overlay = nil
        show("+1 heart. Keep going!", .gold)
    }

    /// Skip is shown after 2 failed attempts; it needs 400 earned Sparks.
    var skipOffered: Bool { lesson == nil && app.progress.canOfferSkip(level) }
    var canAffordSkip: Bool { app.progress.sparks >= Economy.skip }

    func skip() {
        guard skipOffered, canAffordSkip else { return }
        var skipped = false
        app.update { skipped = $0.skip(level, device: app.deviceID) }
        if skipped { overlay = .skipped }
    }

    // MARK: - Endings

    private func onWon() {
        Haptics.win()
        if case .lesson(let index) = mode {
            if index == Lesson.all.count - 1 { app.finishTutorial() }
            overlay = .lessonWon
            return
        }
        guard let result = game.result() else { return }
        var reward: PlayerProgress.WinReward?
        app.update { reward = $0.recordWin(level, result: result, device: app.deviceID) }
        if let reward { overlay = .won(result, reward) }
    }

    private func onLost() {
        if lesson != nil {
            overlay = .lessonLost
            return
        }
        app.update { $0.recordFailure(level) }
        overlay = .lost
    }

    private func onTimeUp() {
        selected = nil
        app.update { $0.recordFailure(level) }
        overlay = .timeUp
    }

    private func show(_ text: String, _ tone: Flash.Tone) {
        flash = Flash(text: text, tone: tone)
        UIAccessibility.post(notification: .announcement, argument: text)
    }
}

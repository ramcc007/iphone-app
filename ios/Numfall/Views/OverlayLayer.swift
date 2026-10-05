import SwiftUI
import NumfallCore

/// Pause, win, time's up, out of hearts, skipped and tutorial results.
/// On iPhone they slide up from the bottom; in the wide iPad layout they sit in the centre.
struct OverlayLayer: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject var session: GameSession
    let wide: Bool
    @Binding var showRules: Bool

    var body: some View {
        if session.overlay != nil || session.paused {
            ZStack(alignment: wide ? .center : .bottom) {
                Color.black.opacity(0.6).ignoresSafeArea()
                VStack(alignment: .leading, spacing: 12) {
                    content
                }
                .padding(.horizontal, 20).padding(.top, 24).padding(.bottom, 20)
                .frame(maxWidth: 520)
                .background(RoundedRectangle(cornerRadius: 32, style: .continuous).fill(Theme.raised))
                .overlay(RoundedRectangle(cornerRadius: 32, style: .continuous).strokeBorder(borderColor, lineWidth: 1.5))
                .padding(.horizontal, 12)
                .padding(.bottom, wide ? 0 : 8)
            }
            .foregroundStyle(Theme.text)
            .transition(.opacity)
        }
    }

    private var borderColor: Color {
        switch session.overlay {
        case .won?, .lessonWon?, .dailyWon?: return Theme.good.opacity(0.5)
        case .lost?, .timeUp?, .lessonLost?: return Theme.bad.opacity(0.5)
        default: return Color.white.opacity(0.08)
        }
    }

    @ViewBuilder
    private var content: some View {
        let level = session.level
        switch session.overlay {
        case let .won(result, reward)?:
            let cleared = app.progress.bestStars.count
            SheetTitle(reward.wasReplay ? Praise.replayHeadline(improved: reward.sparks > 0) : Praise.headline(cleared: cleared), color: Theme.good)
            Text("Level \(level.number) cleared"
                 + (result.stars == 3 ? " \u{00B7} Perfect, no mistakes" : "")
                 + (!reward.wasReplay && Praise.isNewTitle(cleared: cleared) ? " \u{00B7} New title!" : ""))
                .scaledFont(15, .semibold).foregroundStyle(Theme.soft)
            StarRow(count: result.stars, celebrate: true).frame(maxWidth: .infinity)
            VStack(spacing: 4) {
                if reward.wasReplay {
                    RewardRow(label: reward.sparks > 0 ? "Replay: new stars" : "Replay: no new stars", sparks: reward.sparks)
                } else {
                    ForEach(result.breakdown, id: \.label) { line in RewardRow(label: line.label, sparks: line.sparks) }
                }
            }
            if reward.chest > 0 {
                Label("Chapter \(level.chapter)\(chapterSuffix(level)) complete: chest +\(reward.chest) Sparks", systemImage: "gift.fill")
                    .scaledFont(16, .semibold).foregroundStyle(Theme.spark)
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Theme.spark.opacity(0.12)))
            }
            Text("Wallet: \(app.progress.sparks) Sparks").scaledFont(14, .medium).foregroundStyle(Theme.soft)
            if let board = session.board, let next = session.nextIndex {
                PrimaryButton("Next: Level \(level.number + 1)") { app.play(board, next) }
                LinkButton("Back to the map") { app.goHome() }
            } else {
                Text("That\u{2019}s every \(session.board?.name ?? "") level! Try another board for a new challenge.").font(Theme.rounded(.body, .medium)).foregroundStyle(Theme.soft)
                PrimaryButton("Choose a board") { app.goHome() }
            }

        case let .dailyWon(result, reward)?:
            SheetTitle(result.stars == 3 ? "Perfect Daily Drop!" : "Daily Drop cleared!", color: Theme.good)
            StarRow(count: result.stars, celebrate: true).frame(maxWidth: .infinity)
            if reward.firstClearToday {
                VStack(spacing: 4) {
                    ForEach(result.breakdown, id: \.label) { line in RewardRow(label: line.label, sparks: line.sparks) }
                    RewardRow(label: "Daily bonus", sparks: DailyDrop.rewardBase)
                    if DailyDrop.streakBonus(reward.streak) > 0 {
                        RewardRow(label: "Streak bonus", sparks: DailyDrop.streakBonus(reward.streak))
                    }
                }
            } else {
                BodyText("Played again. Only your best result for today is kept.")
            }
            if reward.streak > 0 {
                Label("\(reward.streak)-day streak", systemImage: "flame.fill")
                    .scaledFont(16, .semibold).foregroundStyle(Color(hex: 0xFF8A3D))
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(hex: 0xFF8A3D).opacity(0.12)))
            }
            Text("Wallet: \(app.progress.sparks) Sparks").scaledFont(14, .medium).foregroundStyle(Theme.soft)
            if !Reminders.offered && !Reminders.enabled {
                ReminderOffer()
            }
            PrimaryButton("Back home") { app.goHome() }

        case .timeUp?:
            SheetTitle("Time\u{2019}s up!", color: Theme.bad)
            BodyText("You filled \(session.game.history.count) of \(level.gaps) gaps. \(restartName(level)) starts again with a fresh board and the full \(level.timeLimit) seconds.")
            PrimaryButton(session.isDaily ? "Start again" : "Start Level \(level.number) again") { session.restart() }
            skipRow
            SecondaryButton("Try another board") { app.goHome() }
            LinkButton("Back to the map") { app.goHome() }
            Text("There is no way to buy extra time: the clock is the challenge.")
                .scaledFont(12, .medium).foregroundStyle(Theme.faint)
                .frame(maxWidth: .infinity).multilineTextAlignment(.center)

        case .lost?:
            SheetTitle("Out of hearts", color: Theme.bad)
            BodyText("\(restartName(level)) starts again with a fresh board and the full \(level.timeLimit) seconds.")
            PrimaryButton("Start again") { session.restart() }
            if !session.game.heartContinueUsed {
                SecondaryButton("+1 heart, keep this board \u{00B7} \(Economy.extraHeart) \u{2726}") { session.continueWithHeart() }
                    .disabled(!session.canBuyHeart)
                    .opacity(session.canBuyHeart ? 1 : 0.45)
            }
            skipRow
            LinkButton("Back to the map") { app.goHome() }

        case .skipped?:
            SheetTitle("Level skipped", color: Theme.spark)
            if let board = session.board, let next = session.nextIndex {
                BodyText("Level \(level.number + 1) is unlocked. Level \(level.number) stays on your map so you can come back for the stars.")
                PrimaryButton("Play Level \(level.number + 1)") { app.play(board, next) }
            } else {
                BodyText("Level \(level.number) stays on your map so you can come back for the stars.")
            }
            LinkButton("Back to the map") { app.goHome() }

        case .lessonWon?:
            let isLast: Bool = { if case .lesson(let index) = session.mode { return index == Lesson.all.count - 1 }; return false }()
            SheetTitle(isLast ? "You\u{2019}re ready!" : "Level done!", color: Theme.good)
            BodyText(session.lesson?.winText ?? "")
            if isLast {
                Label("Welcome gift: +\(Economy.welcomeGift) Sparks", systemImage: "gift.fill")
                    .scaledFont(16, .semibold).foregroundStyle(Theme.spark)
                PrimaryButton("Choose your board") { app.goHome() }
            } else if case .lesson(let index) = session.mode {
                PrimaryButton("Next level") { app.route = .tutorial(lesson: index + 1) }
            }

        case .lessonLost?:
            SheetTitle("Out of hearts", color: Theme.bad)
            BodyText("That\u{2019}s how a level is lost. No penalty here, so try again!")
            PrimaryButton("Try again") { session.restart() }

        case nil:
            SheetTitle("Paused", color: Theme.text)
            BodyText("The clock is stopped and the board is hidden, so pausing can\u{2019}t buy thinking time.")
            PrimaryButton("Resume") { session.resume() }
            SecondaryButton("Restart level") { session.restart() }
            SecondaryButton("How to play") { showRules = true }
            LinkButton("Back to the map") { app.goHome() }
        }
    }

    /// The Skip row is always shown on a lost level: enabled after 2 failed attempts, greyed out before that.
    @ViewBuilder
    private var skipRow: some View {
        if session.skipOffered {
            Button {
                session.skip()
            } label: {
                Text(session.canAffordSkip
                     ? "Stuck? Skip this level \u{00B7} \(Economy.skip) \u{2726}"
                     : "Skip costs \(Economy.skip) \u{2726} (you have \(app.progress.sparks))")
                    .scaledFont(16, .semibold)
                    .foregroundStyle(Theme.spark)
                    .frame(maxWidth: .infinity).frame(minHeight: 50)
                    .overlay(Capsule().strokeBorder(Theme.spark.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
            }
            .buttonStyle(.plain)
            .disabled(!session.canAffordSkip)
            .opacity(session.canAffordSkip ? 1 : 0.5)
        } else if session.lesson == nil && !session.isDaily {
            let left = session.skipTriesLeft
            VStack(spacing: 4) {
                Button {} label: {
                    Text("Skip this level \u{00B7} \(Economy.skip) \u{2726}")
                        .scaledFont(16, .semibold)
                        .foregroundStyle(Theme.muted)
                        .frame(maxWidth: .infinity).frame(minHeight: 50)
                        .overlay(Capsule().strokeBorder(Theme.muted.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
                }
                .buttonStyle(.plain)
                .disabled(true)
                .opacity(0.55)
                Text("Unlocks after \(Economy.skipAfterFailedAttempts) tries (\(left) more)")
                    .scaledFont(12, .medium).foregroundStyle(Theme.muted)
            }
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Skip this level, \(Economy.skip) Sparks. Locked: unlocks after \(Economy.skipAfterFailedAttempts) tries, \(left) more.")
            .accessibilityAddTraits(.isButton)
        }
    }

    private func restartName(_ level: Level) -> String { session.isDaily ? "The Daily Drop" : "Level \(level.number)" }

    /// " \u{00B7} Finding Your Feet" for the chest line, or nothing when the board is unknown.
    private func chapterSuffix(_ level: Level) -> String {
        guard let board = BoardKind(rawValue: level.board) else { return "" }
        return " \u{00B7} " + Chapters.name(board: board, chapter: level.chapter)
    }
}

/// One-time offer after the first Daily Drop: a quiet 7 pm reminder, off unless the player says yes.
private struct ReminderOffer: View {
    @State private var answered = false

    var body: some View {
        if !answered {
            VStack(alignment: .leading, spacing: 8) {
                Text("Remind me about the Daily Drop?").scaledFont(16, .semibold)
                Text("One quiet message at 7 pm on days you have not played. You can turn it off any time in Settings.")
                    .scaledFont(13, .medium).foregroundStyle(Theme.soft)
                HStack(spacing: 10) {
                    Button("Yes, remind me") {
                        Reminders.markOffered()
                        Task {
                            _ = await Reminders.setEnabled(true)
                            Reminders.reschedule(doneToday: true)
                            answered = true
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    Button("No thanks") {
                        Reminders.markOffered()
                        answered = true
                    }
                    .buttonStyle(.bordered)
                }
                .scaledFont(15, .semibold)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.white.opacity(0.06)))
        }
    }
}

// MARK: - Small building blocks shared by the overlays and menus

struct SheetTitle: View {
    let text: String
    let color: Color
    init(_ text: String, color: Color) { self.text = text; self.color = color }
    var body: some View { Text(text).scaledFont(28).foregroundStyle(color).accessibilityAddTraits(.isHeader) }
}

struct BodyText: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(Theme.rounded(.body, .medium)).foregroundStyle(Theme.soft).fixedSize(horizontal: false, vertical: true)
    }
}

struct RewardRow: View {
    let label: String
    let sparks: Int
    var body: some View {
        HStack {
            Text(label).foregroundStyle(Theme.soft)
            Spacer()
            Text("+\(sparks) \u{2726}").foregroundStyle(Theme.spark).fontWeight(.bold)
        }
        .scaledFont(15, .medium)
    }
}

struct StarRow: View {
    let count: Int
    var celebrate = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = 0

    var body: some View {
        let animate = celebrate && !reduceMotion
        HStack(spacing: 8) {
            ForEach(0..<3, id: \.self) { index in
                let lit = index < count && (!animate || index < shown)
                Image(systemName: lit ? "star.fill" : "star")
                    .font(.system(size: 38, weight: .bold))
                    .foregroundStyle(Theme.spark)
                    .scaleEffect(animate && index < count && !lit ? 0.6 : 1)
                    .opacity(animate && index < count && !lit ? 0.5 : 1)
                    .animation(.spring(response: 0.35, dampingFraction: 0.5), value: shown)
            }
        }
        .background {
            if celebrate && !reduceMotion && count > 0 {
                ConfettiBurst(count: count == 3 ? 60 : 24)
                    .frame(width: 460, height: 320)
                    .allowsHitTesting(false)
            }
        }
        .task {
            guard animate else { return }
            for index in 0..<count {
                try? await Task.sleep(for: .milliseconds(index == 0 ? 250 : 320))
                if Task.isCancelled { return }
                shown = index + 1
                Sound.play(.star(index))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) of 3 stars")
    }
}

/// A short burst of confetti, drawn in code. Runs for 2.5 seconds, then the timeline stops ticking.
struct ConfettiBurst: View {
    let count: Int
    private let duration = 2.5

    private struct Piece {
        let angle: Double      // direction of the first push, in radians (upwards half)
        let speed: Double      // canvas heights per second
        let spin: Double
        let rotation: Double
        let width: CGFloat
        let height: CGFloat
        let color: Int         // tile colour number 1...8
    }

    @State private var start = Date()
    @State private var finished = false
    @State private var pieces: [Piece] = []

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: finished)) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSince(start)
                guard t >= 0, t < duration, size.width > 0, size.height > 0 else { return }
                let width = Double(size.width)
                let height = Double(size.height)
                let fade = max(0.0, min(1.0, (duration - t) / 0.7))
                for piece in pieces {
                    let travel = piece.speed * height * t
                    let gravity = 0.5 * 1.6 * height * t * t   // pulled down after the first push up
                    let x = width * 0.5 + cos(piece.angle) * travel
                    let y = height * 0.45 + sin(piece.angle) * travel + gravity
                    var pieceContext = context
                    pieceContext.translateBy(x: CGFloat(x), y: CGFloat(y))
                    pieceContext.rotate(by: .radians(piece.rotation + piece.spin * t))
                    let rect = CGRect(x: -piece.width / 2, y: -piece.height / 2, width: piece.width, height: piece.height)
                    let colour = Theme.tile(piece.color).base.opacity(fade)
                    pieceContext.fill(Path(roundedRect: rect, cornerRadius: 1.5), with: .color(colour))
                }
            }
        }
        .onAppear {
            start = Date()
            pieces = (0..<max(0, count)).map { _ in
                Piece(angle: Double.random(in: (-Double.pi * 0.95)...(-Double.pi * 0.05)),
                      speed: Double.random(in: 0.25...0.8),
                      spin: Double.random(in: -9...9),
                      rotation: Double.random(in: 0...6.28),
                      width: CGFloat.random(in: 5...9),
                      height: CGFloat.random(in: 8...14),
                      color: Int.random(in: 1...8))
            }
        }
        .task {
            try? await Task.sleep(for: .seconds(duration + 0.2))
            finished = true
        }
        .accessibilityHidden(true)
    }
}

struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    init(_ title: String, action: @escaping () -> Void) { self.title = title; self.action = action }
    var body: some View {
        Button(action: action) {
            Text(title).scaledFont(19).foregroundStyle(.white)
                .frame(maxWidth: .infinity).frame(minHeight: 58)
                .background(Capsule().fill(Theme.accent))
                .background(Capsule().fill(Theme.accentEdge).offset(y: 5))
        }
        .buttonStyle(.plain)
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void
    init(_ title: String, action: @escaping () -> Void) { self.title = title; self.action = action }
    var body: some View {
        Button(action: action) {
            Text(title).scaledFont(16, .semibold).foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity).frame(minHeight: 50)
                .background(Capsule().fill(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }
}

struct LinkButton: View {
    let title: String
    let action: () -> Void
    init(_ title: String, action: @escaping () -> Void) { self.title = title; self.action = action }
    var body: some View {
        Button(action: action) {
            Text(title).scaledFont(15, .semibold).foregroundStyle(Theme.accentSoft)
                .frame(maxWidth: .infinity).frame(minHeight: 44)
        }
        .buttonStyle(.plain)
    }
}

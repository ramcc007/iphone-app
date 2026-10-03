import SwiftUI
import DropkuCore

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
        case .won?, .lessonWon?: return Theme.good.opacity(0.5)
        case .lost?, .timeUp?, .lessonLost?: return Theme.bad.opacity(0.5)
        default: return Color.white.opacity(0.08)
        }
    }

    @ViewBuilder
    private var content: some View {
        let level = session.level
        switch session.overlay {
        case let .won(result, reward)?:
            SheetTitle(result.stars == 3 ? "Perfect!" : "Level \(level.number) complete!", color: Theme.good)
            StarRow(count: result.stars)
            VStack(spacing: 4) {
                if reward.wasReplay {
                    RewardRow(label: reward.sparks > 0 ? "Replay: new stars" : "Replay: no new stars", sparks: reward.sparks)
                } else {
                    ForEach(result.breakdown, id: \.label) { line in RewardRow(label: line.label, sparks: line.sparks) }
                }
            }
            if reward.chest > 0 {
                Label("Chapter \(level.chapter) milestone chest: +\(reward.chest) Sparks", systemImage: "gift.fill")
                    .font(Theme.rounded(16, .semibold)).foregroundStyle(Theme.spark)
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Theme.spark.opacity(0.12)))
            }
            Text("Wallet: \(app.progress.sparks) Sparks").font(Theme.rounded(14, .medium)).foregroundStyle(Theme.soft)
            if let index = session.levelIndex, index + 1 < app.levels.count {
                PrimaryButton("Next: Level \(level.number + 1)") { app.play(index + 1) }
                ShareLink(item: shareText(result)) {
                    Text("Share result").font(Theme.rounded(16, .semibold)).frame(maxWidth: .infinity).frame(height: 50)
                        .background(Capsule().fill(Color.white.opacity(0.08)))
                }
                LinkButton("Back to the map") { app.goHome() }
            } else {
                Text("That\u{2019}s every level so far. More chapters are coming.").font(Theme.rounded(.body, .medium)).foregroundStyle(Theme.soft)
                PrimaryButton("Back to the map") { app.goHome() }
            }

        case .timeUp?:
            SheetTitle("Time\u{2019}s up!", color: Theme.bad)
            BodyText("You filled \(session.game.history.count) of \(level.gaps) gaps. Level \(level.number) starts again with a fresh board and the full \(level.timeLimit) seconds.")
            PrimaryButton("Start Level \(level.number) again") { session.restart() }
            skipButton
            LinkButton("Back to the map") { app.goHome() }

        case .lost?:
            SheetTitle("Out of hearts", color: Theme.bad)
            BodyText("Level \(level.number) starts again with a fresh board and the full \(level.timeLimit) seconds.")
            PrimaryButton("Start again") { session.restart() }
            if !session.game.heartContinueUsed {
                SecondaryButton("+1 heart, keep this board \u{00B7} \(Economy.extraHeart) \u{2726}") { session.continueWithHeart() }
                    .disabled(!session.canBuyHeart)
                    .opacity(session.canBuyHeart ? 1 : 0.45)
            }
            skipButton
            LinkButton("Back to the map") { app.goHome() }

        case .skipped?:
            SheetTitle("Level skipped", color: Theme.spark)
            BodyText("Level \(level.number + 1) is unlocked. Level \(level.number) stays on your map so you can come back for the stars.")
            if let index = session.levelIndex, index + 1 < app.levels.count {
                PrimaryButton("Play Level \(level.number + 1)") { app.play(index + 1) }
            }
            LinkButton("Back to the map") { app.goHome() }

        case .lessonWon?:
            let isLast: Bool = { if case .lesson(let index) = session.mode { return index == Lesson.all.count - 1 }; return false }()
            SheetTitle(isLast ? "You\u{2019}re ready!" : "Lesson done!", color: Theme.good)
            BodyText(session.lesson?.winText ?? "")
            if isLast {
                Label("Welcome gift: +\(Economy.welcomeGift) Sparks", systemImage: "gift.fill")
                    .font(Theme.rounded(16, .semibold)).foregroundStyle(Theme.spark)
                PrimaryButton("Start Level 1") { app.play(0) }
            } else if case .lesson(let index) = session.mode {
                PrimaryButton("Next lesson") { app.route = .tutorial(lesson: index + 1) }
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

    @ViewBuilder
    private var skipButton: some View {
        if session.skipOffered {
            Button {
                session.skip()
            } label: {
                Text(session.canAffordSkip
                     ? "Stuck? Skip this level \u{00B7} \(Economy.skip) \u{2726}"
                     : "Skip costs \(Economy.skip) \u{2726} (you have \(app.progress.sparks))")
                    .font(Theme.rounded(16, .semibold))
                    .foregroundStyle(Theme.spark)
                    .frame(maxWidth: .infinity).frame(height: 50)
                    .overlay(Capsule().strokeBorder(Theme.spark.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
            }
            .buttonStyle(.plain)
            .disabled(!session.canAffordSkip)
            .opacity(session.canAffordSkip ? 1 : 0.5)
        }
    }

    private func shareText(_ result: LevelResult) -> String {
        let stars = String(repeating: "\u{2605}", count: result.stars) + String(repeating: "\u{2606}", count: 3 - result.stars)
        return "Dropku \u{00B7} Level \(session.level.number) \(stars) \u{00B7} \(session.game.timeLeft)s to spare"
    }
}

// MARK: - Small building blocks shared by the overlays and menus

struct SheetTitle: View {
    let text: String
    let color: Color
    init(_ text: String, color: Color) { self.text = text; self.color = color }
    var body: some View { Text(text).font(Theme.rounded(28)).foregroundStyle(color).accessibilityAddTraits(.isHeader) }
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
        .font(Theme.rounded(15, .medium))
    }
}

struct StarRow: View {
    let count: Int
    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<3, id: \.self) { index in
                Image(systemName: index < count ? "star.fill" : "star")
                    .font(.system(size: 38, weight: .bold))
                    .foregroundStyle(Theme.spark)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) of 3 stars")
    }
}

struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    init(_ title: String, action: @escaping () -> Void) { self.title = title; self.action = action }
    var body: some View {
        Button(action: action) {
            Text(title).font(Theme.rounded(19)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).frame(height: 58)
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
            Text(title).font(Theme.rounded(16, .semibold)).foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity).frame(height: 50)
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
            Text(title).font(Theme.rounded(15, .semibold)).foregroundStyle(Theme.accentSoft)
                .frame(maxWidth: .infinity).frame(minHeight: 44)
        }
        .buttonStyle(.plain)
    }
}

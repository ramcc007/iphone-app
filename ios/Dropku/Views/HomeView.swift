import SwiftUI
import DropkuCore

struct HomeView: View {
    @EnvironmentObject private var app: AppModel
    @State private var showRules = false
    @State private var showSettings = false

    private let chapterNames = [1: "First Drops", 2: "Planning"]

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width >= 700
            ScrollView {
                VStack(spacing: 16) {
                    HStack {
                        Button("How to play") { showRules = true }
                            .font(Theme.rounded(15, .semibold))
                            .padding(.horizontal, 14).frame(height: 40)
                            .background(Capsule().fill(Theme.surface))
                        Spacer()
                        SparksLabel(amount: app.progress.sparks, size: 16)
                            .padding(.horizontal, 14).frame(height: 40)
                            .background(Capsule().fill(Theme.surface))
                        CircleButton(systemImage: "slider.horizontal.3", label: "Settings") { showSettings = true }
                    }

                    HStack(spacing: 18) {
                        LogoMark(size: wide ? 44 : 30)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Dropku").font(Theme.rounded(wide ? 64 : 44))
                            Text("Sudoku. But the numbers fall.").font(Theme.rounded(.subheadline, .medium)).foregroundStyle(Theme.muted)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 8)

                    let next = app.progress.nextLevelIndex(in: app.levels)
                    if app.levels.indices.contains(next) {
                        let level = app.levels[next]
                        PrimaryButton("\(app.progress.bestStars[level.id] == nil ? "Play" : "Replay") Level \(level.number) \u{00B7} \(level.size)\u{00D7}\(level.size) \u{00B7} \(level.timeLimit)s") {
                            app.play(next)
                        }
                    }

                    ForEach(chapters, id: \.self) { chapter in
                        ChapterCard(chapter: chapter, name: chapterNames[chapter] ?? "Chapter \(chapter)", columns: wide ? 10 : 5)
                    }

                    Text("No ads, nothing to buy. Every Spark is earned by playing.")
                        .font(Theme.rounded(13, .medium)).foregroundStyle(Theme.muted)
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 12)
                }
                .frame(maxWidth: wide ? 820 : 540)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity)
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .foregroundStyle(Theme.text)
        .sheet(isPresented: $showRules) { HowToPlayView() }
        .sheet(isPresented: $showSettings) { SettingsView() }
    }

    private var chapters: [Int] {
        Array(Set(app.levels.map(\.chapter))).sorted()
    }
}

private struct ChapterCard: View {
    @EnvironmentObject private var app: AppModel
    let chapter: Int
    let name: String
    let columns: Int

    var body: some View {
        let indices = app.levels.indices.filter { app.levels[$0].chapter == chapter }
        let stars = indices.reduce(0) { total, index in total + (app.progress.bestStars[app.levels[index].id] ?? 0) }
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("CHAPTER \(chapter) OF 10").font(Theme.rounded(12, .semibold)).foregroundStyle(Theme.muted).tracking(1.5)
                    Text(name).font(Theme.rounded(20))
                }
                Spacer()
                Label("\(stars)/\(indices.count * 3)", systemImage: "star.fill")
                    .font(Theme.rounded(14)).foregroundStyle(Theme.spark)
                    .accessibilityLabel("\(stars) of \(indices.count * 3) stars")
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: columns), spacing: 8) {
                ForEach(indices, id: \.self) { index in
                    LevelTile(index: index, level: app.levels[index])
                }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.surface))
    }
}

private struct LevelTile: View {
    @EnvironmentObject private var app: AppModel
    let index: Int
    let level: Level

    var body: some View {
        let best = app.progress.bestStars[level.id] ?? 0
        let skipped = app.progress.skipped.contains(level.id)
        let unlocked = app.progress.isUnlocked(index, in: app.levels)
        let isNext = app.progress.nextLevelIndex(in: app.levels) == index && best == 0 && !skipped
        Button {
            app.play(index)
        } label: {
            VStack(spacing: 1) {
                Text("\(level.number)").font(Theme.rounded(19))
                if best > 0 {
                    Text(String(repeating: "\u{2605}", count: best) + String(repeating: "\u{2606}", count: 3 - best))
                        .font(Theme.rounded(10, .semibold)).foregroundStyle(Theme.spark)
                } else if skipped {
                    Text("SKIPPED").font(Theme.rounded(9, .semibold))
                } else if isNext {
                    Text("PLAY").font(Theme.rounded(10, .semibold))
                } else if level.role == .milestone {
                    Text("CHEST").font(Theme.rounded(9, .semibold))
                }
            }
            .frame(maxWidth: .infinity).frame(height: 60)
            .foregroundStyle(isNext ? Color.white : (skipped ? Theme.spark : (unlocked ? Theme.text : Theme.faint)))
            .background(background(best: best, isNext: isNext, unlocked: unlocked, skipped: skipped))
            .overlay {
                if level.role == .milestone && best == 0 {
                    RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.spark, lineWidth: 2)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(!unlocked)
        .accessibilityLabel(label(best: best, unlocked: unlocked, skipped: skipped, isNext: isNext))
    }

    @ViewBuilder
    private func background(best: Int, isNext: Bool, unlocked: Bool, skipped: Bool) -> some View {
        if isNext {
            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.accent)
                .shadow(color: Theme.accent.opacity(0.5), radius: 9)
        } else if best > 0 {
            GivenBackground(corner: 16)
        } else if skipped {
            RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.spark.opacity(0.5), lineWidth: 1.5)
        } else {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.white.opacity(0.15), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
        }
    }

    private func label(best: Int, unlocked: Bool, skipped: Bool, isNext: Bool) -> String {
        if best > 0 { return "Level \(level.number), \(best) stars" }
        if skipped { return "Level \(level.number), skipped" }
        if isNext { return "Level \(level.number), play now" }
        return unlocked ? "Level \(level.number)" : "Level \(level.number), locked"
    }
}

/// Three tiles: a number landing on a stack. Same idea as the app icon.
struct LogoMark: View {
    let size: CGFloat
    var body: some View {
        VStack(spacing: size * 0.17) {
            HStack(spacing: size * 0.17) {
                Color.clear.frame(width: size, height: size)
                TileBackground(value: 2, corner: size * 0.3).frame(width: size, height: size)
            }
            HStack(spacing: size * 0.17) {
                TileBackground(value: 5, corner: size * 0.3).frame(width: size, height: size)
                GivenBackground(corner: size * 0.3).frame(width: size, height: size)
            }
        }
        .accessibilityHidden(true)
    }
}

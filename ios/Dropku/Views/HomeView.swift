import SwiftUI
import DropkuCore

struct HomeView: View {
    @EnvironmentObject private var app: AppModel
    @State private var showRules = false
    @State private var showSettings = false

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width >= 700
            let board = app.selectedBoard
            let levels = app.levels(board)
            ScrollView {
                VStack(spacing: 16) {
                    HStack(spacing: 8) {
                        Button("How to play") { showRules = true }
                            .scaledFont(15, .semibold)
                            .lineLimit(1)
                            .padding(.horizontal, 14).frame(minHeight: 44)
                            .background(Capsule().fill(Theme.surface))
                            .layoutPriority(2)
                        if let name = app.progress.profile?.name {
                            Text("Hi, \(name)")
                                .scaledFont(15, .semibold)
                                .foregroundStyle(Theme.soft)
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .padding(.horizontal, 14).frame(minHeight: 40)
                                .background(Capsule().fill(Theme.surface.opacity(0.85)))
                                .layoutPriority(0)
                                .accessibilityLabel("Hi, \(name)")
                        }
                        Spacer(minLength: 0)
                        SparksLabel(amount: app.progress.sparks, size: 16)
                            .padding(.horizontal, 14).frame(minHeight: 40)
                            .background(Capsule().fill(Theme.surface))
                            .layoutPriority(2)
                        CircleButton(systemImage: "slider.horizontal.3", label: "Settings") { showSettings = true }
                            .layoutPriority(2)
                    }

                    HStack(spacing: 18) {
                        LogoMark(size: wide ? 44 : 30)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Dropku").scaledFont(wide ? 64 : 44)
                            Text("Sudoku. But the numbers fall.").font(Theme.rounded(.subheadline, .medium)).foregroundStyle(Theme.muted)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 8)

                    BoardPicker(wide: wide)

                    if let first = levels.first, let last = levels.last {
                        Text("\(board.blurb) \(levels.count) levels, \(clockText(first.timeLimit)) to \(clockText(last.timeLimit)) each.")
                            .scaledFont(14, .medium).foregroundStyle(Theme.soft)
                            .multilineTextAlignment(.center)
                    }

                    let next = app.progress.nextLevelIndex(in: levels)
                    if levels.indices.contains(next) {
                        let level = levels[next]
                        let isNewLevel = app.progress.bestStars[level.id] == nil
                        PrimaryButton("\(isNewLevel ? "Play" : "Replay") \(board.name) Level \(level.number) \u{00B7} \(clockText(level.timeLimit))") {
                            app.play(board, next)
                        }
                        .pulse(isNewLevel, scale: 1.03, duration: 1.0)
                    }

                    ForEach(chapters(levels), id: \.self) { chapter in
                        ChapterCard(board: board, levels: levels, chapter: chapter, chapterCount: chapters(levels).count, columns: wide ? 10 : 5)
                    }

                    Text("No ads, nothing to buy. Every Spark is earned by playing.")
                        .scaledFont(13, .medium).foregroundStyle(Theme.muted)
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 12)
                }
                .frame(maxWidth: wide ? 820 : 540)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity)
            }
        }
        .background { AnimatedBackground() }
        .foregroundStyle(Theme.text)
        .sheet(isPresented: $showRules) { HowToPlayView() }
        .sheet(isPresented: $showSettings) { SettingsView() }
    }

    private func chapters(_ levels: [Level]) -> [Int] {
        Array(Set(levels.map(\.chapter))).sorted()
    }
}

/// "45s" under two minutes, "4:00" from there (the in-game clock always counts in seconds).
func clockText(_ seconds: Int) -> String {
    seconds < 120 ? "\(seconds)s" : "\(seconds / 60):" + String(format: "%02d", seconds % 60)
}

/// Quick 4x4, Classic 6x6, Master 9x9. All open from the start; each keeps its own progress.
private struct BoardPicker: View {
    @EnvironmentObject private var app: AppModel
    let wide: Bool

    var body: some View {
        HStack(spacing: 8) {
            ForEach(BoardKind.allCases) { kind in
                let levels = app.levels(kind)
                let done = levels.filter { app.progress.bestStars[$0.id] != nil || app.progress.skipped.contains($0.id) }.count
                let selected = app.selectedBoard == kind
                Button {
                    app.selectedBoard = kind
                } label: {
                    VStack(spacing: 3) {
                        BoardIcon(kind: kind).frame(width: 40, height: 40).padding(.bottom, 4)
                        Text(kind.name).scaledFont(wide ? 20 : 17)
                        Text("\(kind.size)\u{00D7}\(kind.size)").scaledFont(13, .semibold).foregroundStyle(Theme.soft)
                        Text("\(done)/\(levels.count)").scaledFont(12, .medium).foregroundStyle(Theme.muted)
                    }
                    .frame(maxWidth: .infinity, minHeight: wide ? 132 : 112)
                    .background(RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(selected ? Theme.accent.opacity(0.2) : Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .strokeBorder(selected ? Theme.accentSoft : .clear, lineWidth: 2))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(kind.name) board, \(kind.size) by \(kind.size), \(done) of \(levels.count) levels done")
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }
}

/// A small picture of a board: its grid split into boxes, with grey stacks topped by a dropped tile.
struct BoardIcon: View {
    let kind: BoardKind

    var body: some View {
        Canvas { context, size in
            let n = kind.size
            let (boxRows, boxCols) = n == 4 ? (2, 2) : n == 6 ? (2, 3) : (3, 3)
            let gapRatio: CGFloat = n == 9 ? 0.24 : 0.28
            let boxRatio: CGFloat = 0.65
            let units = CGFloat(n) + CGFloat(n - 1) * gapRatio + CGFloat(n / boxCols - 1) * boxRatio
            let cell = min(size.width, size.height) / units
            let colors = [Theme.tile(1).base, Theme.tile(2).base, Theme.tile(4).base, Theme.tile(5).base, Theme.tile(6).base]
            for r in 0..<n {
                for c in 0..<n {
                    let x = (CGFloat(c) * (1 + gapRatio) + CGFloat(c / boxCols) * boxRatio) * cell
                    let y = (CGFloat(r) * (1 + gapRatio) + CGFloat(r / boxRows) * boxRatio) * cell
                    let top = n - 1 - (c * 5 + 2) % max(2, n / 2)
                    let color: Color = r < top ? Color.white.opacity(0.10) : (r == top ? colors[c % colors.count] : Color(hex: 0x59617F))
                    let rect = CGRect(x: x, y: y, width: cell, height: cell)
                    context.fill(Path(roundedRect: rect, cornerRadius: cell * 0.28, style: .continuous), with: .color(color))
                }
            }
        }
        .accessibilityHidden(true)
    }
}

private struct ChapterCard: View {
    @EnvironmentObject private var app: AppModel
    let board: BoardKind
    let levels: [Level]
    let chapter: Int
    let chapterCount: Int
    let columns: Int

    var body: some View {
        let indices = levels.indices.filter { levels[$0].chapter == chapter }
        let range = "Levels \(levels[indices.first!].number)\u{2013}\(levels[indices.last!].number)"
        if let first = indices.first, !app.progress.isUnlocked(first, in: levels) {
            // Locked chapters stay compact, so a 100-level board is still a short scroll.
            HStack {
                Text("Chapter \(chapter) \u{00B7} \(range)").scaledFont(16)
                Spacer()
                Label("Locked", systemImage: "lock.fill").scaledFont(14, .medium)
            }
            .foregroundStyle(Theme.faint)
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.surface))
            .accessibilityElement(children: .combine)
        } else {
            let stars = indices.reduce(0) { total, index in total + (app.progress.bestStars[levels[index].id] ?? 0) }
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(board.name.uppercased()) \u{00B7} CHAPTER \(chapter) OF \(chapterCount)").scaledFont(12, .semibold).foregroundStyle(Theme.muted).tracking(1.5)
                        Text(range).scaledFont(20)
                    }
                    Spacer()
                    Label("\(stars)/\(indices.count * 3)", systemImage: "star.fill")
                        .scaledFont(14).foregroundStyle(Theme.spark)
                        .accessibilityLabel("\(stars) of \(indices.count * 3) stars")
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: columns), spacing: 8) {
                    ForEach(indices, id: \.self) { index in
                        LevelTile(board: board, levels: levels, index: index)
                    }
                }
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.surface))
        }
    }
}

private struct LevelTile: View {
    @EnvironmentObject private var app: AppModel
    let board: BoardKind
    let levels: [Level]
    let index: Int

    var body: some View {
        let level = levels[index]
        let best = app.progress.bestStars[level.id] ?? 0
        let skipped = app.progress.skipped.contains(level.id)
        let unlocked = app.progress.isUnlocked(index, in: levels)
        let isNext = app.progress.nextLevelIndex(in: levels) == index && best == 0 && !skipped
        Button {
            app.play(board, index)
        } label: {
            VStack(spacing: 1) {
                Text("\(level.number)").scaledFont(19)
                if best > 0 {
                    Text(String(repeating: "\u{2605}", count: best) + String(repeating: "\u{2606}", count: 3 - best))
                        .scaledFont(10, .semibold).foregroundStyle(Theme.spark)
                } else if skipped {
                    Text("SKIPPED").scaledFont(9, .semibold)
                } else if isNext {
                    Text("PLAY").scaledFont(10, .semibold)
                } else if level.role == .milestone {
                    Text("CHEST").scaledFont(9, .semibold)
                }
            }
            .frame(maxWidth: .infinity).frame(minHeight: 60)
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
        .accessibilityLabel(label(level: level, best: best, unlocked: unlocked, skipped: skipped, isNext: isNext))
    }

    @ViewBuilder
    private func background(best: Int, isNext: Bool, unlocked: Bool, skipped: Bool) -> some View {
        if isNext {
            GlowingTileBackground(corner: 16)
        } else if best > 0 {
            GivenBackground(corner: 16)
        } else if skipped {
            RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.spark.opacity(0.5), lineWidth: 1.5)
        } else {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.white.opacity(0.15), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
        }
    }

    private func label(level: Level, best: Int, unlocked: Bool, skipped: Bool, isNext: Bool) -> String {
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

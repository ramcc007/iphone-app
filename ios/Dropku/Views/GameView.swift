import SwiftUI
import DropkuCore

/// Tile size and spacing, worked out from the space the board really gets once everything else
/// on the screen is laid out (docs/DEVICES_AND_ASSETS.md). Same formula as the web version.
struct BoardLayout {
    let tile: CGFloat
    let gap: CGFloat
    let boxGap: CGFloat
    let wide: Bool

    init(size n: Int, area: CGSize, wide: Bool) {
        self.wide = wide
        gap = n >= 9 ? 4 : (wide ? 10 : 6)
        boxGap = n >= 9 ? 6 : (wide ? 14 : 8)
        let boxesAcross: CGFloat = n == 9 ? 2 : 1
        let boxesDown: CGFloat = n == 9 ? 2 : CGFloat(n / 2 - 1)
        let gapsAcross = CGFloat(n - 1) * gap + boxesAcross * boxGap + 20
        let gapsDown = CGFloat(n - 1) * gap + boxesDown * boxGap + 20
        let fit = min((area.width - gapsAcross) / CGFloat(n), (area.height - gapsDown) / CGFloat(n))
        tile = max(22, min(wide ? 96 : 92, fit.rounded(.down)))
    }
}

/// The board, sized to whatever space is left for it.
private struct FittedBoard: View {
    @ObservedObject var session: GameSession
    let wide: Bool

    var body: some View {
        GeometryReader { area in
            BoardView(session: session, layout: BoardLayout(size: session.game.size, area: area.size, wide: wide))
                .frame(width: area.size.width, height: area.size.height)
        }
    }
}

struct GameView: View {
    @EnvironmentObject private var app: AppModel
    @StateObject private var session: GameSession
    @Environment(\.scenePhase) private var scenePhase
    @State private var showRules = false

    init(mode: GameSession.Mode, app: AppModel) {
        _session = StateObject(wrappedValue: GameSession(mode: mode, app: app))
    }

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width >= 700 && geo.size.width > geo.size.height * 1.1
            // Short phones (iPhone SE): the 9-number tray goes in one row so the 9x9 board keeps its room.
            let compact = geo.size.height < 750
            ZStack {
                Theme.background.ignoresSafeArea()
                if wide {
                    VStack(spacing: 14) {
                        TopBar(session: session, showRules: $showRules)
                        HStack(alignment: .top, spacing: 36) {
                            FittedBoard(session: session, wide: true)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                            VStack(alignment: .leading, spacing: 14) {
                                StatusPanel(session: session, wide: true)
                                GuideLine(session: session, wide: true)
                                TrayView(session: session, wide: true, compact: false)
                                FlashLine(session: session)
                                Spacer(minLength: 0)
                                ControlsRow(session: session, wide: true)
                            }
                            .frame(width: 380)
                        }
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 20)
                } else {
                    VStack(spacing: 10) {
                        TopBar(session: session, showRules: $showRules)
                        StatusPanel(session: session, wide: false)
                        // One line shows the latest feedback (Crack!, DOUBLE!...) or else the guide, so the board gets the room.
                        Group {
                            if session.flash != nil { FlashLine(session: session) } else { GuideLine(session: session, wide: false) }
                        }
                        .frame(minHeight: 38)
                        FittedBoard(session: session, wide: false)
                            .frame(maxHeight: .infinity)
                        TrayView(session: session, wide: false, compact: compact)
                        ControlsRow(session: session, wide: false)
                    }
                    .frame(maxWidth: 540)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
                OverlayLayer(session: session, wide: wide, showRules: $showRules)
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)   // the board and tray stay playable; menus and pop-ups scale further
        .onAppear { session.start() }
        .onDisappear { session.stop() }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { session.pause() }   // phone call, app switch, lock screen
        }
        .sheet(isPresented: $showRules) {
            HowToPlayView()
                .presentationDetents([.large])
        }
        .onChange(of: showRules) { _, isShowing in
            if isShowing { session.pause() }
        }
        .focusable()
        .onKeyPress { press in handleKey(press) }
    }

    /// Keyboard on iPad and Mac: 1-9 pick a number, P pauses.
    private func handleKey(_ press: KeyPress) -> KeyPress.Result {
        if let digit = Int(press.characters), digit >= 1, digit <= session.game.size {
            session.pick(digit)
            return .handled
        }
        if press.characters.lowercased() == "p" {
            if session.paused { session.resume() } else { session.pause() }
            return .handled
        }
        return .ignored
    }
}

// MARK: - Top bar, status and text lines

private struct TopBar: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject var session: GameSession
    @Binding var showRules: Bool

    var body: some View {
        HStack {
            if session.lesson == nil {
                CircleButton(systemImage: "pause.fill", label: "Pause") { session.pause() }
            } else {
                CircleButton(systemImage: "questionmark", label: "How to play") { showRules = true }
            }
            Spacer()
            VStack(spacing: 2) {
                Text(title).scaledFont(20)
                Text(subtitle).scaledFont(12, .medium).foregroundStyle(Theme.muted)
            }
            Spacer()
            if session.lesson == nil {
                CircleButton(systemImage: "questionmark", label: "How to play") { showRules = true }
            } else {
                Button("Skip") {
                    app.finishTutorial()
                    app.goHome()
                }
                .scaledFont(15, .semibold)
                .padding(.horizontal, 14)
                .frame(minHeight: 40)
                .background(Capsule().fill(Theme.surface))
            }
        }
        .foregroundStyle(Theme.text)
    }

    private var title: String {
        if case .lesson(let index) = session.mode { return "Tutorial \u{00B7} Level \(index + 1) of \(Lesson.all.count)" }
        return "\(session.board?.name ?? "") \u{00B7} Level \(session.level.number)"
    }

    private var subtitle: String {
        if session.lesson != nil { return "No timer while you learn" }
        return "Chapter \(session.level.chapter) \u{00B7} \(session.level.timeLimit)-second limit"
    }
}

struct CircleButton: View {
    let systemImage: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .bold))
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface))
        }
        .accessibilityLabel(label)
    }
}

private struct StatusPanel: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject var session: GameSession
    let wide: Bool

    var body: some View {
        if let lesson = session.lesson {
            VStack(alignment: .leading, spacing: 6) {
                Text(lesson.title.uppercased()).scaledFont(12, .semibold).foregroundStyle(Theme.muted).tracking(1.5)
                Text(lesson.instructions).font(Theme.rounded(.subheadline, .medium)).foregroundStyle(Theme.soft)
                if lesson.costsHearts { Hearts(count: session.game.hearts, size: 22) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Theme.surface))
        } else if wide {
            VStack(spacing: 12) {
                VStack(spacing: 6) {
                    HStack {
                        Text("Time left").scaledFont(18, .semibold)
                        Spacer()
                        Text("\(session.game.timeLeft)s").scaledFont(48).monospacedDigit()
                    }
                    TimerBar(timeLeft: session.game.timeLeft, limit: session.level.timeLimit)
                }
                .padding(.horizontal, 14).padding(.vertical, 8)
                .foregroundStyle(timeColor)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(timeBackground))
                .pulse(session.game.timeLeft <= 10 && session.game.status == .playing, scale: 1.03, duration: 0.5)
                HStack {
                    Hearts(count: session.game.hearts, size: 30)
                    Spacer()
                    SparksLabel(amount: app.progress.sparks, size: 20)
                }
            }
            .padding(18)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.surface))
            .accessibilityElement(children: .combine)
        } else {
            HStack {
                Label("\(session.game.timeLeft)s", systemImage: "timer")
                    .scaledFont(18).monospacedDigit()
                    .foregroundStyle(timeColor)
                    .padding(.horizontal, 12).padding(.bottom, 5)
                    .frame(minHeight: 36)
                    .overlay(alignment: .bottom) {
                        TimerBar(timeLeft: session.game.timeLeft, limit: session.level.timeLimit)
                            .padding(.horizontal, 12).padding(.bottom, 4)
                    }
                    .background(Capsule().fill(timeBackground))
                    .pulse(session.game.timeLeft <= 10 && session.game.status == .playing, scale: 1.06, duration: 0.5)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(session.game.timeLeft) seconds left")
                Spacer()
                Hearts(count: session.game.hearts, size: 22)
                Spacer()
                SparksLabel(amount: app.progress.sparks, size: 16)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Theme.surface))
        }
    }

    private var timeColor: Color {
        session.game.timeLeft <= 10 ? Theme.bad : session.game.timeLeft <= 30 ? Theme.spark : Theme.text
    }

    private var timeBackground: Color {
        session.game.timeLeft <= 10 ? Theme.bad.opacity(0.2) : session.game.timeLeft <= 30 ? Theme.spark.opacity(0.15) : .clear
    }
}

/// A thin bar under the clock that drains as time runs out: green, amber under 30 seconds, red under 10.
struct TimerBar: View {
    let timeLeft: Int
    let limit: Int

    private var fraction: CGFloat {
        guard limit > 0 else { return 0 }
        return CGFloat(min(1.0, max(0.0, Double(timeLeft) / Double(limit))))
    }

    private var colour: Color {
        timeLeft <= 10 ? Theme.bad : timeLeft <= 30 ? Theme.spark : Theme.good
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.14))
                Capsule().fill(colour)
                    .frame(width: max(4, geo.size.width * fraction))
                    .animation(.linear(duration: 1), value: timeLeft)
            }
        }
        .frame(height: 4)
        .accessibilityHidden(true)
    }
}

struct Hearts: View {
    let count: Int
    let size: CGFloat

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<Game.startingHearts, id: \.self) { index in
                Image(systemName: index < count ? "heart.fill" : "heart")
                    .font(.system(size: size * 0.85, weight: .semibold))
                    .foregroundStyle(Theme.bad)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(count) hearts left")
    }
}

struct SparksLabel: View {
    let amount: Int
    let size: CGFloat

    var body: some View {
        Label("\(amount)", systemImage: "sparkle")
            .scaledFont(size)
            .foregroundStyle(Theme.spark)
            .accessibilityLabel("\(amount) Sparks")
    }
}

private struct GuideLine: View {
    @ObservedObject var session: GameSession
    let wide: Bool

    var body: some View {
        Text(session.guideText)
            .scaledFont(wide ? 16 : 14, .medium)
            .foregroundStyle(Theme.soft)
            .multilineTextAlignment(wide ? .leading : .center)
            .frame(maxWidth: .infinity, alignment: wide ? .leading : .center)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct FlashLine: View {
    @ObservedObject var session: GameSession

    var body: some View {
        Text(session.flash?.text ?? " ")
            .scaledFont(18)
            .foregroundStyle(color)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 26)
            .accessibilityHidden(true)   // announced separately by GameSession
    }

    private var color: Color {
        switch session.flash?.tone {
        case .good?: return Theme.good
        case .gold?: return Theme.spark
        case .pink?: return Theme.pink
        case .bad?: return Theme.bad
        default: return Theme.muted
        }
    }
}

// MARK: - Board

private struct BoardView: View {
    @ObservedObject var session: GameSession
    let layout: BoardLayout

    var body: some View {
        let game = session.game
        let n = game.size
        HStack(spacing: layout.gap) {
            ForEach(0..<n, id: \.self) { column in
                Button {
                    session.drop(column: column)
                } label: {
                    VStack(spacing: layout.gap) {
                        ForEach(0..<n, id: \.self) { row in
                            cell(row: row, column: column)
                                .padding(.top, row > 0 && row % game.level.boxRows == 0 ? layout.boxGap : 0)
                        }
                    }
                    .contentShape(Rectangle())   // the whole column is the tap target (needed for 9x9 on iPhone)
                }
                .buttonStyle(.plain)
                .padding(.leading, column > 0 && column % game.level.boxCols == 0 ? layout.boxGap : 0)
                .overlay {
                    if isHighlighted(column) {
                        RoundedRectangle(cornerRadius: layout.tile * 0.3, style: .continuous)
                            .stroke(Theme.spark, lineWidth: 3)
                            .padding(-4)
                            .padding(.leading, column > 0 && column % game.level.boxCols == 0 ? layout.boxGap : 0)
                    }
                }
                .accessibilityLabel(columnLabel(column))
                .accessibilityHint(session.selected.map { "Drops the \($0)" } ?? "Pick a number first")
            }
        }
        .overlay(alignment: .topLeading) {
            if let gain = session.floatingGain {
                let column = gain.position.column
                let row = gain.position.row
                let boxCols = max(1, game.level.boxCols)
                let boxRows = max(1, game.level.boxRows)
                let step: CGFloat = layout.tile + layout.gap
                let boxShiftX: CGFloat = CGFloat(column / boxCols) * layout.boxGap
                let boxShiftY: CGFloat = CGFloat(row / boxRows) * layout.boxGap
                let centreX: CGFloat = CGFloat(column) * step + boxShiftX + layout.tile / 2
                let centreY: CGFloat = CGFloat(row) * step + boxShiftY + layout.tile / 2
                FloatingGainView(text: "+\(gain.amount) \u{2726}", tile: layout.tile)
                    .id(gain.id)
                    .position(x: centreX, y: centreY)
                    .allowsHitTesting(false)
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Theme.surface))
        .blur(radius: session.paused ? 14 : 0)
        .opacity(session.paused ? 0.35 : 1)
        .allowsHitTesting(!session.paused)
    }

    private func isHighlighted(_ column: Int) -> Bool {
        if session.hintColumn == column { return true }
        if let step = session.guideStep, step.column == column, session.selected == step.value { return true }
        return false
    }

    private func columnLabel(_ column: Int) -> String {
        guard let row = session.game.landingRow(column: column) else { return "Column \(column + 1), full" }
        let gaps = (0..<session.game.size).filter { session.game.grid[$0][column] == 0 }.count
        return "Column \(column + 1), \(gaps) gap\(gaps == 1 ? "" : "s"), next number lands in row \(row + 1)"
    }

    @ViewBuilder
    private func cell(row: Int, column: Int) -> some View {
        let game = session.game
        let value = game.grid[row][column]
        let position = Game.Position(row: row, column: column)
        let kind: CellView.Kind = {
            if let crack = session.crack, crack.position == position { return .crack(crack.value) }
            if value != 0 { return game.placedByPlayer[row][column] ? .tile(value) : .given(value) }
            if let selected = session.selected, game.status == .playing, game.landingRow(column: column) == row { return .ghost(selected) }
            return .empty
        }()
        CellView(kind: kind, size: layout.tile, glowing: session.glow.contains(position) && value != 0,
                 fallRows: session.justPlaced == position ? row + 1 : nil, gap: layout.gap)
            .id("\(row)-\(column)-\(value)")   // a new tile appears as a new view, so it can fall into place
    }
}

/// "+N ✦" that rises from the tile that just completed a row, column or box, then fades away.
struct FloatingGainView: View {
    let text: String
    let tile: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var risen = false

    var body: some View {
        Text(text)
            .font(Theme.rounded(max(16, tile * 0.4)))
            .foregroundStyle(Theme.spark)
            .shadow(color: .black.opacity(0.6), radius: 3)
            .fixedSize()
            .offset(y: risen && !reduceMotion ? -tile * 1.2 : 0)
            .opacity(risen ? 0 : 1)
            .onAppear { withAnimation(.easeOut(duration: 1.2)) { risen = true } }
            .accessibilityHidden(true)   // the Sparks gain is already announced by the flash message
    }
}

struct CellView: View {
    enum Kind: Equatable {
        case empty, given(Int), tile(Int), ghost(Int), crack(Int)
    }

    let kind: Kind
    let size: CGFloat
    let glowing: Bool
    let fallRows: Int?
    let gap: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var landed = false

    var body: some View {
        let corner = size * 0.26
        ZStack {
            switch kind {
            case .empty:
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.15), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                    .background(RoundedRectangle(cornerRadius: corner, style: .continuous).fill(Color.white.opacity(0.03)))
            case .given(let value):
                GivenBackground(corner: corner)
                digit(value, color: Color(hex: 0xE6E9F2), weight: .semibold)
            case .tile(let value):
                TileBackground(value: value, corner: corner)
                digit(value, color: Theme.tileInk, weight: .bold)
            case .ghost(let value):
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .strokeBorder(Theme.tile(value).base, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                digit(value, color: Theme.tile(value).base.opacity(0.75), weight: .bold)
            case .crack(let value):
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .fill(Theme.bad.opacity(0.22))
                    .overlay(RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .strokeBorder(Theme.bad, style: StrokeStyle(lineWidth: 2, dash: [6, 4])))
                digit(value, color: Theme.bad, weight: .bold)
            }
        }
        .frame(width: size, height: size)
        .overlay {
            if glowing {
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .stroke(Color.white, lineWidth: 3)
                    .shadow(color: .white.opacity(0.6), radius: 9)
            }
        }
        .offset(y: fallOffset)
        .onAppear {
            guard fallRows != nil, !reduceMotion else { return }
            withAnimation(.spring(response: 0.32, dampingFraction: 0.72)) { landed = true }
        }
        .accessibilityHidden(true)   // the column button speaks for its cells
    }

    private var fallOffset: CGFloat {
        guard let rows = fallRows, !reduceMotion, !landed else { return 0 }
        return -CGFloat(rows) * (size + gap)
    }

    private func digit(_ value: Int, color: Color, weight: Font.Weight) -> some View {
        Text("\(value)")
            .font(.system(size: size * 0.54, weight: weight, design: .rounded))
            .foregroundStyle(color)
    }
}

// MARK: - Number tray and controls

private struct TrayView: View {
    @ObservedObject var session: GameSession
    let wide: Bool
    let compact: Bool

    var body: some View {
        let n = session.game.size
        if wide {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
                ForEach(1...n, id: \.self) { value in NumberButton(session: session, value: value, height: 100, digitSize: 46) }
            }
        } else if n >= 9 && compact {
            HStack(spacing: 4) {
                ForEach(1...n, id: \.self) { value in NumberButton(session: session, value: value, height: 52, digitSize: 22) }
            }
        } else if n >= 9 {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(maximum: 56), spacing: 8), count: 5), spacing: 8) {
                ForEach(1...n, id: \.self) { value in NumberButton(session: session, value: value, height: 54, digitSize: 24) }
            }
        } else {
            HStack(spacing: 8) {
                ForEach(1...n, id: \.self) { value in
                    NumberButton(session: session, value: value, height: 62, digitSize: 27)
                        .frame(maxWidth: 56)
                }
            }
        }
    }
}

private struct NumberButton: View {
    @ObservedObject var session: GameSession
    let value: Int
    let height: CGFloat
    let digitSize: CGFloat

    var body: some View {
        let left = session.game.remaining(value)
        let isSelected = session.selected == value
        let isGuided = session.guideStep?.value == value && !isSelected
        Button {
            session.pick(value)
        } label: {
            VStack(spacing: 0) {
                Text("\(value)").font(Theme.rounded(digitSize))
                Text("\u{00D7}\(left)").font(Theme.rounded(max(11, digitSize * 0.3), .semibold))
            }
            .foregroundStyle(Theme.tileInk)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(TileBackground(value: value, corner: height * 0.24))
            .overlay(RoundedRectangle(cornerRadius: height * 0.24, style: .continuous)
                .stroke(isSelected ? Color.white : (isGuided ? Theme.spark : .clear), lineWidth: 3))
            .offset(y: isSelected ? -6 : 0)
            .opacity(left == 0 ? 0.25 : 1)
            .animation(.easeOut(duration: 0.12), value: isSelected)
        }
        .buttonStyle(.plain)
        .disabled(left == 0)
        .accessibilityLabel("Number \(value), \(left) left")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

private struct ControlsRow: View {
    @ObservedObject var session: GameSession
    let wide: Bool

    var body: some View {
        HStack(spacing: 8) {
            control(undoTitle, color: Theme.text) { session.undo() }
            if session.lesson == nil {
                control("Hint \u{00B7} \(Economy.hint) \u{2726}", color: Theme.spark) { session.hint() }
            }
            control("Restart", color: Theme.text) { session.restart() }
        }
        .frame(maxWidth: .infinity)
    }

    private var undoTitle: String {
        if session.lesson != nil { return "Undo" }
        return session.game.undosLeft > 0 ? "Undo \u{00B7} \(session.game.undosLeft)" : "Undo \u{00B7} \(Economy.extraUndo) \u{2726}"
    }

    private func control(_ title: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .scaledFont(15, .semibold)
                .lineLimit(1)
                .foregroundStyle(color)
                .padding(.horizontal, 14)
                .frame(maxWidth: wide ? .infinity : nil)
                .frame(minHeight: wide ? 56 : 44)
                .background(Capsule().fill(Theme.surface))
        }
        .buttonStyle(.plain)
    }
}

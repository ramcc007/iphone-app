import SwiftUI
import UIKit

/// Colours and shapes from the design canvas ("Numfall – Game Screens").
/// Everything is drawn in code, so it is sharp on every iPhone, iPad and Mac screen.
enum Theme {
    static let background = Color(hex: 0x13161F)
    static let surface = Color(hex: 0x1E2230)
    static let raised = Color(hex: 0x272C3D)
    static let text = Color(hex: 0xF5F6FA)
    static let soft = Color(hex: 0xD7DBE8)
    static let muted = Color(hex: 0xA3A9BF)
    static let faint = Color(hex: 0x8C92AB)
    static let accent = Color(hex: 0x6B5CF0)
    static let accentEdge = Color(hex: 0x4A3DC0)
    static let accentSoft = Color(hex: 0xB3A8FF)
    static let spark = Color(hex: 0xFFB547)
    static let good = Color(hex: 0x6EE7A8)
    static let bad = Color(hex: 0xFF6B7A)
    static let pink = Color(hex: 0xFF8AD8)
    static let given = Color(hex: 0x2A3045)
    static let givenTop = Color(hex: 0x363D57)
    static let givenEdge = Color(hex: 0x1C2030)
    static let tileInk = Color(hex: 0x13161F)

    /// Base, highlight and edge colour for each number tile.
    static func tile(_ value: Int) -> (base: Color, light: Color, edge: Color) {
        switch value {
        case 1: return (Color(hex: 0xFF6B7A), Color(hex: 0xFF97A2), Color(hex: 0xC94656))
        case 2: return (Color(hex: 0xFFB547), Color(hex: 0xFFCF85), Color(hex: 0xC9862A))
        case 3: return (Color(hex: 0xF5E663), Color(hex: 0xFAF29A), Color(hex: 0xBFB244))
        case 4: return (Color(hex: 0x6EE7A8), Color(hex: 0xA0F2C6), Color(hex: 0x3FB27A))
        case 5: return (Color(hex: 0x4FC3F7), Color(hex: 0x8ADAFB), Color(hex: 0x2E8DB8))
        case 6: return (Color(hex: 0x9D8CFF), Color(hex: 0xBDB2FF), Color(hex: 0x6F5ED1))
        case 7: return (Color(hex: 0xFF8AD8), Color(hex: 0xFFB3E6), Color(hex: 0xC25CA6))
        case 8: return (Color(hex: 0x2DD4BF), Color(hex: 0x7EE6D7), Color(hex: 0x1E9E8E))
        default: return (Color(hex: 0xC0C7D6), Color(hex: 0xDDE1EA), Color(hex: 0x8A91A3))
        }
    }

    /// Apple's rounded system font: crisp at any size and free to use on Apple platforms.
    static func rounded(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }

    static func rounded(_ style: Font.TextStyle, _ weight: Font.Weight = .bold) -> Font {
        .system(style, design: .rounded, weight: weight)
    }

    /// The text style a design size scales with, so every size grows and shrinks with the player's
    /// Dynamic Type setting in proportion to the system text it is closest to.
    static func textStyle(forSize size: CGFloat) -> Font.TextStyle {
        switch size {
        case 34...: return .largeTitle
        case 28..<34: return .title
        case 22..<28: return .title2
        case 20..<22: return .title3
        case 17..<20: return .body
        case 16..<17: return .callout
        case 15..<16: return .subheadline
        case 13..<15: return .footnote
        case 12..<13: return .caption
        default: return .caption2
        }
    }
}

/// Rounded system font at a design size that follows Dynamic Type (Settings > Display & Brightness > Text Size,
/// and the Accessibility sizes). Use `.scaledFont(size, weight)` instead of `.font(Theme.rounded(size, weight))`
/// for any text that is not inside a fixed-size game tile.
struct ScaledRounded: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let weight: Font.Weight

    init(size: CGFloat, weight: Font.Weight) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: Theme.textStyle(forSize: size))
        self.weight = weight
    }

    func body(content: Content) -> some View {
        content.font(.system(size: size, weight: weight, design: .rounded))
    }
}

extension View {
    func scaledFont(_ size: CGFloat, _ weight: Font.Weight = .bold) -> some View {
        modifier(ScaledRounded(size: size, weight: weight))
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: 1)
    }
}

/// A raised, glossy number tile: lighter top, darker edge underneath.
struct TileBackground: View {
    let value: Int
    let corner: CGFloat

    var body: some View {
        let colours = Theme.tile(value)
        RoundedRectangle(cornerRadius: corner, style: .continuous)
            .fill(LinearGradient(stops: [.init(color: colours.light, location: 0), .init(color: colours.base, location: 0.58)],
                                 startPoint: .top, endPoint: .bottom))
            .overlay(alignment: .top) {
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .strokeBorder(.white.opacity(0.45), lineWidth: 1.5)
                    .mask { LinearGradient(colors: [.white, .clear], startPoint: .top, endPoint: .center) }
            }
            .background(
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .fill(colours.edge)
                    .offset(y: max(3, corner * 0.3))
            )
    }
}

/// A starting ("given") number: calm grey so the player's own drops stand out.
struct GivenBackground: View {
    let corner: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: corner, style: .continuous)
            .fill(LinearGradient(stops: [.init(color: Theme.givenTop, location: 0), .init(color: Theme.given, location: 0.6)],
                                 startPoint: .top, endPoint: .bottom))
            .background(
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .fill(Theme.givenEdge)
                    .offset(y: max(3, corner * 0.3))
            )
    }
}

/// Short haptic cues. Silently does nothing on devices without haptics (most iPads, Macs).
@MainActor
enum Haptics {
    static var enabled = true

    static func land() {
        guard enabled else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    static func line() {
        guard enabled else { return }
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }

    static func crack() {
        guard enabled else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }

    static func win() {
        guard enabled else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    static func tick() {
        guard enabled else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.5)
    }
}

// MARK: - Motion (all code-drawn; static when Reduce Motion is on)

/// A dark gradient with a few soft, translucent tiles drifting slowly down (gravity, like the game).
/// Cheap by design: about 10 rounded rectangles drawn at 30 frames per second. Static under Reduce Motion.
struct AnimatedBackground: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    private struct Drifter {
        let x: Double        // 0...1 across
        let y: Double        // 0...1.2 down (wraps)
        let size: Double     // points
        let speed: Double    // screens per second
        let sway: Double
        let phase: Double
        let tilt: Double
        let colour: Int
    }

    /// Fixed layout, so the background looks the same every launch and costs nothing to build.
    private let drifters: [Drifter] = (0..<10).map { i in
        let n = Double(i)
        return Drifter(x: (n * 0.37 + 0.08).truncatingRemainder(dividingBy: 1.0),
                       y: (n * 0.61).truncatingRemainder(dividingBy: 1.2),
                       size: 34 + (n * 13).truncatingRemainder(dividingBy: 30),
                       speed: 0.012 + (n * 0.0031).truncatingRemainder(dividingBy: 0.012),
                       sway: 0.015 + (n * 0.007).truncatingRemainder(dividingBy: 0.02),
                       phase: n * 1.7,
                       tilt: (n * 0.9).truncatingRemainder(dividingBy: 1.0) - 0.5,
                       colour: i % 8 + 1)
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x1A1A3A), Theme.background, Color(hex: 0x0F1118)],
                           startPoint: .top, endPoint: .bottom)
            if reduceMotion {
                drawing(at: 0)
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
                    drawing(at: timeline.date.timeIntervalSince(start))
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    private func drawing(at time: Double) -> some View {
        Canvas { context, size in
            let width = Double(size.width)
            let height = Double(size.height)
            guard width > 0, height > 0 else { return }
            for drifter in drifters {
                let fall = (drifter.y + time * drifter.speed).truncatingRemainder(dividingBy: 1.2) - 0.1
                let sway = sin(time * 0.35 + drifter.phase) * drifter.sway
                let centreX = (drifter.x + sway) * width
                let centreY = fall * height
                let side = drifter.size
                var tileContext = context
                tileContext.translateBy(x: CGFloat(centreX), y: CGFloat(centreY))
                tileContext.rotate(by: .radians(drifter.tilt + sin(time * 0.2 + drifter.phase) * 0.12))
                let rect = CGRect(x: -side / 2, y: -side / 2, width: side, height: side)
                let colours = Theme.tile(drifter.colour)
                tileContext.fill(Path(roundedRect: rect, cornerRadius: side * 0.26, style: .continuous),
                                 with: .color(colours.base.opacity(0.10)))
                tileContext.stroke(Path(roundedRect: rect, cornerRadius: side * 0.26, style: .continuous),
                                   with: .color(colours.light.opacity(0.12)), lineWidth: 1)
            }
        }
    }
}

/// A gentle "breathing" scale, for the button that is the obvious next thing to tap.
/// Does nothing when `active` is false or Reduce Motion is on.
struct PulseEffect: ViewModifier {
    let active: Bool
    var scale: CGFloat = 1.04
    var duration: Double = 0.9
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var expanded = false

    private var running: Bool { active && !reduceMotion }

    private var animation: Animation {
        if running { return Animation.easeInOut(duration: duration).repeatForever(autoreverses: true) }
        return Animation.default
    }

    func body(content: Content) -> some View {
        content
            .scaleEffect(expanded ? scale : 1)
            .animation(animation, value: expanded)
            .onAppear { expanded = running }
            .onChange(of: running) { _, isRunning in expanded = isRunning }
    }
}

extension View {
    func pulse(_ active: Bool = true, scale: CGFloat = 1.04, duration: Double = 0.9) -> some View {
        modifier(PulseEffect(active: active, scale: scale, duration: duration))
    }
}

/// The fill of the "next level" tile: accent colour with a soft glow that slowly breathes.
struct GlowingTileBackground: View {
    let corner: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var bright = false

    private var animation: Animation? {
        if reduceMotion { return nil }
        return Animation.easeInOut(duration: 1.1).repeatForever(autoreverses: true)
    }

    var body: some View {
        RoundedRectangle(cornerRadius: corner, style: .continuous)
            .fill(Theme.accent)
            .shadow(color: Theme.accentSoft.opacity(bright ? 0.75 : 0.35), radius: bright ? 13 : 6)
            .animation(animation, value: bright)
            .onAppear { bright = !reduceMotion }
    }
}

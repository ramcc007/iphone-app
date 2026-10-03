import SwiftUI
import UIKit

/// Colours and shapes from the design canvas ("Dropku – Game Screens").
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

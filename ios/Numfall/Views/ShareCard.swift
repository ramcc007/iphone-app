import SwiftUI
import UIKit
import NumfallCore

/// What goes on the share image. Never the board itself, so sharing spoils nothing.
struct ShareCardData: Equatable {
    var headline: String      // "Classic \u{00B7} Level 12" or "Daily Drop \u{00B7} 2026-10-05"
    var stars: Int
    var seconds: Int
    var streak: Int = 0
}

/// A square 1080 x 1080 picture for the share sheet. Static (no animation), drawn entirely with SwiftUI shapes.
struct ShareCardView: View {
    let data: ShareCardData

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x1F1F4A), Theme.background, Color(hex: 0x0F1118)], startPoint: .top, endPoint: .bottom)
            VStack(spacing: 34) {
                HStack(spacing: 24) {
                    LogoMark(size: 56)
                    Text("Numfall").font(.system(size: 92, weight: .bold, design: .rounded))
                }
                .padding(.top, 40)
                Text(data.headline)
                    .font(.system(size: 54, weight: .semibold, design: .rounded))
                    .foregroundStyle(Theme.soft)
                HStack(spacing: 22) {
                    ForEach(0..<3, id: \.self) { index in
                        Image(systemName: index < data.stars ? "star.fill" : "star")
                            .font(.system(size: 150, weight: .bold))
                            .foregroundStyle(index < data.stars ? Theme.spark : Theme.muted)
                    }
                }
                Text(ShareText.clock(data.seconds))
                    .font(.system(size: 210, weight: .bold, design: .rounded))
                    .monospacedDigit()
                if data.streak > 1 {
                    Label("\(data.streak)-day streak", systemImage: "flame.fill")
                        .font(.system(size: 54, weight: .bold, design: .rounded))
                        .foregroundStyle(Color(hex: 0xFF8A3D))
                }
                Spacer(minLength: 0)
                HStack(spacing: 14) {
                    ForEach(1...6, id: \.self) { value in
                        TileBackground(value: value, corner: 26).frame(width: 96, height: 96)
                    }
                }
                Text("numfall.store")
                    .font(.system(size: 40, weight: .semibold, design: .rounded))
                    .foregroundStyle(Theme.muted)
                    .padding(.bottom, 44)
            }
            .foregroundStyle(Theme.text)
        }
        .frame(width: 1080, height: 1080)
    }
}

/// "Share result": a picture plus a short text. The picture is drawn once when the button appears.
struct ShareResultButton: View {
    let data: ShareCardData
    let text: String
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                ShareLink(item: Image(uiImage: image), message: Text(text),
                          preview: SharePreview("My Numfall result", image: Image(uiImage: image))) { label }
            } else {
                ShareLink(item: text) { label }
            }
        }
        .task(id: data) {
            let renderer = ImageRenderer(content: ShareCardView(data: data))
            renderer.scale = 1
            image = renderer.uiImage
        }
    }

    private var label: some View {
        Label("Share result", systemImage: "square.and.arrow.up")
            .scaledFont(16, .semibold)
            .frame(maxWidth: .infinity).frame(minHeight: 50)
            .background(Capsule().fill(Color.white.opacity(0.08)))
    }
}

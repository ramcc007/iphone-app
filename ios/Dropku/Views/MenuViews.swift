import SwiftUI
import DropkuCore

/// Public web pages the app links to. These must exist before App Store submission
/// (docs/APP_STORE_COMPLIANCE.md section 9). [Check] Replace with the real website addresses.
enum AppLinks {
    static let privacy = URL(string: "https://example.com/dropku/privacy")!
    static let terms = URL(string: "https://example.com/dropku/terms")!
    static let support = URL(string: "https://example.com/dropku/support")!
}

struct HowToPlayView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var app: AppModel

    private struct Rule: Identifiable {
        let symbol: String
        let color: Color
        let title: String
        let text: String
        var id: String { title }
    }

    private let rules: [Rule] = [
        Rule(symbol: "checkmark", color: Theme.good, title: "The Sudoku rule", text: "Each row, column and box holds each number once."),
        Rule(symbol: "arrow.down", color: Color(hex: 0x4FC3F7), title: "Numbers fall", text: "Pick a number, tap a column: it drops to the lowest gap. So fill lower gaps first."),
        Rule(symbol: "square.grid.3x3.fill", color: Theme.pink, title: "Three boards", text: "Quick 4\u{00D7}4, Classic 6\u{00D7}6 or Master 9\u{00D7}9. All open from the start."),
        Rule(symbol: "timer", color: Theme.spark, title: "Beat the countdown", text: "Every level has one: seconds on Quick, minutes on Master. Time\u{2019}s up = start the level again."),
        Rule(symbol: "heart.fill", color: Theme.bad, title: "3 hearts", text: "A wrong drop cracks and costs a heart."),
        Rule(symbol: "star.fill", color: Theme.spark, title: "Up to 3 stars", text: "No mistakes, with a quarter of the time still left."),
        Rule(symbol: "sparkle", color: Color(hex: 0x9D8CFF), title: "Sparks", text: "Earned by playing. Spend them on hints, or 400 to skip a level after 2 tries.")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                SheetTitle("How to play", color: Theme.text).padding(.bottom, 4)
                ForEach(rules) { rule in
                    HStack(spacing: 12) {
                        Image(systemName: rule.symbol)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(Theme.tileInk)
                            .frame(width: 40, height: 40)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(rule.color))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rule.title).font(Theme.rounded(.headline))
                            Text(rule.text).font(Theme.rounded(.subheadline, .medium)).foregroundStyle(Theme.soft)
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.surface))
                    .accessibilityElement(children: .combine)
                }
                PrimaryButton("Got it") { dismiss() }.padding(.top, 8)
                SecondaryButton("Replay the tutorial") {
                    dismiss()
                    app.startTutorial()
                }
            }
            .padding(20)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.raised.ignoresSafeArea())
        .foregroundStyle(Theme.text)
    }
}

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var app: AppModel
    @State private var confirmReset = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Game") {
                    Toggle("Haptics", isOn: Binding(
                        get: { app.progress.hapticsOn },
                        set: { value in app.update { $0.hapticsOn = value }; Haptics.enabled = value }
                    ))
                }
                Section("Progress") {
                    LabeledContent("Sparks", value: "\(app.progress.sparks)")
                    LabeledContent("iCloud", value: "Syncs automatically")
                }
                Section("Help and about") {
                    Button("How to play / replay tutorial") {
                        dismiss()
                        app.startTutorial()
                    }
                    Link("Privacy Policy", destination: AppLinks.privacy)
                    Link("Terms of Use", destination: AppLinks.terms)
                    Link("Help & Contact", destination: AppLinks.support)
                }
                Section {
                    Button("Reset all progress\u{2026}", role: .destructive) { confirmReset = true }
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .confirmationDialog("Reset all progress?", isPresented: $confirmReset, titleVisibility: .visible) {
                Button("Delete stars and Sparks", role: .destructive) {
                    dismiss()
                    app.resetProgress()
                }
            } message: {
                Text("This removes your stars, skipped levels and Sparks on this device and in iCloud.")
            }
        }
    }
}

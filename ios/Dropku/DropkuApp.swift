import SwiftUI
import DropkuCore

@main
struct DropkuApp: App {
    @StateObject private var app = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        Group {
            switch app.route {
            case .welcome:
                WelcomeView()
            case .tutorial(let lesson):
                GameView(mode: .lesson(index: lesson), app: app)
            case .home:
                HomeView()
            case .level(let board, let index):
                GameView(mode: .level(board: board, index: index), app: app)
            }
        }
        // A new route gets a fresh screen (and a fresh game session).
        .id(app.route)
        .onAppear { Haptics.enabled = app.progress.hapticsOn }
    }
}

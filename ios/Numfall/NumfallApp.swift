import SwiftUI
import NumfallCore

@main
struct NumfallApp: App {
    @StateObject private var app = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
                .screenshotChrome()
                .dynamicTypeSize(...DynamicTypeSize.accessibility3)   // text follows the player's size, up to the largest accessibility sizes
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.scenePhase) private var scenePhase

    /// Game Center sign-in waits until the player is past the Welcome screen.
    private func startServicesIfReady() {
        if app.route != .welcome { GameCenterService.shared.start() }
    }

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
            case .daily(let day, let levelIndex):
                GameView(mode: .daily(day: day, levelIndex: levelIndex), app: app)
            }
        }
        // A new route gets a fresh screen (and a fresh game session).
        .id(app.route)
        .onAppear {
            Haptics.enabled = app.progress.hapticsOn
            Sound.enabled = app.progress.soundOn
            startServicesIfReady()
            Reminders.reschedule(doneToday: app.progress.dailyDone(on: DayKey(date: Date())))
        }
        .onChange(of: app.route) { _, _ in startServicesIfReady() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Reminders.reschedule(doneToday: app.progress.dailyDone(on: DayKey(date: Date()))) }
        }
    }
}

import Foundation
import SwiftUI
#if canImport(FirebaseAnalytics)
import FirebaseCore
import FirebaseAnalytics
#endif

/// Opt-in ad measurement with Google Analytics for Firebase (owner's decision, 26 October 2026), so Google Ads can count
/// installs and played levels from NumFall's ads.
/// - Off until the player taps Accept (Info.plist keeps collection and every consent type off by default).
/// - Never sends the player's name, sessions or iCloud data; only Firebase's automatic app events plus `tutorial_complete`
///   and `level_clear` (board and stars).
/// - No advertising identifier: the app never shows the App Tracking Transparency prompt, so iOS never hands out the IDFA,
///   and IDFV collection and ad personalisation are turned off in Info.plist.
/// - Only active when the build contains `GoogleService-Info.plist` (the TestFlight workflow writes it from a repository
///   secret) and never in CI screenshot runs.
@MainActor
enum AdMeasurement {
    enum Choice: String { case undecided, allowed, declined }

    private static let key = "numfall.adMeasurement"
    private static var started = false

    static var choice: Choice {
        get { Choice(rawValue: UserDefaults.standard.string(forKey: key) ?? "") ?? .undecided }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: key) }
    }

    /// True when this build can measure at all (configuration file present, not a screenshot run).
    static var available: Bool {
        #if canImport(FirebaseAnalytics)
        return Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil && !isTakingScreenshots
        #else
        return false
        #endif
    }

    /// Whether the player still has to be asked (RootView also waits for a cleared level).
    static var shouldAsk: Bool { available && choice == .undecided }

    static func start() {
        guard available, !started else { return }
        started = true
        #if canImport(FirebaseAnalytics)
        FirebaseApp.configure()
        apply()
        #endif
    }

    /// The player's answer from the prompt or the Settings switch.
    static func set(allowed: Bool) {
        let wasAllowed = choice == .allowed
        choice = allowed ? .allowed : .declined
        guard available else { return }
        start()
        #if canImport(FirebaseAnalytics)
        apply()
        if wasAllowed && !allowed { Analytics.resetAnalyticsData() }   // forget this install's analytics ID
        #endif
    }

    /// Logs an event only when the player has allowed measurement.
    static func log(_ event: String, _ parameters: [String: Any] = [:]) {
        guard available, choice == .allowed else { return }
        #if canImport(FirebaseAnalytics)
        Analytics.logEvent(event, parameters: parameters)
        #endif
    }

    #if canImport(FirebaseAnalytics)
    private static func apply() {
        let on = choice == .allowed
        Analytics.setConsent([
            .analyticsStorage: on ? .granted : .denied,
            .adStorage: on ? .granted : .denied,
            .adUserData: on ? .granted : .denied,
            .adPersonalization: .denied,            // measurement only, never personalised ads
        ])
        Analytics.setAnalyticsCollectionEnabled(on)
    }
    #endif
}

/// The one-time question, shown on the home screen after the first cleared level. Both answers are equally easy;
/// the choice can be changed in Settings.
struct AdMeasurementPrompt: View {
    let answer: (Bool) -> Void

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "hand.raised.fill")
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .accessibilityHidden(true)
            Text("We value your privacy")
                .scaledFont(22, .bold)
                .multilineTextAlignment(.center)
            Text("NumFall uses Google Analytics to understand how the game is played and to measure our ads. Your name and progress are never shared.")
                .scaledFont(16, .regular)
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            VStack(spacing: 6) {
                Text("Change this any time in Settings.")
                    .scaledFont(14, .regular)
                    .foregroundStyle(Theme.muted)
                Link("Privacy Policy", destination: AppLinks.privacy)
                    .scaledFont(14, .semibold)
                    .frame(minHeight: 44)
            }
            VStack(spacing: 10) {
                Button { answer(true) } label: {
                    Text("Accept").scaledFont(17, .semibold).frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                Button { answer(false) } label: {
                    Text("Decline").scaledFont(17, .semibold).frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)   // same style as Accept: neither answer is pushed
            }
            .padding(.top, 6)
        }
        .padding(24)
        .frame(maxWidth: 460)
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled()
    }
}

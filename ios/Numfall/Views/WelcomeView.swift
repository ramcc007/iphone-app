import SwiftUI
import UIKit
import NumfallCore

/// First screen on first launch: asks for a name.
/// Both are saved on the device and in the player's own iCloud only. There is no developer server, so nobody else receives them.
struct WelcomeView: View {
    @EnvironmentObject private var app: AppModel
    @State private var name = isTakingScreenshots ? "Alex" : ""   // store screenshots show a ready "Let's play" button
    @State private var nameTouched = false
    @FocusState private var nameFocused: Bool

    private var cleanName: String? { PlayerProfile.cleanName(name) }
    private var valid: Bool { cleanName != nil }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 22) {
                    LogoMark(size: 44)
                        .padding(.top, 8)

                    VStack(spacing: 8) {
                        Text("Welcome to NumFall")
                            .font(Theme.rounded(.largeTitle))
                            .multilineTextAlignment(.center)
                            .accessibilityAddTraits(.isHeader)
                        Text("Pick a number, drop it in a column and beat the clock.")
                            .font(Theme.rounded(.body, .medium))
                            .foregroundStyle(Theme.soft)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("What\u{2019}s your name?").font(Theme.rounded(.headline))
                            NameField(name: $name, focused: $nameFocused)
                            if let problem = nameProblem(name, showEmpty: nameTouched) {
                                Text(problem).scaledFont(13, .medium).foregroundStyle(Theme.bad)
                                    .fixedSize(horizontal: false, vertical: true)
                            } else if let clean = cleanName {
                                Text("We\u{2019}ll call you \(clean).")
                                    .scaledFont(13, .medium).foregroundStyle(Theme.muted)
                                    .lineLimit(2)
                            }
                        }

                    }
                    .padding(18)
                    .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.surface.opacity(0.92)))

                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "lock.fill").foregroundStyle(Theme.good)
                        Text("Your name stays on this device and in your own iCloud. We never receive it.")
                            .scaledFont(13, .medium)
                            .foregroundStyle(Theme.soft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)

                    PrimaryButton("Let\u{2019}s play") { submit() }
                        .disabled(!valid)
                        .opacity(valid ? 1 : 0.45)
                        .pulse(valid, scale: 1.03, duration: 1.0)
                        .padding(.bottom, 4)

                    LegalLinks()
                }
                .frame(maxWidth: 520)
                .padding(.horizontal, 20)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity, minHeight: geo.size.height)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background { AnimatedBackground() }
        .foregroundStyle(Theme.text)
        .onChange(of: nameFocused) { _, isFocused in
            if !isFocused { nameTouched = true }   // leaving an empty field shows the hint
        }
    }

    private func submit() {
        nameFocused = false
        guard valid else { return }
        app.saveProfile(name: name)
    }
}

/// Privacy Policy, Terms and Support links at the foot of the first screen and the home screen (App Review 5.1.1(i): the policy must be reachable in the app).
struct LegalLinks: View {
    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 18) { links }
            VStack(spacing: 0) { links }
        }
        .scaledFont(14, .semibold)
        .tint(Theme.accentSoft)
    }

    @ViewBuilder private var links: some View {
        Link("Privacy Policy", destination: AppLinks.privacy).frame(minHeight: 44)
        Link("Terms of Use", destination: AppLinks.terms).frame(minHeight: 44)
        Link("Support", destination: AppLinks.support).frame(minHeight: 44)
    }
}

/// Foot of the home screen: a feedback line with the support email (shown as text too, so it can be copied when no
/// mail app is set up), then the Privacy Policy, Terms and Support links.
struct HomeFooter: View {
    var body: some View {
        VStack(spacing: 4) {
            VStack(spacing: 0) {
                Text("Questions or feedback? Write to us:").scaledFont(14, .medium).foregroundStyle(Theme.muted)
                Link(AppLinks.supportEmail, destination: AppLinks.feedbackEmail)
                    .scaledFont(15, .semibold).tint(Theme.accentSoft)
                    .frame(minHeight: 44)
                    .accessibilityLabel("Email \(AppLinks.supportEmail) to send feedback")
                    .contextMenu { Button("Copy email address", systemImage: "doc.on.doc") { UIPasteboard.general.string = AppLinks.supportEmail } }
            }
            .multilineTextAlignment(.center)
            LegalLinks()
        }
        .frame(maxWidth: .infinity)
    }
}

/// Explains what is wrong with a typed name, or nil when it is fine (or still untouched).
func nameProblem(_ raw: String, showEmpty: Bool) -> String? {
    if PlayerProfile.cleanName(raw) != nil { return nil }
    if raw.isEmpty && !showEmpty { return nil }
    return "Please type a name (up to \(PlayerProfile.maxNameLength) characters)."
}

/// The name text field, limited to 20 characters while typing.
struct NameField: View {
    @Binding var name: String
    var focused: FocusState<Bool>.Binding

    var body: some View {
        HStack(spacing: 8) {
            TextField("Your name", text: $name, prompt: Text("Your name").foregroundStyle(Theme.faint))
                .focused(focused)
                .textContentType(.givenName)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled(true)
                .submitLabel(.done)
                .onSubmit { focused.wrappedValue = false }
                .font(Theme.rounded(.title3, .semibold))
                .foregroundStyle(Theme.text)
                .onChange(of: name) { _, newValue in
                    if newValue.count > PlayerProfile.maxNameLength {
                        name = String(newValue.prefix(PlayerProfile.maxNameLength))
                    }
                }
                .accessibilityLabel("Your name")
            Text("\(min(name.count, PlayerProfile.maxNameLength))/\(PlayerProfile.maxNameLength)")
                .scaledFont(12, .medium).foregroundStyle(Theme.faint)
                .monospacedDigit()
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 52)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.background.opacity(0.7)))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(focused.wrappedValue ? Theme.accentSoft : Color.white.opacity(0.12), lineWidth: 1.5))
    }
}

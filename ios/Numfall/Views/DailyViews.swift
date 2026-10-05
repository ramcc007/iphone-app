import SwiftUI
import UIKit
import NumfallCore

/// The Daily Drop card on the home screen: today's puzzle, the streak and the result once it is cleared.
struct DailyCard: View {
    @EnvironmentObject private var app: AppModel
    @State private var clockTick = 0   // bumps when the date changes, so the card moves on to the new day

    var body: some View {
        let _ = clockTick
        let today = DayKey(date: Date())
        let result = app.progress.dailyResult(on: today)
        let done = app.progress.dailyDone(on: today)
        let streak = app.progress.dailyStreak(asOf: today)

        Button { app.playDaily() } label: {
            HStack(spacing: 14) {
                Image(systemName: done ? "checkmark.circle.fill" : "calendar")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(done ? Theme.good : Theme.accentSoft)
                    .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Daily Drop").scaledFont(20)
                    Text(subtitle(done: done, streak: streak, result: result))
                        .scaledFont(13, .medium).foregroundStyle(Theme.soft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 4) {
                    if streak > 0 {
                        Label("\(streak)", systemImage: "flame.fill")
                            .scaledFont(15, .bold).foregroundStyle(Color(hex: 0xFF8A3D))
                    }
                    Text(done ? "Play again" : "Play")
                        .scaledFont(14, .bold)
                        .padding(.horizontal, 14).frame(minHeight: 34)
                        .background(Capsule().fill(done ? Color.white.opacity(0.1) : Theme.accent))
                        .foregroundStyle(.white)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 76)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Theme.accent.opacity(done ? 0.1 : 0.2)))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Theme.accentSoft.opacity(0.5), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Daily Drop. \(subtitle(done: done, streak: streak, result: result))")
        .accessibilityHint(done ? "Plays today's puzzle again" : "Plays today's puzzle")
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in clockTick += 1 }
    }

    private func subtitle(done: Bool, streak: Int, result: DailyResult?) -> String {
        if done, let result {
            return "Cleared \(ShareText.stars(result.stars)) in \(ShareText.clock(result.seconds)). A new puzzle tomorrow."
        }
        let reward = DailyDrop.rewardBase + DailyDrop.streakBonus(streak + 1)
        if streak > 0 { return "Keep your \(streak)-day streak going. +\(reward) \u{2726}" }
        return "Today\u{2019}s puzzle, the same for everyone. +\(reward) \u{2726}"
    }
}

/// Every achievement with its progress. Works without Game Center; Game Center mirrors the unlocked ones.
struct AchievementsView: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        List {
            ForEach(Achievement.allCases) { achievement in
                let value = achievement.progress(in: app.progress)
                let unlocked = value.current >= value.target
                HStack(spacing: 14) {
                    Image(systemName: unlocked ? "trophy.fill" : "lock.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(unlocked ? Theme.spark : Theme.muted)
                        .frame(width: 32)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(achievement.title).font(.headline)
                        Text(achievement.detail).font(.footnote).foregroundStyle(.secondary)
                        if !unlocked && value.target > 1 {
                            ProgressView(value: Double(value.current), total: Double(value.target))
                            Text("\(value.current) of \(value.target)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.vertical, 2)
                .accessibilityElement(children: .combine)
                .accessibilityValue(unlocked ? "Unlocked" : "\(value.current) of \(value.target)")
            }
        }
        .navigationTitle("Achievements")
        .navigationBarTitleDisplayMode(.inline)
    }
}

import Foundation
import UserNotifications
import NumfallCore

/// Optional daily reminder, as a LOCAL notification (no server, no account). Off until the player turns it on.
/// It never nags: one quiet message at 7 pm for the next 14 days (it stops by itself if the app is not opened),
/// it is skipped once today's Daily Drop is cleared, and the text never mentions streaks or what the player would lose.
@MainActor
enum Reminders {
    private static let enabledKey = "numfall.reminders.on"
    private static let offeredKey = "numfall.reminders.offered"
    private static let prefix = "numfall.daily."
    private static let hour = 19
    private static let daysAhead = 14

    static var enabled: Bool { UserDefaults.standard.bool(forKey: enabledKey) }
    /// The one-time "Remind me?" offer after the first Daily Drop has been shown.
    static var offered: Bool { UserDefaults.standard.bool(forKey: offeredKey) }
    static func markOffered() { UserDefaults.standard.set(true, forKey: offeredKey) }

    /// Turning it on asks iOS for permission. Returns whether reminders are now on.
    static func setEnabled(_ on: Bool) async -> Bool {
        let center = UNUserNotificationCenter.current()
        if on {
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
            UserDefaults.standard.set(granted, forKey: enabledKey)
            return granted
        }
        UserDefaults.standard.set(false, forKey: enabledKey)
        await removePending(center)
        return false
    }

    /// Plans the next reminders. Call when the app opens and after the Daily Drop is cleared.
    static func reschedule(doneToday: Bool, now: Date = Date(), calendar: Calendar = .current) {
        Task {
            let center = UNUserNotificationCenter.current()
            await removePending(center)
            guard enabled else { return }
            let status = await center.notificationSettings().authorizationStatus
            guard status == .authorized || status == .provisional else {
                UserDefaults.standard.set(false, forKey: enabledKey)   // turned off in iOS Settings
                return
            }
            for offset in 0..<daysAhead {
                guard let dayDate = calendar.date(byAdding: .day, value: offset, to: now),
                      let fire = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: dayDate),
                      fire > now, !(offset == 0 && doneToday) else { continue }
                let content = UNMutableNotificationContent()
                content.title = "Daily Drop"
                content.body = "Today\u{2019}s puzzle is ready."
                content.sound = .default
                let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fire)
                let request = UNNotificationRequest(identifier: prefix + DayKey(date: fire, calendar: calendar).string,
                                                    content: content,
                                                    trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false))
                try? await center.add(request)
            }
        }
    }

    private static func removePending(_ center: UNUserNotificationCenter) async {
        let pending = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
    }
}

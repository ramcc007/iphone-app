import Foundation

/// How a result is written in the app: stars as symbols and a time as "0:41".
public enum ResultFormat {
    public static func stars(_ n: Int) -> String {
        let count = max(0, min(3, n))
        return String(repeating: "\u{2605}", count: count) + String(repeating: "\u{2606}", count: 3 - count)
    }

    /// "0:41"
    public static func clock(_ seconds: Int) -> String {
        let s = max(0, seconds)
        return "\(s / 60):" + String(format: "%02d", s % 60)
    }
}

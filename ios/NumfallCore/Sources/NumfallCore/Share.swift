import Foundation

/// Text for the Share button. Spoiler-free: it never contains the board, only the result.
public enum ShareText {
    public static let link = "https://www.numfall.store"

    public static func stars(_ n: Int) -> String {
        let count = max(0, min(3, n))
        return String(repeating: "\u{2605}", count: count) + String(repeating: "\u{2606}", count: 3 - count)
    }

    /// "0:41"
    public static func clock(_ seconds: Int) -> String {
        let s = max(0, seconds)
        return "\(s / 60):" + String(format: "%02d", s % 60)
    }

    public static func level(boardName: String, number: Int, stars: Int, seconds: Int) -> String {
        "Numfall \u{00B7} \(boardName) \(number)\n\(Self.stars(stars)) in \(clock(seconds))\nCan you beat it? \(link)"
    }

    public static func daily(day: DayKey, stars: Int, seconds: Int, streak: Int) -> String {
        var text = "Numfall Daily \u{00B7} \(day.string)\n\(Self.stars(stars)) in \(clock(seconds))"
        if streak > 1 { text += "\n\(streak)-day streak" }
        return text + "\nTry today\u{2019}s puzzle: \(link)"
    }
}

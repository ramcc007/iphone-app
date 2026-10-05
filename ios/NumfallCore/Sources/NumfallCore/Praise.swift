import Foundation

/// Compliments for clearing a level, in progression: the more levels a player has cleared (over all boards), the bigger the praise.
/// Mirrored in prototype/web/engine.js (`praise`). Kept short and warm, never about money or pressure.
public enum Praise {
    public struct Title: Equatable, Sendable {
        /// Distinct levels cleared (all boards) at which this title is first earned.
        public let levelsCleared: Int
        public let text: String
    }

    public static let titles: [Title] = [
        Title(levelsCleared: 1, text: "Nice start!"),
        Title(levelsCleared: 2, text: "You\u{2019}re getting it!"),
        Title(levelsCleared: 3, text: "Smooth drop!"),
        Title(levelsCleared: 5, text: "You\u{2019}re on a roll!"),
        Title(levelsCleared: 8, text: "Sharp thinking!"),
        Title(levelsCleared: 10, text: "Double digits!"),
        Title(levelsCleared: 13, text: "You\u{2019}re a natural!"),
        Title(levelsCleared: 16, text: "Smooth moves!"),
        Title(levelsCleared: 20, text: "Brilliant!"),
        Title(levelsCleared: 25, text: "You\u{2019}re a Pro!"),
        Title(levelsCleared: 30, text: "Puzzle power!"),
        Title(levelsCleared: 35, text: "Razor sharp!"),
        Title(levelsCleared: 40, text: "Unstoppable!"),
        Title(levelsCleared: 45, text: "You\u{2019}re an achiever!"),
        Title(levelsCleared: 50, text: "Half a hundred!"),
        Title(levelsCleared: 60, text: "Mastermind at work!"),
        Title(levelsCleared: 70, text: "Number ninja!"),
        Title(levelsCleared: 80, text: "You\u{2019}re a genius!"),
        Title(levelsCleared: 90, text: "Absolute legend!"),
        Title(levelsCleared: 100, text: "Centurion!"),
        Title(levelsCleared: 125, text: "Grandmaster!"),
        Title(levelsCleared: 150, text: "Beyond brilliant!"),
        Title(levelsCleared: 190, text: "Hall of fame!"),
        Title(levelsCleared: 230, text: "You cleared everything!")
    ]

    /// The headline for a first clear, given how many levels are now cleared (this one included).
    public static func headline(cleared: Int) -> String {
        titles.last { $0.levelsCleared <= cleared }?.text ?? titles[0].text
    }

    /// True when this clear just earned a new title.
    public static func isNewTitle(cleared: Int) -> Bool {
        titles.contains { $0.levelsCleared == cleared }
    }

    /// Replays do not move the player along, so they get their own short lines.
    public static func replayHeadline(improved: Bool) -> String {
        improved ? "Better than before!" : "Nice replay!"
    }
}

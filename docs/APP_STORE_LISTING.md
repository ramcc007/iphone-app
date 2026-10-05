# Numfall: App Store listing (v1 draft, 5 October 2026)

Rules this text follows: no other game, brand or trademark names anywhere (Guidelines 2.3.7 and 5.2), nothing the app does not do (2.3.1), no prices or "free" claims in the name or subtitle (2.3.7), no mention of other platforms. Character limits are Apple's; counts below are checked.
Fill in or confirm the items marked **[Owner]** in App Store Connect.

## App information
| Field | Text | Limit |
|---|---|---|
| Name | Numfall | 30 (7 used) |
| Subtitle | Drop numbers. Beat the clock. | 30 (29 used) |
| Primary category | Games | |
| Game subcategory | Puzzle (first), Strategy (second, optional) | |
| Age rating | 4+ (answer "None" to every content question; see below) | |
| Price | Free, no In-App Purchases | |
| Copyright | 2026 Ram C | |
| Privacy Policy URL | https://www.numfall.store/privacy | |
| Support URL | https://www.numfall.store/support | |
| Marketing URL | https://www.numfall.store | |
| Contact email for App Review | support@numfall.store **[Owner: add a phone number too, Apple requires it]** | |

## Promotional text (can change any time without a new build, 170 max, 128 used)
Pick a number, drop it in a column and watch it fall. Fill the grid before the clock runs out. Three boards, 230 levels, no ads.

## Description (4000 max)
Drop the numbers. Beat the clock.

Numfall is a fast, colourful number puzzle. Pick a number from the tray, tap a column, and it falls to the lowest empty cell. Fill the whole grid so that every row, every column and every box holds each number exactly once.

There is a twist: numbers fall. The order you drop them in is part of the puzzle, so you plan which gap to fill first and which must wait. Every level has exactly one solution you can work out by logic, with no guessing.

THREE BOARDS, ALL OPEN FROM THE START
• Quick, 4×4: 30 short levels for a spare minute
• Classic, 6×6: 100 levels with a steady climb in difficulty
• Master, 9×9: 100 big boards with tight clocks

ALWAYS A CLOCK
Every level is timed, and early levels are short on purpose, so you are racing from your first drop. Finish with seconds to spare for more stars and more Sparks.

LEARN IN A MINUTE
A three-level tutorial teaches the whole game: the basic move, why order matters, and how mistakes work. Each real level shows a ghost tile where your number will land.

DAILY DROP
A new puzzle every day, the same for everyone. Clear it to earn bonus Sparks, build a streak and share your result as a picture with no spoilers. An optional reminder is off until you turn it on.

FRESH EVERY TIME
Restart a level and the numbers change while the difficulty stays exactly the same, so you can never beat it from memory. Every board is solvable by logic alone.

EARN, NEVER BUY
Collect Sparks by clearing levels, finishing without mistakes, finishing fast and opening chests every ten levels. Spend them on hints, undos, an extra heart, or to skip a level that has you stuck. Sparks cannot be bought, because there are no purchases at all.

MADE TO FEEL GOOD
• Crisp vector graphics at any size, with a rich dark look
• Smooth animation, haptics and crisp sound effects, each of which you can switch off
• Achievements and leaderboards through Game Center (optional)
• Works on iPhone and iPad, in any orientation
• Large Text, VoiceOver and Reduce Motion supported

PRIVATE BY DESIGN
No ads. No tracking. No account. Numfall asks for a first name to greet you and keeps it, your progress and your session history on your device and in your own iCloud. We never receive it.

Questions or ideas? Write to support@numfall.store.

## Keywords (100 max, 99 used; no spaces; no app name or category words repeated)
puzzle,number,logic,brain,grid,timer,gravity,drop,columns,rows,fill,offline,casual,mind,train,quick

## What's New (version 1.0)
Welcome to Numfall! Three boards, 230 levels and a countdown on every one. Drop the numbers and beat the clock.

## Screenshots (6.9-inch iPhone and 13-inch iPad, required; capture from the real app)
Order and caption (short, no other brand names):
1. Board mid-drop with the ghost tile: "Drop it. Watch it fall."
2. Timer bar and stars: "Beat the clock."
3. Board picker: "Three boards. All open."
4. Level map with chapters: "230 levels, rising steadily."
5. Level complete with Sparks and stars: "Earn Sparks, never buy them."
6. Tutorial step: "Learn it in a minute."
Notes: use the real game screens only, no device frames needed, show no personal name other than a placeholder such as "Alex", keep text inside the safe area.

## Age rating questionnaire (all "None" gives 4+)
Cartoon or fantasy violence, realistic violence, sexual content or nudity, profanity or crude humour, alcohol, tobacco or drug references, mature or suggestive themes, horror or fear themes, medical information, gambling and contests: **None**.
Unrestricted web access: **No**. User-generated content: **No**. Loot boxes or simulated gambling: **No**.

## App Privacy (App Store Connect)
"Data Not Collected." (Game Center scores and achievements go only to Apple's Game Center. Confirm in App Store Connect's privacy questionnaire that using GameKit does not require declaring data as collected by the developer; it normally does not.) The app has no analytics, advertising or third-party code, and the developer receives nothing. The name, progress and sessions stay on the device and in the player's own iCloud (Apple's key-value storage), which is not "collected" by the developer. Tracking: **No**. Re-check this answer if anything below changes.

## Notes for App Review
Numfall is a free single-player number puzzle. No account, sign-in or demo login is needed.

How to try it: on first launch, type any name (for example "Alex") and tap "Let's play". A three-step tutorial follows, then the home screen shows three boards (Quick, Classic, Master) that are all open. Tap a number in the tray, then tap a column; the number falls to the lowest empty cell. Every level has a countdown by design; when it reaches zero the level restarts. After two failed tries, a "Skip this level" option appears and costs Sparks, an in-game score earned by playing.

Data and privacy: Game Center and iCloud are Apple's own services; the app has no server and no third-party SDKs. The first name, progress and session history are stored only on the device and in the user's own iCloud (key-value storage). The app makes no network connections and contains no third-party SDKs, ads or analytics. Settings has "Reset all progress" which deletes this data, and links to the Privacy Policy, Terms and Support pages.

New in this build: a Daily Drop (a Classic level chosen from the date, with a streak), sound effects (synthesised in code, no audio files), Game Center achievements and leaderboards (optional; the app works without signing in), a share image (shows only the result, never the puzzle) and an optional daily reminder (a local notification, off until the player turns it on and iOS permission is given).
Game Center needs the identifiers numfall.stars, numfall.streak and numfall.ach.* (see docs/GAME_CENTER_SETUP.md) to exist in App Store Connect.

Purchases: there are no In-App Purchases and no ads in this version. Sparks cannot be bought.

Content: all levels, art and sounds are original. The app does not reference any other game or brand.

Contact: support@numfall.store

## Before submitting, confirm
- [ ] Bundle ID in Xcode matches the one registered in App Store Connect (currently the placeholder `com.example.numfall`).
- [ ] iCloud (key-value storage) capability is enabled for the App ID, because the Privacy answer relies on it.
- [ ] Screenshots come from a build that matches what is described here (timer, Sparks, three boards).
- [ ] Phone number added to the App Review contact details.
- [ ] Export compliance: the app uses no encryption beyond Apple's standard, so answer "No" to non-exempt encryption (`ITSAppUsesNonExemptEncryption` = NO in Info.plist).
- [ ] The listing says "Large Text, VoiceOver and Reduce Motion supported": test these on a real device before submitting, or remove the line.
- [ ] Re-read the description against the finished app: every sentence must be true (Guideline 2.3.1).

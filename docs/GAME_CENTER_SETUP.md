# Game Center setup (App Store Connect, after the developer account is active)

The app already reports to Game Center when the player is signed in. Create these in App Store Connect, under the app > Services > Game Center, with **exactly** these identifiers (they are compiled into the app):

## Leaderboards (both: Classic, score format Integer, higher is better)
| Reference name | Leaderboard ID | Score |
|---|---|---|
| Total stars | `numfall.stars` | total stars over all boards |
| Longest daily streak | `numfall.streak` | longest run of consecutive cleared Daily Drops |

## Achievements (each worth 10 points, 100 total, one is hidden at most; keep all visible)
| Title | ID | Description |
|---|---|---|
| First drop | `numfall.ach.firstClear` | Clear your first level. |
| Getting warm | `numfall.ach.clear10` | Clear 10 levels. |
| Half century | `numfall.ach.clear50` | Clear 50 levels. |
| Centurion | `numfall.ach.clear100` | Clear 100 levels. |
| Perfectionist | `numfall.ach.threeStars10` | Earn three stars on 10 levels. |
| Big board | `numfall.ach.masterClear` | Clear a Master (9x9) level. |
| Treasure | `numfall.ach.chest` | Open a milestone chest. |
| Daily habit | `numfall.ach.dailyFirst` | Clear a Daily Drop. |
| Three in a row | `numfall.ach.streak3` | Clear the Daily Drop 3 days in a row. |
| Week streak | `numfall.ach.streak7` | Clear the Daily Drop 7 days in a row. |

Each needs a 512 x 512 (or larger) image. The in-app tiles can be reused: draw each as a colour tile with the number or icon.

Also: enable the Game Center capability for the App ID (Xcode does it with automatic signing, or Certificates, Identifiers & Profiles > Identifiers > Capabilities). The entitlement `com.apple.developer.game-center` is already in `Numfall.entitlements`.
Test with a sandbox Game Center account on TestFlight before submitting.

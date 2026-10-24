# NumFall 1.1: store page growth plan (24 October 2026)

Goal: more installs from App Store search and featuring, at no cost.
Owner's decision (24 October 2026): **English only for now**, as English (U.S.) and English (U.K.). The other 11 translations are kept unused in `tools/appstore/listing_1_1.py` (`LATER`).
Listing text: `docs/APP_STORE_LISTING_1.1.md` (generated and limit-checked by `tools/appstore/listing_1_1.py`).

## What the research says

- **Keywords that people search** (Apple Search Popularity, US, measured 17-24 October 2026 via Sonar ASO, scale 5-100):
  "brain games" 61, "logic puzzles" 52, "number games" 49, "number puzzle" 38, "daily puzzle" 5 (too rare to target).
  All four big ones are hard to rank for (difficulty 70-84), so the plan puts the exact phrases in the **name and subtitle**,
  where Apple weighs words most, and spreads related words over the keyword field. App Store autocomplete also shows
  "logic puzzles for adults", "brain games for adults" and "number puzzle game" as common searches, so "Adults" and "Game" are in the en-US name and subtitle.
- **Name change:** "NumFall" alone matches no search. "NumFall: Number Puzzle Game" keeps the brand and adds the phrase players type.
- **A second English listing = more search space.** Apple indexes more than one language per country. Third-party testing
  (AppFollow, AppTweak, MobileAction) reports that the US store also reads Spanish (Mexico), and that the India store reads Hindi and English (U.K.).
  Apple doesn't publish this list, so treat it as likely, not guaranteed. Words only combine inside one language, so English (U.K.) gets 100 extra keyword characters with different words, at no translation cost.
- **In-App Events** (Apple docs): appear on the product page, in search results and in editorial picks. Name 30, short description 50,
  long description 120 characters. Card art 16:9 (1920x1080 to 3840x2160), details art 9:16. An event can last up to 31 days and can be shown up to 14 days before it starts.
  Badge "Challenge" = "achieve a goal before the event ends".
- **Featuring nominations** (Apple docs): Apps → app → Featuring → Nominations. Types: New Content, App Enhancements, App Launch.
  Submit at least 3 weeks before the date you want featured. You can attach an approved In-App Event.
- **Rating prompt** (Apple docs): `requestReview` is shown at most 3 times in 365 days per person, and the system may skip it.
  Ask after a moment of success, never from a button, never in exchange for a reward (guideline 1.1.7 area / 5.6.3).

## Step by step

### Step 1. Today, no review needed: promotional text
App Store Connect → NumFall → **1.0** (the live version) → **Promotional text** → paste the en-US promotional text from `APP_STORE_LISTING_1.1.md` → **Save**.
It goes live in minutes, without a review.

### Step 2. Build 1.1 (rating prompt)
1. Wait for the **iOS build** run on GitHub to finish green (it builds the 1.1 code).
2. GitHub → Actions → **TestFlight upload** → **Run workflow** → version `1.1` → Run.
3. Wait until the build shows **Complete** in App Store Connect → TestFlight (10-30 minutes). Optional: install it from TestFlight and win a level.

What changed in the app: after a 3-star first-time win (once 6+ levels are cleared) or after a Daily Drop with a 3+ day streak,
Apple's standard "Enjoying NumFall?" rating card can appear, at most once per app version. Nothing else changed.

### Step 3. Create version 1.1 and add English (U.K.)
1. App Store Connect → NumFall → Distribution → next to **iOS App**, click **+** → version `1.1` → Create.
2. The language menu at the top right shows **English (U.S.)**; start there.
3. On the 1.1 page (English U.S.): paste **Promotional text, Description, Keywords, What's New** from the file. Support and Marketing URLs stay the same.
4. **App Information** (sidebar) → paste the en-US **Name** and **Subtitle**. These are saved with version 1.1 and go live when 1.1 is approved.
5. Add English (U.K.): **App Information** → language menu (top right) → **Add language** → English (U.K.).
   Paste its **Name** and **Subtitle** there, then switch to the **1.1** version page in English (U.K.) and paste
   **Promotional text, Description, Keywords, What's New**.
   - Screenshots: leave them empty in English (U.K.). The U.S. screenshots are used.
6. Build: click **+** under Build → choose the 1.1 build → encryption question: "None of the algorithms mentioned above".
7. **Add for Review** → **Submit**. Keep **Manually release** or switch to automatic, your choice.


### Step 4. In-App Event: "The 30-Day Daily Drop"
App Store Connect → NumFall → **In-App Events** (sidebar) → **+** (or Create).

| Field | Value |
|---|---|
| Reference name | 30-Day Daily Drop Nov 2026 |
| Event badge | Challenge |
| Deep link | leave empty (opens the app) |
| Event purpose | Appropriate for all users |
| Priority | Normal |
| Start | 15 November 2026, 00:00 |
| End | 14 December 2026, 23:59 (30 days) |
| Publish date | 1 November 2026 (14 days before start, the most allowed) |
| Countries | all where the app is available |
| Event name (30) | The 30-Day Daily Drop |
| Short description (50) | Clear a new puzzle every day and grow your streak. |
| Long description (120) | A fresh number puzzle drops every day. Beat the clock, keep your streak going and climb the Game Center leaderboard. |
| Event card image (16:9) | `design/appstore/event-card-1920x1080.png` |
| Event details image (9:16) | `design/appstore/event-details-1080x1920.png` |

The images have no text on purpose: the App Store prints the event name and description over them.
Then **Submit for Review** (events are reviewed separately from app versions).
Everything it promises already exists: the daily puzzle, streaks and the "Longest daily streak" Game Center leaderboard.

### Step 5. Featuring nomination
App Store Connect → NumFall → **Featuring → Nominations** → **+ → Create Nomination**.

- **Nomination name:** NumFall 30-Day Daily Drop and 1.1
- **Type:** New Content
- **Description:**
  > NumFall is an original number puzzle with gravity, made by an independent developer. Players tap a number and a column, and the number falls to the lowest empty cell; the order of drops is the puzzle. Every row, column and box must hold each number once, against the clock. 230 levels on three boards (4x4, 6x6, 9x9), all solvable without guessing. From 15 November to 14 December we run "The 30-Day Daily Drop": one shared puzzle a day, streaks and a Game Center leaderboard. No ads, no in-app purchases, no tracking, no account, and "Data Not Collected" privacy. Built for iPhone and iPad with SwiftUI, Dynamic Type, VoiceOver labels and Reduce Motion support.
- **Publish date:** custom range 15 November - 14 December 2026.
- **Platforms:** iOS (iPhone and iPad). **Countries / localizations:** keep all.
- **In-App Events:** attach "The 30-Day Daily Drop" once it's approved (you can update a submitted nomination).
- **Supplemental materials:** https://www.numfall.store
- **Helpful details:** Solo indie developer. Original rules, art, sounds and levels. Accessibility: Dynamic Type, VoiceOver, Reduce Motion, 44-point touch targets.

Before sending, check every accessibility claim on your iPhone. Remove any you can't confirm.

## After this
Check App Store Connect → **Analytics** one week after 1.1 goes live: Impressions (search visibility) and Conversion rate by country.
Run `python3 tools/appstore/listing_1_1.py` again after any wording change.

## Sources
- Apple: [Nominate your app for featuring](https://developer.apple.com/help/app-store-connect/manage-featuring-nominations/nominate-your-app-for-featuring)
- Apple: [In-App Events](https://developer.apple.com/app-store/in-app-events/), [Offer In-App Events](https://developer.apple.com/help/app-store-connect/offer-in-app-events/offer-in-app-events/), [Event media specifications](https://developer.apple.com/help/app-store-connect/reference/in-app-events/in-app-event-media-and-audio-specifications/), [Event badges](https://developer.apple.com/help/app-store-connect/reference/in-app-events/in-app-event-badges)
- Apple: [Requesting App Store reviews](https://developer.apple.com/documentation/storekit/requesting-app-store-reviews), [RequestReviewAction](https://developer.apple.com/documentation/storekit/requestreviewaction)
- Cross-localization (third-party testing): [AppFollow](https://appfollow.io/app-store-keywords-localizations), [AppTweak](https://www.apptweak.com/en/aso-blog/how-to-benefit-from-cross-localization-on-the-app-store), [MobileAction](https://www.mobileaction.co/blog/app-store-cross-localization/)
- Search popularity and autocomplete: Sonar ASO keyword metrics (Apple Search Popularity), App Store autocomplete, 24 October 2026

# App Store compliance checklist: NumFall (working title)

This is a living checklist. Re-check Apple's current rules before each submission, because they change every year.
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/

This is not legal advice. Items marked **[Check]** need confirming with Apple's current docs or a professional.

**v1 scope (decided 3 October 2026):** free app, **no In-App Purchases, no ads, no third-party SDKs**, iPhone and iPad (universal). Items marked **(later)** only apply once purchases or ads are added in a future version.

## 1. Accounts and business setup
- [ ] **Apple Developer Program** ($99/year). Enrol as an *Individual* (your legal name is shown as the seller) or an *Organization* (needs a company and a free D-U-N-S number; the company name is shown).
- [ ] **(later)** **Paid Apps Agreement**, plus tax and banking forms. Not needed for a free v1 with no purchases (the Free Apps Agreement is accepted when you enrol).
- [ ] **(later)** **App Store Small Business Program**: apply so Apple's commission is 15% instead of 30%.
- [ ] **EU Digital Services Act trader status**: you must declare it to be distributed in the EU. Traders have their address, phone and email shown publicly on the App Store [Check].
- [ ] **Name.** First search done on 5 October 2026 (see `docs/NAME_SEARCH.md`): "Numpile" recommended, formal trademark search still to do. Search USPTO, the App Store and Google for the final name. The App Store name is limited to 30 characters and must be unique. Consider registering a trademark.

## 2. Design and functionality (Guidelines 2 and 4)
- [ ] The app is complete, with no placeholder content, broken links or "coming soon" items (2.1).
- [ ] No crashes. Test on the smallest and largest supported iPhone (SE and Pro Max), an iPad mini and a 13" iPad, and on the current iOS/iPadOS version.
- [ ] Build with the **current Xcode and iOS SDK** that Apple requires at submission time [Check the yearly deadline].
- [ ] Original mechanic and look, not a clone (4.1 copycats, 4.3 spam).
- [ ] The game is fully playable without signing in to anything.
- [ ] No "Quit" button, and the app never closes itself (HIG).
- [ ] Support iPhone screen sizes, safe areas, Dynamic Type. (The app is dark-only by design: say so, and never claim a light mode in listing text.)
- [ ] **iPad (universal app):** a real iPad layout, not a stretched iPhone one. Apple rejects iPad versions that are just scaled-up iPhone screens (Guideline 2.4.1). Support all iPad orientations and resizable windows (Split View, iPadOS 26 windowing). Apple is phasing out the old "requires full screen" opt-out [Check current status].
- [ ] **Mac (Apple silicon) and Vision Pro:** the iPad app is offered there automatically. Either test it with keyboard and pointer, or opt out in App Store Connect (Pricing and Availability).
- [ ] Don't mention other platforms (Android, etc.) in the app or metadata (2.3.10).
- [ ] **No other game or brand names in anything public (owner's rule, 5 October 2026).** The word "Sudoku" and any other game, company or trademark name must not appear in the app, the App Store name, subtitle, keywords, description, screenshots, website or share text (2.3.7 metadata, 5.2 intellectual property). Describe the rule instead: "each row, column and box holds each number once". Checked by `grep -rIni sudoku` on app, web, canvas and `site/` before each submission (only code comments and `docs/` may use it).
- [ ] App Review notes explain the game and how to reach late levels, with a short video of later chapters. **No hidden unlock or secret feature in the release build** (Guideline 2.3.1 forbids hidden features).

## 3. Payments (Guideline 3.1): (later), not in v1
v1 has nothing to buy. Sparks are earned only and can't be bought, sold or exchanged for anything outside the game, so no payment rules apply. When purchases arrive:
- [ ] All hints, skips, extra moves and the "NumFall Complete" unlock are sold through **In-App Purchase (StoreKit 2)**. No external payment links.
- [ ] **Restore Purchases** button, required for non-consumables such as "NumFall Complete".
- [ ] Prices come from StoreKit and are shown in the local currency. Never hard-code prices.
- [ ] Each IAP has a clear name, description and review screenshot in App Store Connect.
- [ ] No loot boxes. If any are ever added, the odds must be disclosed before purchase (3.1.1).
- [ ] (later) Rewarded ads are optional. Ads must be appropriate for the age rating, closable, and must not appear in the middle of gameplay without warning.
- [ ] No fake timers, misleading "free" offers or manipulative designs aimed at minors.

## 4. Privacy (Guideline 5.1)
- [ ] **Privacy policy URL**, shown in App Store Connect *and* inside the app (Settings → Privacy Policy). Hosted on the website.
- [ ] **App Privacy label** (the "nutrition label") filled in accurately. **v1 target: "Data Not Collected"** (no ads, no analytics SDKs, no accounts). iCloud data lives in the player's own iCloud and isn't collected by us. Game Center is Apple's service [Check the wording when filling in the form].
- [ ] **Privacy manifest (`PrivacyInfo.xcprivacy`)** declaring "required reason" APIs. UserDefaults, file timestamps and similar APIs count. Every third-party SDK must ship its own manifest and signature.
- [ ] **Player name (owner's decision, 4 October 2026; the age question was removed on 5 October 2026).** The first-run "Who's playing?" screen asks for a name only. Rules this must follow:
  - Stored **only on the device and in the player's own iCloud** (key-value store). **No developer server, no analytics, no sharing**, so the App Privacy label can stay "Data Not Collected". If a developer-run cloud is ever added, this changes to "Contact Info: Name" linked to the user, and the privacy policy, label and manifest must change first.
  - **No age is asked or stored.** That keeps data collection minimal (5.1.1) and avoids the young-player questions (COPPA, GDPR-K, Kids rules) that an age field would raise. Old saves that contain an age drop it on the next save.
  - The player can change or delete the name at any time (Settings, "Delete everything"). There is no account, so 5.1.1(v) account deletion does not apply, but deletion is offered anyway.
  - The privacy policy must say what is stored (name, progress, session history of level, result, time used and date), where, and how to delete it.
- [ ] **No account system**, so no account-deletion requirement. If accounts are ever added, in-app account deletion is mandatory (5.1.1(v)), and Sign in with Apple is required if any third-party login is offered (4.8).
- [ ] **App Tracking Transparency:** v1 does no tracking and has no ad SDKs, so there's no prompt.
- [ ] Ask for permissions (notifications) only in context, with a clear reason. The game still works if the player says no.
- [ ] v1 analytics: Apple's built-in App Analytics and crash reports only (App Store Connect), plus TestFlight feedback. No third-party analytics SDK.
- [ ] GDPR (EU/UK) and CCPA (California): the name and session history never leave the device or the player's own iCloud, so we do not collect them. The privacy policy states that [Check with a template or lawyer].

## 5. Age rating and young players
- [ ] Complete Apple's **age rating questionnaire** honestly. The game should rate low (4+ or 9+), with no violence, chat or user-generated content.
- [ ] **Do not** choose the Kids category. Its rules on ads and analytics are much stricter.
- [ ] US state app-store age laws (e.g. Texas, Utah) and Apple's **Declared Age Range API**: check whether developers must respond to age signals [Check before launch].
- [ ] UK Age Appropriate Design Code: use high-privacy defaults and no nudging. This plan already follows it.

## 6. Accessibility
- [ ] VoiceOver labels for every column, tile, button and screen. Columns announce their contents and where the next number lands.
- [ ] Colour is never the only signal. Numbers are always shown, and there is a colour-blind palette.
- [ ] Reduce Motion support, Dynamic Type in menus, and 44pt touch targets.
- [ ] Fill in **Accessibility Nutrition Labels** in App Store Connect honestly [Check current form].

## 7. Store listing (metadata)
- [ ] App name (≤30 characters), subtitle (≤30) and keywords (≤100). No competitor names.
- [ ] Description that matches what the app actually does.
- [ ] **Screenshots:** iPhone 6.9" (1320 × 2868 px) **and** iPad 13" (2064 × 2752 px), both required because the app supports iPad [Check current sizes]. Optional app preview video.
- [ ] Support URL (website), marketing URL (website), privacy policy URL (website).
- [ ] Copyright line, e.g. "© 2026 [Your name or company]".
- [ ] Export compliance: the app uses only standard Apple encryption (HTTPS), so set `ITSAppUsesNonExemptEncryption = NO` [Check].
- [ ] Content rights: confirm you own or license all art, music, sound and fonts.

## 8. Testing before submission
- [ ] TestFlight beta, with external testers via Beta App Review.
- [ ] (later) Test IAP in the sandbox and with a StoreKit config file: buy, restore, interrupted purchase, Ask to Buy.
- [ ] Test iPad in portrait, landscape, Split View (1/3, 1/2, 2/3) and a resizable window, plus the Mac with keyboard and pointer.
- [ ] Run `python3 tools/levelgen/validate.py` and `node tools/failsafe/*.test.js`. All must pass.
- [ ] Test offline play, iCloud sync on two devices, and reinstalling (progress restores).
- [ ] Check the app with VoiceOver, the largest text size and Reduce Motion.

## 9. Website (needed before submission)
- [ ] `/privacy`: privacy policy (draft ready in `site/`, see `site/README.md`)
- [ ] `/terms`: terms of use (or use Apple's standard EULA)
- [ ] `/support`: FAQ and contact email
- [ ] `/`: marketing page with the App Store badge (follow Apple's marketing guidelines for badge usage)


## Links shown in the app (added 5 Oct 2026)
First screen and home screen footer: Privacy Policy, Terms of Use, Support (same links in Settings). The home footer and Settings also show the support email with a "Send feedback" mail link (opens the player's own mail app; covered in the privacy policy). Other common links we do not need yet: Restore Purchases (no IAP), Rate the app (use SKStoreReviewController, never gate on a rating), Licenses/Acknowledgements (only if third-party code is added), Delete my data (already in the player sheet).

## Website addresses (5 Oct 2026)
Marketing URL: https://www.numfall.store
Privacy Policy URL: https://www.numfall.store/privacy
Support URL: https://www.numfall.store/support
Terms: https://www.numfall.store/terms
Support email: support@numfall.store (forwards to the owner's inbox through ImprovMX (MX and SPF records in Vercel DNS); replies are sent from Gmail "Send mail as").

## Features added 5 October 2026 (Daily Drop, sound, Game Center, reminders)
The Share result button was added and then removed again the same day (owner's decision). There is no sharing feature in v1, so the privacy policy and the listing no longer mention one. When it comes back after launch (see `docs/GAME_PLAN.md`, section "Share result, after launch"), update the privacy policy, the listing and this list in the same change.
- **Privacy policy** updated: Daily Drop results are stored on the device and in iCloud; Game Center is Apple's service and optional; the reminder is a local notification. App Privacy answer stays "Data Not Collected", and `PrivacyInfo.xcprivacy` is unchanged (no new required-reason APIs are used beyond UserDefaults).
- **Reminders (Guideline 4.5.4 and 5.1.1):** opt-in only, asked after the first Daily Drop or from Settings, never required to use the app, neutral wording with no streak-loss pressure, stops by itself after 14 days without opening the app.
- **No fake urgency or guilt:** the streak is shown as a score, never as something to lose; there is no purchase to save a streak.
- **Game Center:** optional; needs the identifiers in `docs/GAME_CENTER_SETUP.md`. Leaderboards show the player's Game Center nickname, which is Apple's data, not ours.
- **Sound:** synthesised in code (original), uses the ambient audio category so it respects the silent switch.

# App Store compliance checklist: Dropku (working title)

This is a living checklist. Re-check Apple's current rules before each submission, because they change every year.
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/

This is not legal advice. Items marked **[Check]** need confirming with Apple's current docs or a professional.

## 1. Accounts and business setup
- [ ] **Apple Developer Program** ($99/year). Enrol as an *Individual* (your legal name is shown as the seller) or an *Organization* (needs a company and a free D-U-N-S number; the company name is shown).
- [ ] **Paid Apps Agreement**, plus tax and banking forms in App Store Connect. Required before any In-App Purchase can be sold.
- [ ] **App Store Small Business Program**: apply so Apple's commission is 15% instead of 30%.
- [ ] **EU Digital Services Act trader status**: you must declare it to be distributed in the EU. Traders have their address, phone and email shown publicly on the App Store [Check].
- [ ] **Name.** Search USPTO, the App Store and Google for the final name. The App Store name is limited to 30 characters and must be unique. Consider registering a trademark.

## 2. Design and functionality (Guidelines 2 and 4)
- [ ] The app is complete, with no placeholder content, broken links or "coming soon" items (2.1).
- [ ] No crashes. Test on the oldest supported iPhone and the newest, and on the current iOS version.
- [ ] Build with the **current Xcode and iOS SDK** that Apple requires at submission time [Check the yearly deadline].
- [ ] Original mechanic and look, not a clone (4.1 copycats, 4.3 spam).
- [ ] The game is fully playable without signing in to anything.
- [ ] No "Quit" button, and the app never closes itself (HIG).
- [ ] Support iPhone screen sizes, safe areas, light and dark mode, and Dynamic Type.
- [ ] Don't mention other platforms (Android, etc.) in the app or metadata (2.3.10).
- [ ] App Review notes explain the game and how to reach late levels. Give the reviewer a way to see all levels, for example a review-only debug unlock that is not shipped, or a clear explanation [Check the approach].

## 3. Payments (Guideline 3.1)
- [ ] All hints, skips, extra moves and the "Dropku Complete" unlock are sold through **In-App Purchase (StoreKit 2)**. No external payment links.
- [ ] **Restore Purchases** button, required for non-consumables such as "Dropku Complete".
- [ ] Prices come from StoreKit and are shown in the local currency. Never hard-code prices.
- [ ] Each IAP has a clear name, description and review screenshot in App Store Connect.
- [ ] No loot boxes. If any are ever added, the odds must be disclosed before purchase (3.1.1).
- [ ] Rewarded ads are optional. Ads must be appropriate for the age rating, closable, and must not appear in the middle of gameplay without warning.
- [ ] No fake timers, misleading "free" offers or manipulative designs aimed at minors.

## 4. Privacy (Guideline 5.1)
- [ ] **Privacy policy URL**, shown in App Store Connect *and* inside the app (Settings → Privacy Policy). Hosted on the website.
- [ ] **App Privacy label** (the "nutrition label") filled in accurately. Target: "Data Not Collected", or "Not Linked to You" for anonymous analytics.
- [ ] **Privacy manifest (`PrivacyInfo.xcprivacy`)** declaring "required reason" APIs. UserDefaults, file timestamps and similar APIs count. Every third-party SDK must ship its own manifest and signature.
- [ ] **No account system**, so no account-deletion requirement. If accounts are ever added, in-app account deletion is mandatory (5.1.1(v)), and Sign in with Apple is required if any third-party login is offered (4.8).
- [ ] **App Tracking Transparency.** If the app or ad SDK tracks users across apps, show the ATT prompt before tracking. Plan: no tracking, so no prompt. Use non-personalised ads or SKAdNetwork only.
- [ ] Ask for permissions (notifications) only in context, with a clear reason. The game still works if the player says no.
- [ ] Analytics are anonymous with no ID linking, and declared on the privacy label.
- [ ] GDPR (EU/UK) and CCPA (California): covered by not collecting personal data. The privacy policy states that [Check with a template or lawyer].

## 5. Age rating and young players
- [ ] Complete Apple's **age rating questionnaire** honestly. The game should rate low (4+ or 9+), with no violence, chat or user-generated content.
- [ ] **Do not** choose the Kids category. Its rules on ads and analytics are much stricter.
- [ ] US state app-store age laws (e.g. Texas, Utah) and Apple's **Declared Age Range API**: check whether developers must respond to age signals [Check before launch].
- [ ] UK Age Appropriate Design Code: use high-privacy defaults and no nudging. This plan already follows it.

## 6. Accessibility
- [ ] VoiceOver labels for every cup, button and screen.
- [ ] Colour is never the only signal. Numbers are always shown, and there is a colour-blind palette.
- [ ] Reduce Motion support, Dynamic Type in menus, and 44pt touch targets.
- [ ] Fill in **Accessibility Nutrition Labels** in App Store Connect honestly [Check current form].

## 7. Store listing (metadata)
- [ ] App name (≤30 characters), subtitle (≤30) and keywords (≤100). No competitor names.
- [ ] Description that matches what the app actually does.
- [ ] **Screenshots** at the currently required iPhone sizes (the 6.9" display is required) [Check]. Optional app preview video.
- [ ] Support URL (website), marketing URL (website), privacy policy URL (website).
- [ ] Copyright line, e.g. "© 2026 [Your name or company]".
- [ ] Export compliance: the app uses only standard Apple encryption (HTTPS), so set `ITSAppUsesNonExemptEncryption = NO` [Check].
- [ ] Content rights: confirm you own or license all art, music, sound and fonts.

## 8. Testing before submission
- [ ] TestFlight beta, with external testers via Beta App Review.
- [ ] Test IAP in the sandbox and with a StoreKit config file: buy, restore, interrupted purchase, Ask to Buy.
- [ ] Test offline play, iCloud sync on two devices, and reinstalling (progress restores).
- [ ] Check the app with VoiceOver, the largest text size and Reduce Motion.

## 9. Website (needed before submission)
- [ ] `/privacy`: privacy policy
- [ ] `/terms`: terms of use (or use Apple's standard EULA)
- [ ] `/support`: FAQ and contact email
- [ ] `/`: marketing page with the App Store badge (follow Apple's marketing guidelines for badge usage)

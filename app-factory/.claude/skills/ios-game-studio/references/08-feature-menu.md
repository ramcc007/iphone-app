# Feature menu

Default for every game (owner's decision): the **core retention set**. Everything else only when the owner asks. Each row lists what it costs in compliance work.

## Core retention set (always)

| Feature | Notes |
|---|---|
| Tutorial (3 short untimed levels, skippable, replayable) | Teach by doing |
| Daily challenge, same for everyone, seeded by date | Streak shown as a score, never as something to lose; no paid streak savers |
| Game Center: 2 leaderboards + ~10 achievements | Optional sign-in; IDs in docs; 1024 images |
| iCloud key-value sync | Merge rules: best per level, union of history; works offline |
| Opt-in local reminder | Asked after first daily win; neutral copy; stops after 14 idle days |
| Haptics + procedural sound | Toggles in Settings; respects silent switch and Reduce Motion |
| Earned soft currency (hints, undo, skip) | Earned only in v1; never purchasable without IAP rules |

## Optional (ask first)

| Feature | Value | Extra work |
|---|---|---|
| Home Screen widget (WidgetKit) | Daily reminder without notifications; Apple loves good widgets | App Group entitlement + capability on App ID; widget extension target; screenshots of widget optional |
| Share card (generated result image, no personal data) | Free word of mouth | Privacy policy line; no names in the image by default |
| Live Activity for timed daily | Lock-screen timer | ActivityKit; only for genuinely live sessions |
| App Shortcuts / Siri ("Play today's puzzle") | Discoverability | App Intents; review notes mention |
| Themes / colour-blind palettes | Accessibility + delight | Earned, not sold, in v1 |
| Localisation | More markets | Every string through String Catalog; store listing per language |
| Rate prompt | Ratings | `SKStoreReviewController` only after a win, never gated, max Apple's limits |

## Monetisation later (structure now, switch on later)

- **IAP via StoreKit 2 only**: non-consumable "unlock all"/"remove ads", consumable hint packs, or a supporter tip. Restore Purchases button, prices from StoreKit, clear descriptions, review screenshots per product.
- **Ads**: rewarded ads only (player chooses), never mid-move, age-appropriate network settings; App Tracking Transparency prompt only if tracking; update App Privacy label, privacy policy, `PrivacyInfo.xcprivacy` (SDK manifests), consent (UMP for EEA/UK).
- Before the first sale: Paid Apps Agreement, bank, tax, Small Business Program, EU trader status review.
- Keep v1 listing text free of "no ads"/"free forever" promises so this stays possible.

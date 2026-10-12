# App Store Connect: every field, in order

Apple renames and moves fields often. Use the owner's screenshots as the truth and map these items onto what they see. Character limits are Apple's; count them before giving text.

## Version page (iOS App → 1.0), top to bottom

| Field | Value / rule |
|---|---|
| Header asset (optional, newer UI: 3840x1646 or 5244x2950) | Render with `tools/appstore/header.js`: logo, name, tagline, a lively board. Optional; skip if short on time |
| Screenshots | iPhone (6.9" 1320x2868 or the "medium display" 6.3" 1206x2622 tab) and iPad 13" 2064x2752, 3-10 each, first = core mechanic. From the CI `app-store-screenshots` artifact only |
| App previews (video) | Optional |
| Promotional text (170) | Can change any time without review; engagement-focused |
| Description (4000) | Hook line, how it plays, modes, daily, features, iPhone + iPad + iCloud, support email. True to the build. No "no ads"/"free forever" promises (monetisation may come later). No other brand names |
| Keywords (100) | Comma-separated, no spaces, don't repeat name/category words, no brands |
| Support URL | `https://www.<domain>/support` |
| Marketing URL | `https://www.<domain>` |
| Version / Copyright | `2026 <Owner legal name>` - **blocks submission if empty** |
| Routing app coverage | Leave empty |
| Build | **+** → pick the latest Complete build; answer encryption: "None of the algorithms mentioned above" (with `ITSAppUsesNonExemptEncryption = NO` it may not ask) |
| Game Center | Tick, then add every leaderboard and achievement. Requires the entitlement in the build |
| App Review Information | **Untick "Sign-in required"** when there are no accounts (otherwise user name/password become required errors). Contact first/last name, phone with country code, email `support@<domain>`. Notes = the review notes (see 06) |
| Version release | **Manually release this version** (owner controls launch day) |

## App Information (sidebar)

Name (30), subtitle (30), category Games + subcategories (primary, optional secondary), content rights ("does not contain third-party content"), age rating questionnaire (all None/No for a clean puzzle game → 4+; Loot boxes No; Unrestricted web access No; User-generated content No), privacy policy URL (also under App Privacy).

## Pricing and Availability

Price Free (or tier). Availability: all countries **except China mainland** (needs a game licence/ISBN) and **Vietnam** (game licence); re-check this list each launch. Mac/Vision Pro availability: keep only if tested.

## App Privacy

"Data Not Collected" when: no third-party SDKs, no developer server, data only on device + player's own iCloud, Game Center is Apple's. Publish after saving. Any new data use (ads, analytics, accounts) changes this, the privacy policy and `PrivacyInfo.xcprivacy` together.

## Business / legal (account-level, once)

- EU Digital Services Act **trader status**: declare once (Business → or App Store Regulations & Permits). Traders show address/phone/email publicly in the EU. Free app with no monetisation: usually "not a trader" - owner's legal choice; changes when ads/purchases arrive.
- Paid Apps Agreement + bank + tax (W-8BEN for non-US owners): only when purchases/ads arrive. Then apply to the **Small Business Program** (15% commission) before the first sale.

## Game Center setup

For each leaderboard: reference name, ID `<slug>.<key>`, score format (Integer), sort (High to Low), localization (name, format suffix), optional 1024 image. Achievements: ID `<slug>.ach.<key>`, points (total ≤ 1000), hidden flag, localization with pre/post-earned descriptions, **1024x1024 image** (original, render with code). Keep IDs identical to the Swift code. Write them into `docs/GAME_CENTER_SETUP.md` as a single combined table the owner can copy row by row.

## Listing text template (fill and count)

```
Name (≤30):
Subtitle (≤30):
Promotional text (≤170):
Description (≤4000):
  <Hook: one vivid line about the mechanic>
  <How it plays: 2-3 short sentences>
  <SECTION HEADINGS IN CAPS with bullet points: modes, daily, progression, play your way, iPhone and iPad>
  <Call to action> Questions or ideas? Write to support@<domain>.
Keywords (≤100):
What's New (1.0): Welcome to <Name>! <one line>
Copyright: 2026 <Owner legal name>
```

Before submitting, grep every public text (listing, site, app strings, screenshots' headlines) for the banned brand list and check each sentence is true for the build.

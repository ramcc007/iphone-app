# App Review: notes, common requests and replies

## Review notes (paste into App Review Information → Notes)

```
Thank you for reviewing <Name>, a single-player <genre> with <the twist in one clause>. No account or sign-in is needed.

HOW TO TRY IT (about 2 minutes)
1. On first launch, <first-run step> and tap "<button>".
2. A short <N>-level tutorial teaches the move: <one sentence>.
3. The home screen shows <modes>, all open. <how to start a level>.
4. The <Daily> card on the home screen opens today's puzzle.

THINGS THAT WORK AS DESIGNED
- <timer / lives / retry behaviour>
- <in-game currency is earned only; this version has no In-App Purchases>
- Game Center (achievements and leaderboards) is optional; the game works fully without signing in.
- The daily reminder is a local notification, off until the player turns it on in Settings.

DATA
<What is stored, where (device + player's own iCloud), developer receives none>. Settings has "Reset all progress" plus links to the Privacy Policy, Terms of Use and Support.

All levels, artwork and sounds are original.
Contact: support@<domain>
```

## Guideline 2.1 "Information Needed - New App Submission" (expected for new accounts)

Not a defect. Apple wants a **screen recording on a physical device** starting from launching the app, plus six answers. Prepare the answers at Gate 3 so the owner can reply within minutes. Paste the same text into the reply **and** into the Notes field, then **Resubmit to App Review**.

Recording guide for the owner (iPhone): install the build from TestFlight (delete the app first so first-run shows) → Settings → Control Center → add Screen Recording → start recording → tap the app icon on the Home Screen → first run → tutorial → play one level showing a mistake, undo, hint, win → daily → Settings (legal links, reminder switch, reset) → stop. If too large to attach, Google Drive link with **Anyone with the link: Viewer** (check it isn't Editor).

Answer template:
```
1. SCREEN RECORDING - <attached / link>. It shows: <exact list of what the video shows>. <Name> has no account registration, login, user-generated content, or paid content.
2. PURPOSE AND AUDIENCE - <what it is, who it's for, the twist, the value>.
3. SETUP - No login, account or sample files needed. <first-run steps>.
4. EXTERNAL SERVICES - No third-party services, SDKs, servers, analytics, ads, payments or AI. Apple frameworks only: Game Center (optional), iCloud key-value storage (player's own), local notifications (optional). The website only hosts privacy, terms and support pages.
5. REGIONAL DIFFERENCES - None; English; daily puzzle changes at local midnight.
6. REGULATED / THIRD-PARTY MATERIAL - Not applicable; all content original; fonts <licence>.
```
Only list in answer 1 what the video really shows.

## Other likely findings and responses

| Finding | Response |
|---|---|
| 4.3(b) spam / saturated category | Reply explaining the twist and depth (how it changes decisions), content volume, original art; offer a short video. Don't change the app first |
| 2.3.3 screenshots | Show real gameplay, not title/splash/login |
| 2.1 crash / bug | Reproduce from their device + iOS version, fix, upload a new build, reply with what changed |
| Game Center entitlement missing | Rebuild with entitlements as `project.yml` properties; the workflow check confirms |
| Metadata (2.3.7) brand words | Remove the word everywhere, resubmit metadata (no new build needed) |
| 5.1.1 privacy | Make policy, label and app behaviour match; explain data stays on device/iCloud |

Never cancel a submission just to "speed things up" - it goes to the back of the queue.

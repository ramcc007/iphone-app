# From approved account to NumFall on your iPhone (TestFlight)

No Mac needed: GitHub's Mac builds, signs and uploads the app. You do steps 1 to 5 once, in a web browser.
App ID (bundle ID): **`store.numfall.app`** (owner's decision, 8 October 2026; permanent).

## 1. Register the App ID
developer.apple.com → Account → **Certificates, Identifiers & Profiles** → **Identifiers** → **+**
- Choose **App IDs** → **App**.
- Description: `NumFall`. Bundle ID: **Explicit**, `store.numfall.app`.
- Capabilities: tick **iCloud** and **Game Center** (Game Center may already be ticked). Leave Push Notifications off: the Daily Drop reminder is a local notification and does not need it.
- Continue → Register.

## 2. Create the app in App Store Connect
appstoreconnect.apple.com → **Apps** → **+** → **New App**
- Platforms: **iOS**. Name: **NumFall** (exact spelling). Primary language: **English (U.S.)**.
- Bundle ID: pick `store.numfall.app` from the list. SKU: `numfall-ios-001` (private, any text). User access: Full Access.
- If the name is taken, tell Claude: we pick a variant such as "NumFall: Number Drop" (the name on the Home Screen stays NumFall).

## 3. Make an App Store Connect API key
App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → **+** (the first time, accept the request for API access).
- Name: `GitHub upload`. Access: **Admin** (needed so the build can create its own signing certificate).
- Download the `.p8` file. **Apple lets you download it only once**: keep it somewhere safe and never paste it into a chat or email.
- Write down the **Key ID** (next to the key) and the **Issuer ID** (above the list).

## 4. Find your Team ID
developer.apple.com → Account → **Membership details** → **Team ID** (10 characters).

## 5. Add four secrets to GitHub
github.com/ramcc007/iphone-app → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, four times:

| Name | Value |
|---|---|
| `ASC_KEY_ID` | Key ID from step 3 |
| `ASC_ISSUER_ID` | Issuer ID from step 3 |
| `ASC_KEY_P8` | Open the `.p8` file in a text editor, copy **all** of it (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) and paste |
| `APPLE_TEAM_ID` | Team ID from step 4 |

Secrets are encrypted: nobody (including Claude) can read them back, and they never appear in logs.

## 6. Upload a build
GitHub → **Actions** → **TestFlight upload** → **Run workflow** → version `1.0` → **Run workflow**. It takes about 20 to 30 minutes.
Then App Store Connect → NumFall → **TestFlight**: the build appears after Apple processes it (10 to 30 minutes more).

## 7. Install it on your iPhone
- Install Apple's **TestFlight** app from the App Store.
- App Store Connect → NumFall → TestFlight → **Internal Testing** → **+** create a group (for example "Me") → add yourself (your Apple Account email) → add the build.
- Open the email or the TestFlight app on your iPhone → **Install**. Internal testers do not need Apple's beta review.
- To add friends later, use **External Testing**; the first external build needs a short Beta App Review.

## Xcode Cloud (25 free hours a month)
Not needed: the GitHub route above works without a Mac and costs nothing on a public repository. Xcode Cloud is normally first set up from Xcode on a Mac, so keep the hours as a spare.

## If the upload fails
Send Claude the failing step's message (GitHub run → the red step), or the `testflight-logs` file from the bottom of the run page. Common first-time causes: a secret pasted with a missing line, the API key not set to Admin, or the App ID or App Store Connect app not created yet.

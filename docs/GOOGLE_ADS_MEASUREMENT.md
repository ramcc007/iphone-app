# Google Ads measurement (opt-in), from NumFall 1.2

**Owner's decision, 26 October 2026:** add Google Analytics for Firebase so Google Ads can count installs and played levels that come from NumFall's ads. This is the app's only third-party SDK.

## How it works in the app
- Swift package `firebase-ios-sdk` (12.x), product **`FirebaseAnalytics`**. It includes Google Ads on-device conversion measurement.
- **Off until the player chooses.** After the first cleared level, back on the home screen, the app asks once: "We value your privacy" with equal **Accept** / **Decline** buttons and a Privacy Policy link. Settings → Privacy → "Share anonymous ad measurement" changes it later. Turning it off stops collection and resets the analytics ID.
- Info.plist defaults: collection off, all consent types denied, IDFV off, ad personalisation off. The app never shows the App Tracking Transparency prompt, so iOS never gives out the IDFA.
- Events: Firebase's automatic ones (`first_open`, `session_start`, `app_update` and similar), plus `tutorial_complete` and `level_clear` (board, stars). **Never** the name, session history or iCloud data.
- Code: `ios/Numfall/AdMeasurement.swift` (prompt, switch, logging), `ios/project.yml` (package and Info keys), `ios/Numfall/Resources/PrivacyInfo.xcprivacy`.
- The configuration file `GoogleService-Info.plist` is **not** in the repo. The TestFlight workflow writes it from the repository secret `GOOGLE_SERVICE_INFO_PLIST`. Without the secret the app builds and works, but measurement is off and the prompt never shows.

## Owner steps (in this order)

### 1. Create the Firebase project (10 minutes, computer)
Use the **same Google account as Google Ads** (onlinemoneyrcc@gmail.com).
1. Go to **console.firebase.google.com** → **Create a project** → name `NumFall` → Continue.
2. **Google Analytics:** leave it **on** → choose **Create a new account** named `NumFall` → Analytics location **India** → accept the terms → **Create project**.
3. On the project page click the **iOS** button ("Add app" → Apple).
   - **Apple bundle ID:** `store.numfall.app` (exactly)
   - **App nickname:** `NumFall iOS`
   - **App Store ID:** `6820579220`
   - Click **Register app**.
4. Click **Download GoogleService-Info.plist**. Skip the remaining "Add Firebase SDK" and "Add initialization code" steps (Claude has done them) → **Continue to console**.

### 2. Add the file as a GitHub secret (3 minutes)
1. Open the downloaded `GoogleService-Info.plist` in a text editor (Notepad on Windows) → select all → copy.
2. github.com/ramcc007/iphone-app → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
3. **Name:** `GOOGLE_SERVICE_INFO_PLIST` · **Secret:** paste the whole file text → **Add secret**.
Don't paste the file into chat or commit it.

### 3. Set Analytics data retention to 2 months (the privacy policy promises this)
analytics.google.com → the NumFall property → **Admin** (gear) → **Data collection and modification → Data retention** → **Event data retention: 2 months** → **Save**.
Also under **Admin → Data collection**, leave **Google signals** **off**.

### 4. Link Firebase to Google Ads
1. Firebase console → gear → **Project settings** → **Integrations** → **Google Ads** → **Link** → choose Google Ads account **234-051-3647** → **Link**.
2. Google Ads → **Goals** → **Conversions** → **Summary** → **+ New conversion action** → **App** → **Google Analytics 4 properties (Firebase)** → Continue → tick **first_open** for **NumFall (iOS)** (optionally also `tutorial_complete`, `level_clear`) → **Import and continue** → **Done**.
   The events appear only after the first players allow measurement in 1.2, so this step may need repeating a day after 1.2 is live.
3. In the App campaign → **Settings → Bidding**: once `first_open` shows as a conversion, choose **Install volume** with no target at first (Google needs some installs before a target cost helps).

### 5. Build and submit 1.2
1. GitHub → **Actions** → **TestFlight upload** → **Run workflow** → version `1.2`.
2. The log must **not** show the warning "GOOGLE_SERVICE_INFO_PLIST is not set".
3. Test the TestFlight build on your iPhone (delete the old app first so it starts fresh): clear one level and go back home: the "We value your privacy" sheet appears; both buttons work; Settings → Privacy shows the switch.
4. App Store Connect → **App Privacy** → update the answers below **before** submitting.
5. New version **1.2** → choose the build → What's New (below) → **Add for Review**.

## App Privacy answers for 1.2 (App Store Connect → App Privacy → Edit)

> **1.2 was rejected on 27 Oct 2026 (Guideline 5.1.2(i))** because the published label said these types were **used to track**. Every row must say **Used for tracking: No**; otherwise Apple requires the ATT prompt. Check the published label shows no "Data Used to Track You" section before submitting.
**Do you or your third-party partners collect data from this app?** Yes.

| Data type | Collected | Used for | Linked to the user? | Used for tracking? |
|---|---|---|---|---|
| Identifiers → **Device ID** (Firebase app-instance ID) | Yes | Analytics; Developer's Advertising or Marketing | **No** | **No** |
| Usage Data → **Product Interaction** (app opens, tutorial, level clears) | Yes | Analytics; Developer's Advertising or Marketing | No | No |
| Usage Data → **Advertising Data** (which of our ads led to the install) | Yes | Developer's Advertising or Marketing | No | No |
| Location → **Coarse Location** (Google derives country or region from the IP address) | Yes | Analytics | No | No |

Everything else: not collected. The name, progress and sessions stay on the device and in the player's own iCloud, which Apple does not count as developer collection.

⚠ **Owner and legal check:** Apple's definition of "tracking" covers linking app data with other companies' data for ad measurement. We answer **No** because there is no IDFA, no ATT prompt, IDFV and ad personalisation are off, and Google's on-device measurement keeps matching on the device. If you or an adviser read it differently, the answers become "Used for tracking: Yes" and the app must show the ATT prompt before measurement starts. Ask before submitting if unsure.

## What's New text for 1.2 (paste it in English (U.S.) **and** English (U.K.): language menu, top right)
```
Smoother play and small fixes. New: you can choose whether NumFall may share anonymous app activity with Google to measure our ads. It's off unless you tap Accept, never includes your name or progress, and can be changed any time in Settings.
```

## App Review notes addition for 1.2
```
Version 1.2 adds Google Analytics for Firebase for measuring our own Google Ads, opt-in only. After the player clears their first level, the app asks once ("We value your privacy") with equal "Accept" / "Decline" buttons and collects nothing unless the player taps Accept; it can be changed in Settings → Privacy. The app does not request App Tracking Transparency and does not access the advertising identifier. The player's name and progress are never sent.
```

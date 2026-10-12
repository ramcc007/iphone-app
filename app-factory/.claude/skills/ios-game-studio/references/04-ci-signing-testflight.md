# CI, signing and TestFlight without a Mac

All building happens on GitHub-hosted macOS runners. Public repos get these minutes free; private repos pay roughly 10x per macOS minute - keep app repos public (secrets stay encrypted) or check pricing first.

## Workflows (in `template/.github/workflows/`)

- `ios.yml` - on push to `ios/**`, `tools/ci/**`, `tools/appstore/**`: Swift package tests → XcodeGen → simulator build (no signing) → screenshots on iPhone Pro Max, a small iPhone, iPad 13" → `frame.py` → artifacts `screenshots`, `app-store-screenshots`, `ios-logs`. `concurrency: cancel-in-progress` means a new push cancels the running build (tell the owner which run to download).
- `testflight.yml` - manual (`workflow_dispatch`, input `version`); build number = run number. Steps: check secrets → tests → XcodeGen → install API key → `asc_signing.py setup` (prune old CI items, create Distribution certificate + App Store profile) → temporary keychain → archive (Release, manual signing) → **verify entitlements in the signed app** → export with `destination: upload` → remove keychain (certificate stays) → logs artifact.

## One-time owner setup per Apple account (already done for NumFall)

API key (Users and Access → Integrations → App Store Connect API → Team Keys → +, access **Admin**), download the `.p8` once. Repository secrets (Settings → Secrets and variables → Actions): `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (whole file text), `APPLE_TEAM_ID`. For every new app repo the owner adds the same four secrets (values are reusable; never ask for them in chat).

## Per-app owner setup (guide click by click)

1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App → description = app name, Bundle ID **Explicit** `<reverse-domain>.app` → tick **Game Center** and **iCloud** (and any other capability the app uses) → Register. Capabilities can be added later; each addition needs a new build.
2. appstoreconnect.apple.com → Apps → **+** → New App → iOS, name, English (U.S.), the bundle ID, SKU `<slug>-ios-001`.
3. Add the four secrets to the new repo.
4. Actions → TestFlight upload → Run workflow → version `1.0`. Then App Store Connect → TestFlight: wait for **Complete** (10-30 min).
5. TestFlight → Internal Testing → group → add the owner → install the TestFlight app on iPhone.

## Failure guide

| Symptom | Cause | Fix |
|---|---|---|
| "Your team has no devices" | Automatic signing wants a development profile | Use the template's manual Release signing via API-created certificate/profile |
| "conflicting provisioning settings" | Forcing identity with automatic style | Same as above |
| Build "Failed" in App Store Connect, **90035 Invalid Signature** | Certificate revoked right after upload while Apple still processed | Keep certificates; `asc_signing.py` prunes CI items older than 45 min at the start of the next run |
| App Review: "add the com.apple.developer.game-center key" | Signed app lacked entitlements (XcodeGen wrote an empty file) | List entitlements as `properties` in project.yml; the workflow's entitlement check stops bad uploads |
| Export error "profile doesn't include entitlement X" | App ID lacks the capability | Owner ticks it on the App ID; rerun |
| Job queued 15+ min, no runner | GitHub capacity | Cancel and re-dispatch |
| Simulator boot hangs (no Pro Max screenshots) | Flaky simulator image | Script tries each candidate with a 300 s timeout |
| `mapfile: command not found` | macOS bash 3.2 | Use `while read` loops |
| Certificate creation refused (limit reached) | Apple caps Distribution certificates per account; several apps running CI at once can hit it | Run TestFlight uploads one app at a time; delete old "<Target> CI" certificates in the developer site if needed |
| Screenshots missing from an artifact | A newer push cancelled the run | Download from the latest green run |

## Downloading artifacts

The sandbox proxy blocks artifact blob URLs and Google Drive. To inspect CI output, read job logs with the GitHub MCP tool (`get_job_logs` with `return_content`, then search the saved file), or ask the owner to send images. Never upscale chat-compressed screenshots for the store; always use CI originals.

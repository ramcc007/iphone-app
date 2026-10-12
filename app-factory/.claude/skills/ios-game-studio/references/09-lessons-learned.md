# Lessons learned from NumFall (October 2026)

Each item happened once and cost time. Check them before building and again before submitting.

## Build, signing, upload
1. **Automatic signing failed** ("Your team has no devices"; then "conflicting provisioning settings" when forcing the identity). Fix: manual Release signing with a certificate + App Store profile created through the API each run (`asc_signing.py`).
2. **Build "Failed" with 90035 Invalid Signature**: the certificate was revoked seconds after upload while Apple was still processing. Fix: never revoke at the end; prune CI certificates older than 45 minutes at the start of a later run.
3. **Game Center and iCloud missing from the signed app**: XcodeGen wrote an empty entitlements file because `project.yml` listed only the path. Apple blocked submission ("add the com.apple.developer.game-center key"). Fix: list entitlements as `properties`; the TestFlight workflow now checks the signed app with `codesign -d --entitlements` and stops if any key is missing.
4. **Runner never started** (queued 15 min): cancel and dispatch again.
5. **Simulator boot hung** so the 6.9" screenshots were missing: try each Pro Max simulator with a 300 s boot timeout; 25 min step timeout.
6. **New pushes cancel running builds** (`cancel-in-progress`): tell the owner the run number to use; batch commits when a long run matters.

## Screenshots and store assets
7. **Status bar with time/battery/"Carrier" looked unprofessional**: screenshot mode hides the status bar and home indicator (Debug only).
8. **Bland screenshots** (all grey starting tiles): screenshot scenes play a few correct moves first so the board is colourful and mid-game.
9. **Disabled button on the first-run screen** and **decorative floating tiles over buttons**: screenshot mode pre-fills the name and turns off background drifters.
10. **Wrong sizes**: the owner first uploaded iPad and iPhone SE images to the iPhone slot. Give exact folder → tab mapping: 6.9" 1320x2868, 6.3" "medium display" 1206x2622, iPad 13" 2064x2752. iPhone SE size is not accepted for the main slot.
11. **Chat images are compressed** (~977x2000): never upscale them for the store; use CI originals.
12. Fonts for marketing images: Google Fonts may be unreachable from the sandbox; bundle an OFL font (Fredoka static TTFs in `tools/appstore/fonts`).
13. Owner preferred **plain screenshots or headline versions** case by case; produce both.

## UI details
14. Text below 11 pt on level tiles was too small: minimum 11 pt everywhere; e2e test enforces it.
15. "Difficulty" label truncated on iPhone SE: stack labels instead of truncating; test at 375 pt.
16. Name spelling must be identical everywhere ("NumFall", not "Numfall") in app, site, store, docs.

## App Store Connect
17. Blocking errors at "Add for Review": **Copyright empty**, **"Sign-in required" ticked** (user name/password required), Game Center entitlement missing.
18. Game Center tables: give one combined table (ID, name, points, descriptions) the owner can copy; renames by the owner are fine - update code and docs to match.
19. Header/product page asset appeared in the new UI; optional - offer to render it.
20. **Guideline 2.1 Information Needed** for a new developer account: screen recording on a device + six answers. Have the answers ready before submitting.
21. Google Drive share link was set to **Editor**: always check "Anyone with the link: Viewer".
22. Don't promise "no ads", "no purchases" or "free" in listing text when monetisation might come later; keep App Review notes factual about the current build instead.
23. China mainland and Vietnam need game licences: exclude them in Pricing and Availability.
24. EU DSA trader status must be declared before EU distribution.

## Process
25. The sandbox cannot download from GitHub artifact storage or Google Drive; read logs through the GitHub MCP tool and ask for images when needed.
26. GitHub repo creation may be blocked for the integration: ask the owner to create the repo (empty, public) and then attach it with `add_repo`.
27. Never request or echo secrets; the owner pastes them only into GitHub secrets.
28. Keep the owner informed with short, plain messages; when they paste a screenshot of App Store Connect, respond to exactly what it shows.

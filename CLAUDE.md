# Spill: project rules for Claude

Spill is an original iPhone numbers puzzle game (see `docs/GAME_PLAN.md`).
It **will be published on the Apple App Store**, and a marketing/support website will follow.

## Always
- **App Store compliance comes first.** Every design, feature and code change must pass App Review. Check it against `docs/APP_STORE_COMPLIANCE.md` and the current App Review Guidelines (developer.apple.com/app-store/review/guidelines). If a request would break a guideline, say so and propose a compliant alternative before doing it.
- Follow Apple's Human Interface Guidelines: native iOS controls and patterns, safe areas, Dynamic Type, dark mode, VoiceOver, Reduce Motion, 44pt minimum touch targets.
- **Privacy by default:** no accounts, no personal data, no cross-app tracking unless the owner explicitly decides otherwise. Any new data use must update the privacy policy, the App Privacy label and `PrivacyInfo.xcprivacy`.
- All digital purchases go through StoreKit 2 (In-App Purchase). Always include Restore Purchases. Show clear prices. No fake urgency, no loot boxes without published odds.
- Only original or properly licensed art, sound, fonts and code. Never copy another game's name, look or assets.
- Keep the website in mind: the privacy policy, terms, support page and marketing page must exist at public URLs before submission.
- Flag anything that needs a human decision or legal check rather than guessing.
- Planning documents live in `docs/`.

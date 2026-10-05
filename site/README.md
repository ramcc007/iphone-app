# Website: privacy policy, terms, support

Apple requires real, public **Privacy Policy** and **Support** URLs before App Review (Guideline 5.1.1, 1.5), and a privacy policy link inside the app.

## Build
```sh
node tools/site/build.js          # writes site/dist/ (static HTML, no dependencies)
node tools/site/build.js --check  # lists what is still a placeholder
```
Edit `site/site.config.json` (app name, legal name, support email, governing law, App Store link once live). Anything left in `[SQUARE BRACKETS]` is highlighted on the page and listed by the build: **do not publish until the list is empty.** Do not put a personal email address in a public page unless you want it public: a free forwarding address for the app is better.

The pages describe what the app really does (name and progress on the device and in the player's own iCloud, no ads, no analytics, no network use). If the app changes what it stores, change `site/src/pages/privacy.html`, the App Privacy answers in App Store Connect and `PrivacyInfo.xcprivacy` together.

## Free hosting (any one of these)
- **Cloudflare Pages, Netlify or Vercel:** create a free project and upload the `site/dist` folder (drag and drop works). You get an `https://something.pages.dev` / `netlify.app` / `vercel.app` address at no cost.
- **GitHub Pages:** publish `site/dist` (free for public repositories).
Use the final addresses for the three links in `ios/Numfall/Views/MenuViews.swift` (`AppLinks`) and in App Store Connect (Privacy Policy URL, Support URL, Marketing URL). When you buy a domain later, add it as a custom domain and update those links.

## Before publishing
- [ ] Fill in the placeholders and rebuild.
- [ ] Have a lawyer or a reputable template service review the Terms and Privacy Policy for your country (this is a draft, not legal advice).
- [ ] Update `AppLinks` in the app and the URLs in App Store Connect.

## Vercel
The `numfall-site` project is linked to this repository: every push to `claude/happy-ride-mm490y` (and later `main`) builds the site with `node tools/site/build.js` (see the root `vercel.json`) and publishes `site/dist` to https://www.numfall.store.
The private values come from Vercel project environment variables `SITE_LEGAL_NAME`, `SITE_SUPPORT_EMAIL`, `SITE_GOVERNING_LAW` (locally: `site/site.config.local.json`, git-ignored). The Vercel build fails on purpose if any placeholder is left, so a broken site never replaces a good one.
Do not upload files to this project by hand: the git build is the source of truth.

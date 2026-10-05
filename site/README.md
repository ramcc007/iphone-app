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
Project `numfall-site` in the owner's Vercel team. Build with `node tools/site/build.js`, then deploy the `site/dist` folder (it includes `vercel.json`: clean URLs such as `/privacy`, `/terms`, `/support`). Do not deploy to production until the placeholder list is empty.

Private values (legal name, support email) go in `site/site.config.local.json` (git-ignored, overrides `site.config.json`).

Live: https://numfall-site.vercel.app (/privacy, /terms, /support). Deployed 5 Oct 2026 to the `numfall-site` Vercel project (team onlinemoneyrcc-gmailcoms-projects), Vercel Authentication off so the pages are public.

Vercel note: when files are sent through the API they land in a `src/` folder, so the project's Output Directory is set to `src`. If the site ever shows 404, check that setting and redeploy.

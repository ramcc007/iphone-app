# App Factory

Turns a one-line idea into an original iPhone + iPad game, launched on the App Store, without a Mac.
Built from everything learned shipping **NumFall** (`ramcc007/iphone-app`, the reference implementation).

## What's inside

| Path | What it is |
|---|---|
| `.claude/skills/ios-game-studio/` | The skill: the playbook Claude follows from idea to App Store, with references for concept, UX, architecture, CI/signing, App Store Connect, App Review, website, features, and lessons learned |
| `template/` | Starter files for every new app repo: GitHub Actions (test, build, screenshots, signed TestFlight upload), signing script, screenshot framing, store header art, website generator with SEO checks, XcodeGen spec, privacy manifest, CLAUDE.md |
| `scripts/new_app.py` | Copies the template into a new app folder with the app's name, domain and bundle ID filled in |

## How to start a new game

1. Open a Claude Code session on this repo and say: **"New game: <your topic>"** (for example "a strategy game about building bridges"). The skill starts at Phase 1 and stops at three gates for your approval:
   1. Concept, unique twist and name
   2. Playable prototype and screen designs
   3. Store screenshots and listing, before you submit
2. When you approve the name, buy the domain (`<name>.com` or similar) and create an **empty public GitHub repo** for the app. Tell Claude its name; Claude fills it from the template.
3. Add the four Apple secrets to the new repo (same values as NumFall): Settings → Secrets and variables → Actions → `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`.
4. Follow Claude's click-by-click steps for the App ID, App Store Connect record, website (Vercel) and support email (ImprovMX).

## What you need once (already done)

- Apple Developer Program membership ($99/year)
- App Store Connect API key with Admin access (its `.p8` file kept safe; never pasted in chat)
- GitHub account; Vercel and ImprovMX free accounts

## Costs per app

Domain (yearly). Everything else is free for a free app: GitHub Actions on public repos, Vercel Hobby, ImprovMX, App Review.

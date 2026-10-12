# Phase 2: UX and visual design playbook

The owner's top priority. "World-class" here means: understood instantly, feels physical and responsive, looks distinct, works for everyone, and never shows an unfinished edge.

## 1. First 60 seconds (the most important minute)

- Open straight into something beautiful and alive; no splash delay beyond the launch screen.
- First run: one friendly screen (name optional or minimal), then **play within 10 seconds**. Teach by doing: tutorial levels with a highlighted target and one short instruction each; untimed; skippable; replayable from Settings ("How to play").
- The first real level must be winnable by everyone and end in a celebration.
- Never ask for notifications, Game Center, ratings or anything else before the player has had fun. Ask for reminders only after a daily challenge is completed, with a neutral reason.

## 2. Game feel ("juice") checklist

Every player action has: **anticipation** (selection state, preview/ghost of the result), **action** (quick motion, 150-300 ms, spring easing), **impact** (landing squash, haptic, sound), **result** (score tick, glow, stars). Specifics:

- Preview the outcome before committing (NumFall's dashed "ghost" tile showing where the number lands).
- Errors are gentle and informative: shake + soft haptic + a short reason ("2 is already in this row"), never a harsh buzzer.
- Wins escalate: star reveal one by one, confetti drawn in code, praise lines that grow with progress (a pool of 20+ lines, not one).
- Respect Reduce Motion: replace movement with fades; keep haptics optional in Settings; sound respects the silent switch (ambient audio session).
- Target 120 Hz on ProMotion; no layout jank; animations interruptible.

## 3. Layout and HIG

- Safe areas, Dynamic Type for all text outside the board, 44x44 pt minimum touch targets, native controls for menus and settings (sheets, toggles, `Link`).
- **Smallest text 11 pt.** Labels must never truncate on iPhone SE width (375 pt) at default and largest common text sizes; stack instead of truncating (NumFall's "Difficulty" label was cut off once).
- **iPad is a real layout**, not a stretched phone: wider board with side panels or two columns, all orientations, resizable windows (iPadOS windowing). Apple rejects scaled-up iPhone layouts (2.4.1).
- Mac (Apple silicon) and Vision Pro get the iPad app automatically: keyboard and pointer must work, or opt out in App Store Connect.
- No "Quit" button; the app never closes itself.

## 4. Visual system

- Define tokens once (colours, radii, spacing, type scale, shadows) in `Theme.swift` and mirror them in the web prototype's CSS variables.
- Palette: one dark or light base with high contrast (WCAG AA 4.5:1 for text), 6-9 saturated "piece" colours that remain distinguishable for colour-blind players; never rely on colour alone (numbers/shapes always visible).
- Corners: continuous (squircle) corners; consistent radii scale.
- Typography: SF Pro / SF Rounded via system fonts in the app (no font licensing issues); a licensed OFL font only for marketing images.
- Art: vector or code-drawn only (crisp on every screen); the app icon master (1024 px) is the only raster. Original art only.
- Depth: subtle top highlight and bottom edge on tiles (tactile), soft shadows, no skeuomorphic noise.
- Background motion may exist but must never sit over buttons or text, and must freeze in screenshot mode.

## 5. Screens every game needs

| Screen | Must have |
|---|---|
| First run | Logo, one-line promise, minimal input, Privacy/Terms/Support links |
| Tutorial | 3 short levels, skip, no timer |
| Home | Greeting, currency/score, daily card with streak, mode picker, big primary "Play" button, chapter/level map, footer with support email + legal links |
| Game | Back, title + limit, timer/hearts/score bar, hint line, board, piece tray, Undo/Hint/Restart |
| Pause | Resume, restart, settings, home |
| Win / lose / time-up | Clear result, stars/time, next/retry, never punishing language |
| Daily | Date, same puzzle for all, result + streak |
| Settings | Sound, haptics, reminders, how to play, privacy, terms, support, send feedback (mailto with app + OS version), reset progress (confirm), version |

Every state has a designed empty/loading/error version. No placeholder text, no "coming soon".

## 6. Accessibility (also listed on the store)

- VoiceOver labels for every interactive element, including the board ("Column 3, next number lands in row 2").
- Dynamic Type up to accessibility sizes for menus; the board scales with the screen instead.
- Colour-blind safe palette, Reduce Motion, haptics toggle, sound toggle.
- Only claim accessibility features on the store after testing them on a device.

## 7. Copy

Short, warm, concrete. Buttons are verbs ("Play Level 24"). Errors explain and suggest. No guilt ("You'll lose your streak!"), no fake urgency, no dark patterns. Use `design:ux-copy` for reviews.

## 8. Quality bar before Gate 2

- Play every screen at 375, 430 and 1024 px wide in the prototype; run the e2e checks (no overflow, min font size, no truncation, all links work).
- Run `design:design-critique` and `design:accessibility-review` style passes and fix what they find.
- Ask: would this screenshot stop a thumb scrolling the App Store? If not, improve colour and state.

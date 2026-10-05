# App name search (5 October 2026)

Goal: an easy-to-remember name that is free on the App Store and unlikely to cause trademark trouble. **Working name until the owner decides: "Dropku" is being replaced; the recommended name is Numpile.**

## What was checked, and what could not be
- **Domains:** checked with a domain registrar lookup (.com and .app).
- **Existing games and apps:** web searches of the App Store, Google Play, Steam, itch.io and the Justia trademark index.
- **Not possible here:** Apple's own App Store search service and the official USPTO / EUIPO / WIPO trademark databases were blocked from this environment. So **nothing below is a trademark clearance.** Before committing money to a name, search it yourself in the App Store app, then in the USPTO Trademark Search (trademarks in class 9 "downloadable game software" and class 41 "entertainment"), and ideally have a trademark attorney run a knockout search. App Store names must also be unique within the store (30 characters max).

## Ruled out
| Name | Why |
|---|---|
| Dropku | Contains "-ku" as in Sudoku, a term some companies use in trademarks. Also never searched. |
| Numfall | Existing number-falling puzzle game "NumFall" (Google Play). |
| Tilefall | Several games with this exact name (Google Play, Steam, itch.io). |
| Dropsum / Drop Sum | Existing iOS games with this name. |
| Digitfall / Digifall | Too close to the existing number puzzle "Digifall", and "DigiDrop" is a number-drop game on the App Store. |
| Digidrop | Existing "Number Drop - DigiDrop" on the App Store. |
| Dropnum / DropNumber | Existing "DropNumber" iOS falling-number game. |
| Plunkle, Plunkit | Crowded "Plunk" family of games and apps (Plunk!, Plunko). Plunkit is also a carnival game. |
| Thudle | No exact match, but sounds like "Thule" (a well-known brand with an app) and the "-dle" suffix invites Wordle comparisons. |
| Plonkle, Dropzy, Gridfall, Stackfall, Numdrop, Kerplonk | .com domain already taken. |

## Second round (owner's suggestions and abstract names)
| Name | Verdict | Findings |
|---|---|---|
| Boardify | **Avoid** | boardify.com is taken. Existing iOS app "Boardify Task Management" (Break Point Technologies, LLC) and a Google Play app "BOARDIFY" (education). Also suggests board games or task boards, not a number puzzle. |
| BoardLulu | **Risky** | .com free and no exact match found, but "Lulu" is crowded in games and kids' apps ("Lulu Games", "LuLu ZOO Kids Game", the trademark application LULU & LUIGI in class 9) and Lulu.com is a well-known publisher. Says nothing about the game and sounds like a kids' product. |
| Sodapo | **Risky** | sodapo.com is a live website (could not be opened from here). No app or trademark found, but it is one letter from "Soda Pop", and there are many Soda Pop games and apps (Soda Pop, Soda POP!, SodaPop). Nothing to do with numbers. |
| Nuvik | **Avoid** | .com free, but an existing iOS app "Nuvik" (Snowcat Cloud, Inc.), a cleaning-supplies brand and a UK company use it. |
| Vondu | **Avoid** | .com free, but a tech company that builds mobile apps, a streetwear brand, a music artist and an animated character. |
| Dropli | **Avoid** | A UK delivery company (dropli.co.uk) and the .com is listed for sale. |
| Tumbro | **Avoid** | Brand of tumblers, a surname and a place name. |
| Tumbli, Plixo, Zumbo, Kelvu, Brinko, Quillo, Nubbo, Nuvvo | **Avoid** | .com already taken. |

Lesson: an invented-looking word is rarely free, because short pronounceable words are already used by some business. What matters for an app is the same class of goods and services (class 9 downloadable games, class 41 entertainment) and the App Store, not whether the word exists anywhere.

## Shortlist (no exact match found; .com free on the day of the check)
| Name | Why it fits | .com | Notes |
|---|---|---|---|
| **Numpile** (recommended) | Two plain words, "num" + "pile": the numbers pile up. Easy to say and spell. | free | No exact match in any store or trademark index searched. Many "Num-" names exist (NumRush, NumHunt, NumTrip, Numble, Numpuz), so a formal search matters. |
| Numthump | The thud of a number landing. Memorable and playful. | free | No exact match. Slightly harder to spell. |
| Numplop | Fun sound. | free | No exact match. May sound childish for a 16 to 30 audience. |
| Gravidigit | Says "gravity" and "digit". | free | Long and harder to remember. |

## To switch the name (after the owner decides)
1. Run the checks above on the chosen name (App Store app, USPTO classes 9 and 41).
2. Change `appName` in `site/site.config.json` and rebuild the website.
3. Replace "Dropku" in the app (`CFBundleDisplayName` in `ios/project.yml`, the Home and Welcome screens, How to play, share text), the web preview, the icon wordmark, the canvas and the docs, then rerun every check.
4. Reserve the name in App Store Connect as soon as the Developer account exists, and buy the domain.

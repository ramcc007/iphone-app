# Devices, resolution and assets

Dropku is a **universal app**: designed iPhone-first, fully supported on iPad, and available automatically on Apple silicon Macs and Apple Vision Pro as an iPad app. Canvas screens 15–18 show the iPad layouts, the app icon and this spec visually.

## Supported devices
| Device | Orientation | Layout |
|---|---|---|
| iPhone (SE 3rd gen and newer) | Portrait only | Stacked: top bar, board, guide line, number tray, controls in the thumb zone |
| iPad (mini to 13") | All orientations, resizable windows, Split View, Stage Manager / iPadOS 26 windowing | **Wide** (window ≥ 700pt wide and landscape-ish): board left, side panel right (timer, hearts, Sparks, 3×2 tray, controls). **Tall:** iPhone-style stack with bigger tiles, plus a two-column home. **Narrow** (< 500pt): the iPhone layout |
| Mac (Apple silicon), Vision Pro | Window | The iPad app as is ("Designed for iPad"), plus keyboard and pointer support. Can be switched off in App Store Connect if testing shows problems |

**Rule:** the layout is chosen from the **window size**, never from the device model. That makes Split View, Slide Over and resizable windows work automatically.

## Tile size
Tile size is computed from the available width, capped at 96pt:

```
iPhone:  tile = (window width − 32 margins − 20 board padding − gaps) / columns
iPad:    same formula with iPad margins; side panel width 420pt in the wide layout
gaps:    4×4 = 32pt · 6×6 = 38pt · 9×9 = 44pt (tile gaps plus thicker box gaps)
```

| Device | Screen (pt) | 4×4 | 6×6 | 9×9 |
|---|---|---|---|---|
| iPhone SE / 13 mini | 375 wide | 72 | 47 | **31** |
| iPhone 16 / 17 | 402 × 874 | 79 | 52 | **34** |
| iPhone 16 / 17 Pro Max | 440 × 956 | 89 | 58 | **38** |
| iPad mini, portrait | 744 × 1133 | 96 | 93 | 61 |
| iPad 11", portrait | 820 × 1180 | 96 | 96 | 69 |
| iPad Pro 13", portrait | 1032 × 1376 | 96 | 96 | 93 |
| iPad Pro 13", landscape | 1376 × 1032 | 96 | 96 | 81 |

**Bold** = below Apple's 44pt minimum touch target. On 9×9 iPhone boards:
- the whole column height is the tap area
- the column under the finger is highlighted, with the landing ghost shown
- you can slide along the columns before lifting to drop
- the number tray uses two rows (5 + 4)

## Sharpness rules ("high-quality on every screen")
1. **Vector or code only.** Tiles, board, buttons, hearts, stars, Sparks, chest and all icons are SwiftUI shapes, SF Symbols or vector PDF/SVG assets ("Preserve Vector Data" on). They're crisp at 2× and 3×, and on any iPad or Mac window size, with no per-resolution image files.
2. **The only raster image is the app icon master** (1024 × 1024 px). It's built as layers in Icon Composer, so iOS 26 can render the default, dark, clear and tinted looks. Xcode generates all other sizes.
3. **Typography:** the native app uses **SF Pro Rounded**, Apple's own rounded system font: free on Apple platforms, crisp at every size, and built for Dynamic Type. The app icon and the web version use **Fredoka** (SIL Open Font License), a close rounded match. Menus support Dynamic Type. Tile digits scale with the tile.
4. **Animation:** 120 fps on ProMotion iPhones and iPads (SwiftUI/Core Animation, no frame-by-frame images). Reduce Motion swaps shakes and flashes for fades.
5. **Colour:** dark theme first. Every text-on-background pair meets 4.5:1 contrast (3:1 for large text), and tile digits are always shown, so colour is never the only signal.
6. **Haptics:** Core Haptics on iPhone. iPads and Macs without haptics fall back to sound and visual cues only.

## Input on each platform
| Input | Pick a number | Choose column | Drop |
|---|---|---|---|
| Touch (iPhone / iPad) | Tap tray tile | Tap column (or slide along) | Lift finger |
| Keyboard (iPad keyboard, Mac) | 1–9 | ← → | Return / Space |
| Pointer (iPad trackpad, Mac) | Click tray tile | Hover highlights column | Click |

## App Store assets
| Asset | Size |
|---|---|
| App icon master | 1024 × 1024 px, no transparency, layered in Icon Composer |
| iPhone screenshots (required) | 6.9" display: 1320 × 2868 px (portrait) |
| iPad screenshots (required for iPad support) | 13" display: 2064 × 2752 px |
| App preview video (optional) | Recorded on device, 15–30 seconds |

[Check] Apple updates required screenshot sizes from time to time. Confirm them in App Store Connect before submission.

#!/usr/bin/env python3
"""Turns raw simulator screenshots into App Store screenshots with a headline above the app.

  python3 tools/appstore/frame.py <raw screenshots folder> <output folder>

Needs Pillow. For each App Store size (iPhone 6.9-inch 1320x2868, iPhone 6.3-inch 1206x2622, iPad 13-inch 2064x2752)
it writes two sets, numbered in upload order: "with-headlines" and "plain" (the app screen alone, resized). Captions only describe what the app really does (Guideline 2.3) and name no other game.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BOLD = os.path.join(HERE, "fonts", "Fredoka-SemiBold.ttf")
REG = os.path.join(HERE, "fonts", "Fredoka-Regular.ttf")

# Upload order (owner's choice, 8 October 2026): (raw scene name, headline, smaller line)
SHOTS = [
    ("daily", "A new puzzle every day", "Keep your Daily Drop streak going"),
    ("welcome", "Simple to start", "Type your name and play"),
    ("level-master", "Ready for a challenge?", "100 Master boards for puzzle fans"),
    ("home-master", "230 levels, 3 boards", "From a quick 4×4 to a big 9×9"),
    ("tutorial", "Learn it in a minute", "A short tutorial shows you how"),
]
# (output folder, raw screenshot prefix, App Store size)
SIZES = [("iphone-6.9in", "iphone-pro-max", (1320, 2868)),
         ("iphone-6.3in", "iphone-pro-max", (1206, 2622)),
         ("ipad-13in", "ipad-pro-13", (2064, 2752))]
ACCENT = [(255, 181, 71), (79, 195, 247), (110, 231, 168), (157, 140, 255), (255, 107, 122)]


def background(w, h, accent):
    """Dark NumFall background with a soft glow in this screenshot's accent colour."""
    img = Image.new("RGB", (w, h), (16, 18, 28))
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((-w * 0.3, -h * 0.25, w * 1.3, h * 0.45), fill=tuple(int(c * 0.35) for c in accent))
    d.ellipse((w * 0.2, h * 0.45, w * 1.4, h * 1.2), fill=(46, 42, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(w * 0.18))
    return Image.blend(img, glow, 0.85)


def fit_font(path, text, size, max_w):
    while size > 20:
        f = ImageFont.truetype(path, size)
        if f.getlength(text) <= max_w:
            return f
        size -= 4
    return ImageFont.truetype(path, size)


def frame(raw, w, h, title, sub, accent):
    canvas = background(w, h, accent)
    d = ImageDraw.Draw(canvas)
    pad = int(w * 0.08)
    tf = fit_font(BOLD, title, int(w * 0.085), w - 2 * pad)
    sf = fit_font(REG, sub, int(w * 0.042), w - 2 * pad)
    top = int(h * 0.055)
    d.text((w / 2, top), title, font=tf, fill=(255, 255, 255), anchor="ma")
    sub_y = top + int(tf.size * 1.22)
    d.text((w / 2, sub_y), sub, font=sf, fill=(186, 192, 216), anchor="ma")

    # The app screen, scaled down with rounded corners and running off the bottom edge
    # (this also keeps iPadOS's corner resize handle out of the picture).
    shot_top = sub_y + int(sf.size * 2.0)
    scale = 0.84
    sw = int(w * scale)
    sh = int(raw.height * sw / raw.width)
    screen = raw.convert("RGB").resize((sw, sh), Image.LANCZOS)
    radius = int(sw * (0.11 if w < h * 0.6 else 0.05))
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius, fill=255)
    x = (w - sw) // 2
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x, shot_top + 30, x + sw, shot_top + sh + 30), radius, fill=(0, 0, 0, 150))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(40)))
    border = int(max(6, w * 0.006))
    ImageDraw.Draw(canvas).rounded_rectangle((x - border, shot_top - border, x + sw + border, shot_top + sh + border),
                                             radius + border, fill=(52, 58, 86))
    canvas.paste(screen, (x, shot_top), mask)
    return canvas.convert("RGB")


def main(src, out):
    made = 0
    for folder, prefix, (w, h) in SIZES:
        for style in ("with-headlines", "plain"):
            os.makedirs(os.path.join(out, folder, style), exist_ok=True)
        for i, (scene, title, sub) in enumerate(SHOTS, 1):
            path = os.path.join(src, f"{prefix}_{scene}.png")
            if not os.path.exists(path):
                print(f"missing {path}, skipped")
                continue
            raw = Image.open(path).convert("RGB")
            framed = frame(raw, w, h, title, sub, ACCENT[(i - 1) % len(ACCENT)])
            plain = raw if raw.size == (w, h) else raw.resize((w, h), Image.LANCZOS)
            for style, img in (("with-headlines", framed), ("plain", plain)):
                dest = os.path.join(out, folder, style, f"{i}_{scene}.png")
                img.save(dest, optimize=True)
                print(f"{dest} {img.size}")
                made += 1
    if not made:
        sys.exit("no screenshots found")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

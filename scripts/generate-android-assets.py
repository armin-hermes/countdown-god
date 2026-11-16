#!/usr/bin/env python3
"""Regenerate Android launcher icons + splash screens from public/icons/icon-512.png.

- Legacy + round launcher icons per density (full square art).
- Adaptive-icon foregrounds: art inset to 84% so it sits inside the 66dp
  safe zone of the 108dp canvas (the source art spans ~72% of the square).
- Splash screens: dark #08090a canvas with the icon centred, matching the
  existing per-density drawable sizes.

Usage: python3 scripts/generate-android-assets.py
Requires: Pillow (pip install pillow)
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "icons", "icon-512.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
BG = (8, 9, 10)  # #08090a — app dark background

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}

# (drawable dir, width, height) — the generated PNGs are NOT committed to git
# (the GitHub App push only handles text files); CI regenerates them with
# this script before the Gradle build, and local builds run it once too.
SPLASHES = [
    ("drawable", 480, 320),
    ("drawable-port-mdpi", 320, 480),
    ("drawable-port-hdpi", 480, 800),
    ("drawable-port-xhdpi", 720, 1280),
    ("drawable-port-xxhdpi", 960, 1600),
    ("drawable-port-xxxhdpi", 1280, 1920),
    ("drawable-land-mdpi", 480, 320),
    ("drawable-land-hdpi", 800, 480),
    ("drawable-land-xhdpi", 1280, 720),
    ("drawable-land-xxhdpi", 1600, 960),
    ("drawable-land-xxxhdpi", 1920, 1280),
]


def main():
    src = Image.open(SRC).convert("RGBA")
    for dens, scale in DENSITIES.items():
        mipmap = os.path.join(RES, "mipmap-" + dens)
        os.makedirs(mipmap, exist_ok=True)
        # legacy launcher icon (full square)
        size = int(48 * scale)
        src.resize((size, size), Image.LANCZOS).convert("RGB").save(
            os.path.join(mipmap, "ic_launcher.png"))
        # round launcher icon (slightly inset so the art survives the circle)
        inset = int(size * 0.94)
        icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        icon.paste(src.resize((inset, inset), Image.LANCZOS),
                   ((size - inset) // 2, (size - inset) // 2))
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
        icon.putalpha(mask)
        icon.save(os.path.join(mipmap, "ic_launcher_round.png"))
        # adaptive foreground: transparent canvas, art at 84%
        fsize = int(108 * scale)
        fg = Image.new("RGBA", (fsize, fsize), (0, 0, 0, 0))
        art = int(fsize * 0.84)
        fg.paste(src.resize((art, art), Image.LANCZOS),
                 ((fsize - art) // 2, (fsize - art) // 2))
        fg.save(os.path.join(mipmap, "ic_launcher_foreground.png"))
    # splash screens: dark bg + centred icon, one per density
    for dirname, w, h in SPLASHES:
        d = os.path.join(RES, dirname)
        os.makedirs(d, exist_ok=True)
        canvas = Image.new("RGB", (w, h), BG)
        side = int(round(0.30 * min(w, h)))
        canvas.paste(src.resize((side, side), Image.LANCZOS).convert("RGB"),
                     ((w - side) // 2, (h - side) // 2))
        canvas.save(os.path.join(d, "splash.png"))
    print("Android icons + splash screens regenerated from", SRC)


if __name__ == "__main__":
    main()

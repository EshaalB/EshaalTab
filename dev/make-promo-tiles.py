"""Generates the Chrome Web Store promo tiles.

Both tiles are built from the shipped icon plus type, on the same indigo-violet
ground the extension's default theme uses, so the store art and the product
agree about what the thing looks like.

The store rejects alpha, so every canvas is composited onto opaque RGB before
it is written. Run:  python dev/make-promo-tiles.py
Outputs into dev/store-assets/.
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dev", "store-assets")
ICON = os.path.join(OUT, "icon512.png")
FONTS = r"C:\Windows\Fonts"

BOLD = os.path.join(FONTS, "segoeuib.ttf")
SEMI = os.path.join(FONTS, "seguisb.ttf")
REG = os.path.join(FONTS, "segoeui.ttf")

# The logo's own two colours, which are also the shipped default theme:
# a blue accent (#5888ec) with a pink second accent (#fda6c8).
DEEP = (13, 24, 56)
MID = (54, 94, 190)
VIOLET = (176, 122, 176)
INK = (255, 255, 255)
DIM = (214, 222, 244)


def ground(w, h):
    """Diagonal gradient with two soft light pools, matching the app's default."""
    yy, xx = np.mgrid[0:h, 0:w]
    t = (xx / w) * 0.65 + (yy / h) * 0.35

    stops = [(0.0, DEEP), (0.5, MID), (1.0, VIOLET)]
    base = np.zeros((h, w, 3), dtype=float)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        seg = (t >= t0) & (t <= t1)
        k = np.clip((t - t0) / (t1 - t0), 0, 1)
        for i in range(3):
            base[..., i] = np.where(seg, c0[i] + (c1[i] - c0[i]) * k, base[..., i])

    # Light pools, added rather than blended so they read as light on the
    # surface instead of washing the colour out of it.
    glow = np.zeros((h, w), dtype=float)
    for cx, cy, r, v in (
        (0.24 * w, 0.26 * h, 0.55 * min(w, h), 62),
        (0.82 * w, 0.78 * h, 0.62 * min(w, h), 52),
    ):
        dist = np.hypot(xx - cx, yy - cy) / r
        glow += v * np.clip(1 - dist, 0, 1) ** 2

    out = np.clip(base + glow[..., None], 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGB")


def tile(w, h, icon_px, title_px, sub_px, sub, gap, pad):
    img = ground(w, h)
    d = ImageDraw.Draw(img)

    icon = Image.open(ICON).convert("RGBA").resize((icon_px, icon_px), Image.LANCZOS)
    # A soft drop shadow so the mark sits on the ground rather than floating.
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sh.paste(icon, (pad, (h - icon_px) // 2), icon)
    sh = sh.filter(ImageFilter.GaussianBlur(icon_px // 14))
    img.paste(Image.new("RGB", (w, h), (0, 0, 0)), (0, 0), sh.split()[3].point(lambda a: int(a * 0.45)))
    img.paste(icon, (pad, (h - icon_px) // 2), icon)

    tx = pad + icon_px + gap
    ft = ImageFont.truetype(BOLD, title_px)
    fs = ImageFont.truetype(REG, sub_px)

    th = d.textbbox((0, 0), "EshaalTab", font=ft)[3]
    lines = sub.split("\n")
    lh = int(sub_px * 1.38)
    block = th + int(sub_px * 0.7) + lh * len(lines)
    y = (h - block) // 2

    d.text((tx, y), "EshaalTab", font=ft, fill=INK)
    y += th + int(sub_px * 0.7)
    for ln in lines:
        d.text((tx, y), ln, font=fs, fill=DIM)
        y += lh
    return img


def save(img, name):
    path = os.path.join(OUT, name)
    img.convert("RGB").save(path, "PNG", optimize=True)
    print(f"  {name}  {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    save(tile(440, 280, 128, 44, 19, "Your new tab,\nfinally organised.", 26, 30),
         "promo-small-440x280.png")
    save(tile(1400, 560, 300, 104, 40, "Bookmark boards, notes and focus,\non every new tab.", 62, 96),
         "promo-marquee-1400x560.png")
    print("done")

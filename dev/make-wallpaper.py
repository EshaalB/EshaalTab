"""make-wallpaper.py - convert an image into the packaged wallpaper.

DEV ONLY. `dev/` is excluded from the CI allow-list and from both build
scripts, so nothing here can reach a store package.

EshaalTab ships one wallpaper inside the extension, applied on the first run
of a fresh profile (see `applyPackagedWallpaper` in js/ui/settings-core.js).
It must be `wallpaper/default.webp`, because that is the path the runtime
looks for, and it must be WebP for the same reason every uploaded wallpaper is
converted to WebP: a new tab page is opened dozens of times a day and the
background is the single largest thing it paints.

USAGE
    python dev/make-wallpaper.py path/to/photo.jpg
    python dev/make-wallpaper.py path/to/photo.jpg --quality 82

Requires Pillow:  pip install Pillow

The output is capped at 2560px on its long edge - the same `WP_MAX_PX` the
in-app uploader uses - so a packaged wallpaper is never larger than one the
user could have added themselves.
"""

import argparse
import os
import sys

MAX_PX = 2560
DEST = os.path.join("wallpaper", "default.webp")


def main() -> int:
    ap = argparse.ArgumentParser(description="Build wallpaper/default.webp")
    ap.add_argument("source", help="image to convert (jpg, png, webp, ...)")
    ap.add_argument(
        "--quality",
        type=int,
        default=85,
        help="WebP quality 1-100 (default 85, matching the in-app uploader)",
    )
    ap.add_argument(
        "--max-px",
        type=int,
        default=MAX_PX,
        help=f"cap for the long edge (default {MAX_PX})",
    )
    args = ap.parse_args()

    try:
        from PIL import Image
    except ImportError:
        print("Pillow is required:  pip install Pillow", file=sys.stderr)
        return 1

    if not os.path.isfile(args.source):
        print(f"No such file: {args.source}", file=sys.stderr)
        return 1

    src_bytes = os.path.getsize(args.source)

    with Image.open(args.source) as im:
        # A wallpaper is painted onto an opaque page, so alpha is dead weight.
        # Flattening rather than discarding keeps any transparent edge from
        # turning black.
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            flat = Image.new("RGB", im.size, (13, 17, 23))
            flat.paste(im, mask=im.split()[-1])
            im = flat
        else:
            im = im.convert("RGB")

        w, h = im.size
        scale = min(1.0, args.max_px / max(w, h))
        if scale < 1.0:
            im = im.resize(
                (max(1, round(w * scale)), max(1, round(h * scale))),
                Image.LANCZOS,
            )

        os.makedirs(os.path.dirname(DEST), exist_ok=True)
        im.save(DEST, "WEBP", quality=args.quality, method=6)
        out_w, out_h = im.size

    out_bytes = os.path.getsize(DEST)
    print(f"  in   {args.source}  {w}x{h}  {src_bytes / 1024:.0f} KB")
    print(f"  out  {DEST}  {out_w}x{out_h}  {out_bytes / 1024:.0f} KB")
    if src_bytes:
        print(f"  saved {100 - (out_bytes / src_bytes * 100):.0f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

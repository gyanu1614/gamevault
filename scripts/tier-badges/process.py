#!/usr/bin/env python3
"""
Normalize the 5 tier badge PNGs after they're dropped in public/tiers/.

- Trims transparent margins, then re-centers each badge on an identical square
  canvas with consistent padding, so all 5 line up in a row at the same scale.
- If an image has a near-solid background (Gemini sometimes returns opaque),
  removes it by flood-filling from the corners with a tolerance.
- Resizes to 512x512 and overwrites in place.

Usage:  python3 scripts/tier-badges/process.py
Safe to re-run; skips any tier whose file is missing.
"""
import os
from PIL import Image

TIERS = ["quartz", "amethyst", "ruby", "sapphire", "diamond"]
DIR = "public/tiers"
CANVAS = 512
PAD_RATIO = 0.90  # badge fills 90% of the canvas after trimming

def has_alpha(img):
    return img.mode in ("RGBA", "LA") and img.getchannel("A").getextrema()[0] < 255

def remove_bg_if_opaque(img):
    """If the image is opaque, flood-fill from the 4 corners to make bg transparent."""
    img = img.convert("RGBA")
    if has_alpha(img):
        return img  # already has transparency — trust it
    from collections import deque
    px = img.load()
    w, h = img.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    bg = px[0, 0]
    tol = 32
    def close(a, b):
        return all(abs(a[i] - b[i]) <= tol for i in range(3))
    seen = set()
    dq = deque(c for c in corners)
    while dq:
        x, y = dq.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if close(px[x, y], bg):
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
            dq.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
    return img

def trim_and_center(img):
    bbox = img.getchannel("A").getbbox()
    if bbox:
        img = img.crop(bbox)
    target = int(CANVAS * PAD_RATIO)
    w, h = img.size
    scale = min(target / w, target / h)
    img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(img, ((CANVAS - img.width) // 2, (CANVAS - img.height) // 2), img)
    return canvas

def main():
    for t in TIERS:
        path = os.path.join(DIR, f"{t}.png")
        if not os.path.exists(path):
            print(f"– {t}: missing (skip)")
            continue
        img = Image.open(path)
        img = remove_bg_if_opaque(img)
        img = trim_and_center(img)
        img.save(path)
        print(f"✓ {t}: normalized -> {CANVAS}x{CANVAS} transparent")

if __name__ == "__main__":
    main()

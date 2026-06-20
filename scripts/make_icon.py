#!/usr/bin/env python3
"""Generate Cel.icns for the macOS app bundle."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONSET = ROOT / "packaging" / "Cel.iconset"
ICNS = ROOT / "packaging" / "Cel.icns"
README_ICON = ROOT / "media" / "icon" / "app_icon.png"

ICON_SIZES = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]


def squircle_radius(size: int) -> int:
    # Match macOS app-icon corner curvature (~22.3% of side length)
    return max(2, int(round(size * 0.223)))


def draw_icon(size: int):
    from PIL import Image, ImageDraw

    radius = squircle_radius(size)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size / 1024.0

    draw.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=radius,
        fill=(0, 113, 227, 255),
    )

    stroke = max(2, int(28 * scale))
    back = (
        int(280 * scale),
        int(380 * scale),
        int(760 * scale),
        int(860 * scale),
    )
    front = (
        int(160 * scale),
        int(220 * scale),
        int(640 * scale),
        int(700 * scale),
    )
    draw.rounded_rectangle(back, radius=int(70 * scale), outline=(210, 228, 255, 255), width=stroke)
    draw.rounded_rectangle(front, radius=int(82 * scale), outline=(255, 255, 255, 255), width=stroke)

    head_r = int(38 * scale)
    cx, cy = int(360 * scale), int(340 * scale)
    draw.ellipse(
        (cx - head_r, cy - head_r, cx + head_r, cy + head_r),
        fill=(255, 255, 255, 255),
    )
    draw.arc(
        (int(220 * scale), int(430 * scale), int(500 * scale), int(700 * scale)),
        start=205,
        end=335,
        fill=(255, 255, 255, 255),
        width=stroke,
    )

    return img


def main() -> int:
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        print("Pillow required — pip install pillow", file=sys.stderr)
        return 1

    if ICONSET.exists():
        shutil.rmtree(ICONSET)
    ICONSET.mkdir(parents=True)

    for name, px in ICON_SIZES:
        draw_icon(px).save(ICONSET / name, format="PNG")

    if ICNS.exists():
        ICNS.unlink()

    subprocess.run(
        ["iconutil", "-c", "icns", str(ICONSET), "-o", str(ICNS)],
        check=True,
    )
    README_ICON.parent.mkdir(parents=True, exist_ok=True)
    draw_icon(1024).convert("RGB").save(README_ICON, format="PNG")
    print(f"Created {ICNS}")
    print(f"Created {README_ICON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

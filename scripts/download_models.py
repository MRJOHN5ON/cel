#!/usr/bin/env python3
"""Download rembg ONNX models into packaging/models_cache for bundling."""

from __future__ import annotations

import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "packaging" / "models_cache"
USER_CACHE = Path.home() / ".u2net"

MODELS = {
    "isnet-general-use.onnx": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
    "u2net.onnx": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx",
    "u2net_human_seg.onnx": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx",
    "bria-rmbg.onnx": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/bria-rmbg-2.0.onnx",
}

MIN_BYTES = {
    "isnet-general-use.onnx": 150_000_000,
    "u2net.onnx": 150_000_000,
    "u2net_human_seg.onnx": 150_000_000,
    "bria-rmbg.onnx": 900_000_000,
}


def copy_or_download(name: str, url: str) -> None:
    dest = OUT_DIR / name
    min_size = MIN_BYTES[name]

    if dest.exists() and dest.stat().st_size >= min_size:
        print(f"  ✓ {name} already cached")
        return

    cached = USER_CACHE / name
    if cached.exists() and cached.stat().st_size >= min_size:
        print(f"  → copying {name} from ~/.u2net")
        shutil.copy2(cached, dest)
        return

    print(f"  ↓ downloading {name} ...")
    tmp = dest.with_suffix(".onnx.part")
    try:
        urllib.request.urlretrieve(url, tmp)
        tmp.replace(dest)
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise

    print(f"  ✓ {name} ready ({dest.stat().st_size // 1_000_000} MB)")


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Model cache: {OUT_DIR}")

    for name, url in MODELS.items():
        try:
            copy_or_download(name, url)
        except Exception as exc:
            print(f"  ✗ failed to fetch {name}: {exc}", file=sys.stderr)
            return 1

    total_mb = sum((OUT_DIR / name).stat().st_size for name in MODELS) // 1_000_000
    print(f"All models ready ({total_mb} MB total)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

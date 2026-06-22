#!/usr/bin/env python3
"""Download rembg ONNX models into packaging/models_cache for bundling."""

from __future__ import annotations

import shutil
import ssl
import subprocess
import sys
import urllib.error
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


def ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    try:
        import certifi

        ctx.load_verify_locations(certifi.where())
    except ImportError:
        pass
    return ctx


def is_ssl_error(exc: BaseException) -> bool:
    if isinstance(exc, ssl.SSLError):
        return True
    if isinstance(exc, urllib.error.URLError) and isinstance(exc.reason, ssl.SSLError):
        return True
    message = str(exc)
    return "CERTIFICATE_VERIFY_FAILED" in message or "certificate verify failed" in message.lower()


def ssl_help_message() -> str:
    return (
        "SSL certificates are missing for this Python install.\n"
        "  Fix (pick one):\n"
        "    • Applications → Python 3.x → Install Certificates.command\n"
        "    • Or rerun the build — this script will retry downloads with curl"
    )


def download_with_curl(url: str, dest: Path) -> None:
    curl = shutil.which("curl")
    if not curl:
        raise RuntimeError("curl not found")

    result = subprocess.run(
        [curl, "-fsSL", "--retry", "3", "-o", str(dest), url],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(detail or f"curl failed (exit {result.returncode})")


def download(url: str, dest: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "cel-download-models/1.0"})
    try:
        with urllib.request.urlopen(request, context=ssl_context()) as response, dest.open("wb") as out:
            shutil.copyfileobj(response, out)
    except Exception as exc:
        if not is_ssl_error(exc):
            raise
        if shutil.which("curl"):
            print("  ⚠ Python SSL failed — retrying with curl ...")
            download_with_curl(url, dest)
            return
        raise RuntimeError(ssl_help_message()) from exc


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
        download(url, tmp)
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

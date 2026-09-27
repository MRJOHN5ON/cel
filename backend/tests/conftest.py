from __future__ import annotations

import io
import os
import sys
import types
from pathlib import Path

import pytest
from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.pop("CEL_PACKAGED", None)
os.environ.pop("CEL_FRONTEND_DIR", None)


def make_image_bytes(
    width: int = 64,
    height: int = 48,
    fmt: str = "PNG",
    noise: bool = False,
    color: tuple[int, int, int] = (200, 30, 30),
) -> bytes:
    if noise:
        img = Image.frombytes("RGB", (width, height), os.urandom(width * height * 3))
    else:
        img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _fake_cutout(data: bytes) -> Image.Image:
    """Opaque left half, transparent right half, and a transparent border."""
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    w, h = img.size
    alpha = Image.new("L", (w, h), 0)
    alpha.paste(255, (2, 2, max(3, w // 2), max(3, h - 2)))
    img.putalpha(alpha)
    return img


def _to_png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def models_home(tmp_path, monkeypatch):
    """Isolated U2NET_HOME with downloadable models already 'present'."""
    import remover

    home = tmp_path / "models"
    home.mkdir()
    for model in remover.MODEL_DOWNLOADS:
        (home / f"{model}.onnx").write_bytes(b"")
    monkeypatch.setenv("U2NET_HOME", str(home))
    return home


@pytest.fixture
def fake_rembg(monkeypatch):
    """Replace rembg with a fast stand-in so tests never load ONNX models."""
    calls: dict[str, list] = {"remove": [], "new_session": []}

    def new_session(model: str):
        calls["new_session"].append(model)
        return f"session:{model}"

    def remove(data, session=None, only_mask=False, **kwargs):
        calls["remove"].append({"session": session, "only_mask": only_mask, **kwargs})
        cutout = _fake_cutout(data)
        if only_mask:
            return _to_png(cutout.getchannel("A"))
        return _to_png(cutout)

    def putalpha_cutout(img, mask):
        out = img.convert("RGBA")
        out.putalpha(mask)
        return out

    rembg = types.ModuleType("rembg")
    rembg.__path__ = []
    rembg.new_session = new_session
    rembg.remove = remove

    bg = types.ModuleType("rembg.bg")
    bg.putalpha_cutout = putalpha_cutout
    bg.alpha_matting_cutout = lambda img, mask, *args: putalpha_cutout(img, mask)
    bg.post_process = lambda arr: arr
    rembg.bg = bg

    monkeypatch.setitem(sys.modules, "rembg", rembg)
    monkeypatch.setitem(sys.modules, "rembg.bg", bg)

    import remover

    monkeypatch.setattr(remover, "_sessions", {})
    return calls


@pytest.fixture
def client(fake_rembg):
    from fastapi.testclient import TestClient

    import main

    # Not used as a context manager, so the startup model warm-up never runs.
    return TestClient(main.app)

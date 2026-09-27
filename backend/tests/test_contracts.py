"""Values duplicated between backend and frontend-pro must stay in sync."""

from __future__ import annotations

import re
from pathlib import Path

import main
import remover

FRONTEND_SRC = Path(__file__).resolve().parents[2] / "frontend-pro" / "src"


def _read(rel: str) -> str:
    return (FRONTEND_SRC / rel).read_text()


def _js_number(source: str, name: str) -> int:
    match = re.search(rf"export const {name} = ([\d_]+)", source)
    assert match, f"{name} not found"
    return int(match.group(1).replace("_", ""))


def test_accepted_extensions_match():
    match = re.search(r"ACCEPTED_EXTENSIONS = \[([^\]]*)\]", _read("utils/format.js"))
    assert match
    frontend = set(re.findall(r"'([^']+)'", match.group(1)))

    assert frontend == main.ALLOWED_EXTENSIONS


def test_alpha_matting_limits_match():
    source = _read("hooks/useSettings.js")

    assert _js_number(source, "ALPHA_MATTING_MAX_PIXELS") == remover.ALPHA_MATTING_MAX_PIXELS
    assert _js_number(source, "ALPHA_MATTING_MAX_SIDE_PX") == remover.ALPHA_MATTING_MAX_SIDE_PX


def test_default_model_matches():
    match = re.search(r"model: '([^']+)'", _read("hooks/useSettings.js"))
    assert match

    assert match.group(1) == remover.DEFAULT_MODEL

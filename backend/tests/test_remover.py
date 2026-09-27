from __future__ import annotations

import io

import pytest
from PIL import Image

import remover
from conftest import make_image_bytes


def test_source_info_warns_on_small_image():
    info = remover.get_source_info(make_image_bytes(64, 48))

    assert (info["width"], info["height"], info["format"]) == (64, 48, "PNG")
    assert len(info["warnings"]) == 2


def test_source_info_no_warnings_for_large_file():
    data = make_image_bytes(1200, 1100, noise=True)
    assert len(data) >= remover.LOW_RES_FILE_SIZE_BYTES

    assert remover.get_source_info(data)["warnings"] == []


def test_source_info_rejects_garbage():
    with pytest.raises(Exception):
        remover.get_source_info(b"not an image")


@pytest.mark.parametrize(
    ("width", "height", "skip"),
    [
        (2000, 1250, False),  # exactly the limits
        (2001, 100, True),  # side too long
        (1600, 1600, True),  # too many pixels
        (1000, 1000, False),
    ],
)
def test_should_skip_alpha_matting(width, height, skip):
    assert remover.should_skip_alpha_matting(width, height) is skip


def test_get_session_rejects_unknown_model(fake_rembg):
    with pytest.raises(ValueError, match="Unknown model"):
        remover.get_session("not-a-model")


def test_get_session_is_cached(fake_rembg):
    remover.get_session("u2net")
    remover.get_session("u2net")

    assert fake_rembg["new_session"] == ["u2net"]
    assert remover.is_model_cached("u2net")


def test_remove_background_returns_png_and_metadata(fake_rembg):
    png, meta = remover.remove_background(make_image_bytes(80, 60), model="u2net")

    img = Image.open(io.BytesIO(png))
    assert img.format == "PNG" and img.mode == "RGBA"
    assert (meta["source_width"], meta["output_width"]) == (80, 80)
    assert meta["model"] == "u2net"
    assert meta["trimmed"] is False
    assert meta["file_size"] == len(png)


def test_remove_background_trim_crops_transparent_edges(fake_rembg):
    png, meta = remover.remove_background(make_image_bytes(80, 60), trim=True)

    assert meta["trimmed"] is True
    assert meta["output_width"] < 80 and meta["output_height"] < 60
    assert meta["original_output_width"] == 80
    assert Image.open(io.BytesIO(png)).size == (meta["output_width"], meta["output_height"])


def test_alpha_matting_skipped_on_large_image(fake_rembg):
    _, meta = remover.remove_background(make_image_bytes(2100, 100), alpha_matting=True)

    assert meta["alpha_matting"] is False
    assert fake_rembg["remove"][-1]["alpha_matting"] is False
    assert any("Alpha matting skipped" in w for w in meta["warnings"])


def test_force_alpha_matting_overrides_size_limit(fake_rembg):
    _, meta = remover.remove_background(
        make_image_bytes(2100, 100), alpha_matting=True, force_alpha_matting=True
    )

    assert meta["alpha_matting"] is True
    assert not any("Alpha matting skipped" in w for w in meta["warnings"])


def test_progress_callback_is_monotonic(fake_rembg):
    seen: list[int] = []
    remover.remove_background(make_image_bytes(), progress_callback=lambda p, _m: seen.append(p))

    assert seen and seen == sorted(seen)


def test_segment_with_sam_returns_mask(fake_rembg):
    prompt = [{"type": "point", "data": [10, 10], "label": 1}]
    mask, meta = remover.segment_with_sam(make_image_bytes(40, 30), prompt)

    assert Image.open(io.BytesIO(mask)).mode == "L"
    assert meta == {"source_width": 40, "source_height": 30, "model": "sam", "prompt_count": 1}
    assert fake_rembg["remove"][-1]["sam_prompt"] == prompt


def test_refine_with_mask_resizes_mismatched_mask(fake_rembg):
    image = make_image_bytes(80, 60)
    buf = io.BytesIO()
    Image.new("L", (20, 15), 255).save(buf, format="PNG")

    png, meta = remover.refine_with_mask(image, buf.getvalue(), post_process_mask=False)

    out = Image.open(io.BytesIO(png))
    assert out.size == (80, 60)
    assert out.getchannel("A").getextrema() == (255, 255)
    assert meta["refined"] is True


def test_png_to_jpg_fills_transparency_with_background():
    buf = io.BytesIO()
    Image.new("RGBA", (10, 10), (0, 0, 0, 0)).save(buf, format="PNG")

    jpg = remover.png_to_jpg(buf.getvalue(), "#00ff00", 95)

    img = Image.open(io.BytesIO(jpg))
    assert img.format == "JPEG"
    r, g, b = img.getpixel((5, 5))
    assert g > 240 and r < 15 and b < 15

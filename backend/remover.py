"""rembg wrapper with session caching and image post-processing."""

from __future__ import annotations

import io
from typing import Any

from PIL import Image

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pass

# Model metadata for the settings UI
MODELS: dict[str, dict[str, str]] = {
    "isnet-general-use": {
        "name": "ISNet General",
        "description": "Best for people, hair, and fine edges (recommended)",
    },
    "u2net": {
        "name": "U2Net",
        "description": "General-purpose segmentation",
    },
    "u2net_human_seg": {
        "name": "U2Net Human",
        "description": "Optimized for human portraits",
    },
    "bria-rmbg": {
        "name": "BRIA RMBG 2.0",
        "description": "Highest quality — slower, ~1 GB model (non-commercial license)",
    },
}

DEFAULT_MODEL = "isnet-general-use"
LOW_RES_FILE_SIZE_BYTES = 100 * 1024  # 100 KB
LOW_RES_DIMENSION_PX = 1000
# Alpha matting scales badly on large images (minutes+). Disable past this size.
ALPHA_MATTING_MAX_PIXELS = 2_500_000
ALPHA_MATTING_MAX_SIDE_PX = 2000

_sessions: dict[str, Any] = {}


def _is_session_cached(model: str) -> bool:
    return model in _sessions


def get_session(model: str) -> Any:
    from rembg import new_session

    if model not in MODELS:
        raise ValueError(f"Unknown model: {model}")
    if model not in _sessions:
        _sessions[model] = new_session(model)
    return _sessions[model]


def preload_session(model: str = DEFAULT_MODEL) -> None:
    get_session(model)


def is_model_cached(model: str = DEFAULT_MODEL) -> bool:
    return _is_session_cached(model)


def get_source_info(data: bytes) -> dict[str, Any]:
    img = Image.open(io.BytesIO(data))
    width, height = img.size
    warnings: list[str] = []
    if len(data) < LOW_RES_FILE_SIZE_BYTES:
        warnings.append(
            "This image is low resolution — use the original file for best results."
        )
    if width < LOW_RES_DIMENSION_PX or height < LOW_RES_DIMENSION_PX:
        warnings.append(
            f"Image dimensions ({width}×{height}) are below {LOW_RES_DIMENSION_PX}px — "
            "use the original file for best results."
        )
    return {
        "width": width,
        "height": height,
        "format": img.format or "unknown",
        "file_size": len(data),
        "warnings": warnings,
    }


def should_skip_alpha_matting(width: int, height: int) -> bool:
    pixels = width * height
    return (
        pixels > ALPHA_MATTING_MAX_PIXELS
        or max(width, height) > ALPHA_MATTING_MAX_SIDE_PX
    )


def remove_background(
    data: bytes,
    *,
    model: str = DEFAULT_MODEL,
    alpha_matting: bool = True,
    force_alpha_matting: bool = False,
    trim: bool = False,
    progress_callback: Any = None,
) -> tuple[bytes, dict[str, Any]]:
    import logging
    import time
    from rembg import remove

    log = logging.getLogger("cel.remover")
    source_info = get_source_info(data)
    width, height = source_info["width"], source_info["height"]
    pixels = width * height
    use_alpha_matting = alpha_matting

    if (
        alpha_matting
        and not force_alpha_matting
        and should_skip_alpha_matting(width, height)
    ):
        use_alpha_matting = False
        source_info["warnings"] = [
            *source_info["warnings"],
            (
                f"Alpha matting skipped for this {width}×{height} image — "
                "it can take many minutes at full resolution. "
                "Enable “Force on large images” in settings if you want it anyway. "
                "Result edges may be slightly softer."
            ),
        ]
        log.info(
            "Alpha matting disabled for large image %sx%s (%s pixels)",
            width,
            height,
            pixels,
        )

    if progress_callback:
        progress_callback(18, "Loading model…")

    session = get_session(model)

    if progress_callback:
        progress_callback(25, "Removing background…")

    log.info(
        "Removing background model=%s alpha_matting=%s size=%sx%s",
        model,
        use_alpha_matting,
        width,
        height,
    )
    started = time.time()

    result = remove(
        data,
        session=session,
        alpha_matting=use_alpha_matting,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
        post_process_mask=False,
    )

    log.info("Background removed in %.1fs", time.time() - started)

    if progress_callback:
        progress_callback(92, "Finishing up…")

    img = Image.open(io.BytesIO(result)).convert("RGBA")
    original_width, original_height = img.size
    trim_bbox = None

    if trim:
        bbox = img.getbbox()
        if bbox:
            trim_bbox = list(bbox)
            img = img.crop(bbox)

    out_buf = io.BytesIO()
    img.save(out_buf, format="PNG", optimize=False)
    png_bytes = out_buf.getvalue()

    metadata = {
        "source_width": source_info["width"],
        "source_height": source_info["height"],
        "output_width": img.size[0],
        "output_height": img.size[1],
        "original_output_width": original_width,
        "original_output_height": original_height,
        "trimmed": trim_bbox is not None and (
            img.size != (original_width, original_height)
        ),
        "trim_bbox": trim_bbox,
        "file_size": len(png_bytes),
        "warnings": source_info["warnings"],
        "model": model,
        "alpha_matting": use_alpha_matting,
    }
    return png_bytes, metadata


def png_to_jpg(
    png_bytes: bytes,
    background_color: str = "#ffffff",
    quality: int = 90,
) -> bytes:
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    bg = Image.new("RGB", img.size, background_color)
    bg.paste(img, mask=img.split()[3])
    out_buf = io.BytesIO()
    bg.save(out_buf, format="JPEG", quality=quality, optimize=True)
    return out_buf.getvalue()

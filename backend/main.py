"""FastAPI server for local background removal."""

from __future__ import annotations

import io
import os
import zipfile
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from remover import (
    ALPHA_MATTING_MAX_PIXELS,
    ALPHA_MATTING_MAX_SIDE_PX,
    DEFAULT_MODEL,
    MODELS,
    get_source_info,
    is_model_cached,
    png_to_jpg,
    preload_session,
    remove_background,
)
from jobs import get_job, start_remove_job

PACKAGED = os.environ.get("CEL_PACKAGED") == "1"
FRONTEND_DIR = Path(os.environ.get("CEL_FRONTEND_DIR", "")).resolve()

if PACKAGED:
    import logging

    logging.basicConfig(level=logging.INFO, format="%(message)s")

app = FastAPI(title="Cel", version="1.0.0")

if not PACKAGED:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


def _validate_upload(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported format. Accepted: JPG, JPEG, PNG, WEBP, HEIC",
        )


@app.on_event("startup")
async def startup() -> None:
    import asyncio

    async def warm_model() -> None:
        try:
            await asyncio.to_thread(preload_session, DEFAULT_MODEL)
        except Exception:
            pass

    asyncio.create_task(warm_model())


@app.get("/api/health")
def health() -> dict:
    import sys

    return {
        "status": "ok",
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "default_model": DEFAULT_MODEL,
        "model_cached": is_model_cached(DEFAULT_MODEL),
        "runs_locally": True,
    }


@app.get("/api/models")
def list_models() -> dict:
    return {
        "models": [
            {"id": mid, **meta, "default": mid == DEFAULT_MODEL}
            for mid, meta in MODELS.items()
        ]
    }


@app.post("/api/inspect")
async def inspect_image(file: UploadFile = File(...)) -> dict:
    """Return image metadata without processing."""
    _validate_upload(file)
    data = await file.read()
    try:
        info = get_source_info(data)
    except Exception:
        raise HTTPException(400, "Could not read image — the file may be corrupt.")
    return {
        "filename": file.filename,
        **info,
    }


@app.get("/api/config")
def app_config() -> dict:
    return {
        "alpha_matting_max_pixels": ALPHA_MATTING_MAX_PIXELS,
        "alpha_matting_max_side_px": ALPHA_MATTING_MAX_SIDE_PX,
    }


@app.post("/api/remove")
async def remove_bg(
    file: UploadFile = File(...),
    model: str = Query(DEFAULT_MODEL),
    alpha_matting: bool = Query(True),
    force_alpha_matting: bool = Query(False),
    trim: bool = Query(False),
    format: str = Query("png"),
    jpg_background: str = Query("#ffffff"),
    jpg_quality: int = Query(90, ge=1, le=100),
) -> Response:
    _validate_upload(file)
    data = await file.read()

    try:
        png_bytes, metadata = remove_background(
            data,
            model=model,
            alpha_matting=alpha_matting,
            force_alpha_matting=force_alpha_matting,
            trim=trim,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        raise HTTPException(
            500,
            "Background removal failed. Try a different image or model.",
        )

    if format.lower() == "jpg":
        try:
            body = png_to_jpg(png_bytes, jpg_background, jpg_quality)
            media_type = "image/jpeg"
            filename = _swap_ext(file.filename or "result", ".jpg")
        except Exception:
            raise HTTPException(500, "JPG export failed.")
    else:
        body = png_bytes
        media_type = "image/png"
        filename = _swap_ext(file.filename or "result", ".png")

    return Response(
        content=body,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Source-Width": str(metadata["source_width"]),
            "X-Source-Height": str(metadata["source_height"]),
            "X-Output-Width": str(metadata["output_width"]),
            "X-Output-Height": str(metadata["output_height"]),
            "X-Output-Size": str(metadata["file_size"]),
            "X-Warnings": "|".join(metadata["warnings"]),
            "X-Trimmed": str(metadata["trimmed"]).lower(),
        },
    )


@app.post("/api/remove/json")
async def remove_bg_json(
    file: UploadFile = File(...),
    model: str = Query(DEFAULT_MODEL),
    alpha_matting: bool = Query(True),
    force_alpha_matting: bool = Query(False),
    trim: bool = Query(False),
) -> JSONResponse:
    """Return base64 PNG + metadata for in-browser preview."""
    import base64

    _validate_upload(file)
    data = await file.read()

    try:
        png_bytes, metadata = remove_background(
            data,
            model=model,
            alpha_matting=alpha_matting,
            force_alpha_matting=force_alpha_matting,
            trim=trim,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        raise HTTPException(
            500,
            "Background removal failed. Try a different image or model.",
        )

    return JSONResponse(
        {
            "image": base64.b64encode(png_bytes).decode("ascii"),
            "metadata": metadata,
            "filename": _swap_ext(file.filename or "result", ".png"),
        }
    )


@app.post("/api/remove/job")
async def remove_bg_job(
    file: UploadFile = File(...),
    model: str = Query(DEFAULT_MODEL),
    alpha_matting: bool = Query(True),
    force_alpha_matting: bool = Query(False),
    trim: bool = Query(False),
) -> JSONResponse:
    """Start background removal and poll GET /api/jobs/{id} for progress."""
    _validate_upload(file)
    data = await file.read()

    try:
        job_id = start_remove_job(
            data,
            model=model,
            alpha_matting=alpha_matting,
            force_alpha_matting=force_alpha_matting,
            trim=trim,
            runner=remove_background,
        )
    except Exception:
        raise HTTPException(500, "Could not start background removal job.")

    return JSONResponse({"job_id": job_id})


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str) -> JSONResponse:
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")

    payload = {
        "status": job["status"],
        "progress": job["progress"],
        "message": job["message"],
    }
    if job["status"] == "complete" and job.get("result"):
        payload["image"] = job["result"]["image"]
        payload["metadata"] = job["result"]["metadata"]
    if job["status"] == "error":
        payload["error"] = job.get("error") or "Background removal failed."

    return JSONResponse(payload)


@app.post("/api/batch")
async def batch_remove(
    files: Annotated[list[UploadFile], File(...)],
    model: str = Query(DEFAULT_MODEL),
    alpha_matting: bool = Query(True),
    force_alpha_matting: bool = Query(False),
    trim: bool = Query(False),
) -> StreamingResponse:
    if not files:
        raise HTTPException(400, "No files uploaded")

    zip_buffer = io.BytesIO()
    errors: list[str] = []

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for upload in files:
            try:
                _validate_upload(upload)
                data = await upload.read()
                png_bytes, _ = remove_background(
                    data,
                    model=model,
                    alpha_matting=alpha_matting,
                    force_alpha_matting=force_alpha_matting,
                    trim=trim,
                )
                name = _swap_ext(upload.filename or "image", ".png")
                zf.writestr(name, png_bytes)
            except Exception as e:
                errors.append(f"{upload.filename}: {e}")

        if errors:
            zf.writestr("_errors.txt", "\n".join(errors))

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="removed-backgrounds.zip"'},
    )


def _swap_ext(filename: str, new_ext: str) -> str:
    if "." in filename:
        base = filename.rsplit(".", 1)[0]
    else:
        base = filename
    return f"{base}_BGREMOVED{new_ext}"


if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

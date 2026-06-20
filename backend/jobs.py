"""In-memory job queue for long-running background removal with progress."""

from __future__ import annotations

import base64
import threading
import time
import uuid
from typing import Any, Callable

_jobs: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()

# Drop completed/errored jobs after this many seconds.
_JOB_TTL_SECONDS = 600


def _cleanup_old_jobs() -> None:
    now = time.time()
    with _lock:
        stale = [
            jid
            for jid, job in _jobs.items()
            if now - job.get("updated_at", now) > _JOB_TTL_SECONDS
        ]
        for jid in stale:
            _jobs.pop(jid, None)


def _update(job_id: str, **fields: Any) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.update(fields)
        job["updated_at"] = time.time()


def get_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def _estimate_seconds(
    width: int,
    height: int,
    *,
    alpha_matting: bool,
    force_alpha_matting: bool,
) -> float:
    pixels = width * height
    base = 2.0 + (pixels / 1_000_000) * 2.5
    if alpha_matting:
        large = pixels > 2_500_000 or max(width, height) > 2000
        if force_alpha_matting or not large:
            base *= 4.0
    return max(4.0, min(base, 900.0))


def start_remove_job(
    data: bytes,
    *,
    model: str,
    alpha_matting: bool,
    force_alpha_matting: bool,
    trim: bool,
    runner: Callable[..., tuple[bytes, dict[str, Any]]],
) -> str:
    from remover import get_source_info

    _cleanup_old_jobs()
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = {
            "status": "pending",
            "progress": 0,
            "message": "Starting…",
            "result": None,
            "error": None,
            "created_at": time.time(),
            "updated_at": time.time(),
        }

    def _run() -> None:
        stop_ticker = threading.Event()

        def _tick(started: float, estimate: float) -> None:
            while not stop_ticker.wait(0.4):
                elapsed = time.time() - started
                pct = min(88, 28 + int(60 * elapsed / estimate))
                _update(job_id, progress=pct, message="Removing background…")

        try:
            _update(job_id, status="running", progress=5, message="Reading image…")
            info = get_source_info(data)
            width, height = info["width"], info["height"]
            estimate = _estimate_seconds(
                width,
                height,
                alpha_matting=alpha_matting,
                force_alpha_matting=force_alpha_matting,
            )

            _update(job_id, progress=12, message="Preparing model…")

            def on_progress(pct: int, message: str) -> None:
                _update(job_id, progress=pct, message=message)

            started = time.time()
            ticker = threading.Thread(
                target=_tick, args=(started, estimate), daemon=True
            )
            ticker.start()

            png_bytes, metadata = runner(
                data,
                model=model,
                alpha_matting=alpha_matting,
                force_alpha_matting=force_alpha_matting,
                trim=trim,
                progress_callback=on_progress,
            )

            stop_ticker.set()
            ticker.join(timeout=1.0)

            _update(job_id, progress=96, message="Encoding result…")
            _update(
                job_id,
                status="complete",
                progress=100,
                message="Done",
                result={
                    "image": base64.b64encode(png_bytes).decode("ascii"),
                    "metadata": metadata,
                },
            )
        except Exception as exc:
            stop_ticker.set()
            _update(
                job_id,
                status="error",
                progress=0,
                message="Failed",
                error=str(exc) or "Background removal failed.",
            )

    threading.Thread(target=_run, daemon=True).start()
    return job_id

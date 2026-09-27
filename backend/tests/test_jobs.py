from __future__ import annotations

import time

import pytest

import jobs
from conftest import make_image_bytes


def test_estimate_has_floor_and_ceiling():
    small = jobs._estimate_seconds(10, 10, alpha_matting=False, force_alpha_matting=False)
    huge = jobs._estimate_seconds(
        50_000, 50_000, alpha_matting=True, force_alpha_matting=True
    )

    assert small == 4.0
    assert huge == 900.0


def test_alpha_matting_only_slows_estimate_when_it_will_run():
    args = dict(width=1000, height=1000)
    plain = jobs._estimate_seconds(**args, alpha_matting=False, force_alpha_matting=False)
    matted = jobs._estimate_seconds(**args, alpha_matting=True, force_alpha_matting=False)
    large_skipped = jobs._estimate_seconds(
        3000, 3000, alpha_matting=True, force_alpha_matting=False
    )
    large_plain = jobs._estimate_seconds(
        3000, 3000, alpha_matting=False, force_alpha_matting=False
    )

    assert matted == plain * 4
    assert large_skipped == large_plain


def _wait(job_id: str) -> dict:
    deadline = time.time() + 5
    while time.time() < deadline:
        job = jobs.get_job(job_id)
        if job["status"] in ("complete", "error"):
            return job
        time.sleep(0.02)
    pytest.fail("job did not finish")


def _start(runner) -> str:
    return jobs.start_remove_job(
        make_image_bytes(),
        model="u2net",
        alpha_matting=False,
        force_alpha_matting=False,
        trim=False,
        runner=runner,
    )


def test_job_reports_runner_error():
    def boom(*_args, **_kwargs):
        raise RuntimeError("model exploded")

    job = _wait(_start(boom))

    assert job["status"] == "error"
    assert job["error"] == "model exploded"


def test_job_result_is_base64_png():
    job = _wait(_start(lambda *_a, **_k: (b"\x89PNG", {"ok": True})))

    assert job["status"] == "complete"
    assert job["result"] == {"image": "iVBORw==", "metadata": {"ok": True}}


def test_get_job_returns_copy():
    job_id = _start(lambda *_a, **_k: (b"x", {}))
    _wait(job_id)

    jobs.get_job(job_id)["status"] = "tampered"

    assert jobs.get_job(job_id)["status"] == "complete"


def test_stale_jobs_are_cleaned_up(monkeypatch):
    job_id = _start(lambda *_a, **_k: (b"x", {}))
    _wait(job_id)

    monkeypatch.setattr(jobs, "_JOB_TTL_SECONDS", -1)
    jobs._cleanup_old_jobs()

    assert jobs.get_job(job_id) is None

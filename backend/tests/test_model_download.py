from __future__ import annotations

import hashlib
import io
import time

import pytest

import jobs
import remover
from conftest import make_image_bytes

PAYLOAD = b"fake-onnx-weights" * 1000


class FakeResponse(io.BytesIO):
    def __init__(self, body: bytes):
        super().__init__(body)
        self.headers = {"Content-Length": str(len(body))}


@pytest.fixture
def bria_missing(models_home, monkeypatch):
    (models_home / "bria-rmbg.onnx").unlink()
    spec = {**remover.MODEL_DOWNLOADS["bria-rmbg"], "sha256": hashlib.sha256(PAYLOAD).hexdigest()}
    monkeypatch.setitem(remover.MODEL_DOWNLOADS, "bria-rmbg", spec)
    requests: list[str] = []

    def urlopen(request, **_kwargs):
        requests.append(request.full_url)
        return FakeResponse(PAYLOAD)

    monkeypatch.setattr(remover.urllib.request, "urlopen", urlopen)
    return requests


def test_bundled_models_never_need_download(models_home):
    assert remover.is_model_downloaded("u2net")


def test_download_writes_verified_file(models_home, bria_missing):
    progress: list[int] = []

    remover.ensure_model_downloaded("bria-rmbg", lambda pct, _d, _t: progress.append(pct))

    assert (models_home / "bria-rmbg.onnx").read_bytes() == PAYLOAD
    assert progress[-1] == 100
    assert not list(models_home.glob("*.part"))


def test_download_skipped_when_present(bria_missing):
    remover.ensure_model_downloaded("bria-rmbg")
    remover.ensure_model_downloaded("bria-rmbg")

    assert len(bria_missing) == 1


def test_checksum_mismatch_leaves_no_file(models_home, bria_missing, monkeypatch):
    spec = {**remover.MODEL_DOWNLOADS["bria-rmbg"], "sha256": "0" * 64}
    monkeypatch.setitem(remover.MODEL_DOWNLOADS, "bria-rmbg", spec)

    with pytest.raises(RuntimeError, match="Could not download the BRIA RMBG 2.0 model"):
        remover.ensure_model_downloaded("bria-rmbg")

    assert list(models_home.iterdir()) == []


def test_network_error_is_friendly(bria_missing, monkeypatch):
    def offline(*_args, **_kwargs):
        raise OSError("no route to host")

    monkeypatch.setattr(remover.urllib.request, "urlopen", offline)

    with pytest.raises(RuntimeError, match="internet connection"):
        remover.ensure_model_downloaded("bria-rmbg")


def test_models_endpoint_reports_download_state(client, bria_missing):
    models = {m["id"]: m for m in client.get("/api/models").json()["models"]}

    assert models["bria-rmbg"]["downloaded"] is False
    assert models["bria-rmbg"]["download_size_mb"] == 1024
    assert models["u2net"]["downloaded"] is True


def test_job_shows_download_progress_then_completes(fake_rembg, bria_missing, monkeypatch):
    messages: list[str] = []
    original_update = jobs._update

    def spy(job_id, **fields):
        if "message" in fields:
            messages.append(fields["message"])
        original_update(job_id, **fields)

    monkeypatch.setattr(jobs, "_update", spy)

    job_id = jobs.start_remove_job(
        make_image_bytes(),
        model="bria-rmbg",
        alpha_matting=False,
        force_alpha_matting=False,
        trim=False,
        runner=remover.remove_background,
    )
    deadline = time.time() + 5
    while jobs.get_job(job_id)["status"] not in ("complete", "error") and time.time() < deadline:
        time.sleep(0.02)

    assert jobs.get_job(job_id)["status"] == "complete"
    assert any(m.startswith("Downloading BRIA RMBG 2.0 model (one-time)") for m in messages)

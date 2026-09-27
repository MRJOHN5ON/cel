from __future__ import annotations

import base64
import io
import json
import time
import zipfile
from urllib.parse import unquote

import pytest
from PIL import Image

import main
from conftest import make_image_bytes


def upload(name: str = "photo.png", data: bytes | None = None):
    return {"file": (name, data if data is not None else make_image_bytes(), "image/png")}


def test_health(client):
    body = client.get("/api/health").json()

    assert body["status"] == "ok"
    assert body["default_model"] == "bria-rmbg"
    assert body["runs_locally"] is True


def test_models_lists_default_and_sam(client):
    body = client.get("/api/models").json()

    defaults = [m["id"] for m in body["models"] if m["default"]]
    assert defaults == ["bria-rmbg"]
    assert body["segment_models"][0]["id"] == "sam"


@pytest.mark.parametrize("name", ["photo.gif", "photo", "archive.png.zip"])
def test_rejects_unsupported_extensions(client, name):
    res = client.post("/api/inspect", files=upload(name))

    assert res.status_code == 400


@pytest.mark.parametrize("name", ["a.JPG", "b.jpeg", "c.webp", "d.HEIC", "e.heif"])
def test_accepts_supported_extensions(name):
    class Upload:
        filename = name

    main._validate_upload(Upload())


def test_inspect_corrupt_file_returns_400(client):
    res = client.post("/api/inspect", files=upload(data=b"garbage"))

    assert res.status_code == 400
    assert "corrupt" in res.json()["detail"]


def test_remove_returns_png_with_headers(client):
    res = client.post("/api/remove", files=upload("cat.photo.png"))

    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert 'filename="cat.photo_BGREMOVED.png"' in res.headers["content-disposition"]
    assert "x-warnings" in res.headers
    assert res.headers["x-source-width"] == "64"
    assert res.headers["x-trimmed"] == "false"
    assert Image.open(io.BytesIO(res.content)).mode == "RGBA"


def test_remove_encodes_non_latin1_headers(client):
    res = client.post("/api/remove", files=upload("café ☕.png"))

    assert res.status_code == 200
    assert "Image dimensions (64×48)" in unquote(res.headers["x-warnings"])
    assert "filename*=UTF-8''caf%C3%A9%20%E2%98%95_BGREMOVED.png" in res.headers[
        "content-disposition"
    ]


def test_remove_as_jpg(client):
    res = client.post("/api/remove?format=jpg", files=upload())

    assert res.headers["content-type"] == "image/jpeg"
    assert "_BGREMOVED.jpg" in res.headers["content-disposition"]


def test_remove_unknown_model_is_400(client):
    res = client.post("/api/remove?model=nope", files=upload())

    assert res.status_code == 400
    assert "Unknown model" in res.json()["detail"]


def test_remove_json_returns_base64(client):
    body = client.post("/api/remove/json", files=upload()).json()

    img = Image.open(io.BytesIO(base64.b64decode(body["image"])))
    assert img.format == "PNG"
    assert body["filename"] == "photo_BGREMOVED.png"


def test_job_runs_to_completion(client):
    job_id = client.post("/api/remove/job", files=upload()).json()["job_id"]

    deadline = time.time() + 5
    while time.time() < deadline:
        body = client.get(f"/api/jobs/{job_id}").json()
        if body["status"] in ("complete", "error"):
            break
        time.sleep(0.05)

    assert body["status"] == "complete", body
    assert body["progress"] == 100
    assert "image" in body and "metadata" in body


def test_unknown_job_is_404(client):
    assert client.get("/api/jobs/does-not-exist").status_code == 404


@pytest.mark.parametrize("prompt", ["not json", "[]", '{"type": "point"}'])
def test_sam_rejects_bad_prompts(client, prompt):
    res = client.post("/api/segment/sam", files=upload(), data={"prompt": prompt})

    assert res.status_code == 400


def test_sam_apply_returns_cutout(client):
    prompt = json.dumps([{"type": "point", "data": [5, 5], "label": 1}])
    body = client.post("/api/segment/sam/apply", files=upload(), data={"prompt": prompt}).json()

    assert body["metadata"]["model"] == "sam"
    assert body["metadata"]["sam"]["prompt_count"] == 1


def test_refine_rejects_empty_mask(client):
    files = {**upload(), "mask": ("mask.png", b"", "image/png")}

    assert client.post("/api/refine/mask", files=files).status_code == 400


def test_batch_zips_results_and_reports_errors(client):
    files = [
        ("files", ("one.png", make_image_bytes(), "image/png")),
        ("files", ("two.jpg", make_image_bytes(fmt="JPEG"), "image/jpeg")),
        ("files", ("bad.gif", b"GIF89a", "image/gif")),
    ]
    res = client.post("/api/batch", files=files)

    names = zipfile.ZipFile(io.BytesIO(res.content)).namelist()
    assert sorted(names) == ["_errors.txt", "one_BGREMOVED.png", "two_BGREMOVED.png"]


@pytest.mark.parametrize(
    ("name", "ext", "expected"),
    [
        ("photo.jpg", ".png", "photo_BGREMOVED.png"),
        ("my.cat.heic", ".png", "my.cat_BGREMOVED.png"),
        ("noext", ".jpg", "noext_BGREMOVED.jpg"),
    ],
)
def test_swap_ext(name, ext, expected):
    assert main._swap_ext(name, ext) == expected

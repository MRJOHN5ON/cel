# Cel Pro — agent guide

Local-only background removal app for macOS. A FastAPI backend wraps `rembg` (ONNX models); a React/Vite frontend talks to it over `/api/*`. The shipped `.app` is a pywebview window around the same backend serving the built frontend. Nothing may call out to the network at runtime except the one-time model/dependency downloads.

## Layout

| Path | What it is |
|------|------------|
| `backend/main.py` | FastAPI routes. Validates uploads, maps exceptions to HTTP errors. |
| `backend/remover.py` | All image/ML work: rembg sessions, background removal, SAM segmentation, mask refine, PNG→JPG. |
| `backend/jobs.py` | In-memory, thread-based job queue for `/api/remove/job` progress polling. |
| `backend/tests/` | pytest suite. `rembg` is stubbed, so tests never load models. |
| `frontend-pro/` | **The active UI** (React 18, plain JSX, no TypeScript). |
| `frontend-pro/src/App.jsx` | Top-level state, upload, job polling, results view. |
| `frontend-pro/src/components/MaskEditor.jsx` | Canvas erase/restore editor with magnifier, undo/redo, pan/zoom. |
| `frontend-pro/src/components/SamPointPicker.jsx` | Smart Select (SAM click-to-segment). |
| `frontend-pro/src/utils/` | Pure helpers (`format.js`, `brush.js`). Put testable logic here, not inside components. |
| `packaging-pro/` | `.app` launcher (`launcher.py`), pywebview bridge (`cel_api.py`), PyInstaller spec (`CelPro.spec`), locked build deps (`requirements-build.lock`), release notes template. |
| `scripts/build_release.sh` | **Release build.** Self-contained `.app` (bundled Python via PyInstaller) + DMG in `dist/release/`. `--publish` drafts a GitHub release. |
| `scripts/verify_bundle.py` | Fails the build if the `.app` links outside itself or needs a newer macOS than `LSMinimumSystemVersion`. |
| `.github/workflows/release.yml` | Pushing a `v*.*.*` tag runs `build_release.sh --publish` on a macOS arm64 runner. |
| `scripts/build_mac_app.sh`, `stub.c`, `setup_deps.sh` | Older build that uses the user's system Python. Superseded by `build_release.sh`. |
| `frontend/`, `packaging/`, `start-classic.sh` | **Legacy classic UI.** Don't edit unless asked. `packaging/` still supplies `Cel.icns`, `requirements.txt` and `models_cache/` to the Pro build. |

## Running

```bash
./start.sh                     # dev: backend :8000 + Vite :5173 (proxies /api)
scripts/build_release.sh 1.2.0 # release DMG (needs uv; Apple Silicon only)
```

## Verifying changes

```bash
venv/bin/python -m pytest backend/tests        # backend
(cd frontend-pro && npm test)                   # frontend unit tests (Vitest)
(cd frontend-pro && npm run build)              # catches JSX/import errors
```

Run the relevant suite before calling a change done. For UI changes also check it in the browser via `./start.sh`.

## Contracts to keep in sync

- **Accepted formats:** `ALLOWED_EXTENSIONS` in `backend/main.py` and `ACCEPTED_EXTENSIONS` in `frontend-pro/src/utils/format.js`.
- **Alpha matting limits:** `ALPHA_MATTING_MAX_PIXELS` / `ALPHA_MATTING_MAX_SIDE_PX` in `backend/remover.py` and `frontend-pro/src/hooks/useSettings.js`.
- **Output filenames:** `_swap_ext` (backend) and `swapExt` (frontend) both produce `name_BGREMOVED.ext`.
- **Default model:** `DEFAULT_MODEL` in `remover.py` and `DEFAULTS.model` in `useSettings.js`.
- **Response headers** from `/api/remove` must be latin-1. Anything user- or warning-derived is URL-encoded (`X-Warnings`, `filename*`). Batch mode (`processOne` in `App.jsx`) uses this endpoint.

## Release packaging

- The shipped app must never write inside its own bundle. Models live in `~/Library/Application Support/Cel Pro/models` (`U2NET_HOME`). The launcher symlinks the bundled models there, and BRIA is downloaded there on first use (`ensure_model_downloaded` in `remover.py`).
- BRIA is not bundled because app + all models would be ~2 GB, right at GitHub's 2 GiB asset limit. If `MODEL_DOWNLOADS` changes, keep its sha256 identical to rembg's, or rembg re-downloads the file.
- Build deps are pinned in `packaging-pro/requirements-build.lock` for macOS 12 wheels. Don't `pip install` newer versions into `.venv-build`; change `requirements-build.txt` and run `scripts/build_release.sh --relock`. Newer numpy/scipy/onnxruntime wheels need macOS 14, and `verify_bundle.py` will fail the build.
- New Python dependencies with native code or data files usually need an entry in `CelPro.spec` (`collect_all`). Test the built app, not just dev mode: run it with a clean `HOME` and drive `/api/remove/job`.
- `pyi_rth_cv2_app.py` works around OpenCV's loader failing inside a `.app` ("recursion is detected during loading of cv2"). Don't remove it.
- Releases are unsigned (no Apple Developer ID), so users go through System Settings → Privacy & Security → Open Anyway on first launch.

## Gotchas

- `backend/` modules import each other as top-level modules (`from remover import …`), because uvicorn runs from inside `backend/`. Keep it that way; the packaged launcher relies on it.
- Import `rembg` lazily inside functions. Importing it at module top level slows startup and breaks the test stubs.
- `CEL_PACKAGED=1` disables CORS and enables logging; `CEL_FRONTEND_DIR` makes FastAPI serve the built UI.
- Saving files goes through `window.pywebview.api.save_file` in the app, and falls back to `showSaveFilePicker` or a download link in the browser (`saveBlob` in `format.js`).
- BRIA RMBG 2.0 is non-commercial; don't change licensing text in `THIRD_PARTY_NOTICES.md` casually.

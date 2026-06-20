# Cel

A local-first background removal app for your Mac, powered by [rembg](https://github.com/danielgatis/rembg). Drop a photo in, get a transparent PNG back — everything runs on your machine. No cloud APIs, no subscriptions, no uploads to third parties.

Named after the animation **cel** — a transparent layer with your subject on it.

## Features

- Drag & drop, file picker, or paste from clipboard (JPG, PNG, WEBP, HEIC)
- **ISNet General** model by default — best for people, hair, and fine edges
- Three-step flow: upload → adjust settings → preview & save
- Side-by-side and slider comparison previews (scaled on screen; export is full resolution)
- Alpha matting for wispy edges, with automatic skip on very large images and an optional force override
- Processing progress bar with percentage for long jobs
- Save Result via native macOS save panel (full-resolution PNG)
- Rerun with a different model from the results screen
- Batch mode with per-file progress and ZIP download
- Light / dark mode toggle (remembers your preference)
- Low-resolution warnings when source quality looks suspicious
- Preferences persisted in `localStorage`
- Your images never leave your device

## Requirements

### Development (from source)

- **macOS** 12 Monterey or later (for local dev; Linux/Windows not supported out of the box)
- **Python** 3.10+
- **Node.js** 18+ (frontend dev server only)
- ~500 MB disk space after first model download

### Cel.app (built macOS application)

| Requirement | Details |
|-------------|---------|
| **OS** | macOS **12 Monterey** or later |
| **Processor** | Must match how the app was built — see below |
| **RAM** | 8 GB recommended (4 GB minimum) |
| **Disk** | ~1.2 GB free for the app bundle |
| **Network** | Not required after install — all 3 models are bundled |
| **Other** | No Python, Node, or Homebrew needed on the target Mac |

**Processor architecture matters.** The `.app` only runs on Macs with the same chip type it was built on:

| Built on | Runs on |
|----------|---------|
| Apple Silicon Mac (`arm64`) | M1 / M2 / M3 / M4 Macs |
| Intel Mac (`x86_64`) | Intel Macs |

Check your Mac: Apple menu → **About This Mac**, or run `uname -m` in Terminal (`arm64` = Apple Silicon, `x86_64` = Intel).

The build script prints the architecture when it finishes. If you're sending the app to someone else, **build on the same chip type as their Mac**, or the app won't open.

**Unsigned app (current builds):** macOS Gatekeeper will block the first launch. On the recipient's Mac: **right-click `Cel.app` → Open → Open** (one time only). After that, double-click works normally.

## Quick start

```bash
chmod +x start.sh
./start.sh
```

Then open **http://127.0.0.1:5173**.

### Manual setup

```bash
# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## First run

**Dev mode:** the first background removal downloads the **isnet-general-use** model (~179 MB). After that, the app works fully offline.

**Cel.app:** all three models are bundled — no download step on first launch. The first removal may still take a few extra seconds while the model loads into memory.

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server status |
| `GET /api/config` | App limits (e.g. alpha matting thresholds) |
| `GET /api/models` | Available rembg models |
| `POST /api/inspect` | Image metadata without processing |
| `POST /api/remove` | Process and return PNG bytes (JPG available via `format=jpg`) |
| `POST /api/remove/json` | Process and return base64 PNG + metadata |
| `POST /api/remove/job` | Start async job; poll `GET /api/jobs/{id}` for progress |
| `GET /api/jobs/{id}` | Job status, progress %, and result when complete |
| `POST /api/batch` | Process multiple images, return ZIP |

### Example

```bash
curl -X POST "http://127.0.0.1:8000/api/remove?alpha_matting=true" \
  -F "file=@photo.jpg" \
  -o result.png
```

## Project structure

```
├── backend/
│   ├── main.py           # FastAPI app
│   ├── remover.py        # rembg wrapper
│   ├── jobs.py           # async processing + progress
│   └── requirements.txt
├── frontend/             # React + Vite SPA
├── packaging/
│   ├── launcher.py       # Cel.app entry (native window)
│   ├── cel_api.py        # native save dialog bridge
│   ├── macos_about.py    # About panel + menu branding
│   └── Info.plist
├── scripts/
│   ├── build_mac_app.sh  # build dist/Cel.app
│   └── download_models.py
├── start.sh              # run backend + frontend (dev)
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── README.md
```

## Options

| Option | Default | Notes |
|--------|---------|-------|
| Model | `isnet-general-use` | Also: `u2net`, `u2net_human_seg` |
| Alpha matting | On | Better hair/edge quality; auto-skipped above ~2.5 MP unless you force it |
| Force alpha matting | Off | Shown for large images when alpha matting is on — can take many minutes |

All options are inline on the main page. The UI exports transparent PNG only.

## Performance

On CPU, a full-resolution portrait typically processes in under ~15 seconds depending on image size and hardware. Images are always processed at full source resolution — never downscaled before removal. Alpha matting on large images can take several minutes; Cel skips it by default and shows a warning.

## macOS app

Build a self-contained **Cel.app** — native window, bundled Python + UI + all 3 models, fully offline:

```bash
chmod +x scripts/build_mac_app.sh
./scripts/build_mac_app.sh
```

Output: `dist/Cel.app` — double-click to open a **native app window** (not your browser).

- Opens sized to your screen's usable area (between menu bar and dock)
- First build downloads any missing ONNX models (~530 MB total for all 3)
- Bundle size is typically **~1.1 GB** (Python runtime + ML stack + models + native window)
- Logs: `~/Library/Logs/Cel/cel.log`
- Quit via **Quit Cel** in the app menu or Cmd+Q

### Sending Cel.app to another Mac

**Send the whole `Cel.app` bundle** (or a zip of it) — not the small `Cel` file inside `Contents/MacOS/`. That inner file is just the launcher; the app is the entire `Cel.app` folder (~1.1 GB).

**WeTransfer, AirDrop, or a USB drive all work.** GitHub is optional — fine for public downloads, but overkill for sending to one person (large file, needs Releases + LFS or an external host).

1. **Confirm their chip type** matches your build (`arm64` vs `x86_64`) — see Requirements above.
2. Zip for transfer (recommended — preserves the bundle):
   ```bash
   ditto -c -k --sequesterRsrc --keepParent dist/Cel.app dist/Cel.zip
   ```
   Then WeTransfer/AirDrop **`Cel.zip`** (~1.1 GB).
3. On their Mac, double-click the zip to unzip, then **right-click `Cel.app` → Open → Open** the first time (Gatekeeper, because the app is unsigned).
4. Drag `Cel.app` to **Applications** if you want.
5. Fully offline after copy. No account, no downloads, no setup.

### Troubleshooting (Cel.app)

| Problem | Fix |
|---------|-----|
| "App is damaged" or won't open | Right-click → **Open** (don't double-click the first time) |
| App bounces in Dock and quits | Check `~/Library/Logs/Cel/cel.log` — often wrong chip type (Intel vs Apple Silicon) |
| Slow first removal | Normal — model loads into memory on first use (~5–10 s) |
| Processing stuck on a large image | Alpha matting may be running — cancel and retry without force, or wait |
| Save dialog doesn't appear | Make sure you're on macOS 12+; try a different save location |

## v2 hooks (not built yet)

- Replace background with color/image
- Code signing / notarization for distribution (skips right-click → Open)

## License

Cel is MIT licensed — see [LICENSE](LICENSE).

Third-party libraries and ML models are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

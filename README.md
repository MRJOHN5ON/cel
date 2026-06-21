<p align="center">
  <img src="./media/icon/app_icon.png" alt="Cel Pro app icon" width="120" />
</p>

<h1 align="center">Cel Pro</h1>

<p align="center">
  <strong>Local background removal + precision mask editing for macOS</strong><br>
  Drop a photo · refine the cutout · save a transparent PNG · nothing leaves your Mac
</p>

<p align="center">
  <a href="https://github.com/MRJOHN5ON/cel-android">Android version</a>
  ·
  <img src="https://img.shields.io/badge/platform-macOS%20(Apple%20Silicon)-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS Apple Silicon" />
  <img src="https://img.shields.io/badge/built%20with-Python%20%2B%20React-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python + React" />
  <img src="https://img.shields.io/badge/powered%20by-rembg-7C3AED?style=flat-square" alt="rembg" />
  <img src="https://img.shields.io/badge/privacy-local--only-28D7FF?style=flat-square" alt="Local only" />
  <img src="https://img.shields.io/badge/distribution-build%20yourself-8B9BB0?style=flat-square" alt="Build yourself" />
</p>

---

## What it is

**Cel Pro** removes backgrounds from photos **entirely on your Mac** — no cloud APIs, no credits, no subscription. Drag in a portrait, product shot, or batch of images, then **edit the mask** with erase/restore brushes, undo/redo, and a detail magnifier for fine edge work.

Named after the animation **cel** — a transparent layer with your subject on it. Powered by [rembg](https://github.com/danielgatis/rembg) running locally.

**Also on Android:** [Cel for Android](https://github.com/MRJOHN5ON/cel-android) — sideload APK on [v1.5.3](https://github.com/MRJOHN5ON/cel-android/releases/tag/v1.5.3).

**Requires Python 3.10+** on each Mac (install once from [python.org](https://www.python.org/downloads/macos/)). Cel Pro does **not** bundle Python — that kept downloads smaller and avoids the fragile 3 GB embedded-runtime builds we retired. A one-time setup script installs the Python packages Cel needs.

## What's new in v1.1 — Cel Pro

This release adds a full **mask editor** on top of the existing local background removal pipeline. Cel Pro is now the default app (`./start.sh` and `./scripts/build_mac_app.sh`).

**New in this release:**

- **Edit Mask** — open a dedicated editor after background removal to fix edges by hand
- **Erase & Restore brushes** — adjustable size (4–200) and hardness; restore paints from your **original photo**
- **Detail magnifier** — 4× floating loupe when brush size is 5 or smaller, with live erase preview and crosshair
- **Pan & zoom** — scroll to zoom, drag to pan, Space+drag anywhere
- **Undo / redo** — per-stroke history (⌘Z / ⌘⇧Z)
- **Start Over** — one-click reset of all mask edits before saving
- **Guide overlay** — blue shows AI-removed background, red shows your manual erasures
- **Dark mode** — full editor UI matches system theme

<p align="center">
  <img src="docs/screenshots/pro-editor.png" alt="Cel Pro v1.1 — mask editor with erase brush and detail magnifier" width="720" />
</p>

<p align="center"><em>Cel Pro v1.1 · BRIA RMBG 2.0 · brush size 4 · detail magnifier active</em></p>

## Pro mask editor

After background removal, click **Edit Mask** to open the precision editor:

| Feature | What it does |
|---------|----------------|
| **Erase brush** | Paint away leftover subject or halo |
| **Restore brush** | Paint back from the **original photo** (not just the AI snapshot) |
| **Detail magnifier** | 4× loupe when brush size ≤ 5 — live erase preview with crosshair |
| **Pan & zoom** | Scroll to zoom, drag to pan, or hold Space + drag |
| **Undo / redo** | Full stroke history (⌘Z / ⌘⇧Z) |
| **Start Over** | Discard all edits and restore the original cutout |
| **Guide overlay** | Blue = AI-removed background · red = your erasures |

## Examples

<p align="center">
  <img src="docs/screenshots/example-before-after.png" alt="Before and after — side-by-side in Cel Pro" width="720" />
</p>

<p align="center">
  <em>Portrait · ISNet General · alpha matting on</em>
</p>

<p align="center">
  <img src="docs/screenshots/home-light.png" alt="Cel Pro home screen — light mode" width="720" />
</p>

<p align="center">
  <img src="docs/screenshots/home-dark.png" alt="Cel Pro home screen — dark mode" width="720" />
</p>

### Requirements

- macOS 12+ (Apple Silicon recommended)
- **Python 3.10+** from [python.org](https://www.python.org/downloads/macos/) — required for the native `.app` and dev mode
- Node.js 18+ (dev mode / building the frontend only)

> **Important:** Use the installer from **python.org**, not Xcode Command Line Tools alone. The python.org installer adds `python3` at `/Library/Frameworks/Python.framework/Versions/3.x/bin/python3`.

## Install Cel Pro.app

For you or anyone downloading a release zip or building locally:

### 1. Install Python (one time per Mac)

1. Download **Python 3.10 or newer** from [python.org/downloads/macos](https://www.python.org/downloads/macos/)
2. Run the installer (standard options are fine)
3. Confirm in Terminal: `python3 --version` → should show 3.10+

### 2. Get the app

**From a GitHub release** — download the zip, unzip, and move `Cel Pro.app` to Applications.

**Or build yourself:**

```bash
git clone https://github.com/MRJOHN5ON/cel.git
cd cel
chmod +x scripts/build_mac_app.sh
./scripts/build_mac_app.sh
cp -R "dist/Cel Pro.app" /Applications/
```

### 3. One-time dependency setup

Double-click **`Install Cel Pro.command`** (sits next to `Cel Pro.app` in `dist/` after a build, or in the release zip).

Or from Terminal:

```bash
./scripts/setup_cel_pro_deps.sh
```

This creates `~/Library/Application Support/Cel Pro/venv` and installs rembg, FastAPI, pywebview, etc. (a few hundred MB, needs internet once).

### 4. Open Cel Pro

Launch from Applications. If setup was skipped, the app will prompt you to install Python and run the installer script.

Logs: `~/Library/Logs/Cel Pro/cel-pro.log`

## Quick start (dev mode)

```bash
git clone https://github.com/MRJOHN5ON/cel.git
cd cel
chmod +x start.sh
./start.sh
```

Then open **http://127.0.0.1:5173**.

Dev mode uses a local `venv/` inside the repo (separate from the Application Support venv used by the `.app`).

First run downloads the **isnet-general-use** model (~179 MB). After that, dev mode works fully offline. Other models download on first use, or pre-fetch everything with `python scripts/download_models.py` (~1.5 GB total with BRIA).

### Dev requirements

Same as above — Python 3.10+, Node 18+ for the Vite dev server.

## Models

| Model | Best for | Size | Notes |
|-------|----------|------|-------|
| **ISNet General** *(default)* | People, hair, fine edges | ~170 MB | Best balance of quality and speed |
| **U2Net Human** | Full-body portraits | ~168 MB | Optimized for human subjects |
| **U2Net** | Objects, products, general | ~168 MB | General-purpose segmentation |
| **BRIA RMBG 2.0** | Maximum quality | ~1 GB | Slower, uses more RAM — [non-commercial license](THIRD_PARTY_NOTICES.md) only |

Switch models from the dropdown before processing, or **Try another model** on the results screen to rerun.

## How to use

1. **Drop a photo** — drag & drop, click to browse, or paste from clipboard (JPG, PNG, WEBP, HEIC)
2. **Pick your model** — ISNet General is the default and best for people, hair, and fine edges
3. **Remove Background** — wait for the progress bar (large images can take a minute or two)
4. **Preview** — compare side-by-side or with the slider
5. **Edit Mask** *(optional)* — fine-tune edges with erase/restore brushes
6. **Save Result** — exports a full-resolution transparent PNG via the macOS save panel

**Batch mode:** click **Batch** in the header to process multiple images and download a ZIP.

## Tips & tricks

- **Portraits & hair** — keep **ISNet General** + **Alpha matting** on (defaults). That's the sweet spot for people.
- **Fine edge cleanup** — shrink the brush to **size 4–5** to enable the **Detail** magnifier for precision work.
- **Restore, don't erase** — use **Restore** to paint back stray background removal; it samples the original photo.
- **Large images** — alpha matting auto-turns off above ~2.5 MP to save time. You'll see a warning; you can force it on if you need wispy edge detail and don't mind waiting.
- **Try another model** — **BRIA RMBG 2.0** for max quality (slower, ~1 GB RAM); **U2Net Human** for full-body portraits; **U2Net** for objects/products
- **Paste from clipboard** — copy an image anywhere, then paste (⌘V) into Cel Pro. Handy for screenshots.
- **Dark mode** — toggle in the header; Cel Pro remembers your choice.
- **Low-res warning** — if the source looks tiny or heavily compressed, Cel Pro flags it before you waste time on a bad export.

## Build Cel Pro.app

Build the native app on your Mac (models included, **no bundled Python**):

```bash
chmod +x scripts/build_mac_app.sh
./scripts/build_mac_app.sh
```

Output in `dist/`:

| File | Purpose |
|------|---------|
| `Cel Pro.app` | Native app (~1.5 GB with all models) |
| `Install Cel Pro.command` | One-time Python dependency setup |

After building, run **`Install Cel Pro.command`** once, then open the app.

- Built for the chip type of the machine you build on (`arm64` = Apple Silicon)
- **Unsigned** — right-click → Open the first time; fine for personal use
- Distributing to others still needs Apple Developer signing + notarization ($99/year)

Logs: `~/Library/Logs/Cel Pro/cel-pro.log`

> **Why no bundled Python?** Earlier releases tried to embed python.org’s framework inside the app (~3 GB, fragile on other Macs). Requiring system Python + a one-time setup is more reliable for family and friends.

## Project structure

```
├── backend/          # FastAPI + rembg (shared)
├── frontend-pro/     # Cel Pro UI + mask editor
├── frontend/         # Classic UI (legacy, no mask editor)
├── packaging-pro/    # Cel Pro.app launcher & native bridges
├── packaging/        # Classic Cel.app packaging (legacy)
├── scripts/          # build_mac_app.sh, setup_cel_pro_deps.sh, download_models.py
├── start.sh          # Dev mode — Cel Pro (default)
└── start-classic.sh  # Dev mode — classic UI only
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server status |
| `GET /api/config` | App limits |
| `GET /api/models` | Available rembg models |
| `POST /api/inspect` | Image metadata |
| `POST /api/remove` | Process → PNG bytes |
| `POST /api/remove/job` | Async job with progress |
| `POST /api/batch` | Multi-image → ZIP |

## Options reference

| Option | Default | Notes |
|--------|---------|-------|
| Model | `isnet-general-use` | Also: `u2net`, `u2net_human_seg`, `bria-rmbg` (~1 GB, non-commercial) |
| Alpha matting | On | Auto-skipped above ~2.5 MP unless forced |
| Force alpha matting | Off | Can take many minutes on large images |

## License

Cel Pro is MIT licensed — see [LICENSE](LICENSE).

Third-party libraries and ML models are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

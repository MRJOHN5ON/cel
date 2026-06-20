<p align="center">
  <img src="./media/icon/app_icon.png" alt="Cel app icon" width="120" />
</p>

<h1 align="center">Cel</h1>

<p align="center">
  <strong>Local background removal for macOS</strong><br>
  Drop a photo · get a transparent PNG · nothing leaves your Mac
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20(Apple%20Silicon)-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS Apple Silicon" />
  <img src="https://img.shields.io/badge/built%20with-Python%20%2B%20React-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python + React" />
  <img src="https://img.shields.io/badge/powered%20by-rembg-7C3AED?style=flat-square" alt="rembg" />
  <img src="https://img.shields.io/badge/privacy-local--only-28D7FF?style=flat-square" alt="Local only" />
  <img src="https://img.shields.io/badge/latest-v1.0.1-8B9BB0?style=flat-square" alt="v1.0.1" />
</p>

<p align="center">
  <a href="https://github.com/MRJOHN5ON/cel/releases/tag/v1.0.1"><strong>Download v1.0.1</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/MRJOHN5ON/cel/releases">All releases</a>
</p>

---

## What it is

Cel removes backgrounds from photos **entirely on your Mac** — no cloud APIs, no credits, no subscription. Drag in a portrait, product shot, or batch of images and save full-resolution transparent PNGs.

Named after the animation **cel** — a transparent layer with your subject on it. Powered by [rembg](https://github.com/danielgatis/rembg) running locally.

## Examples

<p align="center">
  <img src="docs/screenshots/example-before-after.png" alt="Before and after — side-by-side in Cel" width="720" />
</p>

<p align="center">
  <em>Portrait · ISNet General · alpha matting on</em>
</p>

<p align="center">
  <img src="docs/screenshots/home-light.png" alt="Cel home screen — light mode" width="720" />
</p>

<p align="center">
  <img src="docs/screenshots/home-dark.png" alt="Cel home screen — dark mode" width="720" />
</p>

## Download

Grab **`Cel-apple-silicon.zip`** (~995 MB) from the release page. No Python, Node, or account needed — Python and all three ML models are bundled.

| | |
|---|---|
| **Works on** | macOS 12+ · **Apple Silicon** (M1 / M2 / M3 / M4) |
| **Internet** | Not required after install |
| **Account** | None |

### Install (first time)

1. Download **`Cel-apple-silicon.zip`** (~690 MB) from the [release page](https://github.com/MRJOHN5ON/cel/releases/latest)
2. **Double-click the zip** to unzip — wait until you see **`Cel.app`** in Downloads (don't run it from inside the zip)
3. **First launch — do not double-click.** Instead:
   - **Right-click** (or Control-click) **`Cel.app`**
   - Choose **Open** from the menu
   - Click **Open** again in the dialog

After that one-time approval, double-click works normally. Drag to **Applications** whenever you like.

> **Got “modified” / “damaged” / “code does not match”?** macOS blocks unsigned apps downloaded from the web. The button in **System Settings → Privacy & Security** often **does not appear** — that's normal. Use **right-click → Open** above, or run this in **Terminal** (change the path if `Cel.app` isn't in Downloads):
>
> ```bash
> xattr -cr ~/Downloads/Cel.app
> ```
>
> Then **right-click `Cel.app` → Open → Open** again.

> **Intel Mac?** Current releases are Apple Silicon only. An Intel build would need to be compiled on an Intel Mac.

## How to use

1. **Drop a photo** — drag & drop, click to browse, or paste from clipboard (JPG, PNG, WEBP, HEIC)
2. **Pick your model** — ISNet General is the default and best for people, hair, and fine edges
3. **Remove Background** — wait for the progress bar (large images can take a minute or two)
4. **Preview** — compare side-by-side or with the slider
5. **Save Result** — exports a full-resolution transparent PNG via the macOS save panel

**Batch mode:** click **Batch** in the header to process multiple images and download a ZIP.

## Tips & tricks

- **Portraits & hair** — keep **ISNet General** + **Alpha matting** on (defaults). That's the sweet spot for people.
- **Large images** — alpha matting auto-turns off above ~2.5 MP to save time. You'll see a warning; you can force it on if you need wispy edge detail and don't mind waiting.
- **Try another model** — from the results screen, switch to **U2Net Human** for full-body portraits or **U2Net** for objects/products, then rerun.
- **Paste from clipboard** — copy an image anywhere, then paste (Cmd+V) into Cel. Handy for screenshots.
- **Dark mode** — toggle in the header; Cel remembers your choice.
- **Low-res warning** — if the source looks tiny or heavily compressed, Cel flags it before you waste time on a bad export.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "App is damaged" / "modified" / won't open | Don't use System Settings — use **right-click → Open**, or run `xattr -cr /path/to/Cel.app` in Terminal first |
| No "Open Anyway" in Privacy & Security | Normal for unsigned apps — that button often never shows; right-click → Open instead |
| App bounces in Dock and quits | Wrong chip type — you need Apple Silicon. Check `~/Library/Logs/Cel/cel.log` |
| Slow first removal | Normal — the model loads into memory (~5–10 s) |
| Processing stuck on a large image | Alpha matting may be running — cancel and retry without force, or wait |
| Save dialog doesn't appear | macOS 12+ required; try a different save location |

Logs: `~/Library/Logs/Cel/cel.log`

---

## For developers

### Run from source

```bash
chmod +x start.sh
./start.sh
```

Then open **http://127.0.0.1:5173**.

First run downloads the **isnet-general-use** model (~179 MB). After that, dev mode works offline.

### Build Cel.app

```bash
chmod +x scripts/build_mac_app.sh
./scripts/build_mac_app.sh
```

Output: `dist/Cel.app` — native window, bundled Python + UI + all 3 models (~1.1 GB).

The build script prints the target architecture (`arm64` or `x86_64`). Upload release zips labeled by chip type.

### Project structure

```
├── backend/          # FastAPI + rembg
├── frontend/         # React + Vite
├── packaging/        # Cel.app launcher & native bridges
├── scripts/          # build_mac_app.sh, download_models.py
└── start.sh
```

### API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server status |
| `GET /api/config` | App limits |
| `GET /api/models` | Available rembg models |
| `POST /api/inspect` | Image metadata |
| `POST /api/remove` | Process → PNG bytes |
| `POST /api/remove/job` | Async job with progress |
| `POST /api/batch` | Multi-image → ZIP |

### Options reference

| Option | Default | Notes |
|--------|---------|-------|
| Model | `isnet-general-use` | Also: `u2net`, `u2net_human_seg` |
| Alpha matting | On | Auto-skipped above ~2.5 MP unless forced |
| Force alpha matting | Off | Can take many minutes on large images |

## License

Cel is MIT licensed — see [LICENSE](LICENSE).

Third-party libraries and ML models are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

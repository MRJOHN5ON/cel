#!/usr/bin/env bash
# Build Cel.app — bundled Python backend, frontend, and all rembg models.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="Cel"
BUILD_DIR="$ROOT/build"
STUB_BIN="$BUILD_DIR/Cel-stub"
DIST_DIR="$ROOT/dist"
APP_BUNDLE="$DIST_DIR/${APP_NAME}.app"
RESOURCES="$APP_BUNDLE/Contents/Resources"
MACOS="$APP_BUNDLE/Contents/MacOS"

echo "══════════════════════════════════════════"
echo "  Building ${APP_NAME}.app"
echo "══════════════════════════════════════════"

# ── 1. Frontend ──────────────────────────────────────────────────────────────
echo ""
echo "→ Building frontend..."
if [ ! -d "frontend/node_modules" ]; then
  (cd frontend && npm install)
fi
(cd frontend && npm run build)

# ── 2. Models ────────────────────────────────────────────────────────────────
echo ""
echo "→ Preparing models (this may take a while on first build)..."
source venv/bin/activate
python scripts/download_models.py

# ── 2b. App icon ─────────────────────────────────────────────────────────────
echo ""
echo "→ Generating app icon..."
python scripts/make_icon.py

# ── 2c. Native launcher (no Terminal window) ───────────────────────────────────
echo ""
echo "→ Compiling native launcher..."
mkdir -p "$BUILD_DIR"
BUILD_ARCH="$(uname -m)"
clang -arch "$BUILD_ARCH" -O2 -o "$STUB_BIN" packaging/stub.c

# ── 3. App bundle skeleton ───────────────────────────────────────────────────
echo ""
echo "→ Assembling app bundle..."
rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS" "$RESOURCES/backend" "$RESOURCES/frontend/dist" "$RESOURCES/models"

cp packaging/Info.plist "$APP_BUNDLE/Contents/Info.plist"
cp packaging/launcher.py "$RESOURCES/launcher.py"
cp packaging/cel_api.py "$RESOURCES/cel_api.py"
cp packaging/macos_about.py "$RESOURCES/macos_about.py"
if [ -f packaging/Cel.icns ]; then
  cp packaging/Cel.icns "$RESOURCES/Cel.icns"
fi
cp backend/main.py backend/remover.py backend/jobs.py "$RESOURCES/backend/"
cp -R frontend/dist/. "$RESOURCES/frontend/dist/"
cp packaging/models_cache/*.onnx "$RESOURCES/models/"

# ── 4. Bundled Python environment ────────────────────────────────────────────
echo ""
echo "→ Creating bundled Python environment..."
python3 -m venv --copies "$RESOURCES/venv"
"$RESOURCES/venv/bin/pip" install -q --upgrade pip
"$RESOURCES/venv/bin/pip" install -q -r backend/requirements.txt
"$RESOURCES/venv/bin/pip" install -q -r packaging/requirements.txt

# ── 5. Launcher executable ───────────────────────────────────────────────────
cp "$STUB_BIN" "$MACOS/Cel"
chmod +x "$MACOS/Cel"

# Refresh Finder icon cache for this bundle
touch "$APP_BUNDLE"
if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$APP_BUNDLE" 2>/dev/null || true
fi

# Ad-hoc sign so Gatekeeper is less hostile (still not notarized)
if command -v codesign >/dev/null 2>&1; then
  echo ""
  echo "→ Ad-hoc signing app bundle..."
  codesign --force --deep --sign - "$APP_BUNDLE" 2>/dev/null || true
fi

# ── 6. Size report ───────────────────────────────────────────────────────────
APP_SIZE="$(du -sh "$APP_BUNDLE" | cut -f1)"
MODEL_COUNT="$(ls -1 "$RESOURCES/models"/*.onnx 2>/dev/null | wc -l | tr -d ' ')"
BUILD_ARCH="$(uname -m)"

echo ""
echo "══════════════════════════════════════════"
echo "  ✓ ${APP_NAME}.app ready"
echo "  Location: $APP_BUNDLE"
echo "  Size:     $APP_SIZE"
echo "  Arch:     $BUILD_ARCH (must match target Mac)"
echo "  Models:   $MODEL_COUNT bundled"
echo ""
echo "  Double-click Cel.app — opens a native window."
echo "  Logs:     ~/Library/Logs/Cel/cel.log"
echo "══════════════════════════════════════════"

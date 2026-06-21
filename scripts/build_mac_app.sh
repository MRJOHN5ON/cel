#!/usr/bin/env bash
# Build Cel Pro.app — bundled Python backend, Pro UI, and all rembg models.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="Cel Pro"
EXEC_NAME="CelPro"
BUILD_DIR="$ROOT/build"
STUB_BIN="$BUILD_DIR/CelPro-stub"
DIST_DIR="$ROOT/dist"
APP_BUNDLE="$DIST_DIR/${APP_NAME}.app"
RESOURCES="$APP_BUNDLE/Contents/Resources"
MACOS="$APP_BUNDLE/Contents/MacOS"

echo "══════════════════════════════════════════"
echo "  Building ${APP_NAME}.app"
echo "══════════════════════════════════════════"

# ── 1. Frontend Pro ─────────────────────────────────────────────────────────
echo ""
echo "→ Building Cel Pro frontend..."
if [ ! -d "frontend-pro/node_modules" ]; then
  (cd frontend-pro && npm install)
fi
(cd frontend-pro && npm run build)

# ── 2. Models ────────────────────────────────────────────────────────────────
echo ""
echo "→ Preparing models (this may take a while on first build)..."
if [ ! -x "venv/bin/python3" ]; then
  python3 -m venv venv
fi
VENV_PY="$ROOT/venv/bin/python3"
"$VENV_PY" scripts/download_models.py

# ── 2b. App icon ─────────────────────────────────────────────────────────────
echo ""
echo "→ Preparing app icon..."
if [ ! -f packaging/Cel.icns ]; then
  "$VENV_PY" scripts/make_icon.py
fi
mkdir -p packaging-pro
cp packaging/Cel.icns packaging-pro/CelPro.icns

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

cp packaging-pro/Info.plist "$APP_BUNDLE/Contents/Info.plist"
cp packaging-pro/launcher.py "$RESOURCES/launcher.py"
cp packaging-pro/cel_api.py "$RESOURCES/cel_api.py"
cp packaging-pro/macos_about.py "$RESOURCES/macos_about.py"
cp packaging-pro/CelPro.icns "$RESOURCES/CelPro.icns"
cp backend/main.py backend/remover.py backend/jobs.py "$RESOURCES/backend/"
cp -R frontend-pro/dist/. "$RESOURCES/frontend/dist/"
cp packaging/models_cache/*.onnx "$RESOURCES/models/"

# ── 4. Bundled Python environment ────────────────────────────────────────────
echo ""
echo "→ Creating bundled Python environment..."
FRAMEWORK_DST="$APP_BUNDLE/Contents/Frameworks/Python.framework"
chmod +x scripts/bundle_python_framework.sh
scripts/bundle_python_framework.sh "$APP_BUNDLE"
BUNDLE_PYTHON="$FRAMEWORK_DST/Versions/3.10/bin/python3.10"
"$BUNDLE_PYTHON" -m venv --copies "$RESOURCES/venv"
"$RESOURCES/venv/bin/pip" install -q --upgrade pip
"$RESOURCES/venv/bin/pip" install -q -r backend/requirements.txt
"$RESOURCES/venv/bin/pip" install -q -r packaging/requirements.txt

echo ""
echo "→ Relocating bundled Python.framework..."
chmod +x scripts/relocate_python_framework.sh
scripts/relocate_python_framework.sh "$APP_BUNDLE"

# ── 5. Launcher executable ───────────────────────────────────────────────────
cp "$STUB_BIN" "$MACOS/$EXEC_NAME"
chmod +x "$MACOS/$EXEC_NAME"

touch "$APP_BUNDLE"
if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$APP_BUNDLE" 2>/dev/null || true
fi

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
echo "  Double-click Cel Pro.app — opens a native window."
echo "  Logs:     ~/Library/Logs/Cel Pro/cel-pro.log"
echo "══════════════════════════════════════════"

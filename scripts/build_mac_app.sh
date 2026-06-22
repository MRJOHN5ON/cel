#!/usr/bin/env bash
# Build Cel Pro.app — Pro UI + models. Uses system Python (no bundled framework).
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
INSTALLER="$DIST_DIR/Install Cel Pro.command"

echo "══════════════════════════════════════════"
echo "  Building ${APP_NAME}.app"
echo "  (system Python — no bundled framework)"
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
echo ""
echo "→ Preparing models (first build downloads ~1.5 GB; cached after that)..."
if [ ! -x "venv/bin/python3" ]; then
  python3 -m venv venv
fi
VENV_PY="$ROOT/venv/bin/python3"
"$VENV_PY" -m pip install -q certifi
"$VENV_PY" scripts/download_models.py

# ── 2b. App icon ─────────────────────────────────────────────────────────────
echo ""
echo "→ Preparing app icon..."
if [ ! -f packaging/Cel.icns ]; then
  "$VENV_PY" scripts/make_icon.py
fi
mkdir -p packaging-pro
cp packaging/Cel.icns packaging-pro/CelPro.icns

# ── 2c. Native launcher (no Terminal window) ─────────────────────────────────
echo ""
echo "→ Compiling native launcher..."
mkdir -p "$BUILD_DIR"
BUILD_ARCH="$(uname -m)"
clang -arch "$BUILD_ARCH" -O2 -o "$STUB_BIN" packaging-pro/stub.c

# ── 3. App bundle skeleton ───────────────────────────────────────────────────
echo ""
echo "→ Assembling app bundle..."
rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS" "$RESOURCES/backend" "$RESOURCES/frontend/dist" "$RESOURCES/models"

cp packaging-pro/Info.plist "$APP_BUNDLE/Contents/Info.plist"
cp packaging-pro/launcher.py "$RESOURCES/launcher.py"
cp packaging-pro/cel_api.py "$RESOURCES/cel_api.py"
cp packaging-pro/macos_about.py "$RESOURCES/macos_about.py"
cp packaging-pro/setup_deps.sh "$RESOURCES/setup_deps.sh"
chmod +x "$RESOURCES/setup_deps.sh"
cp backend/requirements.txt "$RESOURCES/requirements-backend.txt"
cp packaging/requirements.txt "$RESOURCES/requirements-app.txt"
cp packaging-pro/CelPro.icns "$RESOURCES/CelPro.icns"
cp backend/main.py backend/remover.py backend/jobs.py "$RESOURCES/backend/"
cp -R frontend-pro/dist/. "$RESOURCES/frontend/dist/"
cp packaging/models_cache/*.onnx "$RESOURCES/models/"

# ── 4. Launcher executable ─────────────────────────────────────────────────────
cp "$STUB_BIN" "$MACOS/$EXEC_NAME"
chmod +x "$MACOS/$EXEC_NAME"

# ── 5. Double-click installer for recipients ─────────────────────────────────
cat > "$INSTALLER" <<'EOF'
#!/bin/bash
cd "$(dirname "$0")"
RESOURCES="$(cd "Cel Pro.app/Contents/Resources" && pwd)"
echo "Setting up Cel Pro (one time)..."
"$RESOURCES/setup_deps.sh"
EOF
chmod +x "$INSTALLER"

touch "$APP_BUNDLE"
if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$APP_BUNDLE" 2>/dev/null || true
  xattr -cr "$INSTALLER" 2>/dev/null || true
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
echo "  Size:     $APP_SIZE (models only — no bundled Python)"
echo "  Arch:     $BUILD_ARCH"
echo "  Models:   $MODEL_COUNT bundled"
echo ""
echo "  Before first launch on any Mac:"
echo "    1. Install Python 3.10+ from python.org"
echo "    2. Double-click: dist/Install Cel Pro.command"
echo "    3. Right-click Cel Pro.app → Open (unsigned build)"
echo ""
echo "  Build failed? See README → If the build fails"
echo ""
echo "  Logs: ~/Library/Logs/Cel Pro/cel-pro.log"
echo "══════════════════════════════════════════"

#!/usr/bin/env bash
# Build a self-contained Cel Pro.app (bundled Python) and a DMG for GitHub Releases.
#
#   scripts/build_release.sh 1.2.0             build dist/release/Cel-Pro-1.2.0-arm64.dmg
#   scripts/build_release.sh 1.2.0 --publish   ...and upload it as GitHub release v1.2.0 (draft)
#   scripts/build_release.sh --relock          refresh packaging-pro/requirements-build.lock
#
# Needs: uv, Node.js 18+, Xcode Command Line Tools. Users of the DMG need nothing.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Oldest macOS we support. Every compiled wheel must have a build for this version.
export MACOSX_DEPLOYMENT_TARGET=12.0
PY_VERSION=3.12
VENV="$ROOT/.venv-build"
LOCK="packaging-pro/requirements-build.lock"
OUT="$ROOT/dist/release"
UV_PLATFORM=(--python-platform aarch64-apple-darwin)
BINARY_ONLY=()
for pkg in numpy scipy opencv-python-headless onnxruntime pillow numba llvmlite \
  scikit-image pillow-heif pyobjc-core; do
  BINARY_ONLY+=(--only-binary "$pkg")
done

if [ "${1:-}" = "--relock" ]; then
  uv pip compile --python-version "$PY_VERSION" "${UV_PLATFORM[@]}" "${BINARY_ONLY[@]}" \
    --custom-compile-command "scripts/build_release.sh --relock" \
    packaging-pro/requirements-build.txt -o "$LOCK"
  exit 0
fi

VERSION="${1:-}"
PUBLISH="${2:-}"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: scripts/build_release.sh <version, e.g. 1.2.0> [--publish]" >&2
  exit 1
fi
if [ "$(uname -m)" != "arm64" ]; then
  echo "Release builds must run on Apple Silicon (arm64)." >&2
  exit 1
fi
ARCH=arm64
DMG="$OUT/Cel-Pro-${VERSION}-${ARCH}.dmg"
APP="$ROOT/build/pyinstaller/dist/Cel Pro.app"

step() { printf '\n→ %s\n' "$1"; }

step "Python build environment (Python $PY_VERSION, macOS $MACOSX_DEPLOYMENT_TARGET wheels)"
if [ ! -x "$VENV/bin/python" ]; then
  uv venv -q --managed-python --python "$PY_VERSION" "$VENV"
fi
uv pip sync -q --python "$VENV/bin/python" "${UV_PLATFORM[@]}" "${BINARY_ONLY[@]}" "$LOCK"

step "Frontend"
(cd frontend-pro && { [ -d node_modules ] || npm ci; } && npm run build)

step "Bundled models (BRIA downloads on first use, so it is skipped here)"
"$VENV/bin/python" scripts/download_models.py --skip bria-rmbg.onnx
[ -f packaging-pro/CelPro.icns ] || cp packaging/Cel.icns packaging-pro/CelPro.icns

step "PyInstaller"
CEL_VERSION="$VERSION" "$VENV/bin/pyinstaller" --noconfirm --clean --log-level WARN \
  --distpath build/pyinstaller/dist --workpath build/pyinstaller/work \
  packaging-pro/CelPro.spec

step "Verifying the bundle is self-contained"
"$VENV/bin/python" scripts/verify_bundle.py "$APP"
codesign --verify --deep --strict "$APP"

step "DMG"
mkdir -p "$OUT"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create -quiet -volname "Cel Pro" -srcfolder "$STAGE" -fs HFS+ -format ULMO "$DMG"
(cd "$OUT" && shasum -a 256 "$(basename "$DMG")" > "$(basename "$DMG").sha256")

SIZE="$(du -h "$DMG" | cut -f1)"
echo ""
echo "✓ $DMG ($SIZE)"

if [ "$PUBLISH" = "--publish" ]; then
  step "Publishing draft GitHub release v$VERSION"
  gh release create "v$VERSION" "$DMG" "$DMG.sha256" \
    --draft --title "Cel Pro $VERSION" --notes-file packaging-pro/release-notes.md
  echo "Draft created. Review and publish it on GitHub."
fi

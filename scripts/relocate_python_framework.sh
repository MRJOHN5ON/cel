#!/usr/bin/env bash
# Make the copied python.org framework run from inside Cel.app on Macs without system Python.
set -euo pipefail

APP_BUNDLE="${1:?Usage: relocate_python_framework.sh /path/to/Cel.app}"
PY_VER="${2:-3.10}"

FW="$APP_BUNDLE/Contents/Frameworks/Python.framework"
VER="$FW/Versions/${PY_VER}"
OLD="/Library/Frameworks/Python.framework/Versions/${PY_VER}/Python"

if [ ! -f "$VER/Python" ] || [ ! -f "$VER/bin/python${PY_VER}" ]; then
  echo "ERROR: missing bundled Python.framework at $FW"
  exit 1
fi

is_macho() {
  file "$1" 2>/dev/null | grep -q "Mach-O"
}

thin_arm64() {
  local f="$1"
  is_macho "$f" || return 0
  if file "$f" | grep -q "x86_64" && file "$f" | grep -q "arm64"; then
    lipo "$f" -thin arm64 -output "${f}.arm64" && mv "${f}.arm64" "$f"
  fi
}

sign_if_macho() {
  local f="$1"
  is_macho "$f" || return 0
  codesign --force --sign - "$f" 2>/dev/null || true
}

echo "→ Relocating Python.framework (Apple Silicon)..."
thin_arm64 "$VER/Python"
sign_if_macho "$VER/Python"

for bin in "$VER/bin/"*; do
  [ -f "$bin" ] || continue
  case "$bin" in
    *intel64*) continue ;;
  esac
  is_macho "$bin" || continue
  otool -L "$bin" 2>/dev/null | grep -q "$OLD" || continue
  thin_arm64 "$bin"
  codesign --remove-signature "$bin" 2>/dev/null || true
  install_name_tool -change "$OLD" "@loader_path/../Python" "$bin" 2>/dev/null || continue
  sign_if_macho "$bin"
done

if ! otool -L "$VER/bin/python${PY_VER}" | grep -q "@loader_path/../Python"; then
  echo "ERROR: failed to relocate framework python${PY_VER}"
  exit 1
fi

if ! "$VER/bin/python${PY_VER}" -c "import sys; print(sys.version)" >/dev/null 2>&1; then
  echo "ERROR: bundled python${PY_VER} failed a smoke test after relocation"
  exit 1
fi

echo "✓ Python.framework runs from inside the app bundle"

#!/usr/bin/env bash
# One-time setup when developing from source (same venv path as the .app).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/Cel Pro"
VENV="$APP_SUPPORT/venv"

find_python() {
  local candidate version major minor
  for candidate in \
    "${CEL_PYTHON:-}" \
    "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3" \
    "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3" \
    "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3" \
    "/Library/Frameworks/Python.framework/Versions/3.10/bin/python3" \
    "$(command -v python3 2>/dev/null || true)"; do
    [ -n "$candidate" ] || continue
    [ -x "$candidate" ] || continue
    version="$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
    major="${version%%.*}"
    minor="${version#*.}"
    if [ "$major" -ge 3 ] && [ "$minor" -ge 10 ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

PY="$(find_python)" || {
  echo "Python 3.10+ required."
  echo "Install from https://www.python.org/downloads/macos/ then run this script again."
  exit 1
}

echo "Using Python: $PY"
mkdir -p "$APP_SUPPORT"

if [ ! -x "$VENV/bin/python3" ]; then
  echo "Creating virtual environment at $VENV"
  "$PY" -m venv "$VENV"
fi

echo "Installing dependencies..."
"$VENV/bin/python3" -m pip install -q --upgrade pip
"$VENV/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
"$VENV/bin/pip" install -q -r "$ROOT/packaging/requirements.txt"

echo ""
echo "Done. Cel Pro.app (or ./start.sh for dev) can use this environment."

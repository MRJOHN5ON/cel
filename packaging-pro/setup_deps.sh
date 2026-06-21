#!/usr/bin/env bash
# One-time Cel Pro dependency setup — creates a venv in Application Support.
set -euo pipefail

APP_SUPPORT="$HOME/Library/Application Support/Cel Pro"
VENV="$APP_SUPPORT/venv"
RESOURCES="$(cd "$(dirname "$0")" && pwd)"

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

alert() {
  osascript -e "display alert \"Cel Pro Setup\" message \"$1\" as warning" 2>/dev/null || true
}

PY="$(find_python)" || {
  alert "Python 3.10 or newer is required.\n\nDownload the macOS installer from python.org, then run this setup again."
  open "https://www.python.org/downloads/macos/" 2>/dev/null || true
  echo "ERROR: Python 3.10+ not found. Install from https://www.python.org/downloads/macos/"
  exit 1
}

echo "Using Python: $PY"
mkdir -p "$APP_SUPPORT"

if [ ! -x "$VENV/bin/python3" ]; then
  echo "Creating Cel Pro virtual environment..."
  "$PY" -m venv "$VENV"
fi

echo "Installing Python packages (first run may take a few minutes)..."
"$VENV/bin/python3" -m pip install -q --upgrade pip
"$VENV/bin/pip" install -q -r "$RESOURCES/requirements-backend.txt"
"$VENV/bin/pip" install -q -r "$RESOURCES/requirements-app.txt"

echo "Cel Pro dependencies ready."
alert "Cel Pro is ready.\n\nYou can open Cel Pro.app from Applications."

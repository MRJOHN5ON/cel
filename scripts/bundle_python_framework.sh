#!/usr/bin/env bash
# Copy python.org Python.framework into the app so Cel runs without system Python.
set -euo pipefail

APP_BUNDLE="${1:?Usage: bundle_python_framework.sh /path/to/Cel.app}"
PY_VER="${2:-3.10}"

FRAMEWORK_SRC="/Library/Frameworks/Python.framework"
FRAMEWORK_DST="$APP_BUNDLE/Contents/Frameworks/Python.framework"

if [ ! -d "$FRAMEWORK_SRC" ]; then
  echo "ERROR: python.org Python.framework not found at $FRAMEWORK_SRC"
  echo "       Install Python ${PY_VER} from https://www.python.org/downloads/macos/"
  exit 1
fi

echo "→ Copying Python.framework into app bundle..."
mkdir -p "$APP_BUNDLE/Contents/Frameworks"
rm -rf "$FRAMEWORK_DST"
ditto "$FRAMEWORK_SRC" "$FRAMEWORK_DST"
# python.org ships some libs owner-readonly; users need write to clear quarantine with xattr
chmod -R u+w "$FRAMEWORK_DST"
echo "✓ Python.framework bundled (launcher sets DYLD_FRAMEWORK_PATH at runtime)"

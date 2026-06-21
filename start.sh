#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

# Create venv if missing
if [ ! -x "venv/bin/python3" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv venv
fi

VENV_PY="$ROOT/venv/bin/python3"

echo "Installing Python dependencies..."
"$VENV_PY" -m pip install -q -r backend/requirements.txt

if [ ! -d "frontend-pro/node_modules" ]; then
  echo "Installing Cel Pro frontend dependencies..."
  (cd frontend-pro && npm install)
fi

cleanup() {
  echo ""
  echo "Shutting down Cel Pro..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting Cel Pro backend on http://127.0.0.1:${BACKEND_PORT}"
(cd backend && "$VENV_PY" -m uvicorn main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload) &
BACKEND_PID=$!

sleep 1

echo "Starting Cel Pro frontend on http://127.0.0.1:${FRONTEND_PORT}"
(cd frontend-pro && npm run dev -- --port "$FRONTEND_PORT" --host 127.0.0.1) &
FRONTEND_PID=$!

echo ""
echo "  Cel Pro is running"
echo "  → Open http://127.0.0.1:${FRONTEND_PORT} in your browser"
echo ""
echo "  Note: First background removal downloads ~179 MB model (one-time)."
echo "  Press Ctrl+C to stop."
echo ""

wait

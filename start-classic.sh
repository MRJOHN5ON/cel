#!/usr/bin/env bash
# Original Cel UI (no mask editor) — for comparison or legacy dev only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if [ ! -d "venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate

echo "Installing Python dependencies..."
pip install -q -r backend/requirements.txt

if [ ! -d "frontend/node_modules" ]; then
  echo "Installing classic frontend dependencies..."
  (cd frontend && npm install)
fi

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend on http://127.0.0.1:${BACKEND_PORT}"
(cd backend && uvicorn main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload) &
BACKEND_PID=$!

sleep 1

echo "Starting classic frontend on http://127.0.0.1:${FRONTEND_PORT}"
(cd frontend && npm run dev -- --port "$FRONTEND_PORT" --host 127.0.0.1) &
FRONTEND_PID=$!

echo ""
echo "  Cel (classic UI) is running"
echo "  → Open http://127.0.0.1:${FRONTEND_PORT} in your browser"
echo "  For the Pro editor, use ./start.sh instead."
echo ""

wait

#!/usr/bin/env bash
# Alias for start.sh — Cel Pro is the default app.
exec "$(cd "$(dirname "$0")" && pwd)/start.sh" "$@"

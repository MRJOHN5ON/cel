#!/usr/bin/env bash
# Builds Cel Pro.app — same as build_mac_app.sh (kept for backward compatibility).
exec "$(cd "$(dirname "$0")" && pwd)/build_mac_app.sh" "$@"

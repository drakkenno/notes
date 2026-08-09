#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-${PORT:-8000}}"

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
    echo "Usage: $0 [port]" >&2
    echo "Port must be a number between 1 and 65535." >&2
    exit 2
fi

echo "Serving Notes Studio at http://127.0.0.1:${PORT}"

if command -v python3 >/dev/null 2>&1; then
    exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SCRIPT_DIR"
elif command -v python >/dev/null 2>&1; then
    exec python -m http.server "$PORT" --bind 127.0.0.1 --directory "$SCRIPT_DIR"
else
    echo "Error: Python 3 is required to serve the app." >&2
    exit 1
fi

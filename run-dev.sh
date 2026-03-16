#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="$ROOT_DIR/ui"
API_PORT="${API_PORT:-8000}"
UI_PORT="${UI_PORT:-3000}"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found in PATH."
  exit 1
fi

if ! command -v yarn >/dev/null 2>&1; then
  echo "yarn is required but was not found in PATH."
  exit 1
fi

if [[ ! -f "$ROOT_DIR/pyproject.toml" ]]; then
  echo "pyproject.toml not found in $ROOT_DIR"
  exit 1
fi

if [[ ! -f "$UI_DIR/package.json" ]]; then
  echo "ui/package.json not found in $UI_DIR"
  exit 1
fi

api_pid=""
ui_pid=""

wait_for_port_release() {
  local port="$1"
  local attempts=20

  while [[ $attempts -gt 0 ]]; do
    if ! lsof -ti tcp:"$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
    attempts=$((attempts - 1))
  done

  return 1
}

kill_port_processes() {
  local port="$1"
  local pids

  if ! command -v lsof >/dev/null 2>&1; then
    echo "lsof is required to clear port $port."
    exit 1
  fi

  pids="$(lsof -ti tcp:"$port" || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping existing process on port $port"
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      kill "$pid" >/dev/null 2>&1 || true
    done <<< "$pids"

    if ! wait_for_port_release "$port"; then
      echo "Process on port $port did not stop after SIGTERM, forcing shutdown"
      while IFS= read -r pid; do
        [[ -n "$pid" ]] || continue
        kill -9 "$pid" >/dev/null 2>&1 || true
      done <<< "$pids"
      wait_for_port_release "$port" || {
        echo "Port $port is still in use."
        exit 1
      }
    fi
  fi
}

kill_matching_processes() {
  local pattern="$1"
  local pids

  pids="$(pgrep -f "$pattern" || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping matching processes for pattern: $pattern"
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      kill "$pid" >/dev/null 2>&1 || true
    done <<< "$pids"
  fi
}

cleanup() {
  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" >/dev/null 2>&1; then
    kill "$api_pid" >/dev/null 2>&1 || true
  fi

  if [[ -n "$ui_pid" ]] && kill -0 "$ui_pid" >/dev/null 2>&1; then
    kill "$ui_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

kill_matching_processes "uvicorn uisurf_app.main:app"
kill_matching_processes "next dev"
kill_matching_processes "node.*next"
kill_port_processes "$API_PORT"
kill_port_processes "$UI_PORT"

echo "Starting FastAPI on http://localhost:$API_PORT"
(
  cd "$ROOT_DIR"
  uv run uvicorn uisurf_app.main:app --reload --port "$API_PORT"
) &
api_pid=$!

echo "Starting Next.js on http://localhost:$UI_PORT"
(
  cd "$UI_DIR"
  PORT="$UI_PORT" yarn dev
) &
ui_pid=$!

while kill -0 "$api_pid" >/dev/null 2>&1 && kill -0 "$ui_pid" >/dev/null 2>&1; do
  sleep 1
done

if ! kill -0 "$api_pid" >/dev/null 2>&1; then
  wait "$api_pid"
else
  wait "$ui_pid"
fi

#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO_HOST="${MONGO_HOST:-127.0.0.1}"
MONGO_BIND_HOST="${MONGO_BIND_HOST:-0.0.0.0}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_CONTAINER_NAME="${MONGO_CONTAINER_NAME:-pulse-oximeter-mongo}"
MONGO_IMAGE="${MONGO_IMAGE:-mongo:7}"
AUTO_START_MONGO="${AUTO_START_MONGO:-1}"
AUTO_STOP_STALE_DEV="${AUTO_STOP_STALE_DEV:-1}"

is_port_open() {
  local host="$1"
  local port="$2"

  (echo >"/dev/tcp/${host}/${port}") >/dev/null 2>&1
}

find_project_dev_pids() {
  if ! command -v lsof >/dev/null 2>&1; then
    return
  fi

  local pid
  local cmd
  local cwd

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    [[ ! -r "/proc/${pid}/cmdline" ]] && continue

    cmd="$(tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null || true)"
    cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"

    if [[ "$cmd" == *"$PROJECT_ROOT/node_modules/.bin/vite"* ]]; then
      echo "$pid"
      continue
    fi

    if [[ "$cwd" == "$PROJECT_ROOT/backend" && "$cmd" == *"src/server.js"* ]]; then
      echo "$pid"
    fi
  done < <(lsof -t -iTCP -sTCP:LISTEN 2>/dev/null | sort -u)
}

stop_stale_project_processes() {
  if [[ "$AUTO_STOP_STALE_DEV" != "1" ]]; then
    return
  fi

  local stale_pids
  stale_pids="$(find_project_dev_pids | sort -u | tr '\n' ' ' | xargs echo -n || true)"

  if [[ -z "$stale_pids" ]]; then
    return
  fi

  echo "Stopping stale project dev processes: $stale_pids"
  # Best-effort cleanup to prevent EADDRINUSE from old backend/vite sessions.
  kill $stale_pids >/dev/null 2>&1 || true

  for _ in {1..8}; do
    local alive_pids
    alive_pids=""

    for pid in $stale_pids; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        alive_pids+="$pid "
      fi
    done

    if [[ -z "$alive_pids" ]]; then
      break
    fi

    sleep 0.2
  done

  for pid in $stale_pids; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  done
}

read_mongodb_uri() {
  local env_file="$PROJECT_ROOT/backend/.env"
  local line
  local value

  line="$(grep -E '^[[:space:]]*MONGODB_URI=' "$env_file" | tail -n 1 || true)"

  if [[ -z "$line" ]]; then
    echo ""
    return
  fi

  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  echo "$value"
}

is_local_mongodb_uri() {
  local uri="$1"

  [[ "$uri" == *"127.0.0.1:27017"* || "$uri" == *"localhost:27017"* ]]
}

ensure_local_mongodb() {
  local mongo_uri="$1"

  if [[ "$AUTO_START_MONGO" != "1" ]]; then
    return
  fi

  if ! is_local_mongodb_uri "$mongo_uri"; then
    echo "Skipping MongoDB auto-start (MONGODB_URI is not local)."
    return
  fi

  if is_port_open "$MONGO_HOST" "$MONGO_PORT"; then
    echo "MongoDB is already running on ${MONGO_HOST}:${MONGO_PORT}."
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "Error: MongoDB is not reachable on ${MONGO_HOST}:${MONGO_PORT}."
    echo "Install Docker or start MongoDB manually, then run this script again."
    exit 1
  fi

  if docker ps --filter "name=^/${MONGO_CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER_NAME}$"; then
    echo "MongoDB container ${MONGO_CONTAINER_NAME} is already running."
  elif docker ps -a --filter "name=^/${MONGO_CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER_NAME}$"; then
    echo "Starting existing MongoDB container ${MONGO_CONTAINER_NAME}..."
    docker start "$MONGO_CONTAINER_NAME" >/dev/null
  else
    echo "Creating MongoDB container ${MONGO_CONTAINER_NAME} from ${MONGO_IMAGE}..."
    docker run -d \
      --name "$MONGO_CONTAINER_NAME" \
      -p "${MONGO_BIND_HOST}:${MONGO_PORT}:27017" \
      --restart unless-stopped \
      "$MONGO_IMAGE" >/dev/null
  fi

  echo "Waiting for MongoDB to become available on ${MONGO_HOST}:${MONGO_PORT}..."

  for _ in {1..30}; do
    if is_port_open "$MONGO_HOST" "$MONGO_PORT"; then
      echo "MongoDB is ready."
      return
    fi

    sleep 1
  done

  echo "Error: MongoDB did not become ready in time."
  exit 1
}

cd "$PROJECT_ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing workspace dependencies..."
  npm install
fi

missing_env=0

if [[ ! -f backend/.env ]]; then
  echo "Missing backend/.env"
  missing_env=1
fi

if [[ ! -f frontend/.env ]]; then
  echo "Missing frontend/.env"
  missing_env=1
fi

if [[ "$missing_env" -eq 1 ]]; then
  echo ""
  echo "Create env files first:"
  echo "  cp backend/.env.example backend/.env"
  echo "  cp frontend/.env.example frontend/.env"
  exit 1
fi

stop_stale_project_processes

mongodb_uri="$(read_mongodb_uri)"

if [[ -z "$mongodb_uri" ]]; then
  echo "Warning: MONGODB_URI was not found in backend/.env."
  echo "Skipping MongoDB auto-start."
else
  ensure_local_mongodb "$mongodb_uri"
fi

echo "Starting backend and frontend in dev mode..."
echo "Press Ctrl+C to stop both services."

npm run dev
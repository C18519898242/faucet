#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/ubuntu/faucet"
DB_FILE="data/faucet.sqlite"
BACKUP_DIR="data/backups"
HEALTHCHECK_URL="http://localhost:3000"

CURRENT_STEP="initializing"
trap 'echo "ERROR: step failed: ${CURRENT_STEP} (line ${LINENO})" >&2' ERR

log() {
  echo "==> $*"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

run_compose() {
  if docker compose version >/dev/null 2>&1; then
    sudo docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    sudo docker-compose "$@"
  else
    fail "docker compose is not available"
  fi
}

CURRENT_STEP="enter project directory"
log "Entering ${PROJECT_DIR}"
cd "${PROJECT_DIR}"

CURRENT_STEP="check git repository"
log "Checking git repository"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "${PROJECT_DIR} is not a git repository"

CURRENT_STEP="check docker"
log "Checking Docker"
command -v docker >/dev/null 2>&1 || fail "docker command is not available"
docker --version >/dev/null

CURRENT_STEP="check docker compose"
log "Checking Docker Compose"
if docker compose version >/dev/null 2>&1; then
  :
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
  :
else
  fail "docker compose is not available"
fi

CURRENT_STEP="check environment file"
log "Checking .env file"
[[ -f .env ]] || fail ".env file not found; refusing to deploy without required environment variables"

CURRENT_STEP="check clean working tree"
log "Checking for uncommitted changes"
if [[ -n "$(git status --porcelain)" ]]; then
  git status --short >&2
  fail "working tree has uncommitted changes; please review with 'git status' and commit, stash, or discard them before deploying"
fi

CURRENT_STEP="pull latest code"
log "Pulling latest code with git pull --ff-only"
git pull --ff-only

CURRENT_STEP="backup SQLite database"
if [[ -f "${DB_FILE}" ]]; then
  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup_file="${BACKUP_DIR}/faucet.sqlite.${timestamp}.bak"
  log "Backing up SQLite database to ${backup_file}"
  mkdir -p "${BACKUP_DIR}"
  cp "${DB_FILE}" "${backup_file}"
else
  log "SQLite database ${DB_FILE} not found; skipping backup"
fi

CURRENT_STEP="rebuild and start Docker services"
log "Rebuilding and starting Docker services"
run_compose up -d --build

CURRENT_STEP="show Docker Compose status"
log "Docker Compose service status"
run_compose ps

CURRENT_STEP="health check"
log "Checking health at ${HEALTHCHECK_URL}"
health_ok=false
for attempt in {1..30}; do
  if curl -fsS -I "${HEALTHCHECK_URL}"; then
    health_ok=true
    break
  fi
  log "Health check attempt ${attempt}/30 failed; retrying in 2 seconds"
  sleep 2
done
[[ "${health_ok}" == "true" ]] || fail "health check failed for ${HEALTHCHECK_URL}"

CURRENT_STEP="completed"
log "Deployment completed successfully"

#!/usr/bin/env bash
set -euo pipefail

RELEASE_ID="${RELEASE_ID:-}"
if [[ -z "$RELEASE_ID" ]]; then
    echo "RELEASE_ID is required" >&2
    exit 1
fi

TMP_ROOT="${TMP_ROOT:-$HOME/tmp/alecons}"
FRONTEND_RELEASES_ROOT="${FRONTEND_RELEASES_ROOT:-$HOME/releases/acons}"
API_ROOT="${API_ROOT:-/home/api}"
API_RELEASES_ROOT="${API_RELEASES_ROOT:-$API_ROOT/releases}"
API_CURRENT_LINK="${API_CURRENT_LINK:-$API_ROOT/current}"
FRONTEND_LIVE_ROOT="${FRONTEND_LIVE_ROOT:-/home/apps}"
API_ENV_FILE="${API_ENV_FILE:-/etc/alecons/api.env}"
PM2_APP_NAME="${PM2_APP_NAME:-alecons-api}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
PORT="${PORT:-8000}"
API_BUILD_NODE_OPTIONS="${API_BUILD_NODE_OPTIONS:---max-old-space-size=2048}"

REMOTE_PAYLOAD_DIR="$TMP_ROOT/$RELEASE_ID"
FRONTEND_TARBALL="$REMOTE_PAYLOAD_DIR/frontend-dist.tar.gz"
API_TARBALL="$REMOTE_PAYLOAD_DIR/api-release.tar.gz"
FRONTEND_RELEASE_DIR="$FRONTEND_RELEASES_ROOT/$RELEASE_ID"
API_RELEASE_DIR="$API_RELEASES_ROOT/$RELEASE_ID"

require_file() {
    local file_path="$1"
    if [[ ! -f "$file_path" ]]; then
        echo "Required file not found: $file_path" >&2
        exit 1
    fi
}

sync_directory() {
    local source_dir="$1"
    local target_dir="$2"

    if [[ ! -d "$source_dir" ]]; then
        echo "Expected directory not found: $source_dir" >&2
        exit 1
    fi

    mkdir -p "$target_dir"
    if [[ -d "$target_dir" ]]; then
        find "$target_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    fi
    cp -a "$source_dir"/. "$target_dir"/
}

cleanup_releases() {
    local releases_dir="$1"
    local keep_count="$2"

    if [[ ! -d "$releases_dir" ]]; then
        return
    fi

    mapfile -t old_releases < <(ls -1dt "$releases_dir"/* 2>/dev/null | tail -n +$((keep_count + 1)) || true)
    if (( ${#old_releases[@]} > 0 )); then
        rm -rf "${old_releases[@]}"
    fi
}

command -v pm2 >/dev/null 2>&1 || {
    echo "pm2 is required on the droplet" >&2
    exit 1
}
command -v curl >/dev/null 2>&1 || {
    echo "curl is required on the droplet" >&2
    exit 1
}

require_file "$FRONTEND_TARBALL"
require_file "$API_TARBALL"
require_file "$API_ENV_FILE"

mkdir -p "$FRONTEND_RELEASES_ROOT" "$API_RELEASES_ROOT" "$FRONTEND_LIVE_ROOT" "$API_ROOT"
rm -rf "$FRONTEND_RELEASE_DIR" "$API_RELEASE_DIR"
mkdir -p "$FRONTEND_RELEASE_DIR" "$API_RELEASE_DIR"

tar -xzf "$FRONTEND_TARBALL" -C "$FRONTEND_RELEASE_DIR"

authored_dirs=(
    "website-dist:$FRONTEND_LIVE_ROOT/website"
    "application-portal-dist:$FRONTEND_LIVE_ROOT/application-portal"
    "student-portal-dist:$FRONTEND_LIVE_ROOT/student-portal"
    "staff-portal-dist:$FRONTEND_LIVE_ROOT/staff-portal"
    "cbt-dist:$FRONTEND_LIVE_ROOT/cbt"
)

for mapping in "${authored_dirs[@]}"; do
    source_name="${mapping%%:*}"
    target_name="${mapping#*:}"
    sync_directory "$FRONTEND_RELEASE_DIR/$source_name" "$target_name"
done

tar -xzf "$API_TARBALL" -C "$API_RELEASE_DIR"

require_file "$API_RELEASE_DIR/package.json"
require_file "$API_RELEASE_DIR/ecosystem.config.cjs"
if [[ ! -d "$API_RELEASE_DIR/dist" ]]; then
    echo "Built API dist directory not found in release artifact" >&2
    exit 1
fi
if [[ ! -d "$API_RELEASE_DIR/node_modules" ]]; then
    echo "API runtime node_modules not found in release artifact" >&2
    exit 1
fi

ln -sfn "$API_RELEASE_DIR" "$API_CURRENT_LINK"

# Ensure system Chromium is present. This is the preferred browser on the
# droplet because apt manages all required shared libraries automatically.
if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
    echo "System Chromium not found, installing..."
    sudo -n apt-get update -qq
    sudo -n apt-get install -y -q --no-install-recommends chromium-browser 2>/dev/null \
        || sudo -n apt-get install -y -q --no-install-recommends chromium
fi

CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium || true)"
if [[ -z "$CHROMIUM_BIN" ]]; then
    echo "Chromium is not available and could not be installed. Run scripts/deploy/prepare-droplet.sh as root." >&2
    exit 1
fi

if ! "$CHROMIUM_BIN" --version >/dev/null 2>&1; then
    echo "Detected Chromium binary at $CHROMIUM_BIN but it is not runnable." >&2
    exit 1
fi

echo "Using Chromium binary: $CHROMIUM_BIN"

# Optional fallback: keep a Puppeteer-managed Chrome cache copy.
# Disabled by default to avoid storing extra browser binaries on the droplet.
if [[ "${ENABLE_PUPPETEER_BUNDLED_FALLBACK:-false}" == "true" ]]; then
        echo "Setting up optional Puppeteer Chrome browser fallback..."
        PUPPETEER_CACHE_DIR="$HOME/.cache/puppeteer" \
            node "$API_RELEASE_DIR/node_modules/puppeteer/install.mjs" \
            && echo "Puppeteer Chrome fallback ready." \
            || echo "Warning: could not prepare Puppeteer Chrome fallback. System Chromium remains primary."
fi

set -a
source "$API_ENV_FILE"
set +a
export NODE_ENV=production
export PM2_APP_NAME
export ALECONS_API_CWD="$API_CURRENT_LINK"
if [[ -z "${PUPPETEER_EXECUTABLE_PATH:-}" && -n "$CHROMIUM_BIN" ]]; then
    export PUPPETEER_EXECUTABLE_PATH="$CHROMIUM_BIN"
fi

pm2 startOrReload "$API_CURRENT_LINK/ecosystem.config.cjs" --update-env
pm2 save

for attempt in {1..10}; do
    if curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null; then
        cleanup_releases "$FRONTEND_RELEASES_ROOT" "$KEEP_RELEASES"
        cleanup_releases "$API_RELEASES_ROOT" "$KEEP_RELEASES"
        rm -rf "$REMOTE_PAYLOAD_DIR"
        echo "Production deployment completed successfully."
        exit 0
    fi
    sleep 3
done

echo "Health check failed after deployment" >&2
exit 1

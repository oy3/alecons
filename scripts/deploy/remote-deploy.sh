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
BROWSER_CANDIDATES=()

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

add_browser_candidate() {
    local candidate_path="$1"
    if [[ -z "$candidate_path" ]]; then
        return
    fi

    if [[ ! -x "$candidate_path" ]]; then
        return
    fi

    local existing_candidate
    for existing_candidate in "${BROWSER_CANDIDATES[@]:-}"; do
        if [[ "$existing_candidate" == "$candidate_path" ]]; then
            return
        fi
    done

    BROWSER_CANDIDATES+=("$candidate_path")
}

is_snap_browser() {
    local browser_path="$1"
    local resolved_path=""
    local file_head=""

    if [[ -z "$browser_path" || ! -e "$browser_path" ]]; then
        return 1
    fi

    resolved_path="$(readlink -f "$browser_path" 2>/dev/null || printf '%s' "$browser_path")"
    if [[ "$resolved_path" == *"/snap/"* || "$resolved_path" == /var/lib/snapd/* ]]; then
        return 0
    fi

    file_head="$(head -c 4096 "$browser_path" 2>/dev/null || true)"
    if [[ "$file_head" == *"snap.chromium.chromium"* || "$file_head" == *"/snap/bin/chromium"* ]]; then
        return 0
    fi

    return 1
}

is_puppeteer_cache_browser() {
    local browser_path="$1"

    [[ "$browser_path" == *"/.cache/puppeteer/"* ]]
}

smoke_test_browser() {
    local browser_path="$1"

    (
        cd "$API_RELEASE_DIR"
        PUPPETEER_EXECUTABLE_PATH="$browser_path" node <<'NODE'
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  await browser.close();
})();
NODE
    )
}

resolve_browser_path() {
    local candidate_path

    for candidate_path in "${BROWSER_CANDIDATES[@]}"; do
        if is_puppeteer_cache_browser "$candidate_path"; then
            echo "Skipping Puppeteer cache browser candidate: $candidate_path" >&2
            continue
        fi

        if is_snap_browser "$candidate_path"; then
            echo "Skipping snap-wrapped browser candidate: $candidate_path" >&2
            continue
        fi

        if ! "$candidate_path" --version >/dev/null 2>&1; then
            echo "Skipping non-runnable browser candidate: $candidate_path" >&2
            continue
        fi

        if smoke_test_browser "$candidate_path" >/dev/null 2>&1; then
            printf '%s\n' "$candidate_path"
            return 0
        fi

        echo "Skipping browser candidate that failed Puppeteer launch test: $candidate_path" >&2
    done

    return 1
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

set -a
source "$API_ENV_FILE"
set +a
export NODE_ENV=production
export PM2_APP_NAME

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

# Ensure a non-snap browser is present. Google Chrome is preferred because the
# Ubuntu chromium-browser package often resolves to a snap wrapper that fails
# from PM2/system service contexts.
if ! command -v google-chrome-stable >/dev/null 2>&1 && ! command -v google-chrome >/dev/null 2>&1; then
    echo "Google Chrome not found, attempting installation..."
    sudo -n apt-get update -qq
    sudo -n apt-get install -y -q --no-install-recommends google-chrome-stable || true
fi

add_browser_candidate "${PUPPETEER_EXECUTABLE_PATH:-}"
add_browser_candidate "${CHROME_PATH:-}"
add_browser_candidate "/opt/google/chrome/google-chrome"
add_browser_candidate "$(command -v google-chrome-stable || true)"
add_browser_candidate "$(command -v google-chrome || true)"
add_browser_candidate "$(command -v chromium || true)"
add_browser_candidate "$(command -v chromium-browser || true)"

BROWSER_BIN="$(resolve_browser_path || true)"
if [[ -z "$BROWSER_BIN" ]]; then
    echo "No launchable non-snap browser is available for Puppeteer." >&2
    echo "Run scripts/deploy/prepare-droplet.sh as root to install Google Chrome and configure the droplet." >&2
    exit 1
fi

echo "Using browser binary: $BROWSER_BIN"

# Production should not keep or use a Puppeteer-managed browser cache. The
# runtime is locked to the validated system browser above.
if [[ "${ENABLE_PUPPETEER_BUNDLED_FALLBACK:-false}" != "true" ]]; then
    rm -rf "$HOME/.cache/puppeteer"
fi

# Optional fallback remains available only when explicitly enabled.
if [[ "${ENABLE_PUPPETEER_BUNDLED_FALLBACK:-false}" == "true" ]]; then
        echo "Setting up optional Puppeteer Chrome browser fallback..."
        PUPPETEER_CACHE_DIR="$HOME/.cache/puppeteer" \
            node "$API_RELEASE_DIR/node_modules/puppeteer/install.mjs" \
            && echo "Puppeteer Chrome fallback ready." \
            || echo "Warning: could not prepare Puppeteer Chrome fallback. System browser remains primary."
fi

export ALECONS_API_CWD="$API_CURRENT_LINK"
unset CHROME_PATH
export PUPPETEER_EXECUTABLE_PATH="$BROWSER_BIN"

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

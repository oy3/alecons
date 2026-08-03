#!/usr/bin/env bash
set -euo pipefail

OUTPUT_PATH="${1:-$(pwd)/release-artifacts/backend-env/.env.production}"

require_var() {
    local name="$1"
    if [[ -z "${!name:-}" ]]; then
        echo "Missing required environment variable: ${name}" >&2
        exit 1
    fi
}

escape_env_value() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//$'\n'/\\n}"
    printf '%s' "$value"
}

write_env_file() {
    local file_path="$1"
    shift

    mkdir -p "$(dirname "$file_path")"
    : > "$file_path"

    for key in "$@"; do
        local escaped_value
        escaped_value="$(escape_env_value "${!key}")"
        printf '%s="%s"\n' "$key" "$escaped_value" >> "$file_path"
    done
}

require_var DATABASE_URL
require_var JWT_SECRET
require_var PAYSTACK_SECRET_KEY
require_var SPACES_KEY
require_var SPACES_SECRET
require_var SPACES_BUCKET_NAME
require_var SPACES_CDN_URL
require_var GOOGLE_CLIENT_ID
require_var GOOGLE_CLIENT_SECRET
require_var GOOGLE_REFRESH_TOKEN
require_var REDIS_PASSWORD
require_var SMTP_USER
require_var VITE_APP_APPLICATION_PORTAL_URL
require_var VITE_APP_STUDENT_PORTAL_URL
require_var VITE_APP_STAFF_PORTAL_URL
require_var VITE_APP_SITE_URL
require_var VITE_APP_CBT_URL

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-${API_PORT:-8084}}"
export JWT_EXPIRATION="${JWT_EXPIRATION:-24h}"
export WEBSITE_URL="${WEBSITE_URL:-$VITE_APP_SITE_URL}"
export APPLICATION_PORTAL_URL="${APPLICATION_PORTAL_URL:-$VITE_APP_APPLICATION_PORTAL_URL}"
export STUDENT_PORTAL_URL="${STUDENT_PORTAL_URL:-$VITE_APP_STUDENT_PORTAL_URL}"
export STAFF_PORTAL_URL="${STAFF_PORTAL_URL:-$VITE_APP_STAFF_PORTAL_URL}"
export CBT_PORTAL_URL="${CBT_PORTAL_URL:-$VITE_APP_CBT_URL}"
export SPACES_ENDPOINT="${SPACES_ENDPOINT:-https://lon1.digitaloceanspaces.com}"
export SPACES_REGION="${SPACES_REGION:-lon1}"
export REDIS_HOST="${REDIS_HOST:-localhost}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export PUPPETEER_EXECUTABLE_PATH="${PUPPETEER_EXECUTABLE_PATH:-/opt/google/chrome/google-chrome}"

write_env_file "$OUTPUT_PATH" \
    NODE_ENV \
    PORT \
    DATABASE_URL \
    JWT_SECRET \
    JWT_EXPIRATION \
    WEBSITE_URL \
    APPLICATION_PORTAL_URL \
    STUDENT_PORTAL_URL \
    STAFF_PORTAL_URL \
    CBT_PORTAL_URL \
    PAYSTACK_SECRET_KEY \
    SPACES_KEY \
    SPACES_SECRET \
    SPACES_ENDPOINT \
    SPACES_REGION \
    SPACES_BUCKET_NAME \
    SPACES_CDN_URL \
    SMTP_USER \
    GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET \
    GOOGLE_REFRESH_TOKEN \
    REDIS_HOST \
    REDIS_PORT \
    REDIS_PASSWORD \
    PUPPETEER_EXECUTABLE_PATH

echo "Backend production environment file generated successfully at $OUTPUT_PATH"
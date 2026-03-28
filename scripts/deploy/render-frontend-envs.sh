#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"

require_var() {
    local name="$1"
    if [[ -z "${!name:-}" ]]; then
        echo "Missing required environment variable: ${name}" >&2
        exit 1
    fi
}

write_env_file() {
    local file_path="$1"
    shift

    mkdir -p "$(dirname "$file_path")"
    : > "$file_path"

    for key in "$@"; do
        printf '%s="%s"\n' "$key" "${!key}" >> "$file_path"
    done
}

require_var VITE_APP_FULL_NAME
require_var VITE_APP_SITE_URL
require_var VITE_APP_PHONE
require_var VITE_APP_APPLICATION_PORTAL_URL
require_var VITE_APP_STUDENT_PORTAL_URL
require_var VITE_APP_STAFF_PORTAL_URL
require_var VITE_APP_API_URL
require_var VITE_PAYSTACK_PUBLIC_KEY

export VITE_API_URL="${VITE_API_URL:-$VITE_APP_API_URL}"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-$VITE_APP_API_URL}"
export VITE_SOCKET_URL="${VITE_SOCKET_URL:-$VITE_API_BASE_URL}"
export VITE_PAYMENT_PAYSTACK_ENABLED="${VITE_PAYMENT_PAYSTACK_ENABLED:-true}"
export VITE_PAYMENT_MANUAL_TRANSFER_ENABLED="${VITE_PAYMENT_MANUAL_TRANSFER_ENABLED:-true}"
export VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NAME="${VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NAME:-Alecons College of Nursing Sciences}"
export VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NUMBER="${VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NUMBER:-0123456789}"
export VITE_PAYMENT_MANUAL_TRANSFER_BANK_NAME="${VITE_PAYMENT_MANUAL_TRANSFER_BANK_NAME:-Bank Name}"
export VITE_PAYMENT_MANUAL_TRANSFER_NOTE="${VITE_PAYMENT_MANUAL_TRANSFER_NOTE:-Upload a clear receipt after making the transfer. Receipts must be PNG, JPG, or PDF and not more than 1MB.}"
export VITE_APP_ENV="${VITE_APP_ENV:-production}"
export VITE_APP_DEBUG="${VITE_APP_DEBUG:-false}"
export VITE_CBT_APP_NAME="${VITE_CBT_APP_NAME:-ALECONS CBT}"
export VITE_APP_VERSION="${VITE_APP_VERSION:-1.0.0}"
export VITE_LOG_LEVEL="${VITE_LOG_LEVEL:-info}"
export VITE_ENABLE_DEV_TOOLS="${VITE_ENABLE_DEV_TOOLS:-false}"

write_env_file "$ROOT_DIR/apps/website/.env.production" \
    VITE_APP_FULL_NAME \
    VITE_APP_SITE_URL \
    VITE_APP_PHONE \
    VITE_APP_APPLICATION_PORTAL_URL \
    VITE_APP_STUDENT_PORTAL_URL \
    VITE_APP_STAFF_PORTAL_URL

write_env_file "$ROOT_DIR/apps/application-portal/.env.production" \
    VITE_APP_API_URL \
    VITE_APP_STUDENT_PORTAL_URL \
    VITE_PAYSTACK_PUBLIC_KEY \
    VITE_PAYMENT_PAYSTACK_ENABLED \
    VITE_PAYMENT_MANUAL_TRANSFER_ENABLED \
    VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NAME \
    VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NUMBER \
    VITE_PAYMENT_MANUAL_TRANSFER_BANK_NAME \
    VITE_PAYMENT_MANUAL_TRANSFER_NOTE

write_env_file "$ROOT_DIR/apps/student-portal/.env.production" \
    VITE_APP_API_URL \
    VITE_PAYSTACK_PUBLIC_KEY \
    VITE_PAYMENT_PAYSTACK_ENABLED \
    VITE_PAYMENT_MANUAL_TRANSFER_ENABLED \
    VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NAME \
    VITE_PAYMENT_MANUAL_TRANSFER_ACCOUNT_NUMBER \
    VITE_PAYMENT_MANUAL_TRANSFER_BANK_NAME \
    VITE_PAYMENT_MANUAL_TRANSFER_NOTE

write_env_file "$ROOT_DIR/apps/staff-portal/.env.production" \
    VITE_API_URL

write_env_file "$ROOT_DIR/apps/cbt/.env.production" \
    VITE_API_BASE_URL \
    VITE_SOCKET_URL \
    VITE_APP_ENV \
    VITE_APP_DEBUG \
    VITE_CBT_APP_NAME \
    VITE_APP_VERSION \
    VITE_LOG_LEVEL \
    VITE_ENABLE_DEV_TOOLS

echo "Frontend production environment files generated successfully."

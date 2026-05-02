#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_GROUP="${DEPLOY_GROUP:-$DEPLOY_USER}"
DEPLOY_HOME="${DEPLOY_HOME:-/home/$DEPLOY_USER}"
APPS_ROOT="${APPS_ROOT:-/home/apps}"
API_ROOT="${API_ROOT:-/home/api}"
API_ENV_DIR="${API_ENV_DIR:-/etc/alecons}"
PM2_LOG_DIR="${PM2_LOG_DIR:-/var/log/pm2}"

if [[ "$(uname -s)" != "Linux" ]]; then
    echo "This script must be run on the Linux production droplet, not on $(uname -s)." >&2
    echo "SSH into the droplet first, then run it there with sudo." >&2
    exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run this script as root or with sudo." >&2
    exit 1
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    if command -v adduser >/dev/null 2>&1; then
        adduser --disabled-password --gecos "" "$DEPLOY_USER"
    elif command -v useradd >/dev/null 2>&1; then
        useradd -m -s /bin/bash "$DEPLOY_USER"
    else
        echo "Neither adduser nor useradd is available on this system." >&2
        exit 1
    fi
fi

if command -v usermod >/dev/null 2>&1 && getent group sudo >/dev/null 2>&1; then
    usermod -aG sudo "$DEPLOY_USER"
fi

install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$DEPLOY_HOME/tmp/alecons"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$DEPLOY_HOME/releases/acons"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$API_ROOT/releases"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$APPS_ROOT/website"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$APPS_ROOT/application-portal"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$APPS_ROOT/student-portal"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$APPS_ROOT/staff-portal"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$APPS_ROOT/cbt"
install -d -m 755 -o root -g "$DEPLOY_GROUP" "$API_ENV_DIR"
install -d -m 775 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$PM2_LOG_DIR"

chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$APPS_ROOT" "$API_ROOT" "$DEPLOY_HOME/tmp" "$DEPLOY_HOME/releases"
chmod -R 755 "$APPS_ROOT" "$API_ROOT"

# Install system libraries required by the Puppeteer-managed Chromium binary.
# Without these the chrome process exits with code 127 (missing .so files).
if command -v apt-get >/dev/null 2>&1; then
    echo "Installing Chrome/Puppeteer system dependencies..."
    apt-get update -qq
    apt-get install -y -q --no-install-recommends \
        ca-certificates fonts-liberation \
        libatk1.0-0 libatk-bridge2.0-0 \
        libcairo2 libcups2 libdbus-1-3 libdrm2 \
        libexpat1 libfontconfig1 libgbm1 \
        libglib2.0-0 libgtk-3-0 \
        libnspr4 libnss3 \
        libpango-1.0-0 libpangocairo-1.0-0 \
        libx11-6 libx11-xcb1 libxcb1 \
        libxcomposite1 libxcursor1 libxdamage1 \
        libxext6 libxfixes3 libxi6 \
        libxkbcommon0 libxrandr2 libxrender1 \
        libxshmfence1 libxtst6 \
        libasound2 || apt-get install -y -q --no-install-recommends libasound2t64 2>/dev/null || true
    echo "Chrome system dependencies installed."
fi
echo "Next steps:"
echo "  1. Add the GitHub Actions public key to $DEPLOY_HOME/.ssh/authorized_keys"
echo "  2. Create $API_ENV_DIR/api.env with production API secrets"
echo "  3. Ensure pm2, node, npm, nginx, and certbot are installed"
echo "  4. Set GitHub Actions secrets and variables before enabling the workflow"

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

# Install system Chromium. Using the distro package is the most reliable
# approach — apt resolves all transitive .so dependencies automatically,
# avoiding the 'libatk-1.0.so.0: No such file' errors seen with the
# Puppeteer-bundled Chrome binary.
if command -v apt-get >/dev/null 2>&1; then
    echo "Installing system Chromium browser..."
    apt-get update -qq
    # Ubuntu 24+ uses 'chromium'; earlier Ubuntu/Debian uses 'chromium-browser'
    apt-get install -y -q --no-install-recommends chromium-browser 2>/dev/null \
        || apt-get install -y -q --no-install-recommends chromium
    echo "System Chromium installed."
fi

# Allow the deploy user to run apt-get without a password so that
# remote-deploy.sh can ensure Chromium is present on every deployment.
DEPLOY_SUDOERS="/etc/sudoers.d/deploy-apt"
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/apt-get" > "$DEPLOY_SUDOERS"
chmod 440 "$DEPLOY_SUDOERS"
if command -v visudo >/dev/null 2>&1; then
    visudo -cf "$DEPLOY_SUDOERS" >/dev/null
fi
echo "Sudoers entry created: $DEPLOY_SUDOERS"
echo "Next steps:"
echo "  1. Add the GitHub Actions public key to $DEPLOY_HOME/.ssh/authorized_keys"
echo "  2. Create $API_ENV_DIR/api.env with production API secrets"
echo "  3. Ensure pm2, node, npm, nginx, and certbot are installed"
echo "  4. Set GitHub Actions secrets and variables before enabling the workflow"

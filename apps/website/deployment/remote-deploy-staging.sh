#!/usr/bin/env bash
set -euo pipefail

RELEASE_ID="${RELEASE_ID:-}"
STAGING_WEBSITE_ROOT="${STAGING_WEBSITE_ROOT:-}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
PAYLOAD_ROOT="${PAYLOAD_ROOT:-$HOME/tmp/alecons-staging}"

if [[ -z "$RELEASE_ID" || -z "$STAGING_WEBSITE_ROOT" ]]; then
    echo "RELEASE_ID and STAGING_WEBSITE_ROOT are required" >&2
    exit 1
fi

if [[ "$STAGING_WEBSITE_ROOT" != */staging/* ]]; then
    echo "Refusing to deploy outside a /staging/ path: $STAGING_WEBSITE_ROOT" >&2
    exit 1
fi

PAYLOAD_DIR="$PAYLOAD_ROOT/$RELEASE_ID"
TARBALL="$PAYLOAD_DIR/website-dist.tar.gz"
RELEASES_DIR="$STAGING_WEBSITE_ROOT/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
CURRENT_LINK="$STAGING_WEBSITE_ROOT/current"
NEXT_LINK="$STAGING_WEBSITE_ROOT/.current-$RELEASE_ID"

if [[ ! -f "$TARBALL" ]]; then
    echo "Website artifact not found: $TARBALL" >&2
    exit 1
fi

mkdir -p "$RELEASES_DIR"
rm -rf "$RELEASE_DIR" "$NEXT_LINK"
mkdir -p "$RELEASE_DIR"
tar -xzf "$TARBALL" -C "$RELEASE_DIR"

required_files=(
    index.html
    about.html
    404.html
    verify.html
    robots.txt
    sitemap.xml
    prerender-manifest.json
)

for required_file in "${required_files[@]}"; do
    if [[ ! -f "$RELEASE_DIR/$required_file" ]]; then
        echo "Staging release is missing $required_file" >&2
        rm -rf "$RELEASE_DIR"
        exit 1
    fi
done

chmod -R a+rX "$RELEASE_DIR"
ln -s "$RELEASE_DIR" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT_LINK"

mapfile -t old_releases < <(
    find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
        | sort -nr \
        | tail -n +$((KEEP_RELEASES + 1)) \
        | cut -d' ' -f2-
)

if (( ${#old_releases[@]} > 0 )); then
    rm -rf "${old_releases[@]}"
fi

rm -rf "$PAYLOAD_DIR"
echo "Website staging release $RELEASE_ID is active at $CURRENT_LINK"

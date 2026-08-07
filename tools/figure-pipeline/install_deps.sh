#!/usr/bin/env bash
#
# Installs everything the headless figure pipeline needs into the local Blender:
#
#   1. MPFB2 (the MakeHuman-for-Blender extension) from the Blender extensions platform
#   2. makehuman_system_assets  — eyes, teeth, tongue, eyebrows, eyelashes, skins
#   3. faceunits01              — the 52 canonical ARKit face units (CC0)
#   4. visemes01 / visemes02    — 22 Microsoft visemes / 15 Meta (OVR) visemes
#
# MPFB2's Python is GPLv3 and therefore build-time only; it never ships in the runtime.
# Its *output* is CC0 (LICENSE.md §D), which is what we redistribute.
#
# Downloads are cached under .cache/ so re-running is cheap. Pass --force to re-download.

set -euo pipefail

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
PIPELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="$PIPELINE_DIR/.cache"

MPFB_VERSION="2.0.17"
MPFB_SHA256="4f0a879d64a39bf646fbf5f53601ac678855da329d650617dca5737548239a87"
MPFB_URL="https://extensions.blender.org/download/sha256:${MPFB_SHA256}/add-on-mpfb-v${MPFB_VERSION}.zip"

ASSET_HOST="https://files.makehumancommunity.org"
SYSTEM_ASSETS_URL="$ASSET_HOST/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip"
FACEUNITS_URL="$ASSET_HOST/functional/faceunits01.zip"
VISEMES_MS_URL="$ASSET_HOST/functional/visemes01.zip"
VISEMES_OVR_URL="$ASSET_HOST/functional/visemes02.zip"

FORCE_DOWNLOAD="no"
if [ "${1:-}" = "--force" ]; then
  FORCE_DOWNLOAD="yes"
fi

# --------------------------------------------------------------------------------------
# Step 1 — sanity checks

if [ ! -x "$BLENDER" ]; then
  echo "ERROR: Blender not found at $BLENDER. Set BLENDER=/path/to/blender and retry." >&2
  exit 1
fi

echo "Using $("$BLENDER" --version | head -1)"
mkdir -p "$CACHE_DIR"

# --------------------------------------------------------------------------------------
# Step 2 — download everything (cached)

download_if_missing() {
  local url="$1"
  local target="$CACHE_DIR/$2"

  if [ -f "$target" ] && [ "$FORCE_DOWNLOAD" = "no" ]; then
    echo "  cached: $2"
    return
  fi
  echo "  fetching: $2"
  curl --fail --location --silent --show-error --output "$target" "$url"
}

echo "Downloading MPFB2 and asset packs..."
download_if_missing "$MPFB_URL"        "mpfb-${MPFB_VERSION}.zip"
download_if_missing "$FACEUNITS_URL"   "faceunits01.zip"
download_if_missing "$VISEMES_MS_URL"  "visemes01.zip"
download_if_missing "$VISEMES_OVR_URL" "visemes02.zip"
download_if_missing "$SYSTEM_ASSETS_URL" "makehuman_system_assets_cc0.zip"

# The extensions platform publishes the archive hash, so verify it. A silent CDN swap on a
# 45 MB GPL extension is exactly the supply-chain risk worth two lines of shell.
echo "Verifying MPFB2 archive hash..."
ACTUAL_SHA256="$(shasum -a 256 "$CACHE_DIR/mpfb-${MPFB_VERSION}.zip" | cut -d' ' -f1)"
if [ "$ACTUAL_SHA256" != "$MPFB_SHA256" ]; then
  echo "ERROR: MPFB2 archive hash mismatch." >&2
  echo "  expected $MPFB_SHA256" >&2
  echo "  actual   $ACTUAL_SHA256" >&2
  exit 1
fi
echo "  ok"

# --------------------------------------------------------------------------------------
# Step 3 — install MPFB2 as a Blender extension
#
# 'install-file -e' both installs and enables, and writes the enabled state into the user
# preferences so later '--background --python' runs pick the extension up automatically.

echo "Installing MPFB2 extension..."
"$BLENDER" --command extension install-file --repo user_default --enable \
  "$CACHE_DIR/mpfb-${MPFB_VERSION}.zip"

# --------------------------------------------------------------------------------------
# Step 4 — find MPFB's user data directory
#
# MPFB decides this itself (it moved in 2025-01 and is Blender-version scoped), so we ask
# the running extension rather than hardcoding a path that will rot.

echo "Locating MPFB user data directory..."
USER_DATA_DIR="$("$BLENDER" --background --python "$PIPELINE_DIR/print_user_data_dir.py" 2>/dev/null \
  | sed -n 's/^MPFB_USER_DATA_DIR=//p' | head -1)"

if [ -z "$USER_DATA_DIR" ]; then
  echo "ERROR: could not determine MPFB user data directory. MPFB2 probably failed to load." >&2
  echo "Re-run without the stderr filter to see the traceback:" >&2
  echo "  $BLENDER --background --python $PIPELINE_DIR/print_user_data_dir.py" >&2
  exit 1
fi
echo "  $USER_DATA_DIR"

# --------------------------------------------------------------------------------------
# Step 5 — unpack the asset packs into MPFB's user data directory
#
# Each pack zip is already rooted at the layout MPFB expects (packs/, targets/, eyes/, ...),
# so a plain unzip into the data dir is the whole install.

echo "Installing asset packs..."
mkdir -p "$USER_DATA_DIR"
for pack in faceunits01 visemes01 visemes02 makehuman_system_assets_cc0; do
  echo "  $pack"
  unzip -o -q "$CACHE_DIR/${pack}.zip" -d "$USER_DATA_DIR"
done

# --------------------------------------------------------------------------------------
# Step 6 — prove it works before anyone tries to build a figure

echo "Verifying installation..."
"$BLENDER" --background --python "$PIPELINE_DIR/verify_install.py" --python-exit-code 1

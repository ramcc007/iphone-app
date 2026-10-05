#!/usr/bin/env bash
# Boots iOS simulators on the CI Mac, opens the app on chosen screens and saves screenshots.
# Usage: tools/ci/screenshots.sh <path to Numfall.app> <output folder>
set -uo pipefail
APP="$1"; OUT="$2"; BUNDLE="${BUNDLE_ID:-com.example.numfall}"
mkdir -p "$OUT"

udid() { xcrun simctl list devices available | grep -E "$1" | tail -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/'; }

PHONE=$(udid 'iPhone [0-9]+ Pro Max')
[ -z "$PHONE" ] && PHONE=$(udid 'iPhone .*Pro Max')
SMALL=$(udid 'iPhone SE')
PAD=$(udid 'iPad Pro 13-inch')
[ -z "$PAD" ] && PAD=$(udid 'iPad Pro 12.9-inch')
echo "phone=$PHONE small=$SMALL pad=$PAD"
xcrun simctl list devices available | grep -E "iPhone|iPad" | head -40

shoot_device() {   # <label> <udid> <scene list...>
  local label="$1" id="$2"; shift 2
  [ -z "$id" ] && { echo "no simulator for $label, skipping"; return; }
  xcrun simctl boot "$id" 2>/dev/null; xcrun simctl bootstatus "$id" -b >/dev/null 2>&1
  xcrun simctl status_bar "$id" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3 2>/dev/null
  xcrun simctl install "$id" "$APP" || { echo "install failed on $label"; return; }
  for entry in "$@"; do
    local scene="${entry%%+*}" extra=""
    [ "$entry" != "$scene" ] && extra="-NumfallPick ${entry##*+}"
    xcrun simctl terminate "$id" "$BUNDLE" >/dev/null 2>&1
    # shellcheck disable=SC2086
    xcrun simctl launch "$id" "$BUNDLE" -NumfallScene "$scene" $extra >/dev/null || echo "launch failed: $scene"
    sleep 5
    xcrun simctl io "$id" screenshot "$OUT/${label}_${entry//+/_pick}.png" || echo "screenshot failed: $scene"
  done
  xcrun simctl shutdown "$id" 2>/dev/null
}

SCENES=(welcome tutorial home-quick home-classic home-master level-quick level-classic level-classic+3 level-master)
shoot_device iphone-pro-max "$PHONE" "${SCENES[@]}"
shoot_device iphone-se "$SMALL" level-master level-classic home-classic
shoot_device ipad-pro-13 "$PAD" "${SCENES[@]}"
ls -la "$OUT"

#!/usr/bin/env bash
# Boots iOS simulators on the CI Mac, opens the app on chosen screens and saves screenshots.
# Usage: tools/ci/screenshots.sh <path to Numfall.app> <output folder> <phone|small|pad>
# One device per call, so each can have its own time limit in the workflow.
set -uo pipefail
APP="$1"; OUT="$2"; WHICH="${3:-phone}"; BUNDLE="${BUNDLE_ID:-store.numfall.app}"
mkdir -p "$OUT"
log() { echo "[$(date +%H:%M:%S)] $*"; }
# Any single simulator command that hangs is killed after N seconds, so one stuck device cannot block the whole job.
limit() { local secs="$1"; shift; perl -e 'alarm shift; exec @ARGV' "$secs" "$@"; }

udid() { xcrun simctl list devices available | grep -E "$1" | tail -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/'; }

PHONE=$(udid 'iPhone [0-9]+ Pro Max')
[ -z "$PHONE" ] && PHONE=$(udid 'iPhone .*Pro Max')
SMALL=$(udid 'iPhone SE')
SMALL_LABEL=iphone-se
if [ -z "$SMALL" ] && [ "$WHICH" = small ]; then
  # Recent Xcode images ship no iPhone SE simulator, but the device types are still known and can be created on the newest iOS runtime.
  # Try the smallest real phones in order: the SE (3rd gen, 4.7 inch) first, then the other small ones the newest iOS still supports.
  echo "--- no ready-made iPhone SE. Small device types known to this Xcode:"
  xcrun simctl list devicetypes | grep -E "iPhone (SE|[0-9]+ mini)" || echo "(none)"
  RUNTIME=$(xcrun simctl list runtimes available | grep -E "^iOS" | tail -1 | sed -E 's/.* - (com\.apple\.CoreSimulator\.SimRuntime\.[^ ]+).*/\1/')
  echo "runtime=${RUNTIME:-none}"
  for NAME in "iPhone SE (3rd generation)" "iPhone SE (2nd generation)" "iPhone 13 mini" "iPhone 12 mini"; do
    [ -z "$RUNTIME" ] && break
    SE_TYPE=$(xcrun simctl list devicetypes | grep -F "$NAME (com.apple" | head -1 | sed -E 's/.*\((com\.apple\.CoreSimulator\.SimDeviceType\.[^)]*)\).*/\1/')
    [ -z "$SE_TYPE" ] && continue
    NEWDEV=$(xcrun simctl create "NumFall small" "$SE_TYPE" "$RUNTIME" 2>&1 | tail -1)   # not OUT: that is the screenshot folder
    case "$NEWDEV" in
      [0-9A-F]*-*-*-*-*) SMALL="$NEWDEV"; echo "created a $NAME simulator: $SMALL"; case "$NAME" in *mini) SMALL_LABEL=iphone-mini ;; esac; break ;;
      *) echo "could not create $NAME: $NEWDEV" ;;
    esac
  done
fi
PAD=$(udid 'iPad Pro 13-inch')
[ -z "$PAD" ] && PAD=$(udid 'iPad Pro 12.9-inch')
echo "phone=$PHONE small=$SMALL pad=$PAD"
xcrun simctl list devices available | grep -E "iPhone|iPad" | head -40

shoot_device() {   # <label> <udid> <scene list...>
  local label="$1" id="$2"; shift 2
  [ -z "$id" ] && { echo "no simulator for $label, skipping"; return; }
  log "boot $label ($id)"
  limit 60 xcrun simctl boot "$id" 2>&1 || log "boot returned $?"
  limit 240 xcrun simctl bootstatus "$id" -b >/dev/null 2>&1 || { log "boot of $label did not finish, skipping"; limit 60 xcrun simctl shutdown "$id" 2>/dev/null; return; }
  limit 30 xcrun simctl status_bar "$id" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3 --operatorName "" 2>/dev/null
  log "install on $label"
  limit 120 xcrun simctl install "$id" "$APP" || { log "install failed on $label"; return; }
  for entry in "$@"; do
    local scene="${entry%%+*}" extra=""
    [ "$entry" != "$scene" ] && extra="-NumfallPick ${entry##*+}"
    log "$label: $entry"
    limit 30 xcrun simctl terminate "$id" "$BUNDLE" >/dev/null 2>&1
    # shellcheck disable=SC2086
    limit 60 xcrun simctl launch "$id" "$BUNDLE" -NumfallScene "$scene" $extra || log "launch failed: $scene"
    sleep 5
    limit 60 xcrun simctl io "$id" screenshot "$OUT/${label}_${entry//+/_pick}.png" || log "screenshot failed: $scene"
  done
  limit 60 xcrun simctl shutdown "$id" 2>/dev/null
}

SCENES=(welcome home-classic daily daily+3 level-classic+3 level-master home-quick tutorial home-master level-quick)
case "$WHICH" in
  phone) shoot_device iphone-pro-max "$PHONE" "${SCENES[@]}" ;;
  small) shoot_device "$SMALL_LABEL" "$SMALL" level-master level-classic home-classic home-master welcome ;;
  pad)   shoot_device ipad-pro-13 "$PAD" "${SCENES[@]}" ;;
esac
ls -la "$OUT"

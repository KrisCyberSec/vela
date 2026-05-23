#!/usr/bin/env bash
# Capture App Store screenshots from the iOS simulator.
#
# Full automation would need a UI test framework (XCUITest, Playwright)
# to drive the React app to specific screens. That's overkill for a one-
# time App Store submission. Instead this script handles the deterministic
# parts - picking the right simulator size, capturing at native resolution,
# and naming the file correctly - while you navigate the app by hand.
#
# Usage:
#   scripts/capture-screenshots.sh boot 67           # boot iPhone 15 Pro Max (6.7")
#   scripts/capture-screenshots.sh boot 65           # boot iPhone 11 Pro Max (6.5")
#   scripts/capture-screenshots.sh shot welcome      # capture current screen → screenshots/<size>/01-welcome.png
#   scripts/capture-screenshots.sh shot insights
#   scripts/capture-screenshots.sh shot ask-vela
#   scripts/capture-screenshots.sh shot today
#   scripts/capture-screenshots.sh shot paywall
#   scripts/capture-screenshots.sh shot history
#   scripts/capture-screenshots.sh verify            # confirm 12 files, each at correct size
#
# Final output: screenshots/67/*.png (1290×2796) + screenshots/65/*.png (1284×2778)

set -euo pipefail

SCREENSHOT_DIR="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/screenshots"
mkdir -p "$SCREENSHOT_DIR/67" "$SCREENSHOT_DIR/65"

# Simulator-name mapping — these names match what Xcode 15+ ships by default.
# If you see "device not found", run `xcrun simctl list devices available`
# and update the constants here.
SIM_67="iPhone 15 Pro Max"
SIM_65="iPhone 11 Pro Max"

CURRENT_SIZE_FILE="$SCREENSHOT_DIR/.current-size"

cmd_boot() {
  local size="$1"
  local sim
  case "$size" in
    67) sim="$SIM_67" ;;
    65) sim="$SIM_65" ;;
    *)  echo "Unknown size: $size (expected 67 or 65)" >&2; exit 1 ;;
  esac

  echo "Shutting down any running simulators…"
  xcrun simctl shutdown all 2>/dev/null || true

  echo "Booting $sim…"
  xcrun simctl boot "$sim"
  open -a Simulator
  echo "$size" > "$CURRENT_SIZE_FILE"

  echo ""
  echo "✓ $sim is booted."
  echo "  Next: in the simulator's Safari, navigate to"
  echo "        http://localhost:3000/?seed=demo"
  echo "        (you'll need 'npm start' running in another terminal first)"
  echo "  Then drive the app to each frame and run: $0 shot <name>"
}

cmd_shot() {
  local name="$1"
  if [[ ! -f "$CURRENT_SIZE_FILE" ]]; then
    echo "No simulator booted by this script. Run: $0 boot {67|65}" >&2
    exit 1
  fi
  local size
  size=$(cat "$CURRENT_SIZE_FILE")
  local index=""
  case "$name" in
    welcome)  index="01" ;;
    insights) index="02" ;;
    ask-vela) index="03" ;;
    today)    index="04" ;;
    paywall)  index="05" ;;
    history)  index="06" ;;
    *) echo "Unknown frame: $name. Valid: welcome insights ask-vela today paywall history" >&2; exit 1 ;;
  esac
  local out="$SCREENSHOT_DIR/$size/${index}-${name}.png"
  xcrun simctl io booted screenshot "$out"
  echo "✓ Saved $out"
  sips -g pixelHeight -g pixelWidth "$out" 2>/dev/null | grep -E "pixel(Height|Width)" || true
}

cmd_verify() {
  echo "Expected: 12 files (6 frames × 2 sizes)."
  echo ""
  for size in 67 65; do
    local expect_w expect_h
    if [[ "$size" == "67" ]]; then expect_w=1290; expect_h=2796
    else expect_w=1284; expect_h=2778
    fi
    echo "── $size\" set (expecting ${expect_w}×${expect_h}) ─────────────"
    for name in welcome insights ask-vela today paywall history; do
      local index
      case "$name" in
        welcome)  index="01" ;; insights) index="02" ;; ask-vela) index="03" ;;
        today)    index="04" ;; paywall)  index="05" ;; history)  index="06" ;;
      esac
      local f="$SCREENSHOT_DIR/$size/${index}-${name}.png"
      if [[ ! -f "$f" ]]; then
        echo "  ✗ MISSING $f"
        continue
      fi
      local w h
      w=$(sips -g pixelWidth "$f" 2>/dev/null | tail -1 | awk '{print $2}')
      h=$(sips -g pixelHeight "$f" 2>/dev/null | tail -1 | awk '{print $2}')
      if [[ "$w" == "$expect_w" && "$h" == "$expect_h" ]]; then
        echo "  ✓ $f (${w}×${h})"
      else
        echo "  ⚠ $f is ${w}×${h}, expected ${expect_w}×${expect_h} (ASC will reject)"
      fi
    done
  done
}

case "${1:-}" in
  boot)   cmd_boot "${2:-}" ;;
  shot)   cmd_shot "${2:-}" ;;
  verify) cmd_verify ;;
  *)
    sed -n '1,30p' "$0"  # print the header comment
    exit 1
    ;;
esac

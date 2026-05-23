# Screenshot capture cheat sheet

12 PNGs total: 6 frames x 2 device sizes. Goal is reliable, not
glamorous. ASC accepts plain captures from the simulator - no overlays,
no marketing chrome.

Narrative source: `docs/operations/launch-walkthrough.md` § Phase 3.2.
Captions: `docs/operations/manual-tasks.md` § App Store screenshots.

**Working together.** This sheet is Mac-local. The fastest route is now
`node scripts/generate-appstore-screenshots.mjs` with the local dev
server running. The simulator helper is still available if you want true
iOS Safari captures. Drop me a note when you've got the
6.9" slot captured and I'll talk you through any reframe ("the
Insights card got cropped, reshoot the simulator with the keyboard
dismissed", etc.). After all 12 are saved, run `verify` and paste the
output to me - I'll spot any dimension mismatch faster than you'd
catch it in Preview's inspector.

## Sizes ASC requires

| Device class | Pixel dimensions | Simulator to use |
|---|---|---|
| 6.9" Display slot | **1290 × 2796** | iPhone 15 Pro Max |
| 6.5" Display | **1284 × 2778** | iPhone 11 Pro Max |

Apple allows 1-10 screenshots per device size. We're targeting 6 each
(the 6 frames below).

## Frames + captions (paste captions into the ASC form)

| # | Frame | What to show on screen | ASC caption to paste |
|---|---|---|---|
| 1 | Welcome | First onboarding screen, hero copy visible | A quiet place for the noisy years. |
| 2 | Insights | Pattern cards visible (caffeine to hot flash, etc.) | Patterns Vela has noticed, the kind worth showing your doctor. |
| 3 | Ask Vela | The Ask Vela sheet open with a question typed | Ask Vela about what your logs are showing. |
| 4 | Today | Tracker screen with "Yesterday's pattern" card visible | See yesterday's pattern before today even starts. |
| 5 | Paywall | The premium paywall, both pricing tiers visible | Make sense of it. Out loud. |
| 6 | History | Calendar view, several logged days highlighted | Every day, a quiet entry. Every month, a record. |

Capture order matters for the ASC tile carousel. The generated filenames
already match the upload order from walkthrough Step 4.6: **Welcome,
Insights, Ask Vela, Today, Paywall, History**.

## Automated web capture

Use this first. It creates exact App Store dimensions using headless
Chrome at iPhone Pro Max CSS sizes and the dev-only `?screenshot=...`
routes:

```bash
npm start
node scripts/generate-appstore-screenshots.mjs
scripts/capture-screenshots.sh verify
```

Output:
- `screenshots/67/01-welcome.png` through `06-history.png`
- `screenshots/65/01-welcome.png` through `06-history.png`

This path is good for a first App Store packet and avoids hand-clicking
through Safari. If Apple review or a visual QA pass needs true native
iOS Safari chrome behavior, use the simulator helper below.

## Why this is half-manual

The simulator helper script at `scripts/capture-screenshots.sh` handles the
deterministic bits: booting the right simulator, capturing at native
resolution, dropping the PNG in the right place with a stable
filename, and verifying dimensions at the end. The fragile bits -
navigating the React app to a specific screen, opening the Ask Vela
sheet, scrolling Insights to the right card - you do by hand. Trying
to drive that with `xcrun simctl` alone needs UI test scaffolding the
app doesn't have, and ChatGPT-style "let me automate this with
AppleScript" rabbit holes have already eaten a half-day on similar
projects before.

## The capture flow

### Setup (once)

1. In a terminal: `npm start` (boots React dev server on `localhost:3000`).
2. In another terminal, `cd /Users/kristopher/Vela`.

### The 6.9" slot

3. Run `scripts/capture-screenshots.sh boot 67`. Script boots
   iPhone 15 Pro Max and opens Simulator.app.
4. In the simulator, open Safari and navigate to
   `http://localhost:3000/?seed=demo`. The app loads with 30 days of
   seeded demo data and Premium unlocked.
5. For each frame in the table above:
   - Drive the app to that screen (tap through onboarding for #1, go
     to Today tab for #2, etc.).
   - In the terminal run `scripts/capture-screenshots.sh shot <name>`.
     The script prints the dimensions, which should always be
     `pixelWidth: 1290` / `pixelHeight: 2796`.

### The 6.5" set

6. Run `scripts/capture-screenshots.sh boot 65`. Boots iPhone 11 Pro Max.
7. Reload `http://localhost:3000/?seed=demo` in the new sim's Safari.
8. Repeat the 6 captures: `scripts/capture-screenshots.sh shot welcome` etc.

### Verify

9. Run `scripts/capture-screenshots.sh verify`. It walks both
   directories and prints pass/fail per file with measured
   dimensions. Anything off-dimension will be rejected by ASC, so fix
   it now.

End state: `screenshots/67/01-welcome.png ... 06-history.png` plus
the same in `screenshots/65/`. 12 files total.

## If the script fails

Common ones:

- **`device not found`** - Xcode 15+ ships these simulators by default
  but iOS-version-specific names drift. Run `xcrun simctl list devices
  available` and update `SIM_67` / `SIM_65` constants at the top of
  the script.
- **Captures come out as 1170 x 2532** - wrong simulator booted. Run
  `xcrun simctl shutdown all` and `scripts/capture-screenshots.sh
  boot 67` again.
- **`localhost:3000` doesn't load** - `npm start` isn't running, or
  the dev server is on a different port. Check the terminal where you
  started it.
- **Demo data doesn't appear** - `?seed=demo` only works in dev mode
  (`process.env.NODE_ENV === "development"`). If you're running a
  production build it's compiled out.

## Pure-manual fallback

If you'd rather skip the helper entirely:

1. Open Simulator > File > Open Simulator > iOS 17 > iPhone 15 Pro Max.
2. In the sim, open Safari > `http://localhost:3000/?seed=demo`.
3. For each of the 6 frames, `Cmd+S` in the simulator. Files land on
   your Desktop with names like `Simulator Screenshot - iPhone 15 Pro
   Max - 2026-05-13 at 14.33.42.png`. Rename them as you go so you
   know which is which.
4. Repeat with iPhone 11 Pro Max.
5. Verify each in Preview > Tools > Show Inspector > confirm 1290 x 2796
   (or 1284 x 2778). Anything else, recapture.

Upload to ASC: see `asc-paste-sheet.md`, Phase 4.6.

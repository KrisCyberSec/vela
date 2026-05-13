# Xcode build cheat sheet

> ## 🚨 BLOCKED — production build currently fails
>
> `npm run build` does not compile cleanly on current `main`. The same
> command runs under `npx cap sync ios`, so the iOS bundle can't be
> archived from this state.
>
> **Two real errors as of commit `0457505`:**
>
> 1. **`src/App.jsx` — scattered imports** at lines ~3045–3074.
>    Leftover from the Phase 2 screen refactor (`ce2b22a`). ESLint
>    `import/first` treats them as errors in production builds even
>    though Jest is happy.
>
> 2. **`src/lib/cannedAI.js` — undefined references.** Line 317 calls
>    `getPersonalization`, line 651 calls `analyzePatterns`. Both
>    moved to `src/lib/personalization.js` and `src/lib/patterns.js`
>    during the refactor; the `import` statements were never added at
>    the top of `cannedAI.js`.
>
> ```
> Failed to compile.
> [eslint]
> src/App.jsx     Line 3045:1: import/first   (+ 9 more)
> src/lib/cannedAI.js
>   Line 317:13:  'getPersonalization' is not defined  no-undef
>   Line 651:22:  'analyzePatterns' is not defined     no-undef
> ```
>
> Both are small mechanical fixes. Re-run `npm run build` after; do
> NOT proceed below until it prints "Compiled successfully." The
> smoke-test suite (`6f14a94`) doesn't exercise either path, which is
> why this slipped — there is no CI yet (`manual-tasks.md` flags this).

Narrative source: `docs/operations/launch-walkthrough.md` § Phase 7.

## Pre-flight code-side checks (other than the build break above)

| Check | Result | Source |
|---|---|---|
| `NSHealthShareUsageDescription` present | ✓ PASS | `ios/App/App/Info.plist` line 56 |
| `NSHealthUpdateUsageDescription` present | ✓ PASS | line 58 |
| `ITSAppUsesNonExemptEncryption = false` | ✓ PASS | line 50-51 |
| `NSUserTrackingUsageDescription` present | ✓ PASS | line 52-53 |
| `capacitor.config.ts` `appId` | ✓ PASS — `com.velahealth.app` | line 4 |
| `package.json` version | ⚠ `0.1.0` — needs bump to `1.0.0` in Xcode (see Step 5) | line 3 |
| `ios/App/App/public/` populated | ✓ PASS (compiled bundle present from prior sync) | `index.html`, `static/js/main.*.js` |

⚠ Version mismatch: `package.json` says `0.1.0`; walkthrough Step 7.5
sets Xcode `MARKETING_VERSION` to `1.0.0`. The App Store uses the
Xcode value, but Sentry tags events `vela@0.1.0` (per
`src/errorReporting.js` line 26) until `package.json` is bumped.
Recommended: bump `package.json` to `1.0.0` before archive so Sentry
matches the App Store version.

## Xcode walkthrough (only after build is green)

1. **Open the workspace.** Xcode → File → Open →
   `/Users/kristopher/Vela/ios/App/App.xcworkspace` (workspace, NOT
   xcodeproj — white icon).
2. **Sync the web bundle if you changed any JS:**
   ```bash
   cd /Users/kristopher/Vela && npm run build && npx cap sync ios
   ```
3. **Signing.** Click blue **App** project icon → App target →
   **Signing & Capabilities** → check **Automatically manage
   signing** → pick your team. (If team's missing: Xcode → Settings →
   Accounts → + → sign in.) ✓ "Apple Development [Name]" with no red.
4. **HealthKit capability.** Same tab → **+ Capability** → search
   "HealthKit" → double-click. Sub-options stay unchecked (we don't
   use Background Delivery or Clinical Records).
5. **Version + Build.** **General** tab → Identity:
   Version `1.0.0`, Build `1` (bump for each re-upload).
6. **1024×1024 icon.** File tree → **App → Assets.xcassets → AppIcon**
   → rightmost "App Store iOS · 1024pt" slot. If empty, drag in
   `landing/icon-1024.png` (or run the `app-icon-1024.md` Cowork
   prompt to regenerate).
7. **Test build first.** Toolbar device → **iPhone 15 Pro Max**
   simulator → **Cmd+R**. ✓ Welcome screen appears (~30-60s first
   run). Common errors: "No such module 'Capacitor'" → `pod install`
   in `ios/App`. Signing error → redo Step 3.
8. **Archive.** Toolbar device → **Any iOS Device (arm64)** →
   **Product → Archive**. 3-10 min. Organizer opens automatically.
9. **Upload.** Organizer → archive → **Distribute App → App Store
   Connect → Upload → Next**, leave defaults (include symbols,
   manage version), distribution cert auto-selected → **Upload**.
   ✓ "Upload Successful" + ASC binary processing email in ~10-30 min.

## If Apple emails about ITMS-XXXX

- **ITMS-90683 "Missing Purpose String"** — an `NS*UsageDescription`
  key is missing in `Info.plist`. The four we use are all present
  (table above); fix any new one Apple flags + bump Build number + re-archive.
- **ITMS-90809 "Deprecated API Usage"** — usually a warning. Read for
  a date; act if it says "WILL be blocked after $DATE".
- **ITMS-91065 "Missing Privacy Manifest"** — generate
  `PrivacyInfo.xcprivacy` via Xcode's asset-catalog flow.

After this sheet: TestFlight verification (walkthrough Phase 8), then
`asc-paste-sheet.md` Phase 9 (Submit for Review).

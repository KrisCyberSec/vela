# Xcode build cheat sheet

> ## Build status: ✓ green (as of this commit)
>
> `npm run build` compiles cleanly. Two refactor leftovers were fixed
> in the same commit as this status update:
>
> 1. **App.jsx scattered imports** (lines ~3045–3074) were hoisted to
>    the top alongside the gamification import block. Fixed the
>    `import/first` ESLint error that was failing the build.
> 2. **cannedAI.js missing imports** — added
>    `import { getPersonalization } from "./personalization"` and
>    `import { analyzePatterns } from "./patterns"`. Both moved during
>    the screen-component refactor; their consumers in cannedAI.js
>    were left with bare references.
>
> Pre-existing `no-unused-vars` warnings remain (~40 in App.jsx —
> imports of things that moved to screen components and weren't
> cleaned up). They print as warnings under default `npm run build`
> but become errors under `CI=true`. Netlify's React-app build isn't
> wired (we deploy the landing folder), and Xcode invokes
> `npm run build` without CI=true, so this doesn't block launch — but
> it's a cleanup worth doing post-launch.

Narrative source: `docs/operations/launch-walkthrough.md` § Phase 7.

🤝 **Working together.** Xcode is local-only — your hands on the
keyboard for signing, archiving, uploading. For the two build
errors above, say "fix the build break" and I'll write the small
mechanical patches in a separate commit (hoist App.jsx imports +
add the two missing imports in cannedAI.js), then re-run
`npm run build` to confirm green. After upload, Apple emails about
ITMS-XXXX errors get easier to triage if you paste me the email body.

## Pre-flight code-side checks (other than the build break above)

| Check | Result | Source |
|---|---|---|
| `NSHealthShareUsageDescription` present | ✓ PASS | `ios/App/App/Info.plist` line 56 |
| `NSHealthUpdateUsageDescription` present | ✓ PASS | line 58 |
| `ITSAppUsesNonExemptEncryption = false` | ✓ PASS | line 50-51 |
| `NSUserTrackingUsageDescription` absent | ✓ PASS — Vela does not request ATT tracking permission | `ios/App/App/Info.plist` |
| `capacitor.config.ts` `appId` | ✓ PASS — `com.velahealth.app` | line 4 |
| `package.json` version | ✓ PASS — `1.0.0` | line 3 |
| `ios/App/App/public/` populated | ✓ PASS (compiled bundle present from prior sync) | `index.html`, `static/js/main.*.js` |

Version alignment: `package.json` and Xcode `MARKETING_VERSION` are both
`1.0.0`, so Sentry release tags match the App Store version.

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

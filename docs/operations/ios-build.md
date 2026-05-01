# iOS Build & App Store Submission

How to go from source code to an app on your iPhone, and eventually to the App Store.

## Prerequisites

### On the machine

- **Xcode** — install from the Mac App Store (large download, ~15 GB)
- **Xcode command-line tools** — `xcode-select --install`
- **CocoaPods** — `sudo gem install cocoapods` (some Capacitor plugins need it, though Capacitor 8 uses Swift Package Manager by default)

### Accounts (needed to submit)

- **Apple Developer Program** — $99/yr enrollment at [developer.apple.com](https://developer.apple.com). Not needed to run on a personal device with a free Apple ID, but required for TestFlight and App Store distribution.
- **App Store Connect** — comes with the Developer Program; where you create the app record and manage submissions.
- **RevenueCat** — [app.revenuecat.com](https://app.revenuecat.com) for subscription management. Free until $10K MTR.

## Build flow (from source to app)

```bash
# 1. Build the React app into /build
npm run build

# 2. Sync web assets into the iOS project
npx cap sync ios

# 3. Open Xcode
npx cap open ios
```

The React app compiles once per change; `cap sync` copies the fresh `/build` directory into `ios/App/App/public/`, then Xcode picks up the bundled web assets on the next run.

### Common: iterative dev loop

When iterating on React code:
```bash
npm run build && npx cap sync ios
```
Then in Xcode: **Product → Run** (⌘R).

Live reload to a simulator is possible via `npx cap run ios -l` but it's flaky — scripted build+sync is more reliable.

## iOS project config

Current state (verified in `ios/App/App/`):

| File | Purpose | Status |
|------|---------|--------|
| `Info.plist` | App metadata, permissions, category | ✅ Configured |
| `PrivacyInfo.xcprivacy` | Apple privacy manifest (required 2024+) | ✅ Added, must be linked in Xcode |
| `Assets.xcassets/AppIcon.appiconset/` | App icon | ✅ Vela branded icon |
| `Assets.xcassets/Splash.imageset/` | Launch screen | Uses default; customize later |

### Info.plist keys set

- `ITSAppUsesNonExemptEncryption = false` — skips the annual encryption compliance question
- `NSUserTrackingUsageDescription` — required even though we don't track
- `LSApplicationCategoryType = public.app-category.healthcare-fitness` — App Store category

### Privacy Manifest

`PrivacyInfo.xcprivacy` declares:
- No tracking
- No collected data types (app is fully on-device)
- Accessed API categories with "required reasons":
  - `UserDefaults` (CA92.1) — localStorage via WebView
  - `FileTimestamp` (C617.1) — general file ops
  - `SystemBootTime` (35F9.1) — performance measurement
  - `DiskSpace` (E174.1) — user-initiated writes

**First Xcode open:** verify the PrivacyInfo.xcprivacy file is included in the app target. In Xcode's left sidebar, right-click the `App` group → Add Files to "App"… → select `PrivacyInfo.xcprivacy` → ensure "App" target is checked.

## Running on your device (no paid account)

You can install the app on your own iPhone for free:

1. Plug your iPhone into your Mac
2. In Xcode, select your device as the run destination (top of window)
3. **Signing & Capabilities** tab → set Team to your personal Apple ID
4. You'll need to create a free provisioning profile (Xcode does this automatically)
5. **Product → Run** (⌘R)
6. On your iPhone: Settings → General → VPN & Device Management → trust your developer certificate

Apps installed this way expire after 7 days and must be re-deployed. Fine for testing.

## Submitting to TestFlight / App Store

1. **Enroll in Apple Developer Program** ($99/yr)
2. **Create app in App Store Connect** — [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Bundle ID: `com.velahealth.app` (matches `capacitor.config.ts`)
   - Name: `Vela`
   - Category: Health & Fitness
   - Primary language: English (US)
3. **In-app purchases** — create 2 subscriptions:
   - `vela_premium_monthly` at $8.99/mo (Apple Tier 9)
   - `vela_premium_annual` at $69.99/yr (Apple Tier 70)
4. **Wire RevenueCat**:
   - Create an app in RevenueCat
   - Paste the App Store Connect shared secret
   - Copy the RevenueCat public API key
   - Replace the no-op `handleSubscribe` / `handleRestore` in `src/App.jsx` (~line 7554) with the RevenueCat SDK calls
5. **Archive in Xcode**:
   - Product → Archive
   - Window → Organizer → Distribute App → App Store Connect → Upload
6. **Submit for review** in App Store Connect
   - Write the listing using [docs/product/app-store-listing.md](../product/app-store-listing.md)
   - Upload screenshots (see the listing doc for dimensions)
   - Attach the privacy policy URL: `https://velahealth.health/privacy.html`
   - First review typically takes 1–3 days

## Pre-submission checklist

Before clicking "Submit for Review", verify:

- [ ] App builds and runs on a physical device
- [ ] All screens render correctly on smallest supported iPhone (iPhone SE 3rd gen)
- [ ] In-app purchases work in sandbox mode
- [ ] Paywall subscription + restore flows work
- [ ] Privacy policy URL is live: `velahealth.health/privacy.html`
- [ ] Terms URL is live: `velahealth.health/terms.html`
- [ ] App icon is the Vela icon (not the default Capacitor icon)
- [ ] Launch screen doesn't show a spinner or blank state
- [ ] No console errors in the WebView (check via Safari → Develop → connected device)
- [ ] Daily reminders work (permission prompt appears, notifications arrive)
- [ ] Doctor PDF generates and shares correctly
- [ ] Community feature gates correctly (still localStorage-only)
- [ ] RevenueCat is in production mode (not sandbox)

## Troubleshooting

**"Could not locate device support files"** — update Xcode or your iOS version
**"Signing failed"** — Signing & Capabilities → sign out, sign back in with Apple ID
**White screen on launch** — `npm run build` was skipped; re-run the build flow
**Missing plugin errors** — `npx cap sync ios` after `npm install`

## Related docs

- [../product/app-store-listing.md](../product/app-store-listing.md) — App Store metadata, keywords, screenshot plan
- [infrastructure.md](infrastructure.md) — overall infrastructure overview
- [deployment.md](deployment.md) — web deployment (landing page)

# App Store Submission - Hand-off Checklist

What's done in code vs. what only you can do in Apple's / 3rd-party dashboards.

> **Read this top-to-bottom before submitting.** The order matters: some steps depend on earlier ones.

---

## Code-side state (this commit)

| Item | Status |
|------|--------|
| iOS project structure (`ios/App/`) | ✅ Ready |
| Bundle ID `com.velahealth.app` | ✅ Set |
| App icon (1024×1024 single-asset) | ✅ Present |
| Splash screen | ✅ Present |
| `Info.plist`: `ITSAppUsesNonExemptEncryption=false` | ✅ Set (no encryption disclosure required) |
| `PrivacyInfo.xcprivacy` | ✅ Aligned to Health, purchases, anonymous ID, product events, and diagnostics |
| Privacy URL → `https://velahealth.health/privacy.html` | ✅ Live + verified |
| Support URL → `https://velahealth.health/support.html` | ✅ Committed; verify live after next landing deploy |
| RevenueCat SDK wired with `web_fallback` / `misconfigured` / `native` modes | ✅ Done |
| Free-premium bug (was: empty API key on iOS = free premium for all) | ✅ Fixed |
| Doctor PDF (your strongest single feature) | ✅ Verified end-to-end on 5 scenarios |
| Capacitor sync: RevenueCat registered as SPM dep in `Package.swift` | ✅ Done |
| Build compiles | ✅ Clean |

---

## P0 - must do before you can upload

These are blockers. Apple won't accept the build, OR the app will be broken in production.

### 1. Apple Developer Program enrollment (verify active)
- Go to <https://developer.apple.com/account>
- Confirm membership is active and unexpired ($99/year). If lapsed, no archives can be uploaded.

### 2. App Store Connect - create the app record
- Go to <https://appstoreconnect.apple.com> → My Apps → "+"
- Bundle ID: `com.velahealth.app` (must match `capacitor.config.ts` exactly - anything else and uploads will reject)
- Primary language: English (U.S.)
- Name: **Vela - Menopause Companion** (subtitle, description, keywords come from `appstore-metadata.md`)
- SKU: anything unique to you, e.g. `vela-ios-001`

### 3. Create the In-App Purchase products
RevenueCat returns no offerings until the matching IAPs exist in App Store Connect. Without offerings, the paywall shows an error to every user.

In App Store Connect → My Apps → Vela → Monetization → In-App Purchases → "+":

| Product ID | Type | Price | Trial |
|------------|------|-------|-------|
| `com.velahealth.app.premium.annual` | Auto-Renewable Subscription | $69.99 / year (Tier 70) | 14-day free trial |
| `com.velahealth.app.premium.monthly` | Auto-Renewable Subscription | $8.99 / month (Tier 9) | 14-day free trial |

Both go in the same Subscription Group (e.g. `vela_premium`). Upgrade/downgrade between them must be allowed.

For each: provide reference name, display name (user-visible), and one localized description per supported locale (start with en-US only).

### 4. RevenueCat - create account and configure
1. <https://app.revenuecat.com/signup> → create project named **Vela**
2. Add app: bundle ID `com.velahealth.app`
3. Apple credentials (required for receipt validation):
   - In App Store Connect → Users and Access → Integrations → App Store Connect API → "+" - generate a key with role "App Manager" or higher. Download the .p8 file (one-time download).
   - Paste the key + key ID + issuer ID into RevenueCat's iOS app settings.
   - Also paste the App-specific Shared Secret (App Store Connect → Vela → Subscriptions → App-Specific Shared Secret).
4. Create entitlement: **`premium`** (must match the constant in `src/subscription.js` exactly)
5. Create offering named `default` with two packages:
   - `$rc_annual` → linked to `com.velahealth.app.premium.annual`
   - `$rc_monthly` → linked to `com.velahealth.app.premium.monthly`
6. Project Settings → API Keys → copy the **Apple** key (starts with `appl_`)
7. Paste into `/Users/kristopher/Vela/.env.local`:
   ```
   REACT_APP_REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxxxxxxxxxx
   ```
8. Rebuild + sync: `CI=true npm run build && npx cap sync ios`

### 5. App Store screenshots
Apple requires screenshots for at least one device size. The generated
packet is committed under `screenshots/67/` and `screenshots/65/`.

**Easiest path:** use the **6.7" iPhone** category (iPhone 16 Pro Max, 1290 x 2796). Apple lets you submit ONLY 6.7" screenshots and they'll auto-scale to smaller devices. You don't need iPad or 6.5" if you don't want to.

You need at least **3** screenshots (Apple's minimum), realistically **5-6** for a respectable listing.

Generated v1 set, in upload order:
1. **Welcome** - brand tone and privacy-first positioning.
2. **Insights** - the pattern value prop.
3. **Ask Vela** - premium hook with a readable answer.
4. **Today** - daily use and tomorrow-readiness.
5. **Paywall** - price transparency and premium feature list.
6. **History** - long-term value and logged-day record.

How to capture:
- Run `npm start`
- Run `node scripts/generate-appstore-screenshots.mjs`
- Run `scripts/capture-screenshots.sh verify`
- Drag the PNGs into App Store Connect → My Apps → Vela → 1.0 Prepare for Submission → 6.7" Display

**Common rejection trigger:** screenshots that show actual personal data, anything resembling real medical advice, or text claims that exaggerate ("AI doctor", "diagnose menopause"). Stay descriptive, not promissory.

---

## P1 - strongly recommended before going public (not a blocker)

### 6. Sentry crash reporting
- Sentry account, local DSN, Netlify DSN, and synthetic smoke are done.
- Still verify from a real TestFlight build after Apple is available.
- **Why:** App Store reviews will say "it crashed." Sentry gives us a traceback to fix the issue.

### 7. PostHog product analytics
- PostHog account, local key, Netlify key, landing key, and production
  `onboarding_completed` verification are done.
- Still verify real TestFlight funnel events after Apple is available.
- **Why:** the financial-model decisions in `docs/business/financial-model.md`
  depend on trial starts, conversion, logging retention, and premium usage.

### 8. Final rebuild after all keys are pasted
```bash
cd /Users/kristopher/Vela
CI=true npm run build
npx cap sync ios
```

---

## P2 - fixes shipped + remaining known gaps

The first-run audit findings are mostly resolved. What's left is documented below.

| Item | Status |
|------|--------|
| Onboarding Back button | ✅ Fixed - small "← Back" in q-card, hidden on Q1 |
| Onboarding mid-flow persistence | ✅ Fixed - `vela_onboarding_progress` in localStorage; cleared on completion |
| localStorage exception handling | ✅ Mitigated - top-level `ErrorBoundary` (`src/ErrorBoundary.jsx`) catches any render-time throw including useState lazy initializers; `src/safeStorage.js` provides safe `readJSON/writeJSON/remove` and is used for the App-init reads |
| Apple Watch support flag in Info.plist | ✅ Verified clean - no `WKApp*` keys present |
| Demo data seed for screenshots | ✅ Added - Settings → tap version 5× → Debug screen → "Seed 30-day demo" populates realistic perimenopause data with caffeine ↔ hot flash correlations and lands you on Insights |

---

## The actual upload flow (after everything above)

1. Open Xcode: `open ios/App/App.xcworkspace`
2. Select **Any iOS Device (arm64)** as the build target (not a simulator)
3. Product → Archive (5-10 min)
4. Once archived, Xcode opens Organizer → click **Distribute App** → **App Store Connect** → **Upload**
5. Sign with your distribution certificate (Xcode handles this if your Apple ID is signed in)
6. Wait 5-30 min for Apple processing (you'll get an email when ready)
7. Back in App Store Connect → My Apps → Vela → 1.0 Prepare for Submission → fill in:
   - Description, keywords, etc. (copy from `appstore-metadata.md`)
   - Screenshots (from step 5 above)
   - Build (select the uploaded one)
   - Age rating questionnaire (answer honestly; accept the rating ASC calculates)
   - Pricing tier
   - Availability (countries - start with US-only if uncertain)
   - **Export compliance:** "Does your app use encryption?" - answer **No** (your `Info.plist` already declares `ITSAppUsesNonExemptEncryption=false`)
   - **App Privacy:** disclose Health, Purchase History, anonymous User ID, Product Interaction, Crash Data, and Other Diagnostic Data. Do not submit a universal "Data Not Collected" label.
8. **Submit for Review.**
9. **Apple review takes 24-48 hours.** Common rejection reasons specific to Vela:
   - Subscription terms not properly disclosed in the app and the listing → `landing/terms.html` and `landing/privacy.html` are linked from the paywall and the App Store, this should be fine
   - Privacy nutrition label inconsistent with actual SDK/network behavior → use the disclosure list above and keep it aligned with `PrivacyInfo.xcprivacy`
   - "Mentions of competitors or other platforms" - re-read `appstore-metadata.md` to confirm no Caria/Balance/Flo references in user-facing copy

---

## After submission

The financial model decision triggers in `docs/business/financial-model.md` activate the moment you have your first paying user. **Do not** make pricing or feature changes for the first 30 days - let the data settle. Watch:

- App Store Connect: downloads, conversion rate
- RevenueCat: trial starts, trial-to-paid conversion, MRR
- PostHog: log_completed funnel, paywall_shown / paywall_converted ratio
- Sentry: any crash spikes

Reviews are the next critical thing: respond to every review within 24 hours, especially the bad ones. Apple weights review velocity in ASO.

Per the `feedback_iteration.md` standing memory: **don't let App Store reviews push you into a feature-hamster-wheel.** Read everything; ship only the changes that touch your top-funnel metrics.

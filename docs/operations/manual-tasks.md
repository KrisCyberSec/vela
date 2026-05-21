# Manual tasks — things only you can do

Things that require human hands at a console (App Store Connect, Apple
Developer portal, Netlify dashboard, Xcode UI clicks, third-party
account creation). Code-side work is done; these are the gates.

Sorted by what blocks what. Cross items off as they ship.

---

## Blocking App Store submission

### [ ] Apple Developer Program enrollment
- [developer.apple.com/programs](https://developer.apple.com/programs/) · $99/yr
- Use the same Apple ID that owns the `com.velahealth.app` bundle
- Required before anything below can be created in App Store Connect

### [ ] Create the App in App Store Connect
- Bundle ID: `com.velahealth.app`
- Name: `Vela`
- Category: Health & Fitness
- Primary language: English (US)
- Privacy policy URL: `https://velahealth.health/privacy.html`

### [ ] Create the two IAP products in App Store Connect
| Product ID | Type | Price | Trial |
|---|---|---|---|
| `com.velahealth.app.premium.annual` | Auto-Renewable Subscription | $69.99/yr (Tier 70) | 14-day free |
| `com.velahealth.app.premium.monthly` | Auto-Renewable Subscription | $8.99/mo (Tier 9) | 14-day free |
- Both go in the same Subscription Group: `vela_premium`
- Allow upgrade/downgrade between them
- Generate the App-specific shared secret + the App Store Server API key
  (both go into RevenueCat below)

### [ ] Enable HealthKit capability in Xcode
- Xcode → App target → **Signing & Capabilities** → **+ Capability** → HealthKit
- This adds the entitlement to the provisioning profile (the entitlements
  file `ios/App/App/App.entitlements` is already wired in pbxproj — this
  step links it to your Apple Developer account)
- The native HealthKit plugin, usage strings, and privacy manifest target
  resource are already wired in the repo.
- App Store Connect will require justification text on first build with
  HealthKit — paste from `NSHealthShareUsageDescription` in Info.plist

### [ ] Code signing in Xcode
- Xcode → App target → **Signing & Capabilities** → check **Automatically
  manage signing** with your Apple Developer team selected
- Verify the bundle ID matches `com.velahealth.app`
- A **Distribution** certificate and **App Store** provisioning profile
  will be generated when you do the first archive build

### [x] 1024×1024 app icon (no alpha channel)
- Verified present at `landing/icon-1024.png`: 1024×1024 RGB PNG, no alpha.
- Verified present in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
- Still upload the same 1024×1024 icon separately to App Store Connect
  → Media Manager if Apple asks for it outside the binary.

### [ ] App Store screenshots
- Required sizes (Apple needs at least one set; using 6.7" covers most
  devices when "default" is selected):
  - 6.7" display: **1290 × 2796** (iPhone 14/15/16 Pro Max)
  - 6.5" display: **1284 × 2778** (iPhone 11 Pro Max, XS Max)
- 3 minimum, 10 maximum per size.
- Frames + captions to use as a spec (from the screenshots agent's
  earlier draft pass):
  1. **Welcome** — "A quiet place for the noisy years."
  2. **Today** — "See yesterday's pattern before today even starts."
  3. **Insights** — "Patterns Vela has noticed — the kind worth showing your doctor."
  4. **Ask Vela** — "Real AI grounded in your data — not generic web advice."
  5. **Paywall** — "Make sense of it. Out loud."
  6. **History** — "Every day, a quiet entry. Every month, a record."
- Best path: iPhone 15 Pro Max simulator → seed with `?seed=demo` →
  use `Cmd+S` to capture at native resolution. The captions go in the
  App Store Connect form, not on the screenshots themselves (don't
  overlay text on the images for v1).

### [ ] Privacy nutrition label in App Store Connect
- **Highest-probability source of rejection.** The symptom log is mostly
  local-only, but Vela still has off-device flows: Ask Vela/Daily Brief
  summaries, RevenueCat purchases, PostHog product events, and Sentry
  diagnostics. The label must reflect all of them.
- Correct declaration:
  - **Health & Fitness → Health**: App Functionality + Product
    Personalization, Not Linked, Not Tracking.
  - **Purchases → Purchase History**: App Functionality + Analytics, Not
    Linked if you keep anonymous RevenueCat app user IDs, Not Tracking.
  - **Identifiers → User ID**: App Functionality, Not Linked, Not
    Tracking. This is the anonymous RevenueCat/Sentry app user ID, not an
    email or account login.
  - **Usage Data → Product Interaction**: Analytics, Not Linked, Not
    Tracking. Users can opt out in Settings, but Apple still asks for
    everything the app may collect.
  - **Diagnostics → Crash Data** and **Other Diagnostic Data**: App
    Functionality, Not Linked, Not Tracking.
- Do NOT check "Data Not Collected" universally. A reviewer who sees
  `/api/ask-vela`, RevenueCat, Sentry, or PostHog traffic can reject for
  inaccurate disclosure.
- The privacy policy at `landing/privacy.html` and the native
  `PrivacyInfo.xcprivacy` manifest have been aligned to this disclosure.

### [ ] App Review Information (reviewer notes + contact)
- ASC → App Information → App Review Information.
- Reviewer notes (paste verbatim, adjust as needed):
  > Vela has no login or account. Tap "Begin" to start the 90-second
  > onboarding. To exercise premium features without a real
  > subscription, the reviewer can use the App Store sandbox tester
  > flow against the in-app paywall. The "Ask Vela" feature sends an
  > anonymized summary of symptom data (no notes, no custom names, no
  > exact dates) to Anthropic's Claude API via our Netlify proxy.
  > Disclosure in Settings → Privacy & Data and in our privacy policy.
- Contact email: `support@velahealth.health`
- Sign-in required: No.

### [ ] TestFlight build that boots, logs, and completes a sandbox purchase
- Xcode → Product → Archive → Distribute App → App Store Connect →
  Upload.
- Wait ~10-30 min for processing in ASC → TestFlight.
- Install on a physical iPhone via TestFlight app.
- Sandbox tester (App Store Connect → Users and Access → Sandbox).
- Verification flow:
  1. Onboarding completes cleanly.
  2. A log saves and reappears on History.
  3. Tap paywall → buy annual subscription with sandbox tester →
     Premium features unlock.
  4. Ask Vela returns a real response (requires ANTHROPIC_API_KEY).
  5. Doctor report PDF generates and is shareable from iOS share sheet.

---

## Blocking real Ask Vela + Daily Brief in production

### [x] ~~Set `ANTHROPIC_API_KEY` in Netlify~~ (done 2026-05-21)
- Site Settings → Environment variables → Add a variable
- Get the key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
- Powers BOTH `/api/ask-vela` AND `/api/daily-brief`. Until set, both
  return 503 with explainers and the client falls back to canned text.
- Verified after production deploy `6a0e5921b228037c89395de0`: empty
  `/api/ask-vela` returns `Question required` instead of missing-env.

### [x] ~~Set `REVENUECAT_REST_KEY` in Netlify~~ (done 2026-05-21)
- Get the **secret** REST API key (starts with `sk_`) from
  [app.revenuecat.com](https://app.revenuecat.com) → Project Settings → API Keys
- Both AI functions verify against this before spending tokens
- Without it, both return 403 to all premium-gated callers
- Secret V1 key created in RevenueCat as `netlify-premium-verification`
  and pasted into Netlify as a secret env var.

### [ ] (Optional) Tune `ASK_VELA_DAILY_USD` in Netlify
- Default is $50/day SHARED budget across both ask-vela + daily-brief
- At 1000 paying users with 1 brief each per day + ~10 questions/mo
  per user, expected daily spend is ~$1.90 — plenty of headroom
- Set lower if you want to be more conservative early on
- Set higher once you have real usage data and aren't worried

---

## Blocking RevenueCat purchases

### [ ] Wire RevenueCat after IAP products exist in App Store Connect
- Create app in [app.revenuecat.com](https://app.revenuecat.com)
- Paste the App Store Connect shared secret + Server API key
- Create the entitlement: name it exactly `premium` (constant in `src/subscription.js`)
- Create the offering: name it `default`. Add two packages:
  - `$rc_annual` → `com.velahealth.app.premium.annual`
  - `$rc_monthly` → `com.velahealth.app.premium.monthly`
- Get the public iOS API key (starts with `appl_`)
- Set in `.env.local` (dev) and Netlify env (production):
  ```
  REACT_APP_REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxxxxxxxxxx
  ```
- Test with an App Store Connect Sandbox tester account before submitting

---

## Blocking analytics wire-up

### [x] ~~Create PostHog account + paste public key~~ (done 2026-05-08)
- US Cloud project. Key (`phc_...`) set in `.env.local` AND Netlify env vars.
- `REACT_APP_POSTHOG_HOST` not set — code defaults to `https://us.i.posthog.com` which matches the project, so no override needed.
- Verified 2026-05-21: production app bundle fired
  `onboarding_completed`, and it appeared in PostHog Activity.

### [x] ~~Create Sentry account + paste DSN~~ (done 2026-05-21)
- [sentry.io](https://sentry.io) → free Developer plan covers 5k errors/mo
  (plenty for v1 — Vela is client-side-error-light by design).
- Create a project, platform: **React**. Name suggestion: `vela-ios`.
- Copy the DSN (looks like `https://abc@xxxx.ingest.sentry.io/12345`).
- Two places to paste it:
  - `.env.local` (already in `.gitignore`, picks it up via CRA at build time)
  - Netlify env vars (so production CRA builds inherit it)
- Verification flow once the DSN is set:
  1. Restart `netlify dev`.
  2. Open the app, navigate to Settings → tap **Reset all data**.
     Reset clears Sentry user context too — confirms `clearUser()` runs.
  3. Force a test error: open DevTools console, run
     `setTimeout(() => { throw new Error('sentry-smoke-test'); }, 0)`.
  4. Within ~10s, the error should appear in Sentry under
     **Issues** with the release tag `vela@1.0.0`.
- Verified 2026-05-21: DSN is in `.env.local` and Netlify env, local
  production bundle embeds it, and a synthetic smoke event appeared in
  Sentry Issues tagged `vela@1.0.0`.
- Code-side wiring (all done):
  - `src/errorReporting.js` — init, `reportError()`, `identifyUser()`,
    `clearUser()`. Adds `window.onerror` + `unhandledrejection` handlers
    on init. Tags every event with the `vela@<version>` release.
  - `src/ErrorBoundary.jsx` — catches React render errors.
  - `src/subscription.js` — 6 tagged `reportError()` calls covering
    every RevenueCat failure mode.
  - `src/screens/Today.jsx` — tagged report on daily-brief fetch failure.
  - `src/screens/Insights.jsx` — tagged report on ask-vela fetch failure.
  - `src/App.jsx` — `identifyUser(appUserId)` on launch once RevenueCat
    resolves; `clearUser()` on "Reset all data".
- (Optional, post-launch.) Wire source-map upload via
  `@sentry/webpack-plugin` so production stack traces deobfuscate. Needs
  a Sentry **auth token** (Settings → Auth tokens) plus the org + project
  slugs. Not needed for v1 — minified stack traces are still actionable.

---

## Lower priority / nice to have

### [ ] Apple Search Ads account (when ready to spend)
- Required for the Scenario B/C growth plans in `docs/business/financial-model.md`
- Set up after launch when you have ASO baseline data to optimize against

### [ ] App Store screenshots
- Dimensions in `docs/product/app-store-listing.md`
- Can be generated from the existing screens — no new code needed

### [x] ~~Add smoke tests~~ (suite landed 2026-05-13)
- Five Jest tests under `src/__tests__/` and `src/lib/__tests__/` lock
  in the three regressions that would hurt most: privacy-promise
  contracts on the two off-device payloads, the doctor-report PDF, the
  perfect-correlation insight, and the App boot path.
- No CI yet — running them is still a manual `npm test -- --watchAll=false`
  step. Wire CI (GitHub Actions, Netlify build hook, whatever) so these
  run on every push before launch.

---

## Promised in copy, not yet built

These came out of the 2026-05-10 "writing checks the code can't cash"
sweep. The product copy was tightened to match what the code does today,
but each item below is a feature the user-facing surface was implying
and we may want to actually build before launch.

### [x] ~~Real 12-week, chart-rich doctor-report PDF~~ (done 2026-05-12)
- Built the chart version: 12-week scope, top-3 symptom weekly-frequency
  bar charts, mood-by-week, sleep-by-week. Last 4 weeks of daily detail
  preserved beneath. Paywall hero + pillar copy bumped back up.

### [ ] Wire LIVE_COMMUNITY backend, then flip COMMUNITY_PREVIEW to false
- **Launch decision (2026-05-12):** Ship Community in preview mode for
  v1. The locked Share button + honest "opens later this season" copy
  is acceptable, and the prompt-of-the-day is a real piece of content
  to sit with. Wiring Firebase pre-launch isn't worth blocking the
  first review on.
- `community.js` has the Firebase shape; the iOS UI is gated behind a
  `COMMUNITY_PREVIEW` flag at the top of `CommunityScreen` so the fake
  reply counts and "12 reading now" no longer ship.
- When the backend is wired post-launch, set the flag to false and
  ensure the prompt of the day comes from the backend.

### [x] ~~Settings opt-out for PostHog product events (iOS)~~ (done 2026-05-12)
- New toggle in Settings → Privacy & Data. Honored at init (SDK never
  initializes) and on every track call (defense in depth).
- Privacy policy updated to point users at the toggle by name.

### [x] ~~Onboarding selections that actually shape the experience~~ (done 2026-05-12)
- Q1 concerns now bubble to the front of every symptom-category tile
  list in Today via `prioritizedSymptomsForCat`.
- Both Ask Vela and Daily Brief payloads now include the user's full
  concerns + goals arrays. Server-side `buildUserMessage` reads them
  and surfaces them to the model.

### [x] ~~Trim HealthKit read scope to only what we use~~ (done 2026-05-12)
- `read: ["sleepAnalysis"]` only. HRV / step count removed from the JS
  auth request. Swift plugin's sample-type switch retains the cases as
  forward-compat hooks; they're inert without a matching JS read.
- `NSHealthShareUsageDescription` rewritten to "Vela reads your sleep
  hours from Apple Health…" (sleep-only).

---

## How this list is maintained

- Claude adds an item here every time it builds something that has a
  manual gate it can't push through itself (Apple UI, dashboard config,
  account creation, secrets entry)
- You strike items as you complete them
- If something here is no longer relevant, just delete it

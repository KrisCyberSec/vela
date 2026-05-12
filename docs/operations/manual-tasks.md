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
- App Store Connect will require justification text on first build with
  HealthKit — paste from `NSHealthShareUsageDescription` in Info.plist

---

## Blocking real Ask Vela + Daily Brief in production

### [ ] Set `ANTHROPIC_API_KEY` in Netlify
- Site Settings → Environment variables → Add a variable
- Get the key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
- Powers BOTH `/api/ask-vela` AND `/api/daily-brief`. Until set, both
  return 503 with explainers and the client falls back to canned text.

### [ ] Set `REVENUECAT_REST_KEY` in Netlify
- Get the **secret** REST API key (starts with `sk_`) from
  [app.revenuecat.com](https://app.revenuecat.com) → Project Settings → API Keys
- Both AI functions verify against this before spending tokens
- Without it, both return 403 to all premium-gated callers

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
- Verification still pending: run `netlify dev`, fire a tracked event (e.g. open the daily log → `log_started`, or hit the paywall → `paywall_shown`), then check the PostHog "Live events" view.

### [ ] Create Sentry account + paste DSN
- [sentry.io](https://sentry.io) → free tier covers ~5k errors/mo
- Create a React project, copy the DSN
- Set in Netlify env:
  ```
  REACT_APP_SENTRY_DSN=https://xxxxx@xxx.ingest.sentry.io/xxx
  ```
- Code-side wiring is done in `src/errorReporting.js`

---

## Lower priority / nice to have

### [ ] Apple Search Ads account (when ready to spend)
- Required for the Scenario B/C growth plans in `docs/business/financial-model.md`
- Set up after launch when you have ASO baseline data to optimize against

### [ ] App Store screenshots
- Dimensions in `docs/product/app-store-listing.md`
- Can be generated from the existing screens — no new code needed

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

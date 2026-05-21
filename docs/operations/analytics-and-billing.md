# Analytics, Crash Reporting, and Subscriptions

How Vela's three observability/billing systems are wired and what you need to do externally to turn them on.

## What's in the codebase

| Concern | Module | Provider |
|---------|--------|----------|
| Subscriptions | [src/subscription.js](../../src/subscription.js) | RevenueCat (Capacitor SDK) |
| Product analytics | [src/analytics.js](../../src/analytics.js) | PostHog (web SDK) |
| Crash + JS error reporting | [src/errorReporting.js](../../src/errorReporting.js) | Sentry (React SDK) |

All three read their keys from environment variables and **no-op gracefully when keys are missing**. PostHog also refuses to initialize under `npm start` unless `REACT_APP_ENABLE_DEV_ANALYTICS=true`, so local dev and screenshot builds don't pollute the production project. See [.env.example](../../.env.example) for the variable names.

Run `npm run verify:observability` after setting local keys and after each
production build. It prints whether PostHog, Sentry, and RevenueCat client
keys are present locally and embedded in the current `build/` bundle without
printing secret values.

## Current status (2026-05-20)

- PostHog project key is present locally and embedded in the existing
  checked-in build.
- Sentry account/project exists and the DSN is present locally. The
  existing checked-in build was created before the DSN was pasted, so
  rebuild before verifying Sentry in the bundle or dashboard.
- RevenueCat project exists and the entitlement was corrected to exactly
  `premium`. Real App Store configuration is blocked until Apple
  Developer Program enrollment/payment is complete and App Store Connect
  can generate the In-App Purchase API key fields RevenueCat requires.
- Local `npm run verify:observability` currently reports one launch
  blocker: missing `REACT_APP_REVENUECAT_IOS_API_KEY`.

---

## Events instrumented (v1)

Launch analytics are intentionally narrow. Event properties are counts,
booleans, trigger names, plans, and status strings only. Do **not** send
symptom names, notes, Ask Vela questions, Ask Vela answers, exact dates, or
Apple Health values.

| Event | Where it fires | Properties |
|-------|----------------|------------|
| `onboarding_completed` | [src/App.jsx](../../src/App.jsx) `handleOnboardComplete()` | `concernCount`, `goalCount`, `remindersPreferenceSet` |
| `log_completed` | [src/App.jsx](../../src/App.jsx) `handleLog()` | `uniqueDays`, `streak`, `symptomCount`, `hasNotes` |
| `day_3_reached`, `day_7_reached`, `day_14_reached` | [src/App.jsx](../../src/App.jsx) `handleLog()` | `uniqueDays`, `streak` |
| `premium_feature_tapped` | [src/App.jsx](../../src/App.jsx) `openPaywall(trigger)` | `trigger` |
| `paywall_shown` | [src/App.jsx](../../src/App.jsx) `openPaywall(trigger)` | `trigger` (`tracker` / `history` / `insights` / `settings`) |
| `paywall_plan_selected` | [src/screens/Paywall.jsx](../../src/screens/Paywall.jsx) | `plan` (`annual` / `monthly`) |
| `purchase_started` | [src/App.jsx](../../src/App.jsx) `handleSubscribe()` | `plan` |
| `purchase_cancelled` | [src/App.jsx](../../src/App.jsx) `handleSubscribe()` | `plan`, `mode` |
| `purchase_failed` | [src/App.jsx](../../src/App.jsx) `handleSubscribe()` | `plan`, `mode`, `reason` |
| `paywall_converted` | [src/App.jsx](../../src/App.jsx) `handleSubscribe()` after a successful RevenueCat purchase | `plan` (`annual` / `monthly`) |
| `restore_started`, `restore_succeeded`, `restore_failed` | [src/App.jsx](../../src/App.jsx) `handleRestore()` | `mode`, `reason` where relevant |
| `ask_vela_used` | [src/screens/Insights.jsx](../../src/screens/Insights.jsx) `handleQuestion()` | `logCount`, `gatedByDataMin` |
| `ask_vela_started`, `ask_vela_succeeded`, `ask_vela_failed` | [src/screens/Insights.jsx](../../src/screens/Insights.jsx) `handleQuestion()` | `logCount`, `dataReady`, `cached`, `reason` where relevant |
| `doctor_report_exported` | [src/screens/Insights.jsx](../../src/screens/Insights.jsx), [src/screens/Settings.jsx](../../src/screens/Settings.jsx) | `source`, `uniqueDays` |
| `health_sync_enabled`, `health_sync_disabled`, `health_sync_failed` | [src/screens/Settings.jsx](../../src/screens/Settings.jsx) | `reason` where relevant |
| `experiment_started`, `experiment_started_from_today_nudge` | [src/screens/Insights.jsx](../../src/screens/Insights.jsx), [src/screens/Today.jsx](../../src/screens/Today.jsx) | `libraryId`, `duration` where relevant |
| `insight_feedback` | [src/lib/insightFeedback.js](../../src/lib/insightFeedback.js) | `kind`, `vote` |

The funnel that matters most early:

```
onboarding_completed → log_completed (D1) → day_7_reached → paywall_shown
→ purchase_started → paywall_converted
```

If `paywall_shown / log_completed (D7)` is healthy but `paywall_converted / paywall_shown` is dead, the issue is the paywall (price, copy, plan layout). If `log_completed (D7) / log_completed (D1)` is dead, the issue is retention upstream of monetization.

---

## RevenueCat setup

1. Create an account at https://www.revenuecat.com (free up to $2.5K MTR).
2. **Add iOS app:** project bundle ID is `com.velahealth.app`.
3. **Apple credentials:** in App Store Connect generate an in-app-purchase shared secret + an App Store Server API key, paste both into RevenueCat's iOS app settings. (Required for receipt validation and webhooks.)
4. **Create the entitlement:** name it exactly `premium` (the constant in `src/subscription.js`).
5. **Create the offering:** name it `default` (RevenueCat's default identifier). Add two packages:
   - `$rc_annual` → `com.velahealth.app.premium.annual` — $69.99/year, 14-day free trial
   - `$rc_monthly` → `com.velahealth.app.premium.monthly` — $8.99/month, 14-day free trial
6. **Configure products in App Store Connect** with the same product IDs above. RevenueCat's offering won't return until the App Store products exist (even in sandbox).
7. **Get the API key:** in RevenueCat → Project Settings → API Keys, copy the **Apple** public key (starts with `appl_`) into `.env.local`:
   ```
   REACT_APP_REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxxxxxxxxxx
   ```
8. **Test in sandbox:** install the app via TestFlight, sign into a sandbox Apple ID (Settings → App Store → Sandbox Account), open the paywall, complete a purchase. RevenueCat dashboard shows the transaction within seconds.

The paywall reads RevenueCat offerings and checks
`checkTrialOrIntroductoryPriceEligibility` before showing trial copy. If
RevenueCat/Apple reports the sandbox Apple ID is eligible, the button says
`Start 14 days free · then $69.99/yr` or `Start 14 days free · then
$8.99/mo`. Unknown or ineligible status falls back to plain paid copy.

### Web behavior (intentional)

`Capacitor.isNativePlatform()` is false in the browser dev preview, so RevenueCat init is skipped and `purchasePlan()` returns `error: 'web_fallback'`. The paywall handler treats that as a dev fallback and unlocks premium locally — useful for taking screenshots and demoing the paywall flow without an Apple sandbox account.

---

## PostHog setup

1. Create an account at https://posthog.com (free up to 1M events/month — orders of magnitude more than you need pre-PMF).
2. Create a project. The default region is US (`us.i.posthog.com`); for EU, use `https://eu.i.posthog.com`.
3. Copy the **Project API key** (starts with `phc_`):
   ```
   REACT_APP_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxx
   # only set this for non-US regions:
   # REACT_APP_POSTHOG_HOST=https://eu.i.posthog.com
   # only set true when intentionally testing local dev events:
   REACT_APP_ENABLE_DEV_ANALYTICS=false
   ```
4. Verify by completing a log on a build with the key set — within a minute the event shows up in PostHog → Activity.

### Privacy posture

The init in `src/analytics.js` is conservative on purpose:
- `person_profiles: 'identified_only'` — anonymous users don't create person records
- `capture_pageview` / `capture_pageleave` / `autocapture` all **off** — only explicit launch events go out
- `disable_session_recording: true` — no replay

This matches Vela's "your data stays on your device" privacy posture (the legal docs make that claim — don't break it by adding autocapture later without revisiting the privacy policy).

---

## Sentry setup

1. Create an account at https://sentry.io (free tier covers 5K errors/month).
2. Create a project of type **React**.
3. Copy the DSN:
   ```
   REACT_APP_SENTRY_DSN=https://xxxxxxxx@xxxxxxx.ingest.us.sentry.io/xxxxxx
   ```
4. Verify by throwing a test error from the JS console:
   ```js
   throw new Error("sentry test")
   ```
   It should appear in Sentry → Issues within seconds.

### What Sentry sees and doesn't

- **Sees:** unhandled JS errors, React error-boundary crashes, manual `reportError(err, ctx)` calls.
- **Scrubbed:** default PII is disabled; request headers, cookies, and query strings are removed before send; console breadcrumb text is capped.
- **Doesn't see:** native iOS crashes (those would need `@sentry/capacitor` + native config — not worth the complexity until there's a real iOS user base reporting issues).

---

## Per-user identification

Currently Vela has no account system — everything is on-device. So the four events fire as anonymous PostHog events. If/when a server-side identity is added (e.g. for community features beyond the existing Firebase setup), call `identify(distinctId, traits)` from [src/analytics.js](../../src/analytics.js) so events stitch into person profiles.

Don't fabricate a synthetic ID from device data just to identify users — that defeats the privacy posture without giving you anything actionable.

---

## What this is not

- **No A/B testing harness.** PostHog supports feature flags, but we're not using them yet. Pre-PMF, sequential learning beats split testing.
- **No revenue analytics.** RevenueCat's own dashboard is the source of truth for MRR / trial conversion / churn — don't duplicate that into PostHog.
- **No retention cohort dashboards.** Build those in PostHog when you have ≥50 weekly actives. Before that, eyeball the events table.

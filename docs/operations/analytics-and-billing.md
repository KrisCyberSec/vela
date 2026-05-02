# Analytics, Crash Reporting, and Subscriptions

How Vela's three observability/billing systems are wired and what you need to do externally to turn them on.

## What's in the codebase

| Concern | Module | Provider |
|---------|--------|----------|
| Subscriptions | [src/subscription.js](../../src/subscription.js) | RevenueCat (Capacitor SDK) |
| Product analytics | [src/analytics.js](../../src/analytics.js) | PostHog (web SDK) |
| Crash + JS error reporting | [src/errorReporting.js](../../src/errorReporting.js) | Sentry (React SDK) |

All three read their keys from environment variables and **no-op gracefully when keys are missing**, so local dev and screenshot builds don't pollute the production project. See [.env.example](../../.env.example) for the variable names.

---

## Events instrumented (v1)

Only four events. Add new ones with intent — every event is something to maintain.

| Event | Where it fires | Properties |
|-------|----------------|------------|
| `log_completed` | [src/App.jsx](../../src/App.jsx) `handleLog()` | `uniqueDays`, `streak`, `symptomCount`, `hasNotes` |
| `ask_vela_used` | [src/App.jsx](../../src/App.jsx) `handleQuestion()` | `logCount`, `gatedByDataMin` |
| `paywall_shown` | [src/App.jsx](../../src/App.jsx) `openPaywall(trigger)` | `trigger` (`tracker` / `history` / `insights` / `settings`) |
| `paywall_converted` | [src/App.jsx](../../src/App.jsx) `handleSubscribe()` after a successful RevenueCat purchase | `plan` (`annual` / `monthly`) |

The funnel that matters most early:

```
log_completed (D1)  →  log_completed (D7)  →  paywall_shown  →  paywall_converted
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

### Web behavior (intentional)

`Capacitor.isNativePlatform()` is false in the browser dev preview, so RevenueCat init is skipped and `purchasePlan()` returns `error: 'not_available'`. The paywall handler treats that as a dev fallback and unlocks premium locally — useful for taking screenshots and demoing the paywall flow without an Apple sandbox account.

---

## PostHog setup

1. Create an account at https://posthog.com (free up to 1M events/month — orders of magnitude more than you need pre-PMF).
2. Create a project. The default region is US (`us.i.posthog.com`); for EU, use `https://eu.i.posthog.com`.
3. Copy the **Project API key** (starts with `phc_`):
   ```
   REACT_APP_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxx
   # only set this for non-US regions:
   # REACT_APP_POSTHOG_HOST=https://eu.i.posthog.com
   ```
4. Verify by completing a log on a build with the key set — within a minute the event shows up in PostHog → Activity.

### Privacy posture

The init in `src/analytics.js` is conservative on purpose:
- `person_profiles: 'identified_only'` — anonymous users don't create person records
- `capture_pageview` / `capture_pageleave` / `autocapture` all **off** — only the four explicit events go out
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

# Now

Active focus. Things being worked on this week (Kris + assistant sessions).
Format: name + "done means" criterion. Keep this short — if it's more
than 5 items, you're not focused.

When something ships: remove it from here. When something stalls 3+
weeks: move it back to `parking-lot.md`. See `workflow.md` for the
flow.

---

## In flight

### App Store submission readiness
- **Current checkpoint (2026-05-20): paused on purpose.**
  - Xcode 26.5 is installed and selected.
  - iOS 26.5 simulator runtime is installed.
  - Native Debug builds now pass for both `generic/platform=iOS Simulator`
    and `generic/platform=iOS` with signing disabled.
  - Apple Developer Program enrollment/payment is not done yet.
  - App Store Connect cannot proceed for this app owner yet, so no App
    Store Connect API key can be created.
  - RevenueCat real App Store configuration is blocked until ASC provides
    the In-App Purchase `.p8` key, Key ID, and Issuer ID.
  - Resume phrase: "continue App Store setup."
- **Mission-critical path** (full recipe in `manual-tasks.md`):
  1. Apple Developer Program enrollment
  2. Code signing + 1024×1024 icon + HealthKit capability
  3. App Store Connect: app record, IAPs, screenshots (6 frames spec'd)
  4. Privacy nutrition label — *highest rejection risk* — must declare
     Health, Purchase History, anonymous User ID, Product Interaction,
     Crash Data, and Other Diagnostic Data. NOT universal "Data Not
     Collected"
  5. RevenueCat fully wired (the `premium` entitlement constant must
     match) — *second highest rejection risk*
  6. Netlify env: `ANTHROPIC_API_KEY` + `REVENUECAT_REST_KEY`
  7. TestFlight build that completes a sandbox purchase end-to-end
- **Done means:** TestFlight build passes the verification flow listed
  in manual-tasks.md, then "Submit for Review" in ASC.

### Sentry DSN wire-up
- **Code-side done** (commit `678c4fc`). Window-level handlers, user
  context, release tagging, error sinks all in place.
- **Local status (2026-05-20):** Sentry account exists and a real DSN is
  saved in `.env.local`. Local production rebuild embeds the DSN, and a
  synthetic smoke event appeared in Sentry Issues tagged `vela@1.0.0`.
- **Production status (2026-05-21):** DSN is set in Netlify as a secret
  env var and production redeploy `6a0e5921b228037c89395de0` completed.
- **Done means:** A real iOS/TestFlight build smoke appears in Sentry
  after Apple/TestFlight is available.

### Observability / billing envs
- **Local status:** `REACT_APP_POSTHOG_KEY` and `REACT_APP_SENTRY_DSN`
  are present in `.env.local`; `REACT_APP_REVENUECAT_IOS_API_KEY` is
  missing until Apple/RevenueCat setup resumes.
- **Server-side status:** Netlify has `ANTHROPIC_API_KEY`,
  `REVENUECAT_REST_KEY`, `NETLIFY_BLOBS_TOKEN`, and
  `REACT_APP_SENTRY_DSN`; production redeploy completed. Empty POST
  checks now return `Question required` / `Summary required`, which means
  the functions are past missing-env guards.
- **PostHog status:** Production app bundle fired `onboarding_completed`
  and the event appeared in PostHog Activity.
- **Done means:** `npm run verify:observability` passes after RevenueCat
  iOS public key is unblocked by Apple/App Store Connect.

---

## Waiting on me (Kris)

Things blocked on a dashboard click or account creation. Full inventory
in `docs/operations/manual-tasks.md` — this is just the "this week"
slice.

- [ ] Apple Developer Program enrollment/payment (paused until funds are
  available)

---

## Shipped this week

Auto-prune after Friday. See git log for the canonical record.

- `bfb6061` Launch observability funnel — PostHog funnel events, Sentry
  privacy hardening, RevenueCat/Sentry/PostHog verifier, and docs.
- `870ae23` Launch readiness release candidate — app-store prep,
  RevenueCat/paywall trial handling, legal/privacy docs, and iOS sync.
- `a34a5db` CI smoke tests + production build on push.
- `6f14a94` Smoke-test suite — 5 files, 9 tests, locks privacy
  contracts, doctor-report PDF, perfect-correlation insight, and the
  App boot path. `npm test` passes in ~1.6s. (Landed via Cowork; flagged
  follow-up: wire CI so it runs on push.)
- `c124ad3` Workflow scaffolding — workflow.md, now.md, parking-lot.md,
  cowork-prompts/ template directory
- `678c4fc` Sentry coverage expansion (window handlers, user context,
  release tagging, fetch error sinks)
- `ce2b22a` Phase 2 refactor — 8 screens into `src/screens/`
  (App.jsx 7339 → 3762)
- `4374772` Phase 1.5 refactor — 5 remaining helpers
  (App.jsx 8546 → 7339)
- `d56f92b` Icons + haptic extraction (App.jsx 8713 → 8546)
- `9e38a19` Phase 1 refactor — 16 pure-function lib modules
  (App.jsx 10639 → 8713)
- `5a7b5a4` Five pre-launch decisions resolved (12-week chart PDF,
  Community preview, onboarding wire-up, HealthKit scope trim, PostHog
  opt-out toggle)
- `2217b29` Tidied four small copy-honesty items
- `b547890` Sweep landing + app copy for claims the code can't back
- `324ea9c` Match privacy copy to what the code actually does

# Vela Session Handoff

Picking up from this point in a new chat or with a new engineer. Read
this first, then read `docs/operations/now.md` for the freshest status.

## Project at a glance

**What**: Vela is an iOS app for women in perimenopause and menopause.
It combines daily symptom tracking, personal pattern detection, a real
Anthropic Claude AI companion ("Ask Vela"), proactive daily briefs, cycle
prediction, experiments, and doctor-ready PDF reports. Privacy posture is
central: sensitive tracking data is stored on device, and off-device AI
requests receive anonymized summaries rather than raw notes, names, or
exact dates.

**Audience**: women aged 45-55 navigating perimenopause and menopause.
This audience is deliberate, skeptical of subscription rug-pulls, and
allergic to condescending coaching/wellness language.

**Stage**: feature-complete, pre-App Store. Local web preview works,
landing page is live at `velahealth.health`, Xcode native smoke builds now
pass, and the project is waiting on Apple Developer Program enrollment
before App Store Connect, RevenueCat App Store wiring, TestFlight, and
final HealthKit device testing can finish.

**Repo**: `github.com/KrisCyberSec/vela`. Active launch-readiness work is
on branch `codex/launch-readiness` with PR #4 open against `main`.

## Source-of-truth order

If two docs disagree, trust the first applicable doc in this order and
update the stale one in the same commit.

1. `docs/operations/now.md` - current in-flight work and blockers.
2. `docs/operations/manual-tasks.md` - dashboard/account tasks only Kris can do.
3. `docs/operations/launch-walkthrough.md` - step-by-step App Store path.
4. `docs/operations/analytics-and-billing.md` - RevenueCat, PostHog, Sentry state.
5. `docs/engineering/architecture.md` - codebase map and module boundaries.
6. This file - executive context, product promises, and handoff notes.

## Current checkpoint

As of 2026-05-21:

- Xcode 26.5 is installed and selected.
- iOS 26.5 simulator runtime is installed.
- Native Debug builds pass for both `generic/platform=iOS Simulator` and
  `generic/platform=iOS` with signing disabled.
- Netlify production env is verified for `ANTHROPIC_API_KEY`,
  `REVENUECAT_REST_KEY`, `NETLIFY_BLOBS_TOKEN`, Sentry DSN, and PostHog key.
- PostHog received a real `onboarding_completed` event from the production
  app bundle.
- Sentry received a synthetic local/dashboard smoke event tagged
  `vela@1.0.0`.
- RevenueCat project exists, the `premium` entitlement is correct, and the
  secret REST key is in Netlify.
- RevenueCat's real iOS public key is still blocked until Apple Developer
  Program/App Store Connect setup creates the required App Store
  credentials.

Latest launch-readiness commits (full history via `git log --oneline`):

- `c5d03a3` Record Xcode native build readiness
- `ab6e017` Harden HealthKit iOS launch readiness
- `fe4e8c1` Record production observability verification
- `6e2295a` Record Sentry smoke checkpoint
- `1c221d5` Update launch setup checkpoint
- `bfb6061` Wire launch observability funnel
- `870ae23` Prepare launch readiness release candidate
- `a34a5db` Wire CI: smoke tests + build on every push

Before making changes, check `git status`. The launch-readiness branch has
been pushed to origin and is the current place for launch fixes.

## How Kris wants to work

Current working preferences:

1. Keep moving without asking for permission on routine code/doc fixes.
2. Commit and push code/doc changes automatically when they are coherent.
3. Sweep related docs for stale information as part of every change.
4. Push back on large architecture, launch, or spend decisions with clear
   tradeoffs before executing.
5. Track dashboard/account gates in `docs/operations/manual-tasks.md`.
6. Do not alter the app design language unless there is a strong reason.
7. Do not push past the Apple Developer Program payment gate until Kris
   says it is funded. Resume phrase: "continue App Store setup."

Inherited product/copy rules:

- No emoji in UI. Use Phosphor duotone icons.
- No em dashes in user-facing copy. Use periods, commas, or "to".
- Banned brand-voice words in user-facing copy: "journey," "wellness,"
  "self-care," "empowered," "your body is amazing."
- Pricing: $8.99/month, $69.99/year, 14-day free trial. Apple tiers 9 and 70.
- No grandfathered users because the app is not live yet.
- Domains: `velahealth.health` is live. `velahealth.app` is reserved for
  the iOS bundle ID `com.velahealth.app`.

## Tech stack

- React 18 + Capacitor 8 iOS hybrid app
- CRA (`react-scripts 5`) build
- `src/App.jsx` is the app shell, persistence, routing glue, and global CSS
- `src/screens/` holds Today, History, Insights, Onboarding, Paywall,
  Settings, Community, and EditQuestion
- `src/lib/` holds pure analysis and product logic
- `src/components/` holds shared JSX and icon wrappers
- Netlify Functions power waitlist, Ask Vela, Daily Brief, and admin export
- Netlify Blobs power waitlist storage, rate limits, cost tracking, and caches
- jsPDF powers doctor reports
- Phosphor Icons provide UI icons
- Apple HealthKit is implemented through a custom Capacitor plugin in
  `ios/App/App/Plugins/`
- RevenueCat, PostHog, and Sentry are wired through environment variables
  and no-op safely when unavailable

## What ships in the app right now

### Main app surfaces

1. **Today** - daily check-in for mood, energy, symptoms, context, notes,
   and trigger-aware nudges.
2. **History** - calendar and entry feed. Day detail can prefill Ask Vela.
3. **Insights** - correlations, anomalies, cycle prediction, weekly
   summary, experiments, doctor PDF, and Ask Vela.
4. **Community** - preview-mode Circle surface with anonymous daily prompt.
5. **Settings** - profile, subscription, reminders, theme, Apple Health,
   privacy, export, and reset controls.
6. **Onboarding** - concern/goals capture that shapes symptom ordering and
   AI payload context.
7. **Paywall** - annual/monthly premium plans, RevenueCat-backed on native.

### Premium product

The paywall presents these pillars:

1. Ask Vela
2. Daily brief
3. Personalized suggestions
4. Doctor-ready PDF report
5. Run experiments
6. Cycle prediction
7. Tomorrow forecast
8. Anomaly insights
9. Weekly summary
10. Apple Health sync
11. Full pattern history

### AI surfaces

- **Ask Vela**: reactive Q&A through Netlify `/api/ask-vela`, with
  premium verification, rate limits, daily/monthly budgets, caching, and
  crisis filters.
- **Daily Brief**: proactive morning observation through
  `/api/daily-brief`, cached per app user and date. Suppressed when
  sustained low mood is detected.

### Statistical engines

- `analyzeCorrelations` - adaptive same-day and lag correlation detection
- `detectAnomalies` - z-score against personal 30-day baseline
- `predictNextCycle` - mean/stddev adaptive cycle window
- `forecastTomorrow` - cycle phase, recent triggers, and recency weighting
- `suggestExperiments` - maps detected patterns to experiment library
- `buildWeeklySummary` - current week vs prior week
- `compareExperiment` - during-window vs prior-window symptom counts
- `getInsightFeedback` and `applyFeedbackRanking` - thumbs up/down ranking

### Crisis safety

1. Client `looksLikeCrisis` pre-filter surfaces `CrisisSupportCard`.
2. Sustained-low-mood detection on Today suppresses Daily Brief and
   surfaces support resources.
3. Server-side filters in `/api/ask-vela` provide defense in depth.

International resources are hardcoded for US, UK, Canada, Australia, and
worldwide help via `findahelpline.com`.

## Key file map

```text
src/App.jsx              App shell, routing, persistence, global CSS
src/screens/             Main product surfaces
src/lib/                 Pure analysis, summaries, PDF, storage helpers
src/components/          Shared UI components and icon wrappers
src/api.js               API URL/header helper for native vs local calls
src/healthkit.js         Capacitor wrapper for VelaHealth native plugin
src/subscription.js      RevenueCat wrapper, native/web/misconfigured modes
src/analytics.js         PostHog wrapper, live production event verified
src/errorReporting.js    Sentry wrapper, local/prod DSN smoke verified
src/safeStorage.js       localStorage helper that survives private mode
src/theme.js             light/system/dark theme handling
src/community.js         Firebase community shape, preview mode still active

netlify/functions/
  ask-vela.js            Anthropic Claude proxy with premium/rate/cost gates
  daily-brief.js         Proactive morning observation function
  waitlist*.js           Waitlist and admin export

ios/App/App/Plugins/
  VelaHealthPlugin.swift Custom HealthKit Capacitor plugin
  VelaHealthPlugin.m     Obj-C bridge

ios/App/App/App.entitlements   HealthKit entitlement file
ios/App/App/Info.plist         HealthKit usage strings and app metadata
ios/App/App/PrivacyInfo.xcprivacy
                                 Apple privacy manifest included in target
ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
                                 Pinned SwiftPM dependency graph

docs/operations/now.md                  Current operational status
docs/operations/manual-tasks.md         Manual account/dashboard gates
docs/operations/launch-walkthrough.md   App Store launch playbook
docs/operations/analytics-and-billing.md RevenueCat/PostHog/Sentry state
docs/operations/ios-build.md            Native build and TestFlight flow
docs/engineering/architecture.md        General codebase map
docs/engineering/ai-companion.md        AI architecture
docs/business/financial-model.md        Pricing and unit economics
docs/product/overview.md                Product positioning
```

## What's blocking real launch

Full list lives in `docs/operations/manual-tasks.md`. Top blockers:

1. Apple Developer Program enrollment/payment.
2. App Store Connect app record, subscription group, annual/monthly IAPs,
   14-day trials, shared secret, and In-App Purchase API key.
3. RevenueCat App Store configuration plus the real public iOS key
   `REACT_APP_REVENUECAT_IOS_API_KEY`.
4. Xcode signing team and HealthKit capability in the Apple provisioning
   profile.
5. App Store screenshots and privacy nutrition label entry.
6. TestFlight build on a physical iPhone, including sandbox purchase,
   Ask Vela response, doctor PDF share, PostHog event, and Sentry smoke.

Already handled:

- Xcode install and iOS simulator runtime.
- Command-line native Debug builds with signing disabled.
- App icon 1024x1024 RGB/no-alpha asset.
- Netlify production env for Anthropic, RevenueCat REST, Blobs, Sentry,
  and PostHog.
- PostHog live event verification.
- Sentry local/dashboard smoke verification.
- RevenueCat project, `premium` entitlement, and secret REST key.

## Current App Store / RevenueCat bookmark

Paused intentionally on 2026-05-20 because Apple Developer Program
enrollment/payment is not available yet.

Resume steps:

1. Enroll/pay for Apple Developer Program using the business Apple ID.
2. Sign into App Store Connect.
3. Create app record for bundle ID `com.velahealth.app`.
4. Create annual and monthly auto-renewable subscriptions with 14-day trials.
5. Generate App Store shared secret and In-App Purchase API key: `.p8`
   file, Key ID, and Issuer ID.
6. Return to RevenueCat project `Vela`, app `Vela (App Store)`, and paste
   or upload Apple credentials.
7. Copy the RevenueCat Apple public key starting `appl_` into `.env.local`
   and Netlify as `REACT_APP_REVENUECAT_IOS_API_KEY`.
8. Rebuild, run `npm run verify:observability`, then `npx cap sync ios`.
9. Archive, upload to TestFlight, and run the sandbox purchase flow.

## Cost math

At 1000 paying premium users:

- Expected Anthropic spend: about $840/year.
- Against $69k net annual revenue: about 1.2% of net.
- `$50/day` shared global ceiling caps worst case at $18,250/year and
  should not be reached until much larger scale.

Per call with Claude Haiku 4.5 estimate:

- 950 input tokens at $1/Mtok + 150 output tokens at $5/Mtok = about
  $0.0017/call.

## Voice and copy rules

- Talk to a smart 50-year-old who is tired of being condescended to.
- 2-4 sentences max for AI output.
- Italics for emphasis, no headers/bullets unless asked.
- Never start with "Great question," "Good morning," or "Today".
- Use plain language, not therapy jargon.
- HRT awareness: never recommend supplements without "check with your
  prescriber."
- Pregnancy: defer to provider if data suggests pregnancy.
- Crisis topics: respond only with international support resources.

Both Netlify function system prompts have these rules baked in.

## What not to do next without pushback

- Apple Watch app: 5-10 days for a smaller slice of the first audience.
- MyChart/Epic FHIR integration: 4-8 weeks and usually needs B2B
  partnerships.
- Cross-app imports from Caria, Balance, or Oura: high effort, low launch
  signal.
- Voice journaling / Siri shortcuts: sounds useful, likely low adoption
  for v1.

If Kris asks for any of these, explain the cost and what it displaces.

## Natural next work

Until Apple Developer Program payment is available, the highest leverage
work is documentation cleanup, launch checklist sharpening, simulator
smoke testing, and any small reliability fixes found during walkthroughs.

When the Apple payment gate opens, resume App Store setup immediately:
Apple Developer enrollment, App Store Connect app/IAP setup, RevenueCat
iOS key, Xcode signing/HealthKit capability, TestFlight sandbox purchase,
then final App Review submission.

## How to verify in a new chat

1. Confirm working tree and branch: `git status --short --branch`.
2. Read `docs/operations/now.md`.
3. Run web tests: `CI=true npm test -- --watchAll=false`.
4. Run production build: `CI=true npm run build`.
5. Check Capacitor state: `npx cap doctor ios`.
6. Native smoke builds are documented in `docs/operations/ios-build.md`.
   The most recent verified commands were:

   ```bash
   xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
     -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
   xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
     -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
   ```

7. For launch blockers, read `docs/operations/manual-tasks.md` and do not
   assume Apple/RevenueCat is unblocked until that file says so.

## A small but important note

Kris gave lead-engineer responsibility for an app intended to be used by a
large number of women dealing with sensitive health information. Treat
privacy, safety, and copy honesty as launch-critical product quality, not
nice-to-have polish.

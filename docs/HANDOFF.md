# Vela. Session Handoff

Picking up from this point in a new chat. Read this first.

## Project at a glance

**What**: Vela is an iOS app for women in perimenopause and menopause.
Daily symptom check-in, pattern detection, real Anthropic Claude AI
companion ("Ask Vela"), proactive daily brief, cycle prediction,
experiments, doctor-ready PDF report. Privacy-first: data stays on
device, only anonymized aggregates leave for AI features.

**Audience**: women aged 45-55 navigating perimenopause and menopause.
This audience is deliberate, skeptical of subscription rug-pulls, and
allergic to coaching/wellness language.

**Stage**: feature-complete, not yet on App Store. Pre-launch. Working
locally + landing page live at velahealth.health.

**Tech**:
- React 18 + Capacitor 8 (iOS hybrid)
- CRA (`react-scripts 5`) build
- Source layout (post-2026-05-12 refactor):
  - `src/App.jsx` (~3,800 lines: App() orchestrator + the CSS template
    literal. Pure logic and screens are out, see below.)
  - `src/lib/` — 16 pure-function modules (correlations, summaries,
    forecast, anomalies, cycle, patterns, experiments, etc.)
  - `src/screens/` — 8 screen components (Today, History, Insights,
    Onboarding, Paywall, Settings, Community, EditQuestion)
  - `src/components/` — shared JSX (icons, CrisisSupportCard)
- Netlify Functions for AI proxy + waitlist
- Netlify Blobs for rate limits + cost tracking + caches
- jsPDF for doctor reports
- Phosphor Icons (duotone) — no emoji in UI ever
- Apple HealthKit via custom Capacitor plugin (`ios/App/App/Plugins/`)
- Sentry pre-wired with local DSN saved in `.env.local`; PostHog wired
  with local key present. RevenueCat real iOS key is still blocked by
  Apple Developer/App Store Connect setup.

**Repo**: github.com/KrisCyberSec/vela. Active launch-readiness work is
on branch `codex/launch-readiness` with PR #4 open against `main`.

## Where we are right now

**Read first when picking up a session:**
- `docs/operations/now.md` — what's actively being worked on this week
- `docs/operations/workflow.md` — how work moves through the project
- `docs/operations/manual-tasks.md` — what's waiting on a human
- `docs/operations/launch-walkthrough.md` — literal step-by-step playbook
  for App Store submission (Day-1-Apple-enrollment through Submit-for-Review)
- `docs/operations/cowork-prompts/` — template prompts for spawning Cowork
  sessions on recurring work

Latest commits (full history via `git log --oneline`):
- `bfb6061` Wire launch observability funnel
- `870ae23` Prepare launch readiness release candidate
- `a34a5db` Wire CI: smoke tests + build on every push
- `678c4fc` Sentry coverage expansion (window handlers, user context,
  release tagging, fetch error sinks)
- `ce2b22a` Phase 2 refactor — 8 screens into src/screens/
- `4374772` Phase 1.5 refactor — 5 remaining helpers
- `d56f92b` Icons + haptic extraction
- `9e38a19` Phase 1 refactor — 16 pure-function lib modules
- `5a7b5a4` Five pre-launch decisions resolved (12-week chart PDF,
  Community preview, onboarding wire-up, HealthKit scope trim, PostHog
  opt-out toggle)
- `b547890` Sweep landing + app copy for claims the code can't back
- `324ea9c` Match privacy copy to what the code actually does

Before making changes, check `git status`. The launch-readiness branch
has been pushed to origin and is the current place for launch fixes.

## How the user wants to work

From `~/.claude/projects/-Users-kristopher-Vela/memory/`:

1. **Don't push toward App Store submission.** User iterates and ships at own pace.
2. **Commit code/doc changes automatically without asking.** Sweep docs for stale info as part of every change.
3. **Push back on big architectural/strategic asks** with tradeoffs, ask the real question instead of executing. Auto mode does NOT override this rule.
4. **Manual-task list** at `docs/operations/manual-tasks.md`. Add to it whenever you build something with a manual gate Claude can't push through (Apple UI, dashboard config, account creation, secrets).
5. **No emoji in UI**. Use Phosphor duotone icons. The 45-55 audience finds emoji childish for menopause.
6. **No em dashes in user-facing copy**. They read as AI-written. Use periods, commas, "to" instead. Both AI system prompts already have this directive.
7. **Banned brand-voice words** (anywhere user-facing): "journey," "wellness," "self-care," "empowered," "your body is amazing." Period.
8. **Pricing**: $8.99/mo, $69.99/yr, 14-day free trial. Apple tiers 9 and 70.
9. **No grandfathered users** (not live in App Store yet).
10. **Two domains**: velahealth.health (live, Namecheap, support email forwards to lindsaykristopher@gmail.com) and velahealth.app (Squarespace, kept for iOS bundle ID com.velahealth.app only).

## What ships in the app right now

### 7 surfaces (bottom nav)

1. **Today** — daily check-in (mood, energy, symptoms, context, notes). Logged-today state shows "Logged today, 9:00am, 3 symptoms, tap to add more." Personalized trigger-aware nudge appears when user logs a symptom + correlated context.
2. **History** — calendar + entry feed. Tap an entry → day-detail sheet with "Ask Vela about this day" inline action.
3. **Insights** — patterns Vela has noticed (correlations + lag + anomalies), Vela suggests (personalized experiments), cycle prediction, weekly summary, doctor PDF, experiments.
4. **Community (Circle)** — anonymous daily prompt + answers. Sample data; backend Firebase (LIVE_COMMUNITY flag, currently false).
5. **Settings** — profile, subscription, reminders, theme (light/system/dark), Apple Health, privacy, export.

### Premium product (11 pillars in this order on paywall)

1. Ask Vela (real Anthropic Claude)
2. Daily brief (proactive 2-3 sentence morning observation)
3. Personalized suggestions (experiments mapped to detected patterns)
4. Doctor-ready PDF report
5. Run experiments (6 prebuilt: caffeine cutoff, evening walks, no alcohol, consistent bedtime, magnesium, morning protein)
6. Cycle prediction (works on irregular cycles)
7. Tomorrow forecast (cycle phase + recent triggers + recency-weighted)
8. Anomaly insights (z-score deviations from personal 30-day baseline)
9. Weekly summary (Sunday brief)
10. Apple Health sync (sleep)
11. Full pattern history

### AI surfaces

- **Ask Vela**: reactive Q&A. 30 questions/24h per user (server cap), 250/month soft cap (client hint). $50/day shared global ceiling. 24h response cache. 5-layer abuse defense.
- **Daily Brief**: proactive 2-3 sentence morning observation. Cached per appUserId+date so repeat opens are free. Suppressed when sustained low mood detected (crisis safety).

### Statistical engines (on-device, not AI)

- `analyzeCorrelations` — adaptive same-day + 1/2-day lag, perfect-correlation handling
- `detectAnomalies` — z-score against personal 30-day baseline
- `predictNextCycle` — mean + stddev with adaptive window
- `forecastTomorrow` — Bayesian-flavored (cycle phase + recency + trigger streaks)
- `suggestExperiments` — maps correlations to library
- `buildWeeklySummary` — week vs prior-week
- `compareExperiment` — symptom counts during vs prior window
- `getInsightFeedback` + `applyFeedbackRanking` — thumbs up/down with weighted ranking

### Crisis safety net (3 layers)

1. Client `looksLikeCrisis` regex pre-filter, surfaces `CrisisSupportCard`
2. Sustained-low-mood detection on Today (mood ≤ 1 over 5+ days), suppresses brief, surfaces card
3. Server-side regex in /api/ask-vela as defense in depth

International resources hardcoded: 988 (US), 116 123 (UK), 1-833-456-4566 (CA), 13 11 14 (AU), ifindahelpline.com (worldwide).

### Cross-screen integrations

Round one:
- History day-detail → Ask Vela about this day (prefilled question)
- Insights pattern card → Run as experiment (one-tap)
- Today logging → trigger-aware experiment nudge (when correlation exists)

Round two:
- Daily brief on Today deep-links any active-experiment mention to its card on Insights (with sage flash on arrival)
- Anomaly card on Insights → "Ask Vela why" prefilled with the actual numbers (premium tier)
- Settings → "Patterns you've marked helpful" card pulling thumbs-up'd correlations that are still detected
- Today greeting adapts to logging gaps (3+ days = "You haven't logged in N days", 7+ = "It's been over a week")

## Known cleanup (not blocking)

(Nothing pending right now. Earlier items — dead gamification code,
untracked `./vela/`, half-wired HRV, paywall-vs-reality gap — are all
resolved as of May 2026. Add new items here when they appear.)

## Key file map

```
src/App.jsx              ~10400 lines, all components + CSS-in-JS + helpers
src/healthkit.js         Capacitor plugin wrapper for VelaHealth
src/subscription.js      RevenueCat wrapper, 3-mode (native/web/misconfigured)
src/analytics.js         PostHog wrapper (key pending)
src/errorReporting.js    Sentry wrapper (DSN pending)
src/safeStorage.js       localStorage helper that survives private mode
src/theme.js             light/system/dark theme handling
src/community.js         Firebase community (LIVE_COMMUNITY flag, false)

netlify/functions/
  ask-vela.js            Anthropic Claude proxy with 5-layer defense
  daily-brief.js         Proactive morning observation function

netlify.toml             Functions dir + /api/* redirect

ios/App/App/Plugins/
  VelaHealthPlugin.swift  Custom HealthKit Capacitor plugin
  VelaHealthPlugin.m      Obj-C bridge

ios/App/App/App.entitlements   HealthKit capability
ios/App/App/Info.plist         NSHealthShareUsageDescription strings

docs/operations/manual-tasks.md   The user's manual-task list
docs/engineering/ai-companion.md  Full AI architecture (just rewrote)
docs/engineering/architecture.md  General codebase map
docs/business/financial-model.md  Pricing + LTV math
docs/product/overview.md          Product positioning
```

## What's blocking real launch (manual tasks for the user)

Full list in `docs/operations/manual-tasks.md`. Top blockers:

1. **Apple Developer Program enrollment** ($99/yr)
2. **App Store Connect**: create app + IAP products at $8.99/$69.99 with 14-day trial
3. **Xcode**: Signing & Capabilities → +Capability → HealthKit (entitlements file is wired)
4. **Netlify env vars** (3 required):
   - `ANTHROPIC_API_KEY` — powers both AI functions
   - `REVENUECAT_REST_KEY` — premium verification (starts `sk_`)
   - `NETLIFY_BLOBS_TOKEN` — required by ALL four functions (waitlist + waitlist-export + ask-vela + daily-brief). Site runtime doesn't auto-inject `NETLIFY_BLOBS_CONTEXT`, so this PAT is the only path.
5. **RevenueCat dashboard** wiring after IAPs exist. Current checkpoint:
   RevenueCat project exists, entitlement is `premium`, but the App Store
   app configuration could not be saved because ASC In-App Purchase API
   key fields are required.
6. **Sentry/PostHog verification**: local keys are present, but Netlify
   env and dashboard smoke tests still need to be completed.

## Current App Store / RevenueCat bookmark

Paused intentionally on 2026-05-20 because Apple Developer Program
enrollment/payment is not available yet.

Resume steps:
1. Enroll/pay for Apple Developer Program using the business Apple ID.
2. Sign into App Store Connect.
3. Generate an In-App Purchase API key for RevenueCat: `.p8` file, Key
   ID, and Issuer ID.
4. Return to RevenueCat project `Vela`, app `Vela (App Store)`, bundle
   ID `com.velahealth.app`, and paste/upload the Apple credentials.
5. Copy the RevenueCat Apple public key starting `appl_` into
   `.env.local` as `REACT_APP_REVENUECAT_IOS_API_KEY`.
6. Rebuild, run `npm run verify:observability`, then `npx cap sync ios`.

## Cost math (verified)

At 1000 paying premium users:
- Anthropic spend: ~$840/yr (Daily Brief $620 + Ask Vela $204)
- Against $69k net annual revenue: 1.2% of net
- $50/day global ceiling caps worst case at $18,250/yr (won't hit until ~25k users)

Per call (Claude Haiku 4.5):
- 950 in × $1/Mtok + 150 out × $5/Mtok = ~$0.0017/call

## Voice and copy rules (already enforced)

- Talk to a smart 50-year-old who's tired of being condescended to
- 2-4 sentences max for AI output
- Italics for emphasis, no headers/bullets unless asked
- Never start with "Great question," "Good morning," "Today"
- Plain language, never therapeutic-jargon
- HRT awareness: never recommend supplements without "check with your prescriber"
- Pregnancy: defer to provider if data suggests pregnancy
- Crisis topics: respond ONLY with international support resources

Both Netlify function system prompts already have all of these baked in.

## What I would NOT recommend doing next without pushback

- Apple Watch app (5-10 days for ~30% of audience that has one)
- MyChart/Epic FHIR integration (4-8 weeks; needs B2B partnerships)
- Cross-app data import from Caria/Balance/Oura (low signal-to-effort)
- Voice journaling / Siri shortcuts (sounds cool, <5% adoption in this category)

If the user asks for any of these, push back with the math.

## What's a natural next chunk

If the user wants to keep going:

1. **OS-level integration** (next round of "more integrated"):
   - iOS Calendar event for cycle prediction window
   - Lock screen widget (one-tap mood log + cycle countdown)
   - Smart cycle notification ("heads up, your usual window is in 2 days")

2. **App Store prep** (only if user explicitly asks):
   - Screenshot generation
   - Final ASO keyword pass
   - TestFlight soft launch sequence

## How to verify everything works in a new chat

1. Confirm working tree is clean: `git status`
2. Build passes: `CI=true npm run build` (should compile clean, no warnings)
3. Dev server is at port 3000: `npm run start` (or already running)
4. Read `docs/operations/manual-tasks.md` for what's blocked on the user
5. Read `docs/engineering/ai-companion.md` for AI architecture
6. Skim `~/.claude/projects/-Users-kristopher-Vela/memory/` for the user's preferences

## A small but important note

The user gave me lead-engineer responsibility for an app that "potentially 50,000 women will use." I treated this seriously: full safety audit, anonymization verification, crisis interception, perfect-correlation logic fix. The bar in this codebase is "would I want my mother or sister using this." Hold that bar.

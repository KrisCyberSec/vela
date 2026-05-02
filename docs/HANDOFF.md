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
- Single file: `src/App.jsx` (~10400 lines, intentional)
- CRA (`react-scripts 5`) build
- Netlify Functions for AI proxy + waitlist
- Netlify Blobs for rate limits + cost tracking + caches
- jsPDF for doctor reports
- Phosphor Icons (duotone) — no emoji in UI ever
- Apple HealthKit via custom Capacitor plugin (`ios/App/App/Plugins/`)

**Repo**: github.com/KrisCyberSec/vela on `main` branch.

## Where we are right now

Latest commit: round-two cohesion (brief deep-links, anomaly Ask Vela, Settings recent insights, gap-aware greeting).

Recent commits:
- (this commit) Round-two within-app cohesion (4 cross-screen handoffs)
- `e61e2af` Within-app cohesion (History → Ask Vela, Insights pattern → experiment, Today trigger nudge)
- `8af959a` Bumped Ask Vela monthly cap 60 → 250, richer Claude summary
- `1e997aa` Stripped 213 em dashes from user-facing copy + cost-tracking warning logs
- `9f8c1c7` Lead-engineer review for 50k users (crisis safety, perfect-correlation logic, brand voice)
- `e2b99e1` Six "feels alive" features (adaptive thresholds, lag detection, anomalies, daily brief, forecast, feedback loop)
- `631dd62` Trial → 14 days + native Swift HealthKit plugin

Working tree clean. All pushed to origin/main.

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

### Premium product (7 pillars in this order on paywall)

1. Ask Vela (real Anthropic Claude)
2. Personalized suggestions (experiments mapped to detected patterns)
3. Doctor-ready PDF report
4. Run experiments (6 prebuilt: caffeine cutoff, evening walks, no alcohol, consistent bedtime, magnesium, morning protein)
5. Cycle prediction (works on irregular cycles)
6. Weekly summary (Sunday brief)
7. Apple Health sync (sleep + HRV)
8. Full pattern history

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
   - `NETLIFY_BLOBS_TOKEN` — already used by waitlist function
5. **RevenueCat dashboard** wiring after IAPs exist
6. **PostHog + Sentry** account creation (code-side wiring done, just need keys)

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

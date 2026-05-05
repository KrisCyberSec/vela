# Vela AI — Ask Vela + Daily Brief

Technical reference for the two AI surfaces in the app: **Ask Vela**
(reactive Q&A, powered by Claude Sonnet 4.6) and **Daily Brief**
(proactive morning observations, powered by Claude Haiku 4.5). Both
run via Netlify Functions.

Ask Vela was switched from Haiku 4.5 to Sonnet 4.6 on 2026-05-04 after
an offline quality eval showed Sonnet producing ~4x fewer spec
violations on the same 64-run test. Daily Brief stays on Haiku because
it's a short, cached, formulaic generation where quality wins matter
less and cost compounds across every premium user every day.

> **Architecture note:** an earlier rev of this doc claimed Vela was
> rule-based and on-device. That's no longer true. The user's data still
> stays on device, but anonymized aggregates leave the device when AI
> features are invoked, gated behind a 5-layer defense.

## What ships

| Surface | Trigger | Cost ceiling | Cache |
|---|---|---|---|
| Ask Vela | User taps the FAB and asks a question | 30/24h per user, $50/day global | Per question + summary signature, 24h |
| Daily Brief | Premium user opens Today, fetched once per morning | 2/24h per user (1 expected), $50/day global (shared) | Per appUserId + date, 24h |

## Architecture

```
Client (src/App.jsx)
  ├─ buildAskVelaSummary(logs)    anonymized payload for Ask Vela
  ├─ buildDailyBriefSummary(logs)  same shape, tuned for proactive
  ├─ getAppUserId()                RC subscriber ID (premium proof)
  └─ POST /api/ask-vela | /api/daily-brief
        │
        ▼
Netlify Function (netlify/functions/{ask-vela,daily-brief}.js)
  ├─ LAYER 1: verifyPremium        RevenueCat REST, 5-min cache
  ├─ LAYER 2: per-user 24h limit   Netlify Blobs counter
  ├─ LAYER 3: per-IP 24h limit     same
  ├─ LAYER 4: daily $ ceiling      shared budget across both functions
  ├─ LAYER 5: response cache       24h, hashed key
  └─ POST → Anthropic API
       Ask Vela: Claude Sonnet 4.6
       Daily Brief: Claude Haiku 4.5
```

## What "anonymized" means in practice

The summary payload that leaves the device is aggregated. Specifically
it **never** contains:

- Free-text notes (the user-typed `notes` field)
- Custom user-defined symptoms (filtered by length check)
- Exact log timestamps (only dates make it; mostly aggregated)
- Profile names or any personally-identifying info
- The RevenueCat appUserId (used for premium verify only, never
  forwarded to Anthropic)

It **does** contain (verified in `buildAskVelaSummary`):

- 30-day symptom counts (top 12)
- Mood/sleep/stress 30-day averages
- Detected correlation strings (plain-language, derived from data)
- Cycle prediction window (start/end dates)
- Cycle phase (current dayInCycle + named phase)
- Last 7 days breakdown: day-of-week + mood label + sleep + stress +
  symptom names per day
- Active experiments (library name + day count)
- Profile stage label + goal label

A transparent disclosure of this lives on Settings → Privacy & Data:
"What Ask Vela sends. Aggregated counts and averages only. Never your
notes, custom symptoms, or exact dates."

## Defense in depth

### Layer 1. Premium verification (RevenueCat REST)

Every call verifies premium status via RC's `/v1/subscribers/{id}`
endpoint. Result cached for 5 minutes per user to avoid hammering RC.
Free users get a 403 before any Anthropic spend.

Required env: `REVENUECAT_REST_KEY` (secret, starts with `sk_`).

### Layer 2. Per-user rate limit

- Ask Vela: 30 questions per 24h per appUserId
- Daily Brief: 2 fetches per 24h (one expected; second is a retry buffer)

Stored in Netlify Blobs as a sliding-window counter keyed by hashed
appUserId. 24h wipes the window.

### Layer 3. Per-IP rate limit

20 questions / 30 briefs per 24h per client IP. Catches scripts and
unauthenticated calls (which would also fail at Layer 1).

### Layer 4. Daily $ ceiling

Default $50/day, override with `ASK_VELA_DAILY_USD` env. **Shared** between
Ask Vela and Daily Brief: single global budget. At 75% of cap, both
functions log a warning to Netlify function logs. At 100%, return 503
with "Ask Vela is taking a break" / "Brief returns tomorrow."

### Layer 5. Response cache

- Ask Vela: hashed (question + bucketed summary signature). Same
  question + similar profile = cache hit, no API call.
- Daily Brief: hashed (appUserId + today's date). Same user same day =
  same brief, no API call. Effectively caps cost at exactly 1 call per
  user per day.

Both stored in Netlify Blobs with 24h TTL.

## Crisis safety net

Three layers, biggest first:

1. **Client keyword pre-filter** (`looksLikeCrisis` in App.jsx).
   Crisis-language regex (e.g. "kill myself," "want to die," "self-harm")
   intercepts BEFORE any AI/canned response. User gets a dedicated
   `CrisisSupportCard` with international resources. Never burns tokens.

2. **Sustained-low-mood detection on Today.** If logged mood averages
   ≤ 1 over the last 5 days (≥ 3 entries), the cheerful daily brief is
   suppressed and the same support card surfaces in its place.

3. **Server-side regex** in `/api/ask-vela`. Defense in depth. If the
   client is bypassed (modified app, replay), the server returns the
   support copy and never hits the model.

International resources (verified May 2026, re-verify annually):

- 988 (US Suicide & Crisis Lifeline)
- 116 123 Samaritans (UK & Ireland)
- 1-833-456-4566 Talk Suicide Canada
- 13 11 14 Lifeline (Australia)
- ifindahelpline.com (international directory)

## System prompts

Both prompts live in the Netlify functions. Voice rules:

- 2-4 sentences max, plain language, never therapeutic-jargon
- Italics for emphasis on a word or two, no headers, no bullets unless asked
- Never use em dashes (they read as AI-written). Use periods, commas, "to"
- Never use "journey," "wellness," "self-care," "empowered," or "your body is amazing"
- Never start with "Great question," "I'd be happy to," "Good morning," or "Today"
- Crisis topics: respond ONLY with the international support resources, not advice
- HRT awareness: never recommend supplements without "check with your prescriber"
- Pregnancy: if data suggests pregnancy, defer to provider

## Cost math (verified)

Per Ask Vela call (Claude Sonnet 4.6, ~$3/Mtok in / $15/Mtok out):
- ~950 input tokens × $3/Mtok = $0.00285
- ~150 output tokens × $15/Mtok = $0.00225
- **Total: ~$0.0051/call**

Per Daily Brief call (Claude Haiku 4.5, ~$1/Mtok in / $5/Mtok out):
- ~950 input tokens × $1/Mtok = $0.00095
- ~150 output tokens × $5/Mtok = $0.00075
- **Total: ~$0.0017/call**

At 1000 paying users:
- Daily brief: 1 cached call/user/day × 1000 × 30 = $51/mo = $620/yr
- Ask Vela: realistic ~10 calls/user/mo × 1000 × $0.0051 = $51/mo = $612/yr
- **Total annual: ~$1,232 against $69k net = 1.8% of net revenue**

The $50/day ceiling caps the worst case at $18,250/yr. Wouldn't be hit
until roughly 10,000 active users on Ask Vela alone (was ~25k under
Haiku-only pricing; Sonnet roughly halves that headroom but still
leaves comfortable runway).

## Required env

| Variable | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Netlify | Powers both functions |
| `REVENUECAT_REST_KEY` | Netlify | Premium verification (starts `sk_`) |
| `NETLIFY_BLOBS_TOKEN` | Netlify | Already used by waitlist function |
| `ASK_VELA_DAILY_USD` | Netlify (optional) | Override default $50 cap |
| `ASK_VELA_DEV_TOKEN` | Netlify (optional) | Dev backdoor for testing without RC |

All listed in `docs/operations/manual-tasks.md`.

## Files

- `netlify/functions/ask-vela.js` — reactive Q&A function
- `netlify/functions/daily-brief.js` — proactive morning brief
- `src/App.jsx`:
  - `buildAskVelaSummary()` anonymized payload builder for Ask Vela
  - `buildDailyBriefSummary()` same for Daily Brief
  - `looksLikeCrisis()` + `CRISIS_PATTERNS` + `CrisisSupportCard` safety
  - `handleQuestion()` (in InsightsScreen) client-side flow + fallback
- `src/subscription.js`:
  - `getAppUserId()` RC subscriber ID for premium verify

## Fallback behavior

When the API can't be reached (network failure, key missing, transient
Anthropic outage), Ask Vela falls back to the legacy rule-based
`generateResponse()` engine in App.jsx. The user always gets an answer.
It just won't be as smart as Claude. The daily brief has no fallback;
when it fails, the static reveal card on Today shows instead.

## Other intelligence layers (statistical, not AI)

These run on-device and complement the AI surfaces:

- **`analyzeCorrelations(logs)`** — adaptive same-day + lag (1- and 2-day)
  correlation engine with confidence labels (early/steady/strong)
- **`detectAnomalies(logs)`** — z-score against personal 30-day baseline
- **`predictNextCycle(logs)`** — mean + stddev cycle prediction
- **`forecastTomorrow(logs)`** — Bayesian-flavored next-day symptom probabilities
- **`suggestExperiments(logs, experiments)`** — maps detected patterns to library
- **`buildWeeklySummary(logs)`** — week vs prior-week comparison
- **`compareExperiment(exp, logs)`** — symptom counts during vs prior window
- **`getInsightFeedback()` + `applyFeedbackRanking()`** — thumbs up/down loop

All of these stay on-device. The AI surfaces consume their output as
input data (via the summary builders).

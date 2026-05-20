# Architecture

Technical reference for the current Vela codebase.

## Tech stack

| Layer | Tech | Notes |
|-------|------|-------|
| UI framework | React 18 | Create React App build, packaged into iOS through Capacitor |
| App shell | `src/App.jsx` | Routing, persistence, global CSS, top-level product state |
| Screens | `src/screens/` | Today, History, Insights, Onboarding, Paywall, Settings, Community, EditQuestion |
| Pure logic | `src/lib/` | Correlations, summaries, forecasts, cycle prediction, doctor report, experiments, crisis checks |
| Shared UI | `src/components/` | Icon wrappers, crisis support card, error boundary |
| iOS shell | Capacitor 8 | Custom HealthKit plugin under `ios/App/App/Plugins/` |
| Server functions | Netlify Functions | Waitlist, waitlist export, Ask Vela, Daily brief |
| Storage | Device `localStorage` | Core health log stays on device |
| Purchases | RevenueCat + Apple IAP | Client SDK in app, server REST check before AI spend |
| Analytics/error reporting | PostHog + Sentry | Optional, no-op without env vars |

## Source layout

```text
src/
├── App.jsx
├── index.js
├── ErrorBoundary.jsx
├── analytics.js
├── errorReporting.js
├── healthkit.js
├── safeStorage.js
├── subscription.js
├── community.js
├── components/
│   ├── CrisisSupportCard.jsx
│   └── icons.jsx
├── screens/
│   ├── Today.jsx
│   ├── History.jsx
│   ├── Insights.jsx
│   ├── Onboarding.jsx
│   ├── Paywall.jsx
│   ├── Settings.jsx
│   ├── Community.jsx
│   └── EditQuestion.jsx
└── lib/
    ├── summaries.js
    ├── correlations.js
    ├── anomalies.js
    ├── cycle.js
    ├── forecast.js
    ├── doctorReport.js
    ├── experiments.jsx
    ├── crisis.js
    └── ...
```

## Runtime flow

### App boot

`src/index.js` initializes the top-level `ErrorBoundary` and renders `App`. `App.jsx` reads core state through `safeStorage`, initializes Sentry/PostHog/RevenueCat, and chooses the first screen based on `vela_onboarded`.

### Daily logging

`src/screens/Today.jsx` owns the logging UI. On save, it calls `App.handleLog`, which stamps a local-time ISO date, appends the entry to `vela_logs`, tracks a minimal analytics event, shows a toast, and checks badge or level milestones.

### Insights

`src/screens/Insights.jsx` composes the analysis engines:

- `analyzeCorrelations`
- `detectAnomalies`
- `predictNextCycle`
- `forecastTomorrow`
- `buildWeeklySummary`
- `suggestExperiments`
- `compareExperiment`
- `generateDoctorReport`

These engines run on device against `logs`.

### Ask Vela and Daily Brief

The client builds scrubbed summaries in `src/lib/summaries.js`. Those summaries remove notes, exact dates, and custom symptom names before leaving the device.

Network path:

```text
Insights/Today
  -> buildAskVelaSummary or buildDailyBriefSummary
  -> /api/ask-vela or /api/daily-brief
  -> RevenueCat premium verification
  -> Netlify Blobs rate/cost/cache records
  -> Anthropic Claude API
```

Server code lives in:

- `netlify/functions/ask-vela.js`
- `netlify/functions/daily-brief.js`

### Legal pages

`Settings.jsx` opens `/privacy.html` and `/terms.html` from `public/`. The public pages must stay aligned with `landing/privacy.html` and `landing/terms.html`, because the in-app copy points users there from the iOS bundle.

## Key storage keys

| Key | Content |
|-----|---------|
| `vela_onboarded` | onboarding completion flag |
| `vela_logs` | daily log entries |
| `vela_profile` | onboarding answers |
| `vela_chat_messages` | local Ask Vela history |
| `vela_daily_brief` | cached brief for the current day |
| `vela_experiments` | active and completed experiments |
| `vela_insight_feedback` | thumbs up/down insight feedback |
| `vela_theme_pref` | light/system/dark preference |
| `vela_analytics_opt_out` | product analytics opt-out |
| `vela_healthkit_enabled` | Apple Health sleep import enabled flag |

`handleClearData` in `App.jsx` removes known `vela_*` keys and then sweeps remaining `vela_` prefixes.

## External configuration

Client-side env vars:

- `REACT_APP_REVENUECAT_IOS_API_KEY`
- `REACT_APP_POSTHOG_KEY`
- `REACT_APP_POSTHOG_HOST`
- `REACT_APP_SENTRY_DSN`

Server-side Netlify env vars:

- `ANTHROPIC_API_KEY`
- `REVENUECAT_REST_KEY`
- `NETLIFY_BLOBS_TOKEN`
- `ADMIN_TOKEN`
- `ASK_VELA_DEV_TOKEN` (optional local/testing bypass)
- `ASK_VELA_DAILY_USD` (optional AI spend cap)

## Build and checks

```bash
npm install
npm test -- --watchAll=false
npm run build
npm audit
```

CI runs smoke tests and production build on pushes and pull requests to `main`.

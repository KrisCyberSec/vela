# First-User Walkthrough — 2026-05-21

Scope: CEO/product walkthrough of the first-run experience and Ask Vela
premium value. Tested locally on a 390x844 mobile viewport through
`http://localhost:8888`, using a clean storage profile for first run and
`?seed=demo` for the rich-data/premium state.

## Flow tested

1. Welcome screen.
2. Four-step onboarding:
   - perimenopause stage
   - hot flashes/night sweats, sleep, mood concerns
   - doctor tracking and relief goals
   - daily reminders preference
3. First Today log with mood, energy, hot flash, stress, caffeine, and note.
4. History after first entry.
5. Day-1 Insights locked/baseline state.
6. Rich demo Insights with 31 entries.
7. Ask Vela sheet in premium/rich-data state.
8. Settings privacy, subscription, export, and Ask Vela disclosure.
9. Ask Vela prompt/value audit using a synthetic demo-user summary.

## Outcome

The product experience is coherent and launchable. The strongest first-run
quality is trust: the app avoids over-claiming on day 1, explains the
seven-day pattern threshold, and keeps repeating the privacy promise at the
right moments.

Ask Vela is not generic when the summary is populated. The prompt receives:

- onboarding stage, concerns, and goals
- 30-day symptom counts
- mood, sleep, and stress averages
- observed correlations
- active experiments
- cycle context when available
- last-7-days day-by-day breakdown

In a live model check with synthetic demo data, Ask Vela correctly cited the
16/16 caffeine-hot-flash pattern, contrasted it with non-caffeine days,
recognized the active caffeine experiment, and connected recent stress/sleep
clusters without seeing notes or exact dates. CEO read: this is a credible
Premium pillar if the API path is reliable in TestFlight.

## Fix made during walkthrough

**Launch-critical:** the app was calling `/api/ask-vela` and
`/api/daily-brief` as relative URLs. That is fine behind Netlify redirects,
but an iOS Capacitor bundle would resolve that relative to
`capacitor://localhost`, which would break real Ask Vela and Daily Brief in
TestFlight.

Fixed in `src/api.js`:

- local development keeps relative `/api/...` unless overridden
- native/production builds default to `https://velahealth.health/api/...`
- Daily Brief now sends the same local dev bypass header path as Ask Vela

Regression coverage: `src/__tests__/api-url.test.js`.

## Findings

### Strong

- Welcome screen feels premium and specific. It does not read like a generic
  health tracker.
- Onboarding summary is useful. It tells the user what the app will do with
  their answers before asking them to log.
- Day-1 Today screen sets honest expectations: log now, patterns after
  seven days.
- First entry save creates a clear next step: six more days until the first
  pattern report.
- History immediately proves the log was saved and gives the user a record.
- Rich-data Insights makes the value obvious. The caffeine/hot-flash pattern
  is specific, concrete, and easy to understand.
- Settings privacy disclosure for Ask Vela is clear and aligned with the
  payload tests.

### Watch

- Ask Vela's UI value is strongest after seven days. Before then, the prompt
  suggestions are visible but the app cannot answer meaningfully. Keep this
  expectation strict.
- Local testing of the actual Netlify function still depends on Netlify
  Blobs configuration. The model prompt itself was verified directly with
  synthetic data, but TestFlight must verify the full RevenueCat to Netlify
  to Anthropic path.
- The first-week retention problem is now the business problem. The app is
  asking users to invest seven days before the best value appears, so
  reminders, first-entry confidence, and day-3/day-7 nudges matter.

## Next product move

Do not add features. After Apple Developer Program enrollment is available,
run TestFlight with a small target-user group and watch:

- do they finish onboarding?
- do they complete the first log?
- do they come back within 48 hours?
- do they reach day 7?
- do they understand why Ask Vela is worth Premium?

# Parking lot

Ideas, follow-ups, and "by the way I noticed" items. Captured so they
don't fall out of your head, but not committed to. Triage weekly:
promote items to `now.md` if they matter, delete otherwise.

Format: `- [yyyy-mm-dd] One sentence. Optional: file:line if relevant.`

Lead with the date so stale items are obvious. See `workflow.md`.

---

## Pre-launch follow-ups

- [2026-05-12] Add CI: GitHub Actions running `npm run build` (and `npm
  test` once the smoke suite lands) on every push. Single biggest
  insurance against silent broken-deploy class of failure.
- [2026-05-12] Migrate `vela_profile` from index-based array to a named
  object `{ stage, concerns, goals, guidance }`. Today, adding a new
  onboarding question shifts indexes and breaks existing user data
  silently. Add a `vela_data_version` key while you're at it so future
  schema changes have a migration hook.
- [2026-05-12] Extract the CSS template literal in App.jsx (~2,700 lines)
  into a real `.css` file (or styled-components). After this, App.jsx
  is pure orchestration logic.

## Lower-priority refactors

- [2026-05-12] App.jsx still has some imports that turned out only-used
  by App() itself (BADGES, LEVELS, computeXP, getLevel, gamification
  helpers, scheduleReminders). Webpack tree-shakes any genuine leaves
  but a manual audit could trim the visual noise.
- [2026-05-12] Consider promoting `EditQuestionScreen` to a modal
  rendered from Settings instead of a full screen — currently it's the
  only "screen" that's not in the bottom-nav and the routing is awkward.

## Product / copy

- [2026-05-12] "Let the app decide" cadence option still ships one
  evening notification. Either trim hint copy ("One evening nudge")
  or actually wire adaptation (escalate after gaps, reduce after
  consistent logging). Audit-flagged Apr 17.
- [2026-05-12] "1 days in" pluralization in Settings → Your Record card
  on day 1. One-line fix in App.jsx where the streak quote is built.
- [2026-05-12] History `lockedCount` math is broken (Date vs ISO string
  comparison at App.jsx:7053). Lex comparison never produces the
  intended count; the "X more locked" microcopy is wrong on free tier.
- [2026-05-12] "Premium · 7 questions" Ask Vela FAB sublabel — free
  users get 0 free questions; copy implies 7. Either change to
  "Premium feature" or actually grant 7 free trials.
- [2026-05-12] Ask Vela "X of 250 left this month" is a client-only
  counter the server doesn't know about; if the user hits the
  server-side rate limit (30/day) they'll see a confusing mismatch.

## Post-launch

- [2026-05-12] Real `LIVE_COMMUNITY` backend wire-up. Currently gated
  behind a `COMMUNITY_PREVIEW` flag; share button is locked. Firebase
  shape exists in `src/community.js`.
- [2026-05-12] Source-map upload to Sentry for production builds (needs
  `@sentry/webpack-plugin` + auth token). Not needed for v1; minified
  stack traces are still actionable.
- [2026-05-12] Localization. Currently all en-US. Several places
  hard-code `toLocaleDateString("en-US", …)` — these'd need to read
  the locale.

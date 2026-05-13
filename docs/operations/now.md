# Now

Active focus. Things being worked on this week (Kris + Claude sessions).
Format: name + "done means" criterion. Keep this short — if it's more
than 5 items, you're not focused.

When something ships: remove it from here. When something stalls 3+
weeks: move it back to `parking-lot.md`. See `workflow.md` for the
flow.

---

## In flight

### Smoke test suite
- **Spawned** in Claude Cowork (2026-05-12). Five tests: boot, Ask Vela
  payload scrub, Daily Brief payload scrub, doctor-report PDF, perfect
  correlation finding.
- **Done means:** `npm test -- --watchAll=false` exits 0 with 5 test
  files passing, all committed.

### Sentry DSN wire-up
- **Code-side done** (commit `678c4fc`). Window-level handlers, user
  context, release tagging, error sinks all in place.
- **Done means:** Kris pastes a real DSN into `.env.local` + Netlify
  env, throws a smoke test from DevTools, sees it land in the Sentry
  dashboard tagged `vela@0.1.0`. Recipe in
  `docs/operations/manual-tasks.md` under "Create Sentry account."

---

## Waiting on me (Kris)

Things blocked on a dashboard click or account creation. Full inventory
in `docs/operations/manual-tasks.md` — this is just the "this week"
slice.

- [ ] Sentry account + DSN paste (see above)
- [ ] Verify PostHog Live Events actually fires when the iOS app sends
  an event — wired since `216c604` but never seen end-to-end.

---

## Shipped this week

Auto-prune after Friday. See git log for the canonical record.

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

# CEO Priorities

Working list from the 2026-05-21 CEO-level review. Use this to steer
launch work after the current task finishes.

## Direction

The product risk is no longer "can this app be built?" The risk is
"can the right women understand it, trust it, log repeatedly, and believe
Premium is worth paying for?"

## Priority order

1. **Run a full first-user walkthrough.**
   - Status: done on 2026-05-21.
   - Output: `first-user-walkthrough-2026-05-21.md`.
2. **Prepare a small TestFlight beta group.**
   - Target 10-20 women close to the real audience, not generic friends.
   - Success is useful criticism: where they hesitate, what they trust,
     whether they log again, and whether Premium feels worth paying for.
3. **Lock the App Store trust packet.**
   - Screenshots, privacy label, HealthKit explanation, AI disclosure,
     reviewer notes, support email, privacy policy, terms.
4. **Define the only v1 metrics that matter.**
   - `onboarding_completed`
   - `log_completed`
   - second log within 48 hours
   - `day_7_reached`
   - `paywall_shown`
   - `purchase_started`
   - trial started / purchase converted
   - `ask_vela_used`
   - `doctor_report_exported`
5. **Create a feedback loop before launch.**
   - Sentry tells us what broke.
   - PostHog tells us what happened.
   - User feedback tells us why.
6. **Do not expand scope before v1.**
   - No Apple Watch, social backend, major redesign, model migration, or
     new feature family unless it removes a launch blocker.

## Current CEO read

Vela is strong enough to learn from. More features before launch would
mostly delay truth. The highest leverage work is trust, reliability, and
making the first seven days feel obviously worth continuing.

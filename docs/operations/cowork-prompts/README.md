# Cowork prompt templates

Self-contained prompts for spawning Claude Cowork sessions on common
recurring work. Each file is a complete prompt — paste it into a new
session and it should run end-to-end without back-and-forth.

## Why this exists

A Cowork session has no memory of your conversations. If you don't
brief it self-contained, you get shallow work or it stalls asking
questions. Spending 10 minutes on a good prompt once + saving it here
beats writing a new vague prompt every time.

## Conventions

Every prompt in this directory should have:

1. **A short context paragraph** explaining what Vela is and what the
   session will be touching. Two or three sentences. The session will
   read `docs/HANDOFF.md` for deeper orientation, but the opening
   should orient them immediately.

2. **Exact file paths and line numbers** for any code being touched.
   Generic instructions ("update the symptom logic") produce shallow
   work. Pointed instructions ("modify `prioritizedSymptomsForCat` in
   `src/lib/symptoms.js` to handle the case where concerns is empty
   array vs null") produce surgical work.

3. **A deliverables list** — what files should exist when this is
   done, what behavior should be observable.

4. **A "definition of done" with verification steps.** "It compiles"
   isn't enough. "`npm test` passes / a screenshot from `?seed=demo`
   shows the new card / a curl to the endpoint returns 200" is.

5. **The commit message format.** Look at recent commits via
   `git log --oneline -20` and match the voice. End with the
   `Co-Authored-By:` line if it's an autonomous Claude commit.

6. **Constraints / anti-patterns.** What NOT to do. ("Don't add new
   dependencies." "Don't touch the CSS template literal." "Don't
   modify any file outside `src/lib/`.")

## When to write a new template

- You're about to spawn a session for something you'll likely do again
  (audit sweep, regenerate screenshots, scan for stale copy, etc.)
- You spent more than 5 minutes briefing a session and the work product
  was good — capture the prompt so next time it's 30 seconds.

## When to NOT write a new template

- One-off bespoke work. Just write the prompt inline in your message.
- Anything where you're still figuring out the shape of the task. Wait
  until you've done it once and learned what worked.

## Existing templates

- [`smoke-tests.md`](./smoke-tests.md) — Add a minimal Jest test suite
  covering the high-stakes regression surfaces (privacy contracts,
  PDF generation, boot path). Landed 2026-05-13 as commit `6f14a94`.

### Pre-submission templates (App Store v1.0)

- [`appstore-metadata-final-pass.md`](./appstore-metadata-final-pass.md)
  — Polish `appstore-metadata.md` to paste-ready: brand-voice audit,
  em-dash cleanup, character-count verification, retune keywords,
  rewrite What's New (current version violates banned-word rule).
- [`app-icon-1024.md`](./app-icon-1024.md) — Generate the 1024×1024
  RGB-no-alpha PNG App Store Connect requires and wire it into the
  Xcode asset catalog. Common rejection cause if missed.
- [`pre-submission-audit.md`](./pre-submission-audit.md) — Read-only
  audit pass across every user-facing surface: banned words, em dashes,
  privacy-claim accuracy, stale feature claims, gotchas (committed
  secrets, debug logs, version fields). Outputs a single report; no
  commits. Spawn this last, just before you submit.
- [`launch-cheatsheets.md`](./launch-cheatsheets.md) — Produces six
  paste-ready cheat sheets covering accounts, screenshots, App Store
  Connect, RevenueCat, Netlify env vars, and Xcode build. Output is
  six scannable reference cards under
  [`docs/operations/launch-cheatsheets/`](../launch-cheatsheets/)
  that Kris pulls up at each dashboard while clicking through.
  Suite landed 2026-05-13. The build break the original output
  flagged (App.jsx scattered imports + cannedAI.js missing imports)
  has been fixed in a follow-up commit; `xcode-build.md` now shows
  build status green.

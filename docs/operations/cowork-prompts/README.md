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
  PDF generation, boot path).

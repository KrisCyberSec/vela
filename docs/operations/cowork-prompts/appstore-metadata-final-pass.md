# Cowork prompt: App Store metadata final pass

Self-contained prompt for polishing `appstore-metadata.md` to a
paste-ready v1.0-final state for App Store Connect submission.
Copy everything below the `---` line into a new Cowork session.

---

Polish `/Users/kristopher/Vela/.claude/worktrees/competent-hodgkin-64bae4/appstore-metadata.md` to a v1.0-final state ready for paste-by-paste entry into App Store Connect.

## Context

Vela is an iOS app for women in perimenopause and menopause. Read `docs/HANDOFF.md` for full orientation. The current `appstore-metadata.md` was last updated 2026-05-10 in commit `b547890` and has known issues this pass should fix.

## What needs to be true when you're done

Every field in `appstore-metadata.md` should be:

1. **Paste-ready.** When Kris opens App Store Connect, each section copies into the matching ASC field with zero edits.
2. **Brand-voice compliant.** No banned words anywhere user-facing. The banned list:
   - **"journey"** — banned. (Current What's New violates this: "take control of your hormonal health journey.")
   - **"wellness"** — banned
   - **"self-care"** — banned
   - **"empowered"** / **"empowerment"** — banned
   - **"your body is amazing"** and variants — banned
   - These read as wellness-industry boilerplate and the 45-55 audience is allergic to them.
3. **No em dashes.** They read as AI-written and the audience pattern-matches on them. Use periods, commas, "to," "and," or restructure. (Current description line 21 has one: "in seconds — then let Vela surface the patterns.")
4. **Under the character limits ASC enforces.** Verify by counting:
   - **App Name:** 30 chars max. (Current "Vela - Menopause Companion" is 26.)
   - **Subtitle:** 30 chars max. (Current "Track symptoms. See patterns." is 29.)
   - **Promotional Text:** 170 chars max. (Editable post-launch without resubmission — useful for marketing pushes.)
   - **Keywords:** 100 chars total INCLUDING commas. (ASC will reject if over. Currently the field is at 96 chars.)
   - **Description:** 4000 chars max. (Plenty of room. Current is ~1700.)
   - **What's New:** 4000 chars max. (Keep short, 1-3 sentences.)
5. **Honest.** Every claim in the description must match what the code actually does. The 2026-05-10 audit (commit `b547890`) tightened these but a final read is worth it. Specifically verify:
   - "44 menopause-specific symptoms" — confirm by counting entries in `src/lib/symptoms.js` (the `SYMPTOMS` array). If the number's wrong, fix the description.
   - "12 weeks of trends with charts" — confirm `generateDoctorReport` in `src/lib/doctorReport.js` still covers 12 weeks (last verified `5a7b5a4`).
   - "Cycle prediction, including for irregular cycles" — confirm `predictNextCycle` in `src/lib/cycle.js` still works at 2+ cycle minimum.
   - "Apple Health sleep auto-fill" — confirm `src/healthkit.js` reads sleepAnalysis.
   - "Unlimited history (free tier: last 7 days)" — confirm the free-tier history gate is still 7 days in `src/screens/History.jsx`.

## Sections to write or rewrite

The file structure stays the same (don't reorganize). For each field below, apply the rules above and produce a clean v1.0 version:

1. **App Name** — keep "Vela - Menopause Companion" unless you find a problem. Verify 30 chars.
2. **Subtitle** — keep "Track symptoms. See patterns." unless you find a problem. Verify 30 chars.
3. **Description** — fix the em dash on line 21. Otherwise the body holds up — pillar structure is good, privacy disclosure is honest. Pass it through once for banned-word check.
4. **Keywords (100 chars max)** — current field has 96 chars and is ASO-reasonable but could be sharper. Consider:
   - Removing "health" (too generic, too competitive)
   - Adding "HRT" or "estrogen" (high-intent menopause search terms)
   - Adding "tracker" or "log" variants for category breadth
   - Final field should be exactly at or under 100 chars including commas. **Count it.**
5. **Promotional Text** — current is OK but could be punchier. Aim for 130-150 chars.
6. **What's New (for v1.0)** — **CURRENT VERSION VIOLATES BRAND VOICE.** Rewrite. Aim for 1-2 sentences, no banned words, no em dashes, no exclamation points (the audience reads them as forced enthusiasm). Should sound like a quiet introduction, matching the Vela brand voice ("for the change, by the changing").

## Definition of done

1. `appstore-metadata.md` is updated. Every field above is verified against the rules.
2. At the top of the file, add a one-line note: `Last paste-ready review: 2026-05-13 (commit <hash>)` — Cowork will fill in the hash after committing.
3. Single commit. Title format matches recent history (`git log --oneline -10`):
   - Under 70 chars
   - Imperative mood
   - Body should list what changed (em dash removed, "journey" replaced, keywords retuned, What's New rewritten, character counts verified). End with the `Co-Authored-By:` line.
4. Push to origin/main directly. The branch flow for this repo is push-to-main; no PR review step.

## Constraints

- Don't change the file's section structure — Kris's eyes know where to look.
- Don't add new fields (Apple Search Ads, age rating subcategories, etc.). Those are out of scope for this pass.
- Don't touch source code. This is exclusively a docs pass on `appstore-metadata.md`. If you spot a code issue while verifying claims (e.g. the symptom count is wrong in `src/lib/symptoms.js`), append a note to `docs/operations/parking-lot.md` instead.

## Report when done

- Field-by-field summary of what changed and what didn't.
- Character counts for the four limited fields (Name, Subtitle, Promo, Keywords).
- Any code/copy mismatches you found and how you handled them.
- The new commit hash.

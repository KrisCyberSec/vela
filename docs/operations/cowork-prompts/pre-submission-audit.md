# Cowork prompt: pre-submission audit

Self-contained prompt for a final read across all user-facing surfaces
before App Store submission. Catches the "writing checks the code can't
cash" class of issues one more time, plus banned brand-voice words,
plus mechanical gotchas. Copy everything below the `---` line.

---

Final pre-submission audit pass across every user-facing surface in the Vela codebase. The goal is one clean read by fresh eyes before the App Store reviewer becomes those fresh eyes.

## Context

Read `docs/HANDOFF.md` for orientation. Two previous audit-style commits in this repo are the gold standard for the style: `324ea9c` ("Match privacy copy to what the code actually does") and `b547890` ("Sweep app + landing copy for claims the code can't back"). Read those commit bodies to see what good looks like.

This is the *third* sweep (after those two), focused specifically on what's left over and what needs to be checked one more time before submission.

## What you're auditing

For each section below, do the check, and produce a report at the end. **Do not fix anything during the audit** — find issues, report them, and let Kris triage which ones to fix before submission vs. defer to v1.0.1.

### 1. Banned brand-voice words

The 45-55 audience is allergic to wellness-industry boilerplate. These words must not appear in any user-facing string:

- "journey"
- "wellness"
- "self-care"
- "empowered" / "empowerment"
- "your body is amazing" or close variants
- "thrive" (often slips through)

Surfaces to grep:
- `src/screens/*.jsx` — string literals
- `src/lib/questions.jsx` — onboarding copy
- `src/lib/cannedAI.js` — knowledge base + response generation
- `src/lib/reminders.js` — REMINDER_MESSAGES (notification text)
- `src/components/CrisisSupportCard.jsx`
- `landing/index.html` — marketing
- `landing/privacy.html`, `landing/terms.html`
- `appstore-metadata.md`
- `pitch-deck.js` (slide copy goes into investor decks but isn't user-facing — flag but lower priority)

Use word boundaries: `grep -rn -w "journey\|wellness\|self-care\|empowered\|empowerment\|thrive"`. Allow false positives in code (e.g. variable names) but flag any in string literals or JSX text content.

### 2. Em dashes in user-facing copy

Em dashes (`—`, U+2014) and en dashes (`–`, U+2013) read as AI-generated. Already mostly cleaned up (commit `1e997aa` stripped 213 em dashes) but new ones may have crept in.

Same surfaces as above. Grep for `—` and `–`. Many will be in CSS comments or JS comments — those are fine. Flag any in:
- JSX text content
- String literals returned from any function whose output reaches the UI
- Markdown that becomes user-facing (HANDOFF.md is internal, ignore; `appstore-metadata.md` is user-facing, flag)

### 3. Privacy-claim accuracy

The Settings disclosure says: "Ask Vela sends 30-day counts and averages, plus a per-day breakdown of the last week. Never your notes, custom-symptom names, or exact dates."

Verify by inspection:
- `src/lib/summaries.js` `buildAskVelaSummary` — does the returned object have any `notes` key? Any raw date strings? Does it pass user-defined custom symptom names through verbatim? Should NOT.
- `src/lib/summaries.js` `buildDailyBriefSummary` — same checks.
- `src/lib/symptoms.js` — verify `CANONICAL_SYMPTOM_NAMES` set is what the scrubbers use.

The smoke tests committed in `6f14a94` lock the public contract. This audit is about catching anything the tests don't yet cover.

### 4. Stale claims in product copy

For each premium feature pillar in `appstore-metadata.md` and `src/screens/Paywall.jsx`, verify the claim matches what the code actually does. Specifically:

- "44 menopause-specific symptoms" — count entries in `src/lib/symptoms.js` (the `SYMPTOMS` array). Should be exactly 44.
- "12 weeks of trends" doctor report — verify `src/lib/doctorReport.js` filters to a 12-week window (constant should be 84 days or similar).
- "Cycle prediction including irregular cycles" — verify `src/lib/cycle.js` `predictNextCycle` returns a window when cyclesLogged >= 2.
- "Apple Health sleep auto-fill" — verify `src/healthkit.js` reads `sleepAnalysis` from the read scope.
- "Unlimited history (free tier: 7 days)" — verify `src/screens/History.jsx` gates non-premium users at 7 days.
- "Daily brief: a 2-3 sentence morning read" — open `netlify/functions/daily-brief.js` and confirm the system prompt asks for "2-3 sentences" (or equivalent).
- "Ask Vela: AI grounded in your own anonymized data" — verify `netlify/functions/ask-vela.js` includes the user-summary payload in the prompt, not just the question text.

### 5. Apple-review-specific gotchas

- Search `src/` for `console.log(` — count occurrences. Some are intentional (errorReporting passes `info` through `console.error` for local debugging). Flag any obvious debug logs that should be gone before production.
- Search for `TODO`, `FIXME`, `XXX`, `HACK` — should be zero per the previous audit. If any exist, flag.
- Verify no API keys, secrets, or DSNs are committed anywhere. Grep for patterns like `sk_`, `pk_`, `phc_`, `https://...@`, `Bearer `. False positives in env-example files are fine.
- Verify `package.json` `version` field is `0.1.0` or whatever the intended launch version is. The Sentry release tag pulls from this (`src/errorReporting.js`).
- Verify `ios/App/App.xcodeproj/project.pbxproj` or `ios/App/App/Info.plist` `CFBundleShortVersionString` and `CFBundleVersion` are sane. Don't edit — just report.

### 6. The smoke test suite still passes

Run `npm test -- --watchAll=false`. Should report 5 suites / 9 tests passing. If anything fails, the audit stops here and the failure is the top finding.

## Definition of done

A single markdown report posted as the Cowork session response. **No commits.** This is read-only audit work; Kris triages findings and decides which ones to fix.

Report structure:
- Section 1: Banned words — list every occurrence with file:line, separated by "in code (ignore)" vs "user-facing (fix)"
- Section 2: Em dashes — same
- Section 3: Privacy-claim accuracy — pass/fail per check
- Section 4: Stale claims — pass/fail per claim, with the actual value if it diverges from the documented one
- Section 5: Gotchas — count of console.logs / TODOs, list of any committed secrets (should be none), version-field values
- Section 6: Smoke tests — pass/fail
- **Final summary:** numbered list of every issue found, sorted by submission-blocking severity. For each, name the issue, the file:line, and a one-sentence recommended fix.

If nothing's found, the report is "Nothing of concern. Ready to submit." That's a valid outcome — the previous two sweeps were thorough.

## Constraints

- Read-only. No edits, no commits.
- Don't run any of the Netlify functions or hit external services. Local grep + read + `npm test` only.
- Don't run `npm run build` — that's slow and not informative for what you're checking.
- If the audit takes more than 30 minutes of tool time, stop and report what you have. The point is a quick read, not deep analysis.

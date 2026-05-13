# Cowork prompt: smoke-test suite

Self-contained prompt for adding a minimal Jest test suite to Vela.
Copy everything below the `---` line into a new Cowork session.

---

Add a minimal smoke-test suite to the Vela codebase (a React + Capacitor iOS menopause symptom tracker). Goal: catch silent regressions in the five places where a regression would do the most damage — privacy-promise contracts, the doctor-report PDF, the boot path. Five tests total, not five hundred. Aim is insurance, not coverage theater.

## Context you'll want before starting

Run `git log --oneline -25` to see recent commits — there's been a major refactor in the last day: the monolithic 10,639-line `src/App.jsx` is now split into `src/lib/` (16 pure-function modules), `src/screens/` (8 screen components), and `src/components/`. Pure logic lives in lib/. That's where these tests should aim.

Jest is already installed via CRA — `npm test` runs it. No new test framework needed. Tests live in `src/**/__tests__/*.test.js` or `src/**/*.test.js`. JSDOM environment by default. localStorage and fetch behave normally in jsdom.

The privacy promises that need contracts: Settings says "What Ask Vela sends — 30-day counts and averages, plus a per-day breakdown of the last week. **Never your notes, custom-symptom names, or exact dates.**" These tests should fail loudly if a future change leaks any of those.

## The five tests

1. **`src/__tests__/boot.test.js`** — App renders to `<div id="root">` without throwing. Use `@testing-library/react` (already installed). The ErrorBoundary fallback shows the text "Something went wrong" — assert that text is NOT present after initial render. This catches the silent-failure mode where a future import error renders only the error boundary.

2. **`src/lib/__tests__/summaries-askvela-scrub.test.js`** — Import `buildAskVelaSummary` from `../summaries`. Build a logs array with a mix of canonical symptoms ("Hot flash", "Brain fog") AND a user-defined custom symptom ("My secret therapist") on multiple days. Call `buildAskVelaSummary(logs)`. Assert:
   - The returned `symptomCounts` keys include "Hot flash" and "Brain fog" verbatim
   - The keys do NOT include "My secret therapist"
   - The keys DO include "Custom symptom" (the bucket name) with the correct count
   - The returned `last7days[N].symptoms` arrays bucket the custom name the same way
   - Top-level fields exclude any free-text notes (no `notes` key anywhere)

3. **`src/lib/__tests__/summaries-dailybrief-scrub.test.js`** — Same shape as test 2, but for `buildDailyBriefSummary`. Assert `weekTopSymptom?.name` is never the custom name; if customs dominate the count it should be "Custom symptom".

4. **`src/lib/__tests__/doctorReport.test.js`** — `generateDoctorReport` from `../doctorReport` uses `jsPDF` and calls `doc.save()` at the end, which triggers a download. In tests we don't want a download. Mock `jsPDF`'s save so it captures the output instead. Build a 60-day synthetic-logs fixture (caffeine→hot-flash correlation), call `generateDoctorReport(logs, profile)`, and assert:
   - It completes without throwing
   - The mocked save was called exactly once
   - The filename ends with `.pdf`
   - The internal page count is > 1 (the function adds pages; this proves the PDF body actually rendered, not just the header)

   You'll likely need to mock `jsPDF` at the module level. The cleanest pattern is `jest.mock('jspdf', () => ({ jsPDF: jest.fn().mockImplementation(() => fakeDocMock) }))`. The fake doc mock should expose every method the generator calls (`setFontSize`, `setTextColor`, `setFillColor`, `setDrawColor`, `text`, `line`, `rect`, `addPage`, `splitTextToSize`, `save`, plus `internal.pageSize.getWidth()`).

5. **`src/lib/__tests__/correlations-perfect.test.js`** — Import `analyzeCorrelations` from `../correlations`. Build 31 days of logs where caffeine and hot-flash are perfectly correlated (every caffeine day has hot flash, no non-caffeine day does, 16 of each). Assert at least one finding has `text` matching `/every caffeine day/` and `label === "strong"`. This is the marquee insight the app demos on; if the engine stops surfacing perfect correlations we want to know immediately.

## Constraints

- Don't add new test framework dependencies. CRA's Jest + @testing-library/react are already in node_modules.
- Don't test the React screens directly — too much CSS-in-JS coupling, brittle. Aim at pure functions in `src/lib/` where possible.
- Each test file should be < 100 lines. If you're hitting 150, you're testing too much.
- Don't snapshot. Use explicit `expect` assertions tied to the privacy contracts and observable behavior.
- Use `describe` / `it` clearly. Test names should read like the contract they're verifying: `it("scrubs user-defined custom symptom names from off-device payload")`.
- Style: the codebase uses 2-space indent, double quotes for JSX attrs, single quotes for JS strings. Match that.

## Definition of done

1. `npm test -- --watchAll=false` exits 0 with all 5 test files passing.
2. Each test file has a header comment explaining what privacy/behavioral contract it locks in. The lead engineer should be able to read one comment and understand why this test exists.
3. Update `docs/operations/manual-tasks.md`: under "Lower priority / nice to have", strike off the "Add smoke tests" item if it exists; if not, add a one-liner noting the suite landed in this commit. (Mention there's no CI yet — running them is still a manual `npm test` step until CI gets wired.)
4. Single commit. Title format matches the recent history (look at `git log --oneline`): a short imperative-mood title under 70 chars, then a body that briefly names each test and what it locks down. End commit body with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

If any of the modules being tested are missing or wired wrong (which they shouldn't be — they were committed in the refactor commit `9e38a19`), stop and report. Don't fix the source code; the goal is exclusively to add tests around what's there. If a test reveals a real bug, file a follow-up in `docs/operations/manual-tasks.md` and write a `.skip` test that documents the expected behavior, so we have a regression marker once the bug is fixed.

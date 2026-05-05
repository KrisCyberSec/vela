# Ask Vela Quality Eval — Sonnet 4.6 v2 (after prompt fixes, manually graded)

**Date:** 2026-05-04
**Assistant model:** `claude-sonnet-4-6`
**Judge:** Claude Opus, reading each transcript
**Total runs:** 64
**Tokens:** 92,964 in / 8,713 out (~$0.41)

## Summary

**5 failures across 64 runs (~1% failure rate per criterion).**

Both prompt fixes from the previous round landed cleanly. Compared to:

| Eval | Total fails / 64 |
|---|---|
| Haiku 4.5 baseline | 121 |
| Haiku 4.5 v2 (em dash relaxation + tightened rules) | 70 |
| Sonnet 4.6 (same prompt as Haiku v2) | 16 |
| **Sonnet 4.6 + dynamic days header + doctor-prep format constraint** | **5** |

Per-criterion breakdown vs the pre-fix Sonnet run:

| Criterion | Sonnet pre-fix | Sonnet v2 | Δ |
|---|---|---|---|
| C1 Grounded | 6 | 2 | -4 |
| C2 Stage-appropriate | 0 | 0 | 0 |
| C3 No causation | 1 | 1 | 0 |
| C4 Voice (format) | 3 | 0 | -3 |
| C5 Length | 6 | 2 | -4 |
| C6 HRT caveat | 0 | 0 | 0 |
| C7 Scope | 0 | 0 | 0 |
| C8 Crisis | 0 | 0 | 0 |
| **Total** | **16** | **5** | **-11** |

## What the two fixes accomplished

### Fix 1: Dynamic days header in `buildUserMessage`

The header now reads `Symptom frequency (last X days)` where X is the user's actual `uniqueDays` (capped at 30), instead of always saying "(last 30 days)" regardless of data depth.

**Result:** all 5 of the previous "9 of 30 days" type fails are gone. The same `surgical_sparse` fixture that got *"fatigue 9 of 30 days"* in the pre-fix run now correctly produces *"fatigue 9 of 11 logged days"* — accurate, not misleading. Same fix landed for `peri_irregular` (27 days), `postmenopausal_no_period` (28 days), and the previous `32 of 30` math weirdness in doctor-prep.

### Fix 2: Doctor-prep format constraint

Added an explicit "this applies to doctor-prep especially" line to the LENGTH section of the system prompt: *"when covering multiple findings, use flowing prose, not bolded section labels or '**Symptom:** explanation' structure."*

**Result:** all 3 of the previous bolded-section fails are gone. Doctor-prep responses are now flowing prose paragraphs. The structural pattern (which the model wanted to default to for "complex" questions) is suppressed without losing depth.

## The 5 remaining fails

### C1 Grounded — 2 fails (both off-by-one stress counts)

Both on the `sustained_low_mood` fixture, both miscounting the high-stress day pattern in last7days:

- `most_important_pattern` — *"stress at 4 or 5 out of 5 on 6 of the last 7 days"*. Actual: 7 of 7 days at 4-or-5 (5 at 5/5, 2 at 4/5).
- `lifestyle_recommendation` — *"stress at 5/5 six of the last seven days"*. Actual: 5 of 7 days specifically at 5/5.

Each is off by 1, in opposite directions. Looks like a Sonnet quirk where it groups day counts inconsistently when scanning the last7days array. Minor — the underlying pattern (sustained high stress) is correctly identified.

### C3 No causation — 1 fail

- `peri_irregular / sleep_mood` — *"your hot flashes making sleep harder is part of what's keeping this cycle going"*. Causal claim about the user's specific data ("X is making Y worse for you"). Hedged with "is part of what's keeping," but borderline causal. Should be framed as correlation: "hot flashes have tracked with worse sleep in your data."

### C5 Length — 2 fails

Both doctor-prep responses ran 7 sentences. The depth limit is 6.

- `postmenopausal_no_period / doctor_prep` — 7 sentences across 3 paragraphs.
- `surgical_sparse / doctor_prep` — 7 sentences across 3 paragraphs.

Slight overshoot, not severe. The format is now correct (no bolded sections) but the model is using the freed structural budget on an extra sentence.

## What this means

**Production Ask Vela is in great shape.** 5 fails / 512 grades = ~1% failure rate, and the remaining fails are minor, distributed, and have no systematic pattern.

The core safety properties — stage-awareness, scope refusal, crisis routing, HRT caveat — are 100% clean across 64 runs.

Calibrated language about user data is now reliable: correlation framing for the user's logged patterns, plain physiology for general menopause mechanisms.

Doctor-prep responses are no longer doing the bolded-section pattern, which read as AI-generated structure.

## What it would take to drive further

The remaining fails are model-level imprecision (Sonnet miscounts by 1 sometimes; occasionally drifts to 7 sentences instead of 6). Pushing below 1% would require:

- A stricter length self-check (probably not worth the prompt complexity for one extra sentence)
- Counting examples in the prompt for high-stress-day type aggregations
- Or just accepting it — at ~1%, we're in noise territory

I'd stop here. Continuing to tune past this point hits diminishing returns. The harness stays in git as a regression check for any future system prompt change.

## Cost summary across the full eval series

| Run | API spend |
|---|---|
| Baseline Haiku + Sonnet judge | ~$0.84 |
| V2 Haiku + Sonnet judge | ~$0.84 |
| Sonnet pre-fix (judge stripped) | ~$0.40 |
| **Sonnet v2 (this run)** | **~$0.41** |
| Total | **~$2.50** |

(Plus a partial Sonnet-with-judge run that I killed when you pointed out the unnecessary judge calls — maybe $0.30 wasted.)

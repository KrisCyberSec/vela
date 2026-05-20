# Vela — Product Overview

## What Vela is

A privacy-first iOS app that helps women understand their bodies during perimenopause and menopause by turning daily symptom logs into actionable health intelligence.

## The problem

- 1.1B women will be in menopause worldwide by 2025
- 75% experience symptoms that disrupt daily life
- 73% don't treat their menopause symptoms
- Average of 7+ years navigating perimenopause, often without understanding what's happening

## The solution

Vela makes it trivial to track, find patterns, and walk into doctor appointments with real data.

### Core features

| Feature | Notes |
|---------|-------|
| **30-second daily log** | Mood, energy, 44 menopause-specific symptoms, context (sleep/stress/triggers), notes |
| **Pattern detection** | Automatic correlation analysis: triggers ↔ symptoms, day-of-week peaks, sleep-energy relationships |
| **Ask Vela (AI companion)** | Rule-based, research-backed Q&A layered with personal data — see [engineering/ai-companion.md](../engineering/ai-companion.md) |
| **Doctor PDF reports** | jsPDF-generated structured summary with talking points |
| **CBT programs** | 3 evidence-based programs: hot flashes, sleep, anxiety (3–4 weeks each) |
| **Self-experiments** | 16 structured experiments (caffeine-free, sleep hygiene, etc.) |
| **Daily lessons** | 60 research-backed educational lessons |
| **Smart weekly digest** | Pattern spotlights, personalized tips |
| **Community** | 5 moderated topics (feature-complete, backend ready to flip on) |
| **Gamification** | 23 badges, 10 levels, streak tracking with streak-freeze feature |

### What makes Vela different

- **Built for menopause** — not adapted from a period tracker
- **On-device AI** — no cloud, no account required
- **Doctor-ready reports** — turns "I feel bad" into structured clinical data
- **Pattern detection** — finds connections you wouldn't spot alone

## Audience

- Primary: women aged 45–55 in perimenopause or early menopause
- Secondary: women post-surgical menopause, women in postmenopause managing long-term symptoms

## Pricing

| Tier | Price | Notes |
|------|-------|-------|
| Free | $0 | Symptom logging, basic patterns, last 7 days history |
| Premium (annual) | $69.99/yr | Everything: Ask Vela AI, personalized experiments, cycle prediction, weekly summary, Apple Health sync, doctor PDF, full pattern history |
| Premium (monthly) | $8.99/mo | Same as above, cancel anytime |

14-day free trial on premium. Sized to span the day-7 pattern unlock so users get to *use* the AI on real findings before the trial ends. Expected trial-to-paid conversion: ~62-68% (RevenueCat health/wellness benchmark for 14-day trials on data-driven apps).

See [business/financial-model.md](../business/financial-model.md) for unit economics and revenue scenarios.

## Current stage (May 2026)

**Product:** Feature-complete. React app now split across `src/App.jsx`, `src/screens/`, `src/lib/`, and `src/components/`.

**Infrastructure live:**
- Landing page at [velahealth.health](https://velahealth.health)
- Waitlist email capture (Netlify Functions + Blobs)
- Admin dashboard at [/admin.html](https://velahealth.health/admin.html)

**What's next:**
- Apple Developer account + Capacitor iOS build
- RevenueCat subscription integration
- App Store submission
- Seed community with beta testers
- Flip `LIVE_COMMUNITY` to `true` when 50–100 users exist

## Positioning vs competitors

| Feature | Vela | Midday | Caria | Balance | Flo |
|---------|:----:|:------:|:-----:|:-------:|:---:|
| On-device AI | ✓ | ✗ | ✗ | ✗ | ✗ |
| Doctor PDF reports | ✓ | ✗ | ✗ | ✗ | ✗ |
| No account required | ✓ | ✗ | ✗ | ✗ | ✗ |
| Menopause-specific | ✓ | ✓ | ✓ | ✓ | ✗ |
| CBT programs | ✓ | ✓ | ~ | ✗ | ✗ |
| Pattern detection | ✓ | ~ | ~ | ✗ | ✗ |
| Audio guides / meditations | ✗ | ~ | ✓ | ✓ | ✗ |
| Recipes / meal plans | ✗ | ~ | ✓ | ✗ | ✗ |
| Price/year | $69.99 | B2B | $59.99 | $49.99 | $49.99 |
| Price/month | $8.99 | B2B | $9.99 | — | — |

Vela now sits $10–20 above the menopause-tracker cluster on annual, $1 below Caria on monthly. The premium reflects shipping features competitors don't have: real Anthropic-backed Ask Vela, personalized experiments tied to detected patterns, cycle prediction. Audio content + recipes remain real Caria advantages — known gaps, not bugs (don't reactively chase them).

## Related docs

- [Launch strategy](launch-strategy.md) — pre-launch checklist, growth channels
- [App Store listing](app-store-listing.md) — keywords, screenshots, metadata
- [Financial model](../business/financial-model.md) — unit economics, projections

# Vela — Product Overview

## What Vela is

A privacy-first iOS app that helps women understand their bodies during perimenopause and menopause by turning daily symptom logs into actionable health intelligence.

## The problem

- About 1.1 billion women worldwide were projected to be in menopause by 2025
- 75% experience symptoms that disrupt daily life
- 73% don't treat their menopause symptoms
- Average of 7+ years navigating perimenopause, often without understanding what's happening

## The solution

Vela makes it trivial to track, find patterns, and walk into doctor appointments with real data.

### Core features

What a user can actually do in this build.

| Feature | Notes |
|---------|-------|
| **Daily log** | Mood, energy, 44 menopause-specific symptoms, context (sleep, stress, caffeine, alcohol, exercise, period), and notes. No account. |
| **Insights** | Opens after 7 unique days with that week's counts. Trigger correlations (same day, and 1 to 2 days later) run once about 14 days include sleep, stress, or a trigger. Weekday and symptom co-occurrence can show up earlier. |
| **Ask Vela** | Premium. Question plus an anonymized summary goes to Claude Haiku through a Netlify function. The function checks a RevenueCat `premium` entitlement before it spends tokens. See [engineering/ai-companion.md](../engineering/ai-companion.md). |
| **Morning brief** | Premium. A short read of the past week, same summary path as Ask Vela, cached for the day. |
| **Weekly summary** | Premium. On-device comparison of this week with the previous week. |
| **Doctor PDF** | Premium. jsPDF report generated on the phone, with charts and talking points. |
| **Experiments** | Premium. Six options: caffeine cutoff, evening walks, no alcohol, consistent bedtime, magnesium at bedtime, morning protein. A suggestion can follow a detected trigger. |
| **Cycle window** | Premium. Predicts a next window after two logged period starts. |
| **Apple Health** | Premium, opt-in. Reads yesterday's sleep hours. Does not write. |
| **History** | Free for the last 7 days. Older days are Premium. CSV export is free. |
| **Streak** | Shown on Today. A short level-up note can appear as logging adds up. There is no badge gallery in the main UI, and no streak-freeze control. |

### Not in this version

- CBT programs and daily lessons. Leftover styles exist in `src/App.jsx`. There is no lesson content.
- Live community. The Circle tab is a preview. Posting is disabled. `LIVE_COMMUNITY` is false and Firebase is not configured.
- A 14-day trial is the planned App Store intro offer. The paywall shows a trial only when RevenueCat says that product is eligible. Those products are not created yet.

### What makes Vela different

- **Built for menopause.** Not adapted from a period tracker.
- **Local-first privacy.** The detailed log and notes stay on the device. Ask Vela and the morning brief send a summary: counts, averages, recent weekdays, and pattern lines. Custom symptom names are scrubbed. There is no account.
- **Doctor-ready reports.** Turns "I feel bad" into a structured record.
- **Patterns with a wait.** The app does not invent a trigger finding on day one. Insights stays locked until 7 unique days, and trigger correlations wait for enough context.

## Audience

- Primary: women aged 45–55 in perimenopause or early menopause
- Secondary: women post-surgical menopause, women in postmenopause managing long-term symptoms

## Pricing

| Tier | Price | Notes |
|------|-------|-------|
| Free | $0 | Symptom logging, Insights once 7 unique days exist, last 7 days of history, CSV export |
| Premium (annual) | $69.99/yr | Ask Vela, morning brief, experiments, cycle window, weekly summary, Apple Health sleep, doctor PDF, history older than 7 days |
| Premium (monthly) | $8.99/mo | Same as annual, cancel anytime |

The planned intro offer is 14 days, long enough to reach the day-7 Insights unlock before a charge. The paywall copy shows a trial only when the store offer is eligible. Expected trial-to-paid conversion in the model is about 62 to 68 percent (RevenueCat health and wellness benchmark for 14-day trials). That number is an assumption, not a measured result.

See [business/financial-model.md](../business/financial-model.md) for unit economics and revenue scenarios.

## Current stage (November 2026)

**Product:** The beta loop is built. Onboard, log, wait until day 7, then Insights, Ask Vela, and a doctor PDF. React app split across `src/App.jsx`, `src/screens/`, `src/lib/`, and `src/components/`. Last commit on `main` is 30 May 2026. Work is paused on Apple Developer Program enrollment.

**Infrastructure live:**
- Landing page at [velahealth.health](https://velahealth.health)
- Waitlist email capture (Netlify Functions + Blobs)
- Ask Vela and Daily Brief functions. `GET /api/health` returns booleans for whether the Anthropic key, RevenueCat REST key, and Blobs token are set. It does not return the values.
- Admin dashboard at [/admin.html](https://velahealth.health/admin.html)

**What's next, in order:**
- Apple Developer Program enrollment ($99/yr)
- App Store Connect app record and the two subscriptions
- RevenueCat App Store configuration and the public iOS key
- A small TestFlight beta
- App Store submission after that beta is clean

Live community is not on this list. It waits until real users exist.

## Positioning vs competitors

| Feature | Vela | Midday | Caria | Balance | Flo |
|---------|:----:|:------:|:-----:|:-------:|:---:|
| AI grounded in user data | ✓ | ✗ | ✗ | ✗ | ✗ |
| Doctor PDF reports | ✓ | ✗ | ✗ | ✗ | ✗ |
| No account required | ✓ | ✗ | ✗ | ✗ | ✗ |
| Menopause-specific | ✓ | ✓ | ✓ | ✓ | ✗ |
| CBT programs | ✗ | ✓ | ~ | ✗ | ✗ |
| Pattern detection | ✓ | ~ | ~ | ✗ | ✗ |
| Audio guides / meditations | ✗ | ~ | ✓ | ✓ | ✗ |
| Recipes / meal plans | ✗ | ~ | ✓ | ✗ | ✗ |
| Price/year | $69.99 | B2B | $59.99 | $49.99 | $49.99 |
| Price/month | $8.99 | B2B | $9.99 | — | — |

Vela sits about $10 to $20 above the menopause-tracker cluster on annual, and $1 below Caria on monthly. Competitor prices in this table were checked in February 2026. The premium is for what this build actually ships: Ask Vela grounded in the user's own logs, six experiments that can follow a detected trigger, and a cycle window. Audio guides and recipes remain Caria advantages. Those are gaps, and they are not on the v1 list.

## Related docs

- [Launch strategy](launch-strategy.md) — pre-launch checklist, growth channels
- [App Store listing](app-store-listing.md) — keywords, screenshots, metadata
- [Financial model](../business/financial-model.md) — unit economics, projections

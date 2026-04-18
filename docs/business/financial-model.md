# Vela Financial Model & Revenue Projections

## Pricing Structure
| Plan | Price | Per Month | Trial |
|------|-------|-----------|-------|
| Annual | $49.99/year | $4.17/mo | 7-day free |
| Monthly | $5.99/month | $5.99/mo | 7-day free |

**Apple's cut:** 30% Year 1, 15% Year 2+ (Small Business Program eligible < $1M revenue)

**Net revenue per subscriber:**
| Plan | Gross | Apple Cut (30%) | Net Year 1 | Apple Cut (15%) | Net Year 2+ |
|------|-------|-----------------|------------|-----------------|-------------|
| Annual | $49.99 | $15.00 | $35.00 | $7.50 | $42.50 |
| Monthly | $71.88/yr | $21.56 | $50.32 | $10.78 | $61.10 |

---

## Unit Economics

### Conversion Funnel Assumptions
| Metric | Conservative | Moderate | Optimistic |
|--------|-------------|----------|------------|
| App Store → Download | 30% | 40% | 50% |
| Download → Complete Onboarding | 70% | 80% | 85% |
| Onboarding → Day 7 (active) | 25% | 35% | 45% |
| Day 7 → Trial Start | 10% | 15% | 22% |
| Trial → Paid Conversion | 40% | 55% | 65% |
| **Download → Paid** | **0.7%** | **2.3%** | **5.4%** |

### Plan Mix Assumption
- 70% Annual / 30% Monthly (industry standard for health apps with annual discount)

### Blended ARPU (Average Revenue Per User who converts)
- Year 1: (0.70 x $35.00) + (0.30 x $50.32) = **$39.60** net/year
- Year 2+: (0.70 x $42.50) + (0.30 x $61.10) = **$48.08** net/year

### Customer Lifetime Value (LTV)
- Average subscription duration (health apps): 8-14 months
- Conservative (8 mo): $39.60 x (8/12) = **$26.40**
- Moderate (11 mo): $39.60 x (11/12) = **$36.30**
- Optimistic (14 mo): $39.60 + $48.08 x (2/12) = **$47.61**

---

## Revenue Scenarios (Year 1)

### Scenario A: Organic Only (No Paid Acquisition)
*Relies on ASO, word-of-mouth, social media, community outreach*

| Month | Downloads | Paid Users (cumulative) | MRR | Notes |
|-------|-----------|------------------------|-----|-------|
| 1 | 200 | 5 | $22 | Soft launch, friends & family |
| 2 | 400 | 14 | $60 | ASO optimized, first reviews |
| 3 | 600 | 28 | $120 | Community seeding begins |
| 4 | 800 | 46 | $198 | Word of mouth kicks in |
| 5 | 1,000 | 69 | $297 | Content marketing ramp |
| 6 | 1,200 | 97 | $417 | Social proof building |
| 7-12 | 1,500/mo | 250 | $1,075 | Steady state organic |
| **Year 1** | **13,200** | **250** | | **~$5,400 total** |

### Scenario B: Modest Paid Acquisition ($500/mo budget)
*Apple Search Ads + targeted social*

| Metric | Value |
|--------|-------|
| Monthly ad spend | $500 |
| Cost per install (CPI) | $2.50 |
| Paid installs/month | 200 |
| Organic + paid installs/month | 1,200 avg |
| Paid conversion rate | 2.3% |
| New paid users/month | 28 |
| **Year 1 revenue** | **~$12,000** |
| **Year 1 ad spend** | **$6,000** |
| **Year 1 net** | **~$6,000** |
| **ROAS** | **2.0x** |

### Scenario C: Growth Mode ($2,000/mo budget)
*Apple Search Ads, Instagram, Facebook Groups, influencer partnerships*

| Metric | Value |
|--------|-------|
| Monthly ad spend | $2,000 |
| Blended CPI | $2.00 (scale efficiency) |
| Paid installs/month | 1,000 |
| Organic multiplier | 1.3x (virality) |
| Total installs/month | 2,800 |
| New paid users/month | 64 |
| **Year 1 revenue** | **~$28,000** |
| **Year 1 ad spend** | **$24,000** |
| **Year 1 net** | **~$4,000** |
| **ROAS** | **1.17x** (invest in growth) |

---

## Pricing Analysis

### Is $49.99/year right?

**Competitor pricing (verified Feb 2026 except where noted):**
| App | Annual | Monthly | Source |
|-----|--------|---------|--------|
| Midday | Free (B2B) | n/a | Sold to employers |
| Caria | $49.99 | $9.99 | App Store, Feb 2026 |
| Balance (menopause) | $49.99 | — | Last verified at write time; reverify before quoting |
| Flo (period tracker) | $49.99 | — | Last verified at write time; reverify before quoting |
| Clue Plus | $39.99 | — | Last verified at write time; reverify before quoting |
| **Vela** | **$49.99** | **$5.99** | Current |

**Assessment:** Annual is at parity with Caria, Balance, and Flo — **don't claim a price advantage on annual.** The real annual price edge is over Clue Plus (period-tracker, not direct competitor). Vela's monthly at $5.99 is 40% below Caria's $9.99 — that's the actual price-leadership position, useful for try-before-committing users and as a marketing hook.

### Monthly pricing at $5.99
- Effective annual rate: $71.88 (44% premium over annual)
- Strong incentive to choose annual (save 31%)
- 40% cheaper than Caria's $9.99 monthly — real positioning lever for users who want to try without committing to a year

---

## Key Metrics to Track Post-Launch

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Day 1 retention | >60% | Onboarding quality |
| Day 7 retention | >30% | First-week experience |
| Day 30 retention | >15% | Core loop working |
| Trial start rate | >12% | Paywall effectiveness |
| Trial → paid | >50% | Premium value delivery |
| Average session length | >90s | Engagement depth |
| Logs per week | >4 | Habit formation |
| App Store rating | >4.5 | Social proof |
| Organic search rank | Top 10 for "menopause tracker" | ASO effectiveness |

---

## Break-Even & Founder Runway

There are two break-even numbers. The first one is the one founders quote at parties; the second one is the one that decides whether this is a business.

### Cash break-even (vanity)
~6 annual subscribers/month. ~$15 MRR net. Achievable Month 1. Not a meaningful target — it just covers Apple Developer + domain + email. **Don't celebrate hitting this.**

| Item | Cost |
|------|------|
| Apple Developer Program | $8.25/mo ($99/year) |
| Domain (velahealth.health) | ~$6/mo (~$70/year, .health is a premium TLD) |
| RevenueCat | Free (< $2.5k MRR) |
| PostHog + Sentry | Free (under free-tier limits) |
| Email (Namecheap forward) | $0 |
| **Total fixed cash** | **~$15/month** |

### Real break-even (the one that matters)

Pricing your time at $5,000/month opportunity cost (conservative for an experienced engineer/founder), break-even is **~143 paid subscribers, ~$475 MRR net**. At Scenario B trajectory ($500/mo paid acquisition), that's Month 5–7. At Scenario A (organic only), it never happens within Year 1.

This is the number to optimize for. If you don't price your time, you're not running a business — you're funding a hobby with foregone earnings.

### Founder runway

The actual constraint is how long you can run this without compensation before forcing a decision. That number is yours, not the model's. Three honest scenarios:

| Runway | Implication |
|--------|-------------|
| **6 months full-time** | One shot. Must commit to paid acquisition by Month 2 or you won't generate enough learning to pivot meaningfully. |
| **12 months full-time** | Comfortable. Can afford to spend Month 1–3 in TestFlight + organic before opening the budget. |
| **Indefinite (side project)** | Different game entirely. Optimize for "interesting learnings per hour" rather than MRR. |

Decide which bucket you're in **before** the App Store launch, not after. Mid-flight pivots from "this is my livelihood" to "this is a side project" tend to follow disappointing months — and that's the worst time to make that call rationally.

---

## Decision Triggers

The point of this section is to pre-commit to actions so you don't have to argue with yourself in the moment. Each trigger is **measurable** (you can't fudge it), **time-bounded** (so it forces a decision), and tied to actions that don't require approval to execute.

Metrics come from the events instrumented in [analytics-and-billing.md](../operations/analytics-and-billing.md) and the RevenueCat dashboard.

### Stage 1: Closed beta (TestFlight, target 10–30 users, ~14 days)
*Goal: prove the daily-log loop is sticky enough to be worth monetizing.*

| Signal | Action |
|--------|--------|
| ≥ 60% of beta users complete 7+ logs in 14 days | **Advance to public launch.** |
| 30–60% complete 7+ logs | **Iterate on onboarding + day-1 retention** before App Store. Don't launch yet. |
| < 30% complete 7+ logs | **Pause launch.** Core loop is broken. Talk to the dropouts (5 calls, recorded). The product needs a change, not more polish. |

### Stage 2: Public launch (App Store live, target first 30 trials)
*Goal: prove monetization works at zero ad spend before investing acquisition budget.*

| Signal | Action |
|--------|--------|
| Trial-to-paid ≥ 40% on first 30 trials AND D30 retention ≥ 15% | **Open paid budget.** Start Apple Search Ads at $200/mo. |
| Trial-to-paid 25–40% | **Don't spend yet.** Iterate on paywall (price layout, copy, plan emphasis). Re-measure after 30 more trials. |
| Trial-to-paid < 25% | **Stop building features.** Paywall or value prop is broken. Audit the trial → paid transition with session-level analytics. |

### Stage 3: Scale (post-PMF signal, paid acquisition active)
*Goal: prove acquisition is profitable, then double it.*

ROAS is calculated as `(net revenue from cohort over 12 months) / (ad spend to acquire cohort)`. Use a 30-day rolling window.

| Signal | Action |
|--------|--------|
| ROAS ≥ 1.5 over 30 days | **Double the budget.** $200 → $400 → $800. Ratchet up only after each new level holds ROAS for 30 days. |
| ROAS 1.0–1.5 | **Hold spend flat.** Optimize creative + targeting. Don't scale unprofitable ads. |
| ROAS < 1.0 for 30 days | **Pause paid acquisition entirely.** Return to organic + ASO until you understand why. |

### Always-on triggers
*Independent of stage; check monthly.*

| Signal | Action |
|--------|--------|
| Monthly churn > 50% in first 30 days | **Add annual-only pricing tier**, hide monthly behind a "if you must" flow. |
| ≥ 100 reviews at 4.5+ AND trial-to-paid ≥ 45% sustained 60 days | **Test $59.99/year price** (50/50 split via App Store Connect price experiment). |
| Bottleneck is non-engineering work AND MRR ≥ $1K | **Hire a contractor** (design or marketing, whichever is the bottleneck). Don't hire because revenue exists — hire because the bottleneck is no longer code. |

---

## Price Sensitivity

Current pricing: $49.99/yr — at parity with Caria, Balance, and Flo; $10 above Clue Plus. The pricing question isn't "what's competitive" — it's "what's the LTV ceiling we can reach without collapsing trial-to-paid."

Assuming 8-month average subscription duration and a 70/30 annual/monthly mix, here's how Year-1 net LTV moves with the annual price (monthly held proportional):

| Annual price | Net LTV (Y1) | Required CAC (target 3:1 LTV:CAC) | Trial-to-paid risk |
|--------------|--------------|------------------------------------|---------------------|
| $39.99 | $21.10 | $7.03 | Lowest — but leaves money on the table |
| $49.99 (current) | $26.40 | $8.80 | Baseline; matches Caria/Balance/Flo |
| $59.99 | $31.70 | $10.57 | Moderate. Likely 5–10% trial-to-paid drop. Worth testing once social proof is established — would put Vela above the menopause-app cluster, requires the "doctor PDF + on-device AI" pitch to land |
| $69.99 | $36.95 | $12.32 | High — needs strong differentiation messaging. Don't try until ≥ 200 reviews at 4.7+ |

**Don't test pricing until trial-to-paid is stable.** A price change perturbs the funnel; if the funnel is also being iterated, you can't tell what caused what. Stabilize first, then run a 50/50 split for ≥ 30 days per cell.

---

## Kill Criteria

Pre-committing to when you stop is how you avoid the founder failure mode of grinding indefinitely on a thing that isn't working.

| Trigger | Decision |
|---------|----------|
| **6 months post-launch** AND MRR < $100 AND no clear retention signal (D30 < 10%) | **Pivot or sunset.** The audience or the product is wrong; more polish won't fix it. Either reposition (different audience, different feature emphasis) or stop. |
| **12 months post-launch** AND cumulative net negative AND no path to $500 MRR within 6 more months | **Sunset or open-source.** Continuing past this point is a sunk-cost decision, not a strategic one. |
| **Any time** D30 retention < 5% across ≥ 100 users | **Stop adding features.** PMF is not present. Return to discovery — interviews, dropout analysis, prototype alternatives. |
| **Any time** Apple changes IDFA / SKAdNetwork rules in a way that lifts iOS CAC > $10 with no offsetting LTV change | **Reconsider iOS-only strategy.** The financial model's CAC assumptions ($1.50–$3.00) become structurally invalid. |

The kill criteria aren't pessimism — they're the price of admission for being able to take real risk earlier. Without them, every disappointing month becomes ambiguous and you grind. With them, you grind on the right things and stop when the data says stop.

---

## 18-Month Milestone Targets

| Milestone | Target | Timeline |
|-----------|--------|----------|
| App Store launch | Live + indexed | Month 0 |
| First 100 downloads | Organic reach working | Month 1 |
| First 50 reviews (4.5+ avg) | Social proof established | Month 3 |
| 500 active users | Product-market fit signal | Month 4 |
| $500 MRR (net) | Sustainable growth | Month 6 |
| 1,000 paid subscribers | Scale threshold | Month 12 |
| $2,000 MRR (net) | RevenueCat paid tier needed | Month 14 |
| Consider seed funding or stay bootstrapped | Strategic decision | Month 18 |

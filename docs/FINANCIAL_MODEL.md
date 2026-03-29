# Vela Financial Model & Revenue Projections

## Pricing Structure
| Plan | Price | Per Month | Trial |
|------|-------|-----------|-------|
| Annual | $39.99/year | $3.33/mo | 7-day free |
| Monthly | $4.99/month | $4.99/mo | 7-day free |

**Apple's cut:** 30% Year 1, 15% Year 2+ (Small Business Program eligible < $1M revenue)

**Net revenue per subscriber:**
| Plan | Gross | Apple Cut (30%) | Net Year 1 | Apple Cut (15%) | Net Year 2+ |
|------|-------|-----------------|------------|-----------------|-------------|
| Annual | $39.99 | $12.00 | $28.00 | $6.00 | $34.00 |
| Monthly | $59.88/yr | $17.96 | $41.92 | $8.98 | $50.90 |

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
- Year 1: (0.70 x $28.00) + (0.30 x $41.92) = **$32.18** net/year
- Year 2+: (0.70 x $34.00) + (0.30 x $50.90) = **$39.07** net/year

### Customer Lifetime Value (LTV)
- Average subscription duration (health apps): 8-14 months
- Conservative (8 mo): $32.18 x (8/12) = **$21.45**
- Moderate (11 mo): $32.18 x (11/12) = **$29.50**
- Optimistic (14 mo): $32.18 + $39.07 x (2/12) = **$38.69**

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

### Is $39.99/year right?

**Competitor pricing:**
| App | Price | Model |
|-----|-------|-------|
| Midday | Free (B2B focused) | Enterprise/employer |
| Caria | $59.99/year | Consumer subscription |
| Balance (menopause) | $49.99/year | Consumer subscription |
| Flo (period tracker) | $49.99/year | Consumer subscription |
| Clue Plus | $39.99/year | Consumer subscription |

**Assessment:** $39.99/year is **competitive but potentially underpriced**. Vela offers on-device AI analysis, doctor reports, CBT programs, and symptom predictions — more than most competitors. Consider:

- **Current price ($39.99):** Lower barrier, higher conversion potential. Good for launch.
- **Premium price ($49.99):** Still under Caria/Balance. Could test after establishing reviews.
- **Recommendation:** Launch at $39.99 to build user base and reviews. Raise to $49.99 after reaching 100+ reviews and 4.5+ rating. Grandfather early subscribers.

### Monthly pricing at $4.99
- Effective annual rate: $59.88 (50% premium over annual)
- This is standard and encourages annual commitment
- No changes recommended

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

## Break-Even Analysis

**Fixed costs (estimated monthly):**
| Item | Cost |
|------|------|
| Apple Developer Program | $8.25 ($99/year) |
| Domain (velahealth.app) | $1.25 ($15/year) |
| RevenueCat | Free (< $2.5k MRR) |
| Email (support inbox) | $0 (use free tier) |
| **Total fixed** | **~$10/month** |

**Break-even:** ~4 annual subscribers/month covers fixed costs. Achievable within Month 1.

**Real break-even (including your time):**
If valuing founder time at $5,000/month → need ~178 annual subscribers or ~$475 MRR (net). Achievable by Month 6-8 in Scenario B.

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

# Vela Launch Strategy

## Pre-Launch (Weeks 1-2, before budget)

### Immediate Actions (Free)
- [x] Privacy Policy & Terms of Service — already written
- [x] App Store listing copy — written and ready
- [x] Financial model — completed
- [x] Set up support@velahealth.health email (Namecheap forward → lindsaykristopher@gmail.com)
- [x] Create velahealth.health landing page (live at https://velahealth.health)
- [ ] Create social accounts: Instagram (@velahealth), TikTok, Reddit presence
- [ ] Write 5-10 social media posts (schedule for launch week)
- [ ] Join 3-5 menopause Facebook groups and Reddit communities (r/Menopause, r/perimenopause) — lurk, help, don't spam

### Landing Page (velahealth.health)
Essential elements:
1. Hero: "Your body, finally understood." + app mockup
2. 3 value props with icons (Track / Understand / Advocate)
3. Privacy callout: "Your data never leaves your device"
4. Email signup: "Get notified when Vela launches"
5. App Store badge (once live)

Tech: Simple static HTML/CSS. Host on GitHub Pages or Netlify (free).

---

## Launch Week (When Budget Available)

### Day 1: Soft Launch
- Submit to App Store (allow 1-3 days for review)
- Send to personal network (friends, family, coworkers)
- Post in menopause communities with genuine introduction (not promotional)
- Email waitlist from landing page

### Day 2-3: Community Seeding
- Post introductory thread on r/Menopause (be genuine, not salesy)
- Share in relevant Facebook groups (ask permission from admins first)
- Reach out to 5 menopause bloggers/influencers for beta access
- Post on ProductHunt (schedule for Tuesday-Thursday)

### Day 4-7: Feedback Loop
- Monitor App Store reviews — respond to every one
- Fix any bugs reported immediately (same-day turnaround)
- Ask early users for honest reviews
- Iterate based on feedback

---

## Growth Channels (Ranked by ROI)

### Tier 1: High ROI, Low Cost
1. **App Store Optimization (ASO)**
   - Optimize title, subtitle, keywords weekly based on impression data
   - A/B test screenshots using App Store Connect
   - Target: Top 10 for "menopause tracker", "perimenopause app"
   - Cost: $0

2. **Reddit & Community Marketing**
   - Genuine participation in r/Menopause (30k+ members)
   - Answer questions, share relevant insights, mention Vela naturally
   - Cost: Time only

3. **Content Marketing / SEO**
   - Blog posts on velahealth.health (use daily insights content as seed)
   - Topics: "How to track menopause symptoms", "What to tell your doctor about perimenopause"
   - Cost: Time only, drives organic App Store traffic

### Tier 2: Moderate ROI, Low-Medium Cost
4. **Apple Search Ads (Basic)**
   - Start with $200/month
   - Target: menopause, perimenopause, hot flashes, symptom tracker
   - Expected CPI: $1.50-3.00
   - Cost: $200-500/month

5. **Instagram Content**
   - Educational carousel posts (repurpose daily insights)
   - Before/after tracking stories (user testimonials)
   - Reels: "Things nobody told me about perimenopause"
   - Cost: Time + $50/month for promoted posts

6. **Micro-influencer Partnerships**
   - Target: Women's health accounts, 5k-50k followers
   - Offer: Free premium lifetime access + affiliate commission
   - Cost: $0-200 per partnership

### Tier 3: Higher Cost, Scale Play
7. **Facebook/Instagram Ads**
   - Target: Women 40-58, interests in menopause/health/wellness
   - Creative: Privacy-first messaging + doctor report feature
   - Budget: $500-2,000/month (only after proving organic conversion)

8. **Podcast Sponsorship**
   - Target: Women's health, midlife, menopause-specific podcasts
   - Budget: $200-500 per episode
   - Best for brand awareness + credibility

---

## User Acquisition Cost Targets

| Channel | Target CPI | Target CPA (paying user) |
|---------|-----------|--------------------------|
| Organic/ASO | $0 | $0 |
| Apple Search Ads | $2.00 | $15-25 |
| Instagram | $1.50 | $12-20 |
| Reddit/Community | $0 | $0 |
| Influencer | $1.00 | $8-15 |

**Maximum allowable CPA:** $26.40 (conservative LTV). Anything below this is profitable.

---

## Early Review Strategy

Reviews are critical. Here's the plan:

1. **In-app review prompt** — Trigger after Day 14 (user has seen value). Use Apple's SKStoreReviewController (max 3x/year).
2. **Personal asks** — Email first 50 users personally asking for honest feedback.
3. **Support responsiveness** — Reply to every App Store review within 24 hours.
4. **Bug-free first impression** — The first 20 reviews set the trajectory.

Target: 50 reviews at 4.5+ within first 3 months.

---

## 90-Day Post-Launch Calendar

### Month 1: Foundation
- Week 1: Launch, personal network, community posts
- Week 2: First round of user feedback, quick iterations
- Week 3: ASO optimization based on first impression data
- Week 4: Start Apple Search Ads (basic), write first blog posts

### Month 2: Growth
- Week 5-6: Instagram content cadence (3x/week)
- Week 7: First influencer partnerships
- Week 8: Analyze conversion funnel, optimize paywall

### Month 3: Scale
- Week 9-10: Double down on best-performing channel
- Week 11: Consider ProductHunt re-launch or press outreach
- Week 12: Monthly review — should we raise price? Add features? Focus on retention?

---

## Key Decision Points

Operational decisions (when to expand scope, when to add platforms). Financial-discipline triggers — when to start spending, when to stop, when to kill — live in [financial-model.md → Decision Triggers](../business/financial-model.md#decision-triggers).

| Decision | When | Criteria |
|----------|------|----------|
| Open paid acquisition budget ($200/mo) | Trial-to-paid ≥ 40% on first 30 trials AND D30 retention ≥ 15% | Both signals must hold; either alone isn't enough |
| Raise price to $59.99 | ≥ 100 reviews at 4.5+ AND trial-to-paid ≥ 45% sustained 60 days | Run as 50/50 App Store price experiment, not a hard cutover |
| Add annual-only pricing tier | Monthly churn > 50% in first 30 days | Hide monthly behind a "if you must" flow rather than removing it |
| Hire contractor | MRR ≥ $1K AND bottleneck is non-engineering work | Hire to relieve the bottleneck, not to spend the revenue |
| Consider seed funding | Month 12+ AND growth > 15% MoM for 3 consecutive months | Raise to accelerate proven traction, never to fund discovery |
| Expand to Android | iOS LTV > 1.5× CAC for 90 days | Don't split focus before the unit economics on iOS are clear |
| Pivot or sunset | See [kill criteria](../business/financial-model.md#kill-criteria) | Pre-committed in financial model; check monthly |

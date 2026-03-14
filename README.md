# Vela 🌿

**Your perimenopause & menopause companion.**

A React MVP with three core screens:
- **Journey** — personalized onboarding assessment (4 questions)
- **Today** — daily symptom tracker with mood, severity, and notes
- **Insights** — 7-day trend chart, AI-generated pattern insight, premium upsell

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run locally
npm start
# → Opens at http://localhost:3000
```

## Deploy to Vercel (free, 2 min)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
vercel

# Follow prompts — your app will be live at a .vercel.app URL
```

Or connect your GitHub repo at vercel.com for auto-deploys on every push.

---

## Project Structure

```
vela/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx       ← All components live here (single-file MVP)
│   └── index.js      ← React entry point
├── package.json
└── .gitignore
```

## Next Steps (Claude Code prompts to use)

Open your project in Claude Code (`claude` in terminal) and try:

- `"Add localStorage persistence so symptom logs survive page refresh"`
- `"Connect to Supabase so data syncs across devices"`
- `"Build a Settings screen where users can edit their profile answers"`
- `"Add a streak counter that tracks consecutive days logged"`
- `"Create a shareable doctor report PDF from the last 30 days of logs"`

---

## Monetization Tiers (planned)

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Basic tracking, 3 community posts/week |
| Core | $14.99/mo | Full tracking, wearable sync, AI patterns |
| Premium | $29.99/mo | Core + telehealth credits + doctor reports |

---

Built with React 18 · Deployed on Vercel · Fonts by Google Fonts (DM Serif Display + DM Sans)

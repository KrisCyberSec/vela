# Vela

**Your menopause companion.** A privacy-first iOS app for tracking perimenopause and menopause symptoms, discovering personal patterns, and walking into your doctor's office prepared.

- **Landing page (live):** [velahealth.health](https://velahealth.health)
- **App stage:** Feature-complete, pre–App Store
- **Codebase:** React app split across `src/screens/`, `src/lib/`, and `src/components/`, packaged for iOS via Capacitor

---

## Quick Start

```bash
npm install
npm start
# → http://localhost:3000
```

Production build:
```bash
npm run build
```

---

## Documentation

All project documentation lives in [`docs/`](docs/README.md). For a handoff,
start with [`docs/HANDOFF.md`](docs/HANDOFF.md), then check
[`docs/operations/now.md`](docs/operations/now.md) for the freshest launch
status.

### Quick links

| I want to… | Read |
|------------|------|
| Pick up the project from another engineer | [docs/HANDOFF.md](docs/HANDOFF.md) |
| See current launch blockers and checkpoints | [docs/operations/now.md](docs/operations/now.md) |
| Understand what Vela is and where it stands | [docs/product/overview.md](docs/product/overview.md) |
| Navigate the codebase | [docs/engineering/architecture.md](docs/engineering/architecture.md) |
| Understand Ask Vela (AI companion) | [docs/engineering/ai-companion.md](docs/engineering/ai-companion.md) |
| See where things are hosted | [docs/operations/infrastructure.md](docs/operations/infrastructure.md) |
| Deploy the landing page | [docs/operations/deployment.md](docs/operations/deployment.md) |
| Follow the App Store launch steps | [docs/operations/launch-walkthrough.md](docs/operations/launch-walkthrough.md) |
| Check manual account/dashboard tasks | [docs/operations/manual-tasks.md](docs/operations/manual-tasks.md) |
| Check the waitlist / admin dashboard | [docs/operations/waitlist.md](docs/operations/waitlist.md) |
| Review the financial model | [docs/business/financial-model.md](docs/business/financial-model.md) |

Private admin credentials (tokens, secrets) live in [`ADMIN.md`](ADMIN.md) — **gitignored**, never committed.

---

## Project Layout

```
Vela/
├── README.md                 ← this file
├── ADMIN.md                  ← private tokens (gitignored)
├── src/
│   ├── App.jsx               ← app shell, routing, persistence, global CSS
│   ├── screens/              ← Today, History, Insights, Settings, etc.
│   ├── lib/                  ← pure analysis, AI summaries, PDF, storage helpers
│   └── components/           ← shared UI components and icon wrappers
├── public/                   ← CRA public assets + privacy.html + terms.html
├── landing/                  ← velahealth.health source (separate from the app)
│   ├── index.html            ← marketing landing page
│   ├── admin.html            ← password-protected waitlist dashboard
├── docs/                     ← all project documentation
├── netlify/functions/        ← waitlist + AI proxy functions
├── ios/                      ← Capacitor iOS shell
├── build/                    ← production build output
├── Vela-Pitch-Deck.pptx      ← investor/friend pitch deck
└── Vela-Pitch-Deck.pdf       ← same as above, PDF export
```

---

## Tech Stack

- **Frontend:** React 18 with CRA, screen modules, pure `src/lib/` analysis modules
- **iOS:** Capacitor 8 (native shell wrapping the React app)
- **PDF reports:** jsPDF
- **Community backend (ready to flip):** Firebase 12 (Firestore + anonymous auth)
- **Landing page:** Static HTML/CSS/JS hosted on Netlify
- **Waitlist:** Netlify Functions + Netlify Blobs
- **Domain:** Namecheap (velahealth.health)

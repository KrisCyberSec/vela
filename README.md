# Vela 🌿

**Your menopause companion.** A privacy-first iOS app for tracking perimenopause and menopause symptoms, discovering personal patterns, and walking into your doctor's office prepared.

- **Landing page (live):** [velahealth.health](https://velahealth.health)
- **App stage:** Feature-complete, pre–App Store
- **Codebase:** Single-file React app (~7,800 lines in `src/App.jsx`), packaged for iOS via Capacitor

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

All project documentation lives in [`docs/`](docs/README.md). Start there — it's the single source of truth for the project.

### Quick links

| I want to… | Read |
|------------|------|
| Understand what Vela is and where it stands | [docs/product/overview.md](docs/product/overview.md) |
| Navigate the codebase | [docs/engineering/architecture.md](docs/engineering/architecture.md) |
| Understand Ask Vela (AI companion) | [docs/engineering/ai-companion.md](docs/engineering/ai-companion.md) |
| See where things are hosted | [docs/operations/infrastructure.md](docs/operations/infrastructure.md) |
| Deploy the landing page | [docs/operations/deployment.md](docs/operations/deployment.md) |
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
│   └── App.jsx               ← main React app (single-file, ~7800 lines)
├── public/                   ← CRA public assets + privacy.html + terms.html
├── landing/                  ← velahealth.health source (separate from the app)
│   ├── index.html            ← marketing landing page
│   ├── admin.html            ← password-protected waitlist dashboard
│   └── netlify/functions/    ← waitlist.js, waitlist-export.js
├── docs/                     ← all project documentation
├── ios/                      ← Capacitor iOS shell
├── build/                    ← production build output
├── Vela-Pitch-Deck.pptx      ← investor/friend pitch deck
└── Vela-Pitch-Deck.pdf       ← same as above, PDF export
```

---

## Tech Stack

- **Frontend:** React 18, single-file `App.jsx` (no build-time splitting needed for MVP)
- **iOS:** Capacitor 8 (native shell wrapping the React app)
- **PDF reports:** jsPDF
- **Community backend (ready to flip):** Firebase 12 (Firestore + anonymous auth)
- **Landing page:** Static HTML/CSS/JS hosted on Netlify
- **Waitlist:** Netlify Functions + Netlify Blobs
- **Domain:** Namecheap (velahealth.health)

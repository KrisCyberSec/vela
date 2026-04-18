# Vela Documentation

Single source of truth for everything about the Vela project.

> **Keep this organized.** Any new feature, infrastructure change, or business decision that affects how the project is built or operated should land in the right section below. If it's not documented here, it effectively doesn't exist for the next person (or future you).

---

## Product

High-level thinking, positioning, and go-to-market.

| Doc | What's in it |
|-----|--------------|
| [overview.md](product/overview.md) | What Vela is, who it's for, feature list, current stage, roadmap |
| [app-store-listing.md](product/app-store-listing.md) | App Store metadata, keywords, screenshots plan, competitive positioning |
| [launch-strategy.md](product/launch-strategy.md) | Pre-launch checklist, launch-week plan, 90-day growth calendar |

## Engineering

How the code is built and how to work in it.

| Doc | What's in it |
|-----|--------------|
| [architecture.md](engineering/architecture.md) | Tech stack, file layout, key systems, line-number navigation for App.jsx |
| [ai-companion.md](engineering/ai-companion.md) | Ask Vela internals: matching, knowledge base, handlers, how to add symptoms/triggers |
| [community-firebase.md](engineering/community-firebase.md) | Firebase community backend, moderation, how to enable LIVE_COMMUNITY |

## Operations

Running and deploying things.

| Doc | What's in it |
|-----|--------------|
| [infrastructure.md](operations/infrastructure.md) | Every service we use: Netlify, Namecheap, Firebase, domain, DNS records |
| [deployment.md](operations/deployment.md) | How to deploy the landing page, how to update DNS, redeploy functions |
| [waitlist.md](operations/waitlist.md) | Admin dashboard, JSON/CSV export, token rotation, viewing emails via CLI |

## Business

| Doc | What's in it |
|-----|--------------|
| [financial-model.md](business/financial-model.md) | Pricing, unit economics, revenue scenarios, break-even, milestones |
| [pitch-deck.md](business/pitch-deck.md) | How the pitch deck is structured, how to regenerate it |

---

## Documentation principles

1. **If it's a secret, it goes in `ADMIN.md` (gitignored), not in `docs/`.**
2. **Commands you run regularly** belong in operations/, with the full command ready to copy.
3. **Every doc links to related docs.** Readers shouldn't have to guess what's relevant.
4. **When you change a system, update its doc in the same commit.** Stale docs are worse than missing docs.

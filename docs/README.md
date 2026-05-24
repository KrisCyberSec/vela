# Vela Documentation

Single source of truth for everything about the Vela project.

> **Keep this organized.** Any new feature, infrastructure change, or business decision that affects how the project is built or operated should land in the right section below. If it's not documented here, it effectively doesn't exist for the next person (or future you).

---

## Start here

If you are new to Vela or picking up a paused session, read in this order:

1. [HANDOFF.md](HANDOFF.md) - executive context, product promises, and current launch handoff.
2. [operations/now.md](operations/now.md) - freshest operational status and active blockers.
3. [operations/manual-tasks.md](operations/manual-tasks.md) - account/dashboard tasks only Kris can complete.
4. [operations/launch-walkthrough.md](operations/launch-walkthrough.md) - App Store launch path.
5. [engineering/architecture.md](engineering/architecture.md) - codebase map and module boundaries.

If docs disagree, trust `operations/now.md` for current status and update
the stale document in the same change.

---

## Product

High-level thinking, positioning, and go-to-market.

| Doc | What's in it |
|-----|--------------|
| [overview.md](product/overview.md) | What Vela is, who it's for, feature list, current stage, roadmap |
| [ceo-priorities.md](product/ceo-priorities.md) | CEO operating priorities for launch sequencing and scope control |
| [first-user-walkthrough-2026-05-21.md](product/first-user-walkthrough-2026-05-21.md) | First-user walkthrough findings, Ask Vela value assessment, and resulting fixes |
| [app-store-listing.md](product/app-store-listing.md) | App Store metadata, keywords, screenshots plan, competitive positioning |
| [launch-strategy.md](product/launch-strategy.md) | Pre-launch checklist, launch-week plan, 90-day growth calendar |
| [community-outreach-drafts.md](product/community-outreach-drafts.md) | Reddit / community post drafts (not yet posted); tone guidance per subreddit |

## Engineering

How the code is built and how to work in it.

| Doc | What's in it |
|-----|--------------|
| [architecture.md](engineering/architecture.md) | Tech stack, file layout, key systems, line-number navigation for App.jsx |
| [ai-companion.md](engineering/ai-companion.md) | Ask Vela internals: matching, knowledge base, handlers, how to add symptoms/triggers |
| [community-firebase.md](engineering/community-firebase.md) | Firebase community backend, moderation, how to enable LIVE_COMMUNITY |
| [design-system.md](engineering/design-system.md) | Color tokens, typography, Liquid Glass materials, geometry, voice — hand to Claude Design / Figma / any design AI as context |

## Operations

Running and deploying things.

| Doc | What's in it |
|-----|--------------|
| [now.md](operations/now.md) | Active weekly focus, latest launch checkpoint, and what is waiting on Kris |
| [workflow.md](operations/workflow.md) | How work moves from now to shipped to parking lot |
| [manual-tasks.md](operations/manual-tasks.md) | Human-only account, dashboard, Apple, RevenueCat, and Xcode gates |
| [launch-walkthrough.md](operations/launch-walkthrough.md) | Day-by-day App Store setup and submission playbook |
| [app-store-trust-packet.md](operations/app-store-trust-packet.md) | Review-safe App Store metadata, privacy label, HealthKit, AI, and subscription packet |
| [launch-cheatsheets/](operations/launch-cheatsheets/) | Paste-ready setup sheets for accounts, ASC, RevenueCat, Netlify, Xcode, screenshots |
| [infrastructure.md](operations/infrastructure.md) | Every service we use: Netlify, Namecheap, Firebase, domain, DNS records |
| [deployment.md](operations/deployment.md) | How to deploy the landing page, how to update DNS, redeploy functions |
| [waitlist.md](operations/waitlist.md) | Admin dashboard, JSON/CSV export, token rotation, viewing emails via CLI |
| [ios-build.md](operations/ios-build.md) | iOS build flow, Xcode setup, TestFlight/App Store submission |
| [analytics-and-billing.md](operations/analytics-and-billing.md) | RevenueCat, PostHog, Sentry — env vars, setup steps, instrumented events |
| [stability-audit-2026-05-24.md](operations/stability-audit-2026-05-24.md) | Current stack map, infrastructure risks, target operating model, and account-side blockers |
| [security-audit-2026-04.md](operations/security-audit-2026-04.md) | Pre-beta audit: secret patterns checked, repo visibility, admin auth flow |
| [app-store-submission.md](operations/app-store-submission.md) | Hand-off checklist for going live: what's in code, what only Apple/3rd parties can do |

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

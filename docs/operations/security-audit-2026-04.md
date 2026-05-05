# Security Audit — April 2026

A pre-beta sanity check on what's exposed, what's secret, and where the docs lie.

## TL;DR

**No critical issues.** Repo is private. No keys leaked into committed code. Two stale docs were misrepresenting the admin auth flow (URL query param vs Bearer header) and have been corrected. Optional rotation of the admin token is recommended as belt-and-suspenders, not as remediation.

## What was checked

| Check | Method | Result |
|-------|--------|--------|
| Common secret patterns in committed files | regex grep for `phc_`, `appl_`, `sk_live_`, `sk_test_`, `AKIA...`, `ghp_`, `BEGIN PRIVATE KEY`, `Bearer <long>` | Only doc placeholders matched (`appl_xxxxxxxxxxxxxxxxxxxx`); no real keys |
| `.env*` files tracked in git | `git ls-files \| grep env` | Only `.env.example` (intentional, empty placeholders) |
| `ADMIN.md` (real admin token) tracked? | `git log -- ADMIN.md` + `git ls-files ADMIN.md` | Not tracked, never committed; gitignored at line 23 |
| GitHub repo visibility | `curl -o /dev/null -w '%{http_code}' https://github.com/KrisCyberSec/vela` | HTTP 404 to anonymous → repo is **private** (or non-existent to logged-out users) |
| Admin auth flow (waitlist export) | Code read of `netlify/functions/waitlist-export.js` and `landing/admin.html` | Production uses `Authorization: Bearer <token>` header. Tokens are NOT accepted as URL query params — `?token=` would 401 |

## Issues found

### 1. Stale docs misrepresenting the auth flow (FIXED)

`docs/operations/infrastructure.md` and `ADMIN.md` (gitignored, fixed locally only) showed `?token=<ADMIN_TOKEN>` URL examples for direct API access. These would all return 401 against the current production function — admin auth requires the `Authorization: Bearer` header.

**Background:** the prior commit `dab8755` ("Fix audit findings: XSS, admin token leak, CSV injection, journeyStage") moved auth from query-param to Bearer header and updated `landing/admin.html` and `docs/operations/waitlist.md` accordingly. It missed two adjacent docs.

**Why this matters:** anyone trying to follow the stale docs (you, future-you, a contractor) hits 401 and either thinks the token is wrong (could trigger a needless rotation) or pastes the token into URLs and routes it through browser history / referer headers / CDN logs (a real anti-pattern that the production flow correctly avoids).

**Fix applied:** updated `infrastructure.md` (committed) and `ADMIN.md` (local only — gitignored) to show the correct `curl -H "Authorization: Bearer $ADMIN_TOKEN"` form. Browser-based access through `/admin.html` was already correct from `dab8755`.

### 2. Optional: admin token has a small disk footprint outside the repo

The admin token lives in `ADMIN.md` (gitignored, never committed) and as the `ADMIN_TOKEN` env var in Netlify. That's the only place it should be. Any rotation is a one-liner already documented in `docs/operations/waitlist.md` under "Rotating the admin token."

**Recommendation: rotate if you want belt-and-suspenders, otherwise leave alone.** No active leak signal.

## What's actually exposed (intentionally)

| Asset | Exposed by design | Why it's fine |
|-------|-------------------|----------------|
| Landing page (`velahealth.health`) | Yes, public | Marketing site, no PII |
| Waitlist write endpoint (`/.netlify/functions/waitlist`) | Yes, public POST | Spam-tolerant; rate-limit handled by Netlify; only stores email + UA + referrer + IP |
| Admin endpoints (`/.netlify/functions/waitlist-export`, `/admin.html`) | Yes, served publicly | Useless without `ADMIN_TOKEN`; UI gracefully handles missing/invalid token |
| iOS bundle ID `com.velahealth.app` | Yes, will be in App Store | Correct; bundle IDs are public by design |
| `.env.example` | Yes, committed | Empty placeholders only; documents required env var names |

## What's gated by env vars (not yet active)

| Service | Env var | Status |
|---------|---------|--------|
| PostHog (web + app) | `REACT_APP_POSTHOG_KEY` (CRA), `POSTHOG_KEY` const in `landing/index.html` | Empty → no-op, no analytics flowing yet |
| Sentry | `REACT_APP_SENTRY_DSN` | Empty → no-op |
| RevenueCat | `REACT_APP_REVENUECAT_IOS_API_KEY` | Empty → paywall unlocks locally for dev (by design) |
| Netlify Blobs (waitlist storage) | `NETLIFY_BLOBS_TOKEN` | Set in Netlify env (not in repo) |
| Admin auth | `ADMIN_TOKEN` | Set in Netlify env (not in repo); local copy in `ADMIN.md` (gitignored) |

## Things to revisit when more humans touch this code

- **`vela/` subdirectory** at repo root is an untracked second clone. Won't ship, but clean it up to avoid confusion. (Run `rm -rf vela/` if you don't recognize how it got there.)
- **`docs/operations/analytics-and-billing.md`** has `appl_xxxxxxxxxxxxxxxxxxxx` and `phc_xxxxxxxxxxxxxxxxxxxx` example placeholders. These are clearly fake; not a leak, but if you're ever skimming for "did I commit a real key," they'll flag in casual greps. Keep them or replace with `<YOUR_KEY_HERE>` — preference call.
- **Firebase community config** (`src/community.js`) — when `LIVE_COMMUNITY` is flipped to `true`, audit the Firebase rules and what's exposed in client-side config (Firebase API keys are public by design but rules need to be tight).
- **Admin dashboard CSRF** — `/admin.html` uses Bearer auth, no cookies, so CSRF is structurally not a concern.

## Recurring habits to keep this clean

1. Never paste the admin token into URLs, chat messages, screenshots, or commit messages. Bearer-header only.
2. Rotate the admin token any time it's been on a screen recording, in a screenshot you shared, or in a transcript you're not sure about.
3. Before publishing the GitHub repo (if you ever flip from private to public), run the secret-pattern grep from this doc again and search history with `git log -p | grep -E '...'`.
4. Don't add new tracked `.env*` files. `.env.example` only.

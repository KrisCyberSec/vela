# Infrastructure

Every service Vela depends on, who owns it, where it lives, and how to access it.

> Secrets (tokens, passwords, API keys) live in `ADMIN.md` at the project root — gitignored. This doc only references public-safe info.

## Services

| Service | Purpose | Dashboard | Account |
|---------|---------|-----------|---------|
| **Namecheap** | Domain registrar | [ap.namecheap.com](https://ap.www.namecheap.com/domains/list/) | `karawforever` |
| **Netlify** | Landing page hosting + waitlist functions + blobs | [app.netlify.com/projects/velahealth-app](https://app.netlify.com/projects/velahealth-app) | Kristopher's Google account |
| **Firebase** | Community backend (dormant until flipped on) | [console.firebase.google.com](https://console.firebase.google.com) | TBD when enabled |
| **Apple Developer** | App Store publishing | [developer.apple.com](https://developer.apple.com) | Not yet created |
| **RevenueCat** | Subscription management | [app.revenuecat.com](https://app.revenuecat.com) | Not yet created |

## Domain

- **Primary:** `velahealth.health`
- **Registrar:** Namecheap
- **Registered:** April 17, 2026
- **Expires:** April 17, 2027
- **Auto-renew:** Currently OFF — turn on before expiration
- **Domain Privacy:** ON (Namecheap WHOIS masking)

### DNS records (at Namecheap)

| Type | Host | Value | TTL |
|------|------|-------|-----|
| `A` | `@` | `75.2.60.5` | Auto |
| `CNAME` | `www` | `velahealth-app.netlify.app` | Auto |
| `TXT` | `@` | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | Auto |

SSL is provisioned by Netlify via Let's Encrypt, auto-renews.

## Netlify project

- **Site name:** `velahealth-app`
- **Site ID:** `e0a6111f-d0ad-469a-bb29-66844eb342fe`
- **Production URL:** [velahealth.health](https://velahealth.health)
- **Netlify subdomain:** `velahealth-app.netlify.app`
- **Deploy source:** Manual CLI (`netlify deploy --prod`) from repo root. Single [netlify.toml](../../netlify.toml) drives the deploy (publishes `landing/`, ships all four functions in `netlify/functions/`).
- **Plan:** Free (Starter / `nf_team_dev`)

### Functions

Located at `/Users/kristopher/Vela/netlify/functions/`:

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `waitlist.js` | `/.netlify/functions/waitlist` | Accepts POST with `{email}`, stores to Blobs |
| `waitlist-export.js` | `/.netlify/functions/waitlist-export` (requires `Authorization: Bearer $ADMIN_TOKEN`) | Returns all waitlist entries as JSON or CSV |
| `ask-vela.js` | `/api/ask-vela` (rewritten via toml) | Anthropic API proxy for the iOS Ask Vela feature |
| `daily-brief.js` | `/api/daily-brief` (rewritten via toml) | Anthropic API proxy for the iOS daily brief |

### Netlify Blobs

| Store | Keys | Notes |
|-------|------|-------|
| `waitlist` | email address (lowercase) | `{email, submittedAt, userAgent, referrer, ip}` per entry |

### Netlify env vars

| Name | Scope | Purpose |
|------|-------|---------|
| `NETLIFY_BLOBS_TOKEN` | all contexts | Auth for Blobs writes (Netlify PAT) |
| `ADMIN_TOKEN` | all contexts | Protects `/admin.html` and export endpoint |

**Rotate admin token:**
```bash
cd /Users/kristopher/Vela/landing
netlify env:set ADMIN_TOKEN "$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
netlify deploy --dir=. --functions=./netlify/functions --prod
```

Update the new token value in [../operations/waitlist.md](waitlist.md) and `ADMIN.md`.

## App repo (main React app)

- **Location:** `/Users/kristopher/Vela`
- **Git remote:** (see `git remote -v`)
- **Build output:** `/build`
- **Hosting:** Not currently deployed (will go to App Store, not web)

## Firebase (dormant)

Community backend is pre-wired but not yet activated. When enabled:
- Project name: `vela-health` (suggested)
- Auth: Anonymous
- Firestore: `posts`, `userTopics` collections
- Free tier (Spark plan) covers first ~1,000 users comfortably

See [../engineering/community-firebase.md](../engineering/community-firebase.md) for activation steps.

## Monthly cost

| Item | Cost |
|------|------|
| Netlify | $0 (Starter plan) |
| Namecheap domain | ~$1.08/mo amortized ($12.98/yr) |
| Firebase | $0 (dormant) |
| **Total** | **~$1/mo** |

At launch, add:
- Apple Developer: $99/yr (~$8.25/mo)
- RevenueCat: $0 until $10K MTR

## Access recovery

If you lose access to any service:

- **Namecheap** — recover via email associated with `karawforever` account
- **Netlify** — recover via Google OAuth (same account CLI is logged into; check `~/Library/Preferences/netlify/config.json`)
- **Domain transfer** — 60-day lock after registration, then `netlify api createTransfer` or a registrar transfer is possible

## Related docs

- [deployment.md](deployment.md) — how to deploy the landing page
- [waitlist.md](waitlist.md) — admin dashboard + email export
- [../engineering/community-firebase.md](../engineering/community-firebase.md) — Firebase activation

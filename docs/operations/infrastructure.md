# Infrastructure

Every service Vela depends on, who owns it, where it lives, and how to access it.

> Secrets (tokens, passwords, API keys) live in `ADMIN.md` at the project root — gitignored. This doc only references public-safe info.

## Services

| Service | Purpose | Dashboard | Account |
|---------|---------|-----------|---------|
| **Namecheap** | Domain registrar | [ap.namecheap.com](https://ap.www.namecheap.com/domains/list/) | `karawforever` |
| **Netlify** | Landing page hosting + waitlist functions + blobs | [app.netlify.com/projects/velahealth-app](https://app.netlify.com/projects/velahealth-app) | Kristopher's Google account |
| **Firebase** | Community backend (dormant until flipped on) | [console.firebase.google.com](https://console.firebase.google.com) | TBD when enabled |
| **Apple Developer** | App Store publishing | [developer.apple.com](https://developer.apple.com) | Not enrolled yet |
| **RevenueCat** | Subscription management | [app.revenuecat.com](https://app.revenuecat.com) | Project created; App Store connection pending |

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
- **Deploy source:** Manual CLI through `npm run deploy:netlify`, which builds a clean staging folder before running `netlify deploy --prod`. Single [netlify.toml](../../netlify.toml) drives the deploy (publishes `landing/`, ships all functions in `netlify/functions/`).
- **Plan:** Free (Starter / `nf_team_dev`)

### Functions

Located at `/Users/kristopher/Vela/netlify/functions/`:

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `waitlist.js` | `/.netlify/functions/waitlist` | Accepts POST with `{email}`, stores to Blobs |
| `waitlist-export.js` | `/.netlify/functions/waitlist-export` (requires `Authorization: Bearer $ADMIN_TOKEN`) | Returns all waitlist entries as JSON or CSV |
| `ask-vela.js` | `/api/ask-vela` (rewritten via toml) | Anthropic API proxy for the iOS Ask Vela feature |
| `daily-brief.js` | `/api/daily-brief` (rewritten via toml) | Anthropic API proxy for the iOS daily brief |
| `health.js` | `/api/health` (rewritten via toml) | Cheap health check for uptime checks and deploy verification |

### Security headers

Configured in [landing/_headers](../../landing/_headers) for all static
public paths:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Content-Security-Policy is not enabled yet. Add it only after reviewing
the static landing pages for inline scripts/styles and third-party assets.

### Netlify Blobs

| Store | Keys | Notes |
|-------|------|-------|
| `waitlist` | email address (lowercase) | `{email, submittedAt, userAgent, referrer, ip}` per entry |

### Netlify env vars

| Name | Scope | Purpose |
|------|-------|---------|
| `NETLIFY_BLOBS_TOKEN` | all contexts | Auth for Blobs reads and writes (Netlify PAT). Required because this site's runtime doesn't auto-inject `NETLIFY_BLOBS_CONTEXT`. If rotated, also rotate it here. |
| `ADMIN_TOKEN` | all contexts | Protects `/admin.html` and export endpoint |
| `ANTHROPIC_API_KEY` | functions | Powers `ask-vela` and `daily-brief` |
| `REVENUECAT_REST_KEY` | functions | Verifies premium entitlement server-side before AI calls |
| `ASK_VELA_DAILY_USD` | functions | Optional daily AI spend cap override |
| `ASK_VELA_DEV_TOKEN` | functions | Optional local/internal bypass token for AI endpoint testing |
| `REACT_APP_SENTRY_DSN` | build/client | Sentry client DSN used by the React app bundle |
| `REACT_APP_POSTHOG_KEY` | build/client | PostHog project key used by the React app bundle |

The RevenueCat public iOS key, `REACT_APP_REVENUECAT_IOS_API_KEY`, is not
final until Apple Developer enrollment and App Store Connect products are
created.

**Rotate admin token:**
```bash
cd /Users/kristopher/Vela
NEW=$(openssl rand -hex 32)
netlify env:set ADMIN_TOKEN "$NEW"
npm run deploy:netlify
echo "$NEW"  # paste into ADMIN.md (gitignored)
```

Then overwrite `ADMIN.md` with the new value. Don't put the token in `waitlist.md` or any other tracked file.

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

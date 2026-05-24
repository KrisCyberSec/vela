# Stability Audit - 2026-05-24

This audit maps the current Vela setup and the minimum practical steps to
make it easier to operate, test, and hand off.

## Current architecture map

| Area | Current state |
|------|---------------|
| Source of truth | GitHub repo `KrisCyberSec/vela`, branch `main` |
| Hosting | Netlify site `velahealth-app`, custom domain `velahealth.health` |
| Deployment trigger | Manual CLI deploy from a clean staging folder using `npm run deploy:netlify` |
| Framework/runtime | React 18 Create React App bundled into Capacitor iOS; Netlify Functions on Node via esbuild |
| API routes | `/api/*` rewrites to `/.netlify/functions/:splat` |
| Functions | `waitlist`, `waitlist-export`, `ask-vela`, `daily-brief`, `health` |
| Env vars and secrets | `ANTHROPIC_API_KEY`, `REVENUECAT_REST_KEY`, `NETLIFY_BLOBS_TOKEN`, `ADMIN_TOKEN`, Sentry DSN, PostHog key, plus local `.env.local`; secrets stay out of git |
| Auth | No app login yet; admin export protected by `ADMIN_TOKEN`; premium features verified through RevenueCat |
| Database/storage | Netlify Blobs for waitlist, AI cache, rate limits, cost tracking, and premium cache |
| Payments | RevenueCat project created; App Store Connect in-app purchases still blocked by Apple Developer enrollment |
| Background jobs | None; Daily Brief is generated on request and cached for 24 hours |
| Analytics | PostHog client events, Sentry client monitoring, RevenueCat subscription events |
| DNS/domain | Namecheap DNS points apex and `www` to Netlify |
| Security/abuse | Premium gate, rate limits, daily AI cost cap, admin token, security headers, CSV export escaping |
| Local dev/build/test | `npm start`, `npm test -- --watchAll=false`, `npm run build`, `npm run verify:netlify-scope`, `npm run verify:observability`, `npx cap sync ios` |

## Risks ranked by severity

| Severity | Risk | Status |
|----------|------|--------|
| High | Apple Developer enrollment is not complete, so App Store Connect, real IAPs, and the RevenueCat public iOS key cannot be finalized | Manual blocker |
| High | Production deploy ownership is manual and not Git-triggered | Reduced by deploy script and docs; automate later if deploy cadence increases |
| Medium | DNS/security edge is still Namecheap plus Netlify, not Cloudflare | Acceptable for launch; move DNS to Cloudflare when ready |
| Medium | Netlify Functions and Blobs create platform-specific backend logic | Acceptable because provider code is contained in `netlify/functions/`; do not spread it into app UI |
| Medium | Function CORS is open | Acceptable only because premium AI endpoints still require RevenueCat verification and rate limits |
| Medium | Content-Security-Policy is not enabled | Deferred to avoid breaking inline landing assets without a separate review |
| Low | Firebase dependency exists while Community is dormant | Documented as dormant; do not enable before launch unless it becomes a launch requirement |
| Low | PostHog autocapture/session replay is off | Intentional privacy choice for health context |

## Recommended target stack

For the next two weeks, keep the stack stable:

| Layer | Recommendation |
|-------|----------------|
| Source of truth | GitHub `main` |
| iOS app | React plus Capacitor, shipped through App Store |
| Landing/API host | Netlify for `landing/` and `netlify/functions/` |
| DNS/security edge | Keep Namecheap for launch; migrate DNS to Cloudflare after App Store submission or when traffic warrants it |
| App code | Keep app UI standard React/Capacitor; isolate Netlify-specific code to functions |
| Payments | RevenueCat plus Apple IAP |
| Analytics/observability | PostHog, Sentry, RevenueCat dashboards |
| Health check | `/api/health` |
| Deployment | Reproducible clean staging deploy through `npm run deploy:netlify` |

Do not migrate Vela to Vercel or Next.js right now. ChartQuery's pattern is
useful as an operating model, but Vela is primarily an iOS app with a static
landing page and a few API functions. A platform migration would add launch
risk without improving the App Store path.

## Changes made from this audit

- Added `/api/health` via `netlify/functions/health.js`.
- Added baseline Netlify security headers in `netlify.toml`.
- Added `npm run deploy:netlify` and `npm run deploy:netlify:preview`.
- Updated Netlify scope verification so the health function is required.
- Updated deployment and infrastructure docs to match the clean staging deploy flow.

## Manual account-side steps

1. Enroll the business Apple ID in Apple Developer Program.
2. Create the App Store Connect app record.
3. Create monthly and annual in-app purchases in App Store Connect.
4. Connect those products to RevenueCat.
5. Add `REACT_APP_REVENUECAT_IOS_API_KEY` locally and in any build environment that creates the iOS bundle.
6. Turn on Namecheap domain auto-renew.
7. Optional after launch: move DNS to Cloudflare for WAF, bot rules, and clearer edge security ownership.

## Verification checklist

Run these after infra changes:

```bash
npm run verify:netlify-scope
node -c netlify/functions/health.js
npm test -- --watchAll=false
npm run build
```

After deploying:

```bash
curl -i https://velahealth.health/api/health
```

Confirm the response is `200`, `ok` is `true`, and no secret values are exposed.

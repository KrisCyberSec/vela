# Deployment

How to deploy the various pieces of Vela. Copy-paste commands.

## Landing page (velahealth.health)

The marketing site at velahealth.health and the API functions used by
the iOS app are a single Netlify deploy. The root [netlify.toml](../../netlify.toml)
is the single source of truth — it points `publish` at `landing/` and
ships everything in `netlify/functions/`.

### One-time setup

```bash
# Install Netlify CLI (already done — skip if `netlify --version` works)
npm install -g netlify-cli

# Log in (already done — skip if `netlify status` shows your account)
netlify login
```

### Deploy

From the project root:

```bash
cd /Users/kristopher/Vela
netlify deploy --prod
```

This:
1. Uploads everything in `/landing` to Netlify's CDN
2. Deploys the four Netlify Functions (`waitlist`, `waitlist-export`,
   `ask-vela`, `daily-brief`)
3. Makes it live at [velahealth.health](https://velahealth.health) within a few seconds

### Deploy a preview (without affecting production)

Drop `--prod`:

```bash
netlify deploy
```

Netlify returns a unique preview URL so you can QA before publishing.

### Rollback

```bash
netlify api listSiteDeploys --data '{"site_id": "e0a6111f-d0ad-469a-bb29-66844eb342fe"}' | head
# Find the deploy_id you want, then:
netlify api restoreSiteDeploy --data '{"site_id": "...", "deploy_id": "..."}'
```

Or do it from the Netlify dashboard → Deploys → click any past deploy → "Publish deploy".

## What ships where

| Path | Purpose |
|------|---------|
| `landing/index.html` | Main marketing page |
| `landing/admin.html` | Password-protected waitlist dashboard |
| `landing/privacy.html` | Privacy policy |
| `landing/terms.html` | Terms of service |
| `landing/support.html` | App Store support page and contact path |
| `netlify/functions/waitlist.js` | Email capture endpoint (called from landing) |
| `netlify/functions/waitlist-export.js` | Admin export endpoint (called from admin) |
| `netlify/functions/ask-vela.js` | Anthropic API proxy for the iOS Ask Vela feature |
| `netlify/functions/daily-brief.js` | Anthropic API proxy for the iOS daily brief |
| `netlify.toml` | Single source of truth for the deploy |

The iOS app reaches its functions over HTTPS at `https://velahealth.health/api/*`,
which the toml redirects to `/.netlify/functions/:splat`.

## DNS changes

DNS records live at Namecheap. To edit:

1. [ap.namecheap.com/domains/list/](https://ap.www.namecheap.com/domains/list/) → `velahealth.health` → **Manage**
2. **Advanced DNS** tab

Current records are documented in [infrastructure.md](infrastructure.md#dns-records-at-namecheap).

If you're repointing the domain to a different host, you'll need to:
1. Update A/CNAME records at Namecheap
2. Update `custom_domain` in Netlify (or remove from Netlify first):
   ```bash
   netlify api updateSite --data '{"site_id": "e0a6111f-d0ad-469a-bb29-66844eb342fe", "body": {"custom_domain": null}}'
   ```

## Main app (React → iOS)

The React app in `src/` is the iOS web bundle, not a website. Capacitor
syncs `build/` into the iOS project; the app is distributed via the App
Store. There is no separate web deploy of the app.

When you're ready for App Store:

### 1. Build for iOS

```bash
cd /Users/kristopher/Vela
npm run build                   # build React app
npx cap sync ios                # sync web assets into iOS project
npx cap open ios                # open Xcode
```

### 2. Archive and submit in Xcode

- Product → Archive
- Distribute App → App Store Connect
- Requires Apple Developer account ($99/yr) and an App Store Connect app record

### 3. Hook up RevenueCat

Before submitting:
- Create App Store Connect in-app purchases (annual $69.99, monthly $8.99)
- Paste SKUs into RevenueCat
- Replace paywall no-op handlers in `src/App.jsx` (lines around 7554)

## CI/CD (future)

We're currently deploying manually via CLI. When this becomes painful (rare deploys or more collaborators), set up:

- GitHub Actions workflow that runs `netlify deploy --prod` on push to `main`
- Netlify's built-in Git integration (connect repo in Netlify dashboard) — safe to enable, the toml is correct

Not worth it yet at current deploy frequency.

## Related docs

- [infrastructure.md](infrastructure.md) — where everything lives
- [waitlist.md](waitlist.md) — admin dashboard + token rotation

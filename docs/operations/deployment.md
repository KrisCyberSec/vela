# Deployment

How to deploy the various pieces of Vela. Copy-paste commands.

## Landing page (velahealth.health)

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
netlify deploy \
  --dir=landing \
  --functions=landing/netlify/functions \
  --prod
```

This:
1. Uploads everything in `/landing` to Netlify's CDN
2. Deploys the two Netlify Functions (`waitlist`, `waitlist-export`)
3. Makes it live at [velahealth.health](https://velahealth.health) within a few seconds

### Deploy a preview (without affecting production)

Drop `--prod`:

```bash
netlify deploy --dir=landing --functions=landing/netlify/functions
```

Netlify returns a unique preview URL so you can QA before publishing.

### Rollback

```bash
netlify api listSiteDeploys --data '{"site_id": "e0a6111f-d0ad-469a-bb29-66844eb342fe"}' | head
# Find the deploy_id you want, then:
netlify api restoreSiteDeploy --data '{"site_id": "...", "deploy_id": "..."}'
```

Or do it from the Netlify dashboard → Deploys → click any past deploy → "Publish deploy".

## Landing page files

| File | Purpose |
|------|---------|
| `landing/index.html` | Main marketing page |
| `landing/admin.html` | Password-protected waitlist dashboard |
| `landing/privacy.html` | Privacy policy |
| `landing/terms.html` | Terms of service |
| `landing/netlify.toml` | Netlify build config (enables HTML processing) |
| `landing/netlify/functions/waitlist.js` | Email capture endpoint |
| `landing/netlify/functions/waitlist-export.js` | Admin export endpoint |
| `landing/package.json` | Declares `@netlify/blobs` dependency for functions |

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

## Main app (React)

Not yet deployed anywhere — the plan is App Store, not web.

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
- Create App Store Connect in-app purchases (annual $49.99, monthly $5.99)
- Paste SKUs into RevenueCat
- Replace paywall no-op handlers in `src/App.jsx` (lines around 7554)

## CI/CD (future)

We're currently deploying manually via CLI. When this becomes painful (rare deploys or more collaborators), set up:

- GitHub Actions workflow that runs `netlify deploy --prod` on push to `main`
- Netlify's built-in Git integration (connect repo in Netlify dashboard) — simpler if the main React app isn't involved

Not worth it yet at current deploy frequency.

## Related docs

- [infrastructure.md](infrastructure.md) — where everything lives
- [waitlist.md](waitlist.md) — admin dashboard + token rotation

# Accounts cheat sheet

Three new accounts (Sentry, Anthropic, RevenueCat) and one verification
(Netlify). Knock these out while Apple Developer enrollment is in the
24-48hr processing wait — they all parallelize.

Narrative source: `docs/operations/launch-walkthrough.md` § Phase 2.

## Credential → destination grid

| Service | Credential to copy | Pastes into |
|---|---|---|
| **Sentry** | DSN (`https://abc@xxx.ingest.sentry.io/12345`) | `.env.local` as `REACT_APP_SENTRY_DSN=` · Netlify env var `REACT_APP_SENTRY_DSN` |
| **Anthropic** | API key (`sk-ant-...`) | Netlify env var `ANTHROPIC_API_KEY` (server-only — never goes in `.env.local`) |
| **RevenueCat** | Public iOS key (`appl_...`) | `.env.local` as `REACT_APP_REVENUECAT_IOS_API_KEY=` · Netlify env var same name |
| **RevenueCat** | Secret REST key (`sk_...`) | Netlify env var `REVENUECAT_REST_KEY` (server-only) |
| **Netlify** | (no new credential — verify access) | n/a |

After this is done, all four destinations get pasted in
`netlify-env.md` (Netlify side) and via `.env.local` on Kris's Mac.

## Code-side verification (PASS)

Verified against the current main commit before writing this sheet.

- **Sentry** — `src/errorReporting.js` line 24 reads `process.env.REACT_APP_SENTRY_DSN`. Release tag format is `vela@<package.json version>` (line 26 — currently `vela@0.1.0`).
- **Anthropic** — Both `netlify/functions/ask-vela.js` (lines 86, 157, 237) and `netlify/functions/daily-brief.js` (lines 85, 157) read `process.env.ANTHROPIC_API_KEY`. Without it both endpoints return 503.
- **RevenueCat** — `src/subscription.js` line 28 reads `process.env.REACT_APP_REVENUECAT_IOS_API_KEY`. Entitlement constant on line 29 is `ENTITLEMENT_ID = 'premium'` (lowercase — see `revenuecat-wire.md` for why this matters). `.env.example` line 11 lists the var.

---

## 1. Sentry account

1. Go to <https://sentry.io> → **Sign Up** (top right).
2. Email: `lindsaykristopher@gmail.com`.
3. Plan: **Developer** (free, 5,000 errors/mo — plenty for v1).
4. Setup → "What kind of project?" → **React**.
5. Project name: `vela-ios`. Click **Create Project**.
6. The setup page shows `Sentry.init({ dsn: "..."})`. **Copy the DSN
   string between the quotes.** Save it in your password manager.

✓ Verify by: paste DSN into `.env.local`, restart `netlify dev`, open
DevTools console, run
`setTimeout(() => { throw new Error('sentry-smoke-test'); }, 0)`.
Within 10s, the error appears in Sentry **Issues** tagged
`vela@0.1.0`.

## 2. Anthropic API key

1. Go to <https://console.anthropic.com> → sign in or sign up.
2. Top-right user menu → **Settings** → **API Keys** (left nav).
3. Click **Create Key**. Name: `vela-production`.
4. **Copy the key now** (starts with `sk-ant-`) — Anthropic only
   shows it once.

⚠ Anthropic accounts get a small free credit. Production will need a
payment method added. Expected spend for 100 active users: under
$20/month at current pricing.

✓ Verify by: pasting into Netlify env (see `netlify-env.md`), then
`curl -X POST https://velahealth.health/api/ask-vela` should return a
JSON body that is NOT `{"error":"Server is missing ANTHROPIC_API_KEY"}`.

## 3. RevenueCat account

1. Go to <https://app.revenuecat.com>.
2. Sign up with `lindsaykristopher@gmail.com`.
3. Create a **Project** named `vela`.
4. Inside the project: **Apps** → **+ New App** → **Apple App Store**.
5. App name: `vela-ios`. Bundle ID: `com.velahealth.app` (verified
   from `capacitor.config.ts`).
6. **Don't fill the App Store Connect API key fields yet** — needs
   ASC set up first (covered in `revenuecat-wire.md`). Click **Save**.
7. On the app dashboard, copy the **Public API Key** (starts with
   `appl_`). Save it.

Then while you're in the dashboard:

8. **Project Settings** → **API Keys** → **Secret API Keys** →
   **REST API key**. Copy this too (starts with `sk_`). This is the
   Netlify-side credential, NOT the public iOS one. Two different
   keys, two different destinations.

✓ Verify both keys are saved. The full wiring (entitlement, offering,
packages) happens in `revenuecat-wire.md` after ASC has the IAPs
created.

## 4. Netlify (verify access only)

You already have an account from when the landing page was deployed.
Just confirm:

1. Go to <https://app.netlify.com>.
2. Sign in.
3. Find the **velahealth-health** site (or whatever it's named in your
   org).
4. Click **Site configuration** → **Environment variables**.

✓ You should see at least `REACT_APP_POSTHOG_KEY` already set (from
the 2026-05-08 analytics wire-up). If you can see + edit this list,
you have the access you need.

## After this sheet

Save all four credentials in a password manager:
- Sentry DSN
- Anthropic `sk-ant-...`
- RevenueCat public `appl_...`
- RevenueCat secret `sk_...`

Next sheets to run: `screenshot-script.md` (also parallelizable during
the Apple wait), then everything in Phase 4+ once Apple confirms
enrollment.

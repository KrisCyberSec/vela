# Netlify env vars cheat sheet

Three variables to paste in Netlify before the production build picks
up the AI proxies and Sentry. Run AFTER `accounts.md` and
`revenuecat-wire.md` (so you have all the credentials in hand).

Narrative source: `docs/operations/launch-walkthrough.md` § Phase 6.

🤝 **Working together.** Kris pastes the three vars + triggers
redeploy (auth-required). When the deploy is green, say "check the
endpoints" and I'll fetch both `/api/ask-vela` and `/api/daily-brief`
from Chrome and report what JSON comes back. For the Sentry round-
trip, fire the test error from your DevTools console; if it doesn't
show in Sentry, share a screenshot of your Issues page and I'll help
triage the why.

## The three variables (names verified from source)

| Var name | Read by | Value format | Where the value comes from |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | `netlify/functions/ask-vela.js` (L86, L157, L237) + `netlify/functions/daily-brief.js` (L85, L157) | `sk-ant-...` | `accounts.md` Step 2 (Anthropic console) |
| `REVENUECAT_REST_KEY` | `netlify/functions/ask-vela.js` (L311, L319) + `netlify/functions/daily-brief.js` (L216, L221) | `sk_...` | `revenuecat-wire.md` Step 7 (RC Project Settings → API Keys → Secret) |
| `REACT_APP_SENTRY_DSN` | `src/errorReporting.js` (L24) | `https://abc@xxx.ingest.sentry.io/12345` | `accounts.md` Step 1 (Sentry project setup page) |

I greppped all four files before writing this — those line numbers are
where the keys are actually read. If a future commit renames any of
them, this sheet will be out of date; re-grep before pasting.

```bash
# Re-verify the env var names yourself:
grep -rn "process.env\." netlify/functions/ src/errorReporting.js
```

## Step-by-step

### 1. Open the env vars page

1. <https://app.netlify.com> → click the **velahealth-health** site.
2. **Site configuration** → **Environment variables**.

### 2. Add each variable

Click **Add a variable** three times. For each:

| Setting | Value |
|---|---|
| Key | (one of the three from the grid above) |
| Values | **Same value for all deploy contexts** |
| Scopes | **All scopes** (Builds + Functions + Runtime + Post-processing) |

Click **Create variable**.

⚠ **REACT_APP_SENTRY_DSN** has the `REACT_APP_` prefix because CRA
bakes it into the static build at build time. Without the prefix, CRA
strips it. Don't drop the prefix even though the variable feels like
it should be flat.

⚠ **`REVENUECAT_REST_KEY`** is the **secret** REST key (starts `sk_`),
NOT the public iOS key (`appl_`). Pasting the wrong one means the
Netlify functions can't verify subscribers and Ask Vela returns 403
to every premium caller.

### 3. Trigger a redeploy

Netlify needs a fresh build to bake the new vars in.

1. **Deploys** tab → **Trigger deploy** → **Deploy site**.
2. Watch the build log — expect ~2-3 min.
3. The build should show "Environment variables: 3 from Netlify"
   among its early log lines.

## Verification

### Anthropic + RevenueCat path — alive vs. 503

Two paths, same outcome:

**Option A (pair):** Say "check the endpoints" once redeploy is green
and I'll fetch both from Chrome and report the JSON. Faster than
typing curl yourself.

**Option B (solo):**
```bash
curl -s -X POST https://velahealth.health/api/ask-vela | head -3
curl -s -X POST https://velahealth.health/api/daily-brief | head -3
```

| Response | Meaning |
|---|---|
| `{"error":"Method not allowed"}` or similar 400/401/403 JSON | ✓ Function alive, env vars present, downstream guard hit. Good. |
| `{"error":"Server is missing ANTHROPIC_API_KEY"}` | ✗ Var not set or empty. Re-paste in Netlify and re-deploy. |
| HTML "Page Not Found" or 500 | ✗ Function not deployed at all. |

### Sentry path — error round-trip

The DSN bakes into the static JS, so verify from a real browser:

1. Open <https://velahealth.health> in Chrome.
2. DevTools → **Console**.
3. Paste and run:
   ```js
   setTimeout(() => { throw new Error("sentry-smoke-test-2026-05"); }, 0);
   ```
4. Within 10s, go to Sentry → **Issues**. You should see the error
   tagged with release `vela@0.1.0`. (Tag format from
   `src/errorReporting.js` line 26.)

If no event arrives: open DevTools → Network tab, refresh the page,
filter for `sentry.io`. If you see no requests, the DSN didn't get
baked in — most likely the deploy that built the bundle ran BEFORE
the env var was set. Trigger another deploy and re-test.

## .env.local mirror (for local dev)

Three of the four credentials also belong in `.env.local` on Kris's
Mac for local development:

```env
REACT_APP_REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxxxxxxxxxx
REACT_APP_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxx
REACT_APP_SENTRY_DSN=https://abc@xxx.ingest.sentry.io/12345
```

(Note: `.env.local` only takes the `REACT_APP_` prefixed vars
because they're client-side. `ANTHROPIC_API_KEY` and
`REVENUECAT_REST_KEY` are server-only — Netlify functions read them
at runtime, never expose them to the bundle, so they never go in
`.env.local`.)

`.env.local` is in `.gitignore`. Don't paste secrets into anything
that isn't.

## After this sheet

`xcode-build.md` is the next click-through — actually building and
uploading the iOS bundle that talks to all this wiring.

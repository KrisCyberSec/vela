# Cowork prompt: launch cheat sheets

Self-contained prompt for producing six paste-ready cheat sheets that
Kris will follow while sitting at App Store Connect, RevenueCat,
Netlify, and Xcode. Copy everything below the `---` line into a new
Cowork session.

---

Produce six paste-ready cheat sheet files for the App Store launch. Kris will follow these while clicking through dashboards, so they need exact values, exact field names, and verifications that pull from the actual codebase. **Read `docs/operations/launch-walkthrough.md` first** — it's the narrative source of truth. Your job is to compress it into focused, single-purpose reference docs.

## Context

Vela is an iOS app for women in perimenopause and menopause. Read `docs/HANDOFF.md` for orientation. The launch walkthrough is at `docs/operations/launch-walkthrough.md`. Metadata source of truth: `appstore-metadata.md`. Subscription constants: `src/subscription.js`. Capacitor config: `capacitor.config.ts`.

## Deliverables (six files, one commit)

Each file lives at `docs/operations/launch-cheatsheets/<name>.md`. Structure each as a numbered checklist with exact values verified against source. Don't repeat the walkthrough's narrative — these are scannable reference cards.

### 1. `accounts.md`

For each of Sentry, Anthropic, RevenueCat: account creation steps, what to copy when the dashboard shows the credential, and where each credential goes (which env file, which dashboard, which line). Verify Netlify access (no creation, just confirm). Produce a single grid at the top mapping `service → credential → destination(s)`.

For each service, also do this code-side verification BEFORE Kris creates the account, and report inline:
- **Sentry**: confirm `src/errorReporting.js` reads from `REACT_APP_SENTRY_DSN`. Confirm release tag format.
- **Anthropic**: confirm `netlify/functions/ask-vela.js` and `netlify/functions/daily-brief.js` read from `ANTHROPIC_API_KEY`.
- **RevenueCat**: confirm `src/subscription.js` constant for the entitlement name (should be `premium` lowercase). Confirm the iOS API key var name in `.env.example`.

### 2. `screenshot-script.md`

Write a shell script Kris runs on his Mac that boots the iPhone simulator, navigates to `?seed=demo`, and saves 12 PNGs (6 frames × 2 device sizes: 1290×2796 + 1284×2778). Save the script to `scripts/capture-screenshots.sh` (create the dir if missing) and chmod +x it. The cheat sheet doc explains how to run it and what to verify afterward.

If `xcrun simctl` automation is too fragile (high chance), fall back to a manual checklist with exact simulator names + the 6 frame captions Kris should capture in order. Better to have a reliable manual walkthrough than a flaky script.

The 6 frames + captions (already drafted in `manual-tasks.md` under "App Store screenshots"):
1. Welcome — "A quiet place for the noisy years."
2. Today — "See yesterday's pattern before today even starts."
3. Insights — "Patterns Vela has noticed."
4. Ask Vela — "Real AI grounded in your data."
5. Paywall — "Make sense of it. Out loud."
6. History — "Every day, a quiet entry."

### 3. `asc-paste-sheet.md`

Walk Kris through every App Store Connect form field he'll fill, in the order ASC presents them. For each: which page (e.g. "App Information"), which field, the EXACT text to paste (pulled from `appstore-metadata.md`), and verification afterward.

Special attention to **Privacy Nutrition Label** — this is the highest rejection risk. Document the exact checkbox sequence:
- Question: "Do you collect data?" → **Yes**
- Data type: **Health & Fitness** only
- How used: **App Functionality** only (uncheck Analytics, Personalization, etc.)
- Linked to identity: **No**
- Used for tracking: **No**

Include a verification command Kris can run after submitting metadata: visit `https://apps.apple.com/us/app/com.velahealth.app/id<APP_ID>` (the public listing) and confirm the visible state matches what was pasted.

### 4. `revenuecat-wire.md`

Step-by-step RevenueCat dashboard clicks to wire it to the App Store Connect IAPs. Read `src/subscription.js` to extract the EXACT constants — paste them at the top of the cheat sheet so Kris doesn't have to re-derive:

- Entitlement name: `premium` (must match the constant in `src/subscription.js`, lowercase, no caps)
- Product IDs (from `manual-tasks.md` — confirm against actual IAP creation):
  - `com.velahealth.app.premium.annual`
  - `com.velahealth.app.premium.monthly`
- Bundle ID (from `capacitor.config.ts`): `com.velahealth.app`

Walk through: API key from ASC (`.p8` file generation), App-Specific Shared Secret, paste into RevenueCat, create entitlement, create offering, attach packages. Each step gets a "✓ verify by" check.

Loud warning at top: **the entitlement name must be exactly `premium` (lowercase) — if you type "Premium" or "Vela_Premium", purchases will appear successful but the app stays free, instant rejection from any Apple reviewer who tests subscription.**

### 5. `netlify-env.md`

Three environment variables Kris pastes into Netlify, with exact var names (verify by grepping the codebase), example value formats, and verification curl commands.

| Var | Read by | Format |
|---|---|---|
| `ANTHROPIC_API_KEY` | `netlify/functions/{ask-vela,daily-brief}.js` | `sk-ant-...` |
| `REVENUECAT_REST_KEY` | `netlify/functions/{ask-vela,daily-brief}.js` | `sk_...` (RC secret REST key, not the public iOS key) |
| `REACT_APP_SENTRY_DSN` | `src/errorReporting.js` | `https://abc@xxx.ingest.sentry.io/12345` |

Verify the var names by `grep -r "process.env" netlify/functions/ src/`. After Kris pastes + redeploys, verification is a curl to each endpoint:

- `curl -X POST https://velahealth.health/api/ask-vela` → expect 401/403/400 (means the function is alive; 500 or "function not found" means env var missing).
- `curl -X POST https://velahealth.health/api/daily-brief` → same.

Sentry verification: open DevTools console on velahealth.health, run `setTimeout(() => { throw new Error('test') }, 0)`. Within 10s, the error appears in Sentry tagged `vela@0.1.0`.

### 6. `xcode-build.md`

Pre-flight code-side verification BEFORE Kris opens Xcode (do these checks inline in the doc and report pass/fail at the top):

- `ios/App/App/Info.plist` has `NSHealthShareUsageDescription` (required for HealthKit)
- `ios/App/App/Info.plist` has `ITSAppUsesNonExemptEncryption=false` (or the encryption disclosure question will block the upload)
- `capacitor.config.ts` `appId` is `com.velahealth.app`
- `package.json` `version` matches the version field Kris will set in Xcode (currently `0.1.0` — confirm)
- The app builds cleanly: run `npm run build` and report success/failure. If build fails, report the error and stop — don't write the rest of the cheat sheet.
- The web bundle is synced into the iOS project: confirm by checking that `ios/App/App/public/` exists and has files (or `npx cap sync ios` is needed)

Then the Xcode click-by-click walkthrough: open workspace, signing config, HealthKit capability, asset catalog 1024 icon (assume `app-icon-1024.md` Cowork prompt has been run), version + build number, archive, distribute, upload.

## Definition of done

1. Six files exist at `docs/operations/launch-cheatsheets/`. Each one ≤ 150 lines.
2. Every value comes from source — no placeholders, no "TBD."
3. Every code-side verification is done and the result is in the file.
4. If any pre-flight check fails (missing Info.plist key, build broken, env var read by wrong name), the corresponding cheat sheet says so loudly at the top and stops there.
5. `docs/operations/cowork-prompts/README.md` index updated to reference the new directory.
6. Single commit. Title under 70 chars, imperative mood. Body lists the six files. End with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
7. `git push origin HEAD:main` (a worktree has main checked out so this refspec is the workaround).

## Constraints

- No new dependencies.
- Don't modify source code. If a check fails, document it; don't fix it.
- Keep each cheat sheet scannable. Tables and numbered lists, not prose paragraphs.
- The launch-walkthrough.md already has the narrative. These cheat sheets are reference cards Kris pulls up while at a dashboard — they should fit on one screen each where possible.

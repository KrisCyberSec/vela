# RevenueCat wiring cheat sheet

Wires RevenueCat to the ASC IAPs so the in-app purchase flow actually
charges (and unlocks Premium). Run this AFTER `asc-paste-sheet.md`
has created both IAPs.

Narrative source: `docs/operations/launch-walkthrough.md` § Phase 5.

🤝 **Working together.** The RC dashboard + ASC API key generation
need your auth — that's all you. I'll re-grep
`src/subscription.js` if you want to triple-check the entitlement
constant before you type it (it's `premium`, lowercase). For the
sandbox-purchase test on your physical iPhone, share a screenshot of
Settings → Subscription after the purchase and I'll tell you whether
the state matches what `subscription.js` expects.

## 🚨 The one thing that will silently break everything

**The entitlement name must be exactly `premium` — lowercase, no caps,
no underscores, no suffix.** If you type `Premium` or `Vela_Premium`
in the RC dashboard, purchases will succeed, Apple will charge the
card, but Premium stays locked: `src/subscription.js` line 29 reads
`ENTITLEMENT_ID = 'premium'` and checks that exact string. App Store
reviewers test subscriptions; "paid but locked" = guideline-3.1.1
rejection, 24-48hr re-submit cycle.

## Constants verified from source

| Constant | Value | Source |
|---|---|---|
| Entitlement identifier | `premium` (lowercase) | `src/subscription.js` line 29 |
| Bundle ID | `com.velahealth.app` | `capacitor.config.ts` line 4 |
| Product ID (annual) | `com.velahealth.app.premium.annual` | `appstore-metadata.md` + walkthrough |
| Product ID (monthly) | `com.velahealth.app.premium.monthly` | same |
| Offering identifier | `default` | walkthrough Step 5.5 |
| Annual package identifier | `$rc_annual` | walkthrough Step 5.5 |
| Monthly package identifier | `$rc_monthly` | walkthrough Step 5.5 |
| Public iOS API key env var | `REACT_APP_REVENUECAT_IOS_API_KEY` | `src/subscription.js` line 28, `.env.example` line 11 |
| Server-side secret env var | `REVENUECAT_REST_KEY` | `netlify/functions/ask-vela.js` lines 311, 319 |

## Prerequisite from ASC

You need 3 things from ASC before pasting into RevenueCat:

1. **App Store Connect API Key** (`.p8` file + Key ID + Issuer ID).
2. **App-Specific Shared Secret** (32-char string).
3. Both IAPs created and listed (from `asc-paste-sheet.md`).

### 1. Generate the API Key

1. ASC → **Users and Access** (top nav) → **Integrations** tab.
2. **App Store Connect API** → blue **+**.
3. Name: `RevenueCat`. Access: **App Manager**.
4. **Generate** → **Download the .p8 file immediately** (Apple only
   shows it once).
5. Copy **Key ID** (10 chars) and **Issuer ID** (UUID at top).

### 2. Generate the App-Specific Shared Secret

1. ASC → My Apps → Vela → **App Information**.
2. Scroll to **App-Specific Shared Secret** at the bottom.
3. **Manage** → **Generate** → copy the 32-char secret.

## RevenueCat steps

### Step 1 — Connect ASC

1. <https://app.revenuecat.com> → `vela` project → `vela-ios` app.
2. Sidebar → **App Store Connect API**.
3. Paste:
   - **Issuer ID** (from prerequisite 1)
   - **Key ID** (from prerequisite 1)
   - Upload the `.p8` file (from prerequisite 1)
4. **Save**.
5. Sidebar → **App-Specific Shared Secret** → paste the 32-char
   secret. **Save**.

✓ Verify: green "Connected" indicator + IAPs auto-sync from ASC
within 1-2 min. Refresh — both `com.velahealth.app.premium.annual`
and `.monthly` should appear.

### Step 2 — Create the entitlement (THE thing to get right)

1. **Project Settings** → **Entitlements** → **+ New Entitlement**.
2. **Identifier**: type exactly `premium` (lowercase). Triple-check
   before clicking Create.
3. **Display Name**: `Premium` (capitalization here doesn't matter
   — only the identifier is read by code).
4. **Create**.

✓ Verify: identifier appears as exactly `premium` in the entitlements
list. If you typo'd, delete it and recreate — don't rename, RC keeps
the slug.

### Step 3 — Create the offering

1. **Project Settings** → **Offerings** → **+ New Offering**.
2. **Identifier**: `default`. **Create**.
3. On the offering's page → **+ Add Package**:

| Package identifier | Product to attach |
|---|---|
| `$rc_annual` | `com.velahealth.app.premium.annual` (should auto-populate from ASC sync) |
| `$rc_monthly` | `com.velahealth.app.premium.monthly` |

4. Drag `$rc_annual` to position 1 (it's the recommended pricing tier
   shown first in the paywall).

### Step 4 — Attach packages to the entitlement

1. Sidebar → **Entitlements** → click the `premium` entitlement.
2. **+ Attach** → select both products you just added in Step 3.
3. **Save**.

✓ Verify: the entitlement card now lists both product IDs. RevenueCat
will mark this as "ready" — no yellow warnings.

### Step 5 — Sandbox-test the wiring

Catches typo-class bugs before Apple's reviewer does:

1. ASC → **Users and Access → Sandbox → Testers → +**. Create
   `vela-sandbox-1@yourdomain.com` (real inbox you control).
2. Physical iPhone → **Settings → App Store → Sandbox Account** → sign
   in with the tester.
3. Install the TestFlight build (`xcode-build.md`).
4. In the app: Settings → Subscription → **Upgrade to Vela → Try free
   for 14 days · then $69.99/yr**. Complete the purchase prompt.

✓ Pass: Subscription shows **Active**, Premium features unlock.
✗ Fail (paid, still locked): entitlement-name typo. Back to Step 2,
confirm `premium` (lowercase, no suffix), and that it's attached to
both products in the `default` offering.

### Step 6 — Grab the two keys

| Key | Where | Pastes to |
|---|---|---|
| Public iOS (`appl_...`) | `vela-ios` app dashboard → **Public API Key** | `.env.local` AND Netlify env as `REACT_APP_REVENUECAT_IOS_API_KEY` |
| Secret REST (`sk_...`) | **Project Settings → API Keys → Secret → REST API key** | Netlify env as `REVENUECAT_REST_KEY` (never `.env.local` — server-only) |

After this: `netlify-env.md` then `xcode-build.md`.

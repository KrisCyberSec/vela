# Launch Walkthrough — Vela v1.0

The literal step-by-step. Written assuming you've never shipped an iOS
app before. Every screen, every button, every paste.

This is the **narrative** doc. The **reference** lives in
`manual-tasks.md` (item-by-item checklist). When in doubt, follow this
top-to-bottom and check things off as you go.

---

## What you need before you start

Gather these before sitting down. Stop and grab them if you don't have
them — you'll get blocked partway through otherwise.

- [ ] **Your Apple ID.** The same one that owns the `com.velahealth.app`
  bundle ID (likely `lindsaykristopher@gmail.com` based on the project
  history). Make sure you can log into it.
- [ ] **A credit/debit card.** Apple charges $99 immediately for
  Developer Program enrollment.
- [ ] **A Mac with Xcode installed.** Xcode 15+ recommended. If you
  don't have Xcode, install from the Mac App Store first — it's a
  ~10GB download.
- [ ] **A physical iPhone.** Any model from the last 5 years. You'll
  install a TestFlight build on it for end-to-end verification before
  submitting.
- [ ] **A Lightning or USB-C cable** to plug the iPhone into the Mac
  for the first install (required once for trust setup).
- [ ] **About 4-6 hours of focused time, spread over 2-3 days.** Apple
  has a ~24-hour processing delay between Developer enrollment and
  when you can start using ASC. Plan around that.

---

## The order of things

```
DAY 1 (start of day)
└── Apple Developer enrollment ($99, then 24-48hr Apple wait)
    │
    ├── (parallel, while waiting) Sentry account → DSN
    ├── (parallel, while waiting) Anthropic API key
    ├── (parallel, while waiting) RevenueCat account
    └── (parallel, while waiting) Cowork: app icon + screenshots

DAY 2 (after Apple confirms)
├── App Store Connect: create app record
├── App Store Connect: create 2 IAP products
├── App Store Connect: privacy nutrition label
├── App Store Connect: upload screenshots
├── App Store Connect: paste metadata from appstore-metadata.md
├── RevenueCat: wire to ASC IAPs
├── Netlify: paste env vars (ANTHROPIC_API_KEY, REVENUECAT_REST_KEY, SENTRY DSN)
└── Xcode: signing config + HealthKit capability + asset catalog

DAY 2 or 3
├── Xcode: archive build → upload to ASC
├── ASC: assign build to TestFlight version
├── Install on iPhone via TestFlight
├── Verify 5-step flow on physical phone
└── ASC: Submit for Review
```

---

## Phase 1 — Apple Developer Program enrollment

Apple takes 24-48 hours to process this. **Start it first**, then do
everything else while you wait.

### Step 1.1 — Go to the enrollment page

1. Open Safari (works best with Apple) and go to
   <https://developer.apple.com/programs/>.
2. Click the blue **Enroll** button near the top.
3. You'll be asked to sign in. Use your Apple ID
   (`lindsaykristopher@gmail.com`).

✓ **You'll see**: "Welcome to the Apple Developer Program" enrollment
flow with a few steps listed in the sidebar.

### Step 1.2 — Choose entity type

You'll be asked: "Are you enrolling as an Individual or an
Organization?"

- **Individual**: faster (no D-U-N-S number needed), shows your name
  on the App Store as the seller ("Lindsay Kristopher" or similar).
- **Organization**: requires a registered business + a D-U-N-S number
  (free but takes 1-2 weeks to get if you don't have one). Shows your
  business name on the App Store.

For Vela v1.0, **Individual is fine**. You can convert later.

Click **Individual** → **Continue**.

### Step 1.3 — Confirm personal info

Apple pre-fills your name, address, etc. from your Apple ID. Verify
it's accurate. The address goes on the App Store seller page.

Click **Continue**.

### Step 1.4 — Pay $99

1. Card details, Apple charges $99 USD immediately.
2. Click **Submit Purchase**.

✓ **You'll see**: "Thank you for enrolling. We will email you when
your enrollment is complete."

🕒 **Expect**: 24-48 hours. Sometimes faster, sometimes a week if
Apple needs additional verification.

⚠ **If you get an "on hold" email**: Apple needs additional ID
verification. They'll email you with what to send. This adds 3-7 days.

### Step 1.5 — While you wait

Don't sit on this. Go do Phase 2 in parallel.

---

## Phase 2 — Account creation (parallel during Apple wait)

These all take 5-15 minutes each. Knock them out while Apple processes.

### Step 2.1 — Sentry account

Why: catches crashes after launch so you find out about them before
your users tweet about them.

1. Go to <https://sentry.io>.
2. Click **Sign Up** (top right).
3. Use your work email (`lindsaykristopher@gmail.com`).
4. Choose **Developer plan** (free, covers 5,000 errors/month — plenty).
5. After signup, Sentry asks "What kind of project?" → choose
   **React**.
6. Project name: `vela-ios`.
7. Click **Create Project**.

✓ **You'll land on**: a setup page showing a code snippet starting
with `Sentry.init({ dsn: "..."`.

8. **Copy the entire DSN** (the long URL inside the quotes — looks
   like `https://abc123@o12345.ingest.sentry.io/67890`).
9. Save it somewhere you can get back to it (Notes app, password
   manager, whatever). You'll paste it in two places later.

### Step 2.2 — Anthropic API key

Why: powers Ask Vela and Daily Brief. Without this, Premium feels
broken.

1. Go to <https://console.anthropic.com>.
2. Sign in (or sign up if new).
3. Top-right user menu → **Settings** → **API Keys** in the left nav.
4. Click **Create Key**.
5. Name it `vela-production`.
6. **Copy the key immediately** (starts with `sk-ant-`). Anthropic only
   shows it once.
7. Save it next to your Sentry DSN.

⚠ **About billing**: New Anthropic accounts get a small free credit.
Production usage will require adding a payment method. Estimated cost
for 100 active users: under $20/month.

### Step 2.3 — RevenueCat account

Why: handles the App Store subscription complexity (purchases,
renewals, refunds, sandbox testing) so you don't have to.

1. Go to <https://app.revenuecat.com>.
2. Sign up with `lindsaykristopher@gmail.com`.
3. After signup, you'll be asked to create a **Project**. Name it
   `vela`.
4. Inside the project, click **Apps** → **+ New App** → **Apple App
   Store**.
5. App name: `vela-ios`.
6. Bundle ID: `com.velahealth.app`.
7. **Don't fill in the App Store Connect API key fields yet** — you
   need ASC set up first. Click **Save**.

✓ **You'll see**: Your app card on the project dashboard, with the
**Public API Key** field. Copy this key (starts with `appl_`). Save it
next to the others.

You'll come back to RevenueCat in Phase 5 after ASC is set up.

### Step 2.4 — Verify Netlify access

You should already have a Netlify account from when the landing page
was deployed. Just verify you can get in.

1. Go to <https://app.netlify.com>.
2. Sign in.
3. Find the **velahealth-health** site (or whatever the Vela site is
   named).
4. Confirm you can click **Site Settings** → **Environment variables**.

✓ **You'll see**: a list of any env vars already set (probably
`POSTHOG_KEY` and a few others). You'll add 3 more in Phase 6.

---

## Phase 3 — Local prep (parallel during Apple wait)

While you're waiting on Apple, two things can happen on your Mac:

### Step 3.1 — Generate the 1024×1024 app icon

You can either:
- **Spawn the Cowork prompt** at
  `docs/operations/cowork-prompts/app-icon-1024.md` — it'll handle the
  generation, alpha-strip, and Xcode asset-catalog wiring.
- **OR do it manually**: open `landing/generate-app-icon.js`, run
  `node landing/generate-app-icon.js`, verify with
  `file landing/icon-1024.png` — should say "RGB" (not RGBA).

Spawning Cowork is the recommended path. Saves you ~30 minutes of
fiddling.

### Step 3.2 — Generate App Store screenshots

You need 3-10 screenshots at each of these sizes:
- **6.7" display**: 1290×2796 (iPhone 14/15/16 Pro Max)
- **6.5" display**: 1284×2778 (iPhone 11 Pro Max, XS Max)

**The simplest path:**

1. Open Xcode.
2. Open the simulator: **Xcode → Open Developer Tool → Simulator**.
3. In the simulator menu: **File → Open Simulator → iOS [latest] →
   iPhone 15 Pro Max**.
4. The simulator boots an iPhone-shaped window.
5. In that simulator's Safari, navigate to
   `http://localhost:3000/?seed=demo` (run `npm start` in the Vela repo
   first to start the dev server).
6. The app loads with 30 days of seeded demo data + Premium unlocked.
7. Press `Cmd+S` in the simulator to capture each screen at native
   resolution. Files save to your Desktop.
8. Capture 6 frames in this order (the captions are pre-spec'd in
   `manual-tasks.md`):
   1. **Welcome** — the first onboarding screen
   2. **Today** — with the YESTERDAY'S PATTERN card visible
   3. **Insights** — pattern cards visible
   4. **Ask Vela** — open the FAB, see the Ask Vela sheet
   5. **Paywall** — tap any locked Premium feature
   6. **History** — calendar with logged days

9. Repeat with **iPhone 11 Pro Max** simulator for the 6.5" size.

You should end up with 12 PNG files (6 frames × 2 sizes).

✓ **Verify**: open one in Preview → Tools → Show Inspector → confirm
the dimensions are exactly 1290×2796 (or 1284×2778 for the 6.5" set).

⚠ **Common issue**: simulator Safari may render slightly differently
than native. That's fine for screenshots — Apple just wants
representative images.

### Step 3.3 — Spawn the metadata polish (already done!)

This already ran. The current `appstore-metadata.md` is paste-ready as
of commit `d9d5b67`.

### Step 3.4 — (Optional) Spawn the pre-submission audit

Before you submit on Day 2 or 3, spawn the Cowork prompt at
`docs/operations/cowork-prompts/pre-submission-audit.md`. It'll do a
final read across every user-facing surface and flag anything that
drifted between now and submission day. ~30 min.

---

## Phase 4 — App Store Connect setup (after Apple confirms)

You'll get an email from Apple when enrollment is processed. That's
your green light for this phase.

### Step 4.1 — Sign into ASC

1. Go to <https://appstoreconnect.apple.com>.
2. Sign in with your Apple ID.
3. Click **Apps** in the top nav.

✓ **You'll see**: Apps page (empty if this is your first app).

### Step 4.2 — Create the app record

1. Click the blue **+** button → **New App**.
2. A dialog appears. Fill in:
   - **Platforms**: ☑ iOS
   - **Name**: `Vela: Menopause Companion` (this is what shows in the
     App Store; don't include "Vela" twice — Apple counts the App Name
     toward the 30-char limit)
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: select `com.velahealth.app` from the dropdown. If
     it's not listed, you'll need to register it first at
     <https://developer.apple.com/account/resources/identifiers/list>
     → **+** → **App IDs** → **App** → enter the bundle ID.
   - **SKU**: `vela-ios-001` (anything unique to you; not user-visible)
   - **User Access**: Full Access (default)
3. Click **Create**.

✓ **You'll land on**: the App Information page for Vela.

### Step 4.3 — Fill App Information

In the left sidebar of the app page, click **App Information**.

Fill in:
- **Subtitle**: `Track symptoms. See patterns.` (paste from
  `appstore-metadata.md`)
- **Privacy Policy URL**: `https://velahealth.health/privacy.html`
- **Category**: Primary = **Health & Fitness**, Secondary = (leave
  blank)
- **Content Rights**: Does your app contain, show, or access third-party content? **No**

Click **Save** (top right).

### Step 4.4 — Create In-App Purchase products

In the left sidebar, click **Monetization** → **In-App Purchases** →
**+** (create a new IAP).

**First IAP — Annual subscription:**

1. Type: **Auto-Renewable Subscription**
2. Reference Name: `Premium Annual` (internal, not shown to users)
3. Product ID: `com.velahealth.app.premium.annual`
4. Click **Create**.
5. On the next page:
   - **Subscription Group**: click **Create New** → name it
     `vela_premium`
   - **Subscription Duration**: 1 Year
   - **Price**: select **Tier 70** ($69.99 USD)
   - **Free Trial**: 14 Days (under "Introductory Offers")
   - **Localizations** → English (U.S.):
     - Display Name: `Vela Premium (Annual)`
     - Description: `Unlimited Ask Vela, daily brief, doctor PDF reports, personalized experiments, and more.`
   - **Review Information** (Apple will see this):
     - Screenshot: upload one of the paywall screenshots from Phase 3.2
     - Review Notes: `Tap the Annual purchase button on the paywall. If the sandbox Apple ID is eligible for the introductory offer, the button says "Start 14 days free · then $69.99/yr"; otherwise it says "Continue with Annual · $69.99/yr". Sandbox tester accounts work normally.`
6. Click **Save** at the top.

**Second IAP — Monthly subscription:**

Same steps, but:
- Reference Name: `Premium Monthly`
- Product ID: `com.velahealth.app.premium.monthly`
- Subscription Group: select the existing `vela_premium`
- Duration: 1 Month
- Price: **Tier 9** ($8.99 USD)
- Free Trial: 14 Days
- Display Name: `Vela Premium (Monthly)`

✓ **You'll see**: both IAPs listed under In-App Purchases. Each will
show "Ready to Submit" status (yellow). They'll go green once you've
submitted with a build.

### Step 4.5 — Privacy Nutrition Label

**This is the highest-risk rejection step.** Read this carefully.

In the left sidebar, click **App Privacy**.

1. **Get Started** (or **Edit** if it's already there).

2. **Data collection question**: "Do you or your third-party partners
   collect data from this app?"

   Answer: **Yes**. (Most-instinct is "No" because Vela is
   privacy-first. But Ask Vela sends an anonymized summary, which
   counts as collection.)

3. **Data Type screen**: select what's collected:
   - ☑ **Health & Fitness** → **Health**
   - ☑ **Purchases** → **Purchase History**
   - ☑ **Identifiers** → **User ID**
   - ☑ **Usage Data** → **Product Interaction**
   - ☑ **Diagnostics** → **Crash Data**
   - ☑ **Diagnostics** → **Other Diagnostic Data**

   Leave contact info, location, browsing history, search history,
   contacts, photos, audio, and advertising data unchecked.

4. Click **Save**.

5. Configure each type:
   - **Health**: App Functionality + Product Personalization; Linked: No; Tracking: No.
   - **Purchase History**: App Functionality + Analytics; Linked: No while using anonymous RevenueCat app user IDs; Tracking: No.
   - **User ID**: App Functionality; Linked: No while the ID is anonymous and not tied to email/account identity; Tracking: No.
   - **Product Interaction**: Analytics; Linked: No; Tracking: No.
   - **Crash Data**: App Functionality; Linked: No; Tracking: No.
   - **Other Diagnostic Data**: App Functionality; Linked: No; Tracking: No.

6. Click **Save**.

✓ **You'll see**: a Privacy Nutrition Label preview with no tracking, no
data linked to identity, and the above data types under "Data Not Linked
to You."

⚠ **If a reviewer rejects this**: they'll cite "incomplete privacy
disclosure." The fix is to come back here and verify Health & Fitness
is checked correctly.

### Step 4.6 — Upload screenshots

1. Left sidebar → **Vela** (your app's main page) → **iOS App** →
   **1.0 Prepare for Submission**.
2. Scroll down to **App Previews and Screenshots**.
3. There's a tab for each device size:
   - **iPhone 6.7" Display** (Pro Max sizes)
   - **iPhone 6.5" Display**
   - You can ignore the smaller ones if you uploaded 6.7" — Apple
     auto-scales, but having the dedicated 6.5" set is more polished.
4. Drag-and-drop your 6 screenshots from Phase 3.2 into each tab.

Order matters: first screenshot is the "hero" that shows in search
results. Order I'd recommend:
1. Welcome (sets the brand tone)
2. Insights (shows the value prop — patterns)
3. Ask Vela (premium hook)
4. Today (daily use)
5. Paywall (price transparency)
6. History (long-term value)

### Step 4.7 — Paste app metadata

On the same **1.0 Prepare for Submission** page, fill in:

- **Promotional Text**: paste from `appstore-metadata.md` "Promotional
  Text" section (141 chars, well under the 170 limit)
- **Description**: paste from `appstore-metadata.md` "Description"
  section
- **Keywords**: paste from `appstore-metadata.md` "Keywords" section
  (`perimenopause,hot flashes,night sweats,HRT,estrogen,hormones,cycle,brain fog,mood,tracker,log`)
- **Support URL**: `https://velahealth.health` (or specifically
  `mailto:support@velahealth.health` if asked for a contact link)
- **Marketing URL**: `https://velahealth.health` (optional but nice)
- **Version**: `1.0.0`
- **Copyright**: `© 2026 [your name]`

### Step 4.8 — App Review Information

Same page, scroll down.

- **Sign-In Required**: No
- **Contact Information**: your name, email
  (`lindsaykristopher@gmail.com`), phone (your number)
- **Demo Account**: leave blank (no login required)
- **Notes**: paste this exactly:

> Vela has no login or account. Tap "Begin" on the welcome screen to
> start the 90-second onboarding. To exercise premium features without
> a real subscription, please use the App Store sandbox tester flow
> against the in-app paywall. The "Ask Vela" feature sends an
> anonymized summary of symptom data (no notes, no custom symptom
> names, no exact dates) to Anthropic's Claude API via our Netlify
> proxy. Disclosure in Settings → Privacy & Data and in our privacy
> policy at velahealth.health/privacy.html.

- **Attachment**: optional. You can leave blank.

### Step 4.9 — Version Information

Scroll up. Fill in:
- **What's New in This Version**: paste from `appstore-metadata.md`
  "What's New" section
- **Build**: leave blank — you'll select a build after Phase 7

Click **Save** (top right).

✓ **You'll see**: most fields filled in, with red exclamation marks
next to the ones still missing (Build, mostly). Build comes from
Xcode in Phase 7.

---

## Phase 5 — Wire RevenueCat to ASC IAPs

Now that the IAPs exist in ASC, RevenueCat can verify them.

### Step 5.1 — Generate App Store Connect API Key

1. In ASC, click **Users and Access** (top nav).
2. Click **Integrations** tab.
3. Click **App Store Connect API**.
4. Click the blue **+** to generate a new key.
5. Name: `RevenueCat`. Access: **App Manager**.
6. Click **Generate**.
7. **Download the .p8 file immediately** (Apple only shows this once).
   Save it somewhere safe.
8. Copy the **Key ID** (10-char string) and **Issuer ID** (UUID at top
   of the page). Save these too.

### Step 5.2 — Generate App-Specific Shared Secret

1. Back to **My Apps → Vela → App Information**.
2. Scroll to **App-Specific Shared Secret** at the bottom.
3. Click **Manage** → **Generate** → copy the 32-char secret.

### Step 5.3 — Paste into RevenueCat

1. Go to <https://app.revenuecat.com>.
2. Open the `vela` project → `vela-ios` app.
3. Click **App Store Connect API** in the left sidebar.
4. Paste:
   - **Issuer ID** (from Step 5.1)
   - **Key ID** (from Step 5.1)
   - Upload the `.p8` file (from Step 5.1)
5. Click **Save**.

6. Click **App-Specific Shared Secret** → paste the 32-char secret
   from Step 5.2.

✓ **You'll see**: a green "Connected" indicator. RevenueCat will start
syncing your IAPs from ASC (takes 1-2 minutes).

### Step 5.4 — Create the Entitlement

1. RevenueCat → **Project Settings** → **Entitlements** → **+ New
   Entitlement**.
2. Identifier: **`premium`** (lowercase, exactly this — it's hardcoded
   in `src/subscription.js`).
3. Display Name: `Premium`.
4. Click **Create**.

### Step 5.5 — Create the Offering

1. RevenueCat → **Project Settings** → **Offerings** → **+ New
   Offering**.
2. Identifier: `default`.
3. Click **Create**.
4. On the offering page → **+ Add Package**:
   - First package:
     - Identifier: `$rc_annual`
     - Product: `com.velahealth.app.premium.annual` (should auto-list
       from ASC sync)
   - Second package:
     - Identifier: `$rc_monthly`
     - Product: `com.velahealth.app.premium.monthly`
5. Drag both packages so `$rc_annual` is first (it shows as the
   recommended option in the paywall).

### Step 5.6 — Attach packages to the entitlement

1. RevenueCat → **Project Settings** → **Entitlements** → click the
   `premium` entitlement.
2. **+ Attach** → select both products you just added to the offering.
3. Save.

✓ **Verify**: RevenueCat → Customer Center → there should be no
"misconfigured" warnings on the project.

⚠ **The single biggest source of submission rejection here**:
mismatched entitlement name. The constant in `src/subscription.js` is
`premium` (lowercase). RevenueCat must use exactly that string. If
you typed `Premium` or `Vela_Premium` anywhere, the app will show
purchases as failed even though Apple charged the card. Fix by
renaming the entitlement to `premium`.

---

## Phase 6 — Netlify environment variables

These power the server-side AI calls.

### Step 6.1 — Open env vars page

1. Go to <https://app.netlify.com>.
2. Click the Vela site.
3. **Site configuration** → **Environment variables**.

### Step 6.2 — Add three variables

Click **Add a variable** for each:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | The `sk-ant-...` key from Step 2.2 |
| `REVENUECAT_REST_KEY` | RevenueCat → Project Settings → API Keys → Secret API Keys → "REST API key" (starts with `sk_`) |
| `REACT_APP_SENTRY_DSN` | The DSN from Step 2.1 |

For each: Scope = **All scopes**, Values = **Same value for all
deploy contexts**.

### Step 6.3 — Trigger a redeploy

After saving env vars, Netlify needs a fresh build to pick them up.

1. **Deploys** tab → **Trigger deploy** → **Deploy site**.
2. Wait ~2-3 minutes for the build to finish.

✓ **Verify**: visit `https://velahealth.health/api/ask-vela` in your
browser. You should see a JSON error like `{"error":"Method not
allowed"}` (POST-only endpoint). If you see "Function not found" or
"500 internal error", check the env var spelling.

---

## Phase 7 — Xcode build for TestFlight

### Step 7.1 — Open the project

1. Open Xcode.
2. **File → Open** → navigate to
   `/Users/kristopher/Vela/.claude/worktrees/competent-hodgkin-64bae4/ios/App/`
   (or your primary worktree at `/Users/kristopher/Vela/ios/App/`).
3. Open `App.xcworkspace` (NOT `App.xcodeproj` — workspace is the one
   with the white icon).

### Step 7.2 — Select your team for signing

1. Click **App** in the left file tree (the blue project icon at top).
2. Select **App** target.
3. **Signing & Capabilities** tab.
4. Check **Automatically manage signing**.
5. **Team**: select your Apple Developer team from the dropdown.
   (If your team isn't listed: Xcode → Settings → Accounts → + → sign
   in with your Apple ID.)

✓ **You'll see**: "Signing Certificate: Apple Development [Your Name]"
without any red errors.

### Step 7.3 — Add HealthKit capability

In the same **Signing & Capabilities** tab:

1. Click **+ Capability** (top left of the tab).
2. Search for **HealthKit** → double-click to add.
3. The capability appears below. Leave all the sub-options unchecked
   (we only read sleep data, no Background Delivery or Clinical
   Records).

✓ **You'll see**: HealthKit listed under Capabilities, with a green
checkmark.

### Step 7.4 — Verify the asset catalog has the 1024×1024 icon

1. In the left file tree: **App → Assets.xcassets → AppIcon**.
2. Look for the rightmost slot labeled "App Store iOS 1024pt".
3. It should have the icon image. If empty, drag in `landing/icon-1024.png`
   (from Phase 3.1).

### Step 7.5 — Set the version and build number

1. Click **App** target → **General** tab.
2. **Identity** section:
   - **Version**: `1.0.0`
   - **Build**: `1` (increment for each TestFlight upload — `2`, `3`, etc.)

### Step 7.6 — Run a quick test build

Make sure it compiles before archiving (much faster fail-fast).

1. In the toolbar, select **iPhone 15 Pro Max** simulator from the
   device dropdown (next to the Play button).
2. Press **Cmd+R** (Run).
3. Wait for build (~30-60 sec first time).

✓ **You'll see**: the simulator boots and the Vela welcome screen
appears.

If errors: read the bottom-right Issue Navigator. Common fixes:
- Missing dependency: in terminal, `cd ios/App && pod install` (if
  using CocoaPods) or wait for SPM to resolve.
- Signing error: re-do Step 7.2.

### Step 7.7 — Archive build

1. In the toolbar device dropdown, select **Any iOS Device (arm64)**
   (NOT a simulator — you can only archive for real device targets).
2. **Product → Archive** (or Cmd+Shift+B then archive).
3. Wait 3-10 minutes for the archive build to complete.

✓ **You'll see**: the **Organizer** window opens showing the new
archive at the top.

### Step 7.8 — Upload to App Store Connect

1. In Organizer, select the new archive.
2. Click **Distribute App** (right side).
3. **App Store Connect** → **Next**.
4. **Upload** → **Next**.
5. Leave defaults checked (include symbols, manage version) →
   **Next**.
6. Choose your distribution certificate (auto-selected) → **Next**.
7. Review the summary → **Upload**.
8. Wait 5-15 min for upload + Apple processing.

✓ **You'll see**: "Upload Successful" in Xcode. Then ASC processes
the binary (10-30 min). You'll get an email when it's ready.

⚠ **If Apple emails you about ITMS-XXXX errors**: read the email
carefully. Most common ones:
- ITMS-90683 "Missing Purpose String": Info.plist needs a usage
  description for some accessed framework. The ones for HealthKit are
  already in `ios/App/App/Info.plist` — verify they're there.
- ITMS-90809 "Deprecated API Usage": warning, usually not a blocker.

---

## Phase 8 — TestFlight verification on physical iPhone

### Step 8.1 — Add the build to TestFlight

1. ASC → My Apps → Vela → **TestFlight** tab.
2. Wait until the build (1.0.0 build 1) shows status **Ready to
   Submit** (not "Processing" — this takes 10-30 min after upload).
3. Click on it → fill in **Test Information** (just an email is
   enough).
4. Add yourself as an **Internal Tester**: TestFlight → Internal
   Testing → + → enter your own email.

### Step 8.2 — Install TestFlight on your iPhone

1. On your iPhone, open the App Store → search "TestFlight" → install
   (if not already installed).
2. Open TestFlight. You'll see an invite for Vela.
3. Tap **Accept** → **Install**.

✓ **You'll see**: Vela app icon appears on your home screen with an
orange dot (TestFlight builds get a dot until they expire).

### Step 8.3 — Run the 5-step verification

This is the critical pre-submission check. Don't skip.

Tap to open Vela. Verify each:

1. **Onboarding completes cleanly.**
   - Tap "Begin", answer the 4 questions, tap "Enter Vela".
   - ✓ You should land on the Today screen with the personalized
     welcome.

2. **A log saves and reappears.**
   - On Today, tap a mood face, tap a symptom or two, tap "Save
     entry".
   - Tap History tab.
   - ✓ Today's date should be highlighted in clay color in the
     calendar.

3. **Paywall + sandbox purchase.**
   - Tap Settings → Subscription → "Upgrade to Vela".
   - Tap "Start 14 days free · then $69.99/yr" if the sandbox tester is
     eligible for the introductory offer. If Apple reports the account is
     not eligible or eligibility is unknown, tap "Continue with Annual ·
     $69.99/yr".
   - You'll be prompted to sign in with a sandbox tester account.
     (Set up at ASC → Users and Access → Sandbox → Testers → +. Use a
     fresh email like `vela-sandbox-1@yourdomain.com`. Sign out of
     your real Apple ID in iPhone → Settings → App Store first.)
   - Complete the purchase.
   - ✓ Premium should unlock — Settings → Subscription should now
     show "Active".

4. **Ask Vela returns a real response.**
   - Tap Insights tab → tap the "V" floating button.
   - Type "Best questions to bring to my doctor?" → send.
   - ✓ Within 5-10 seconds, you should get a response that mentions
     specific patterns from your logged data (not generic boilerplate
     — that's the canned fallback if the API failed).

5. **Doctor report PDF generates.**
   - Settings → Doctor report.
   - ✓ A PDF should download via the iOS share sheet. Tap "Save to
     Files" → open it. You should see charts and a 12-week breakdown.

If any step fails: stop. Don't submit. Debug first. Most issues at
this stage are:
- Premium doesn't unlock → RevenueCat entitlement name mismatch (see
  Step 5.6 warning)
- Ask Vela returns canned response → Anthropic API key not set in
  Netlify (Step 6.2)
- App crashes on launch → check Sentry — that's exactly why you wired
  it

---

## Phase 9 — Submit for Review

You're here. Final step.

### Step 9.1 — Select the build

1. ASC → My Apps → Vela → **iOS App → 1.0 Prepare for Submission**.
2. Scroll to **Build** → click **+ Select a build before you submit
   your app**.
3. Choose the build that passed TestFlight verification.

### Step 9.2 — Final review

Scroll through the entire page once more. Confirm:
- [ ] All metadata fields are filled (no red exclamation marks)
- [ ] Screenshots uploaded for at least 6.7" size
- [ ] Privacy Nutrition Label complete
- [ ] App Review Information has the reviewer notes
- [ ] Build is selected
- [ ] Pricing → confirm the IAPs are listed and at the right tiers

### Step 9.3 — Submit

1. Click **Add for Review** (top right).
2. ASC will check all required fields. If any are missing, it'll list
   them and you'll fix them then come back.
3. If all green, click **Submit to App Review**.

✓ **You'll see**: status change to **Waiting for Review**. Then
**In Review** within 24-48 hours. Then **Pending Developer Release**
or **Ready for Sale** within another 24-48 hours.

🕒 **Total review time**: typically 1-3 days. Apple's median is
around 24 hours.

### Step 9.4 — If rejected

You'll get an email with a Resolution Center link. Most rejections
fall into:

- **Privacy disclosure mismatch**: see Step 4.5. Re-verify the Health
  & Fitness checkbox.
- **Subscription not working**: see RevenueCat entitlement warning,
  Step 5.6.
- **Demo notes insufficient**: rewrite the reviewer notes to be more
  specific about how to test premium features.

Reply via Resolution Center with the fix. Resubmit. Cycle is usually
24-48 hours per round.

### Step 9.5 — When approved

1. ASC → My Apps → Vela → **App Store** tab → **iOS App** → **Pricing
   and Availability**.
2. **Release this version**: choose **Manually release this version**
   if you want to coordinate the launch, or **Automatically release
   this version** to go live immediately on approval.
3. Press **Save**.

🌳 **You shipped.** Time for a walk.

---

## Right after launch

A few things to do in the first 24-48 hours after the app is live:

- [ ] Verify a real (non-sandbox) purchase works end-to-end. Use a
  real card on your own iPhone signed into your real Apple ID. Refund
  yourself afterward via ASC → Users and Access → Sandbox →
  Customers → Refund.
- [ ] Watch Sentry. First crashes will trickle in within hours.
- [ ] Watch PostHog. First "log_completed" events confirm the
  analytics is wired.
- [ ] Reply to any 1-star reviews calmly within 24 hours. Apple weighs
  responsiveness in the algorithm.

---

## When something goes wrong

- **Apple rejects with vague "guideline violation"** → ask Resolution
  Center for specifics. Reviewers often clarify within 24 hours.
- **TestFlight build won't process** → most often this is missing
  Info.plist usage descriptions. Check `ios/App/App/Info.plist` for
  every `NS*UsageDescription` key.
- **RevenueCat shows purchases as failed despite Apple charging**
  → entitlement name mismatch (see Step 5.6).
- **Ask Vela returns a 503** → Netlify env var missing or misnamed
  (see Step 6.2). Check Netlify → Site → Functions → ask-vela →
  recent invocations for the actual error.
- **Sentry doesn't show events** → wrong DSN, OR the iOS app build
  was made before the env var was set. Re-build and re-upload.

If you get truly stuck, spawn a Cowork session with the exact error
message + which step you're on, and ask for triage. Same as how the
smoke-test session worked.

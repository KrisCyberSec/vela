# App Store Connect paste sheet

Every ASC form field, in the order ASC presents them, with the exact
text from `appstore-metadata.md`. Open this side-by-side with
<https://appstoreconnect.apple.com>.

Narrative source: `docs/operations/launch-walkthrough.md` § Phase 4.
Metadata source of truth: `appstore-metadata.md` (last polish:
2026-05-13, commit `d9d5b67`).

## Sign in + create the app record

1. <https://appstoreconnect.apple.com> → sign in.
2. **Apps** → blue **+** → **New App**. Fill:

| Field | Value |
|---|---|
| Platforms | ☑ iOS |
| Name | `Vela: Menopause Companion` |
| Primary Language | English (U.S.) |
| Bundle ID | `com.velahealth.app` (from dropdown) |
| SKU | `vela-ios-001` |
| User Access | Full Access |

If `com.velahealth.app` is missing from the Bundle ID dropdown:
<https://developer.apple.com/account/resources/identifiers/list>
→ **+** → **App IDs** → **App** → register it first.

## Page: App Information

Sidebar → **App Information**.

| Field | Value |
|---|---|
| Subtitle | `Track symptoms. See patterns.` |
| Privacy Policy URL | `https://velahealth.health/privacy.html` |
| Category — Primary | Health & Fitness |
| Category — Secondary | (leave blank) |
| Content Rights — Third-party content? | No |

Click **Save** (top right).

## Page: Pricing and Availability

Sidebar → **Pricing and Availability**. Price: **Free**, Availability:
**All territories**. The IAPs are where the money lives.

## Page: Monetization → In-App Purchases

Sidebar → **Monetization → In-App Purchases → +**. Create both:

| Common | Annual | Monthly |
|---|---|---|
| Type | Auto-Renewable Subscription | Auto-Renewable Subscription |
| Reference Name | `Premium Annual` | `Premium Monthly` |
| Product ID | `com.velahealth.app.premium.annual` | `com.velahealth.app.premium.monthly` |
| Subscription Group | **Create New** → `vela_premium` | **Existing** → `vela_premium` |
| Duration | 1 Year | 1 Month |
| Price | **Tier 70** ($69.99 USD) | **Tier 9** ($8.99 USD) |
| Free Trial | 14 Days | 14 Days |
| Display Name (en-US) | `Vela Premium (Annual)` | `Vela Premium (Monthly)` |

Both Description fields (English U.S.):
`Unlimited Ask Vela, daily brief, doctor PDF reports, personalized experiments, and more.`

Review Screenshot for each: upload one of the paywall screenshots from
`screenshot-script.md`. Review Notes for each:
`Tap "Try free for 14 days" on the paywall to subscribe. Sandbox tester accounts work normally.`

Both end at "Ready to Submit" (yellow) — turns green after first build
ships alongside them.

## Page: App Privacy ⚠ HIGHEST REJECTION RISK

Sidebar → **App Privacy** → **Get Started** (or **Edit**).

Sequence matters — follow exactly:

1. **"Do you or your third-party partners collect data?"** → **Yes**

   ⚠ Counter-intuitive but correct. Ask Vela sends an anonymized
   summary to our Netlify proxy → Anthropic. That counts as
   collection, even though it's stripped (no notes, no custom names,
   no exact dates).

2. **Data Type screen** — check ONLY:
   - ☑ **Health & Fitness** → **Health & Fitness** (sub-category)

   Leave Contact Info, Identifiers, Location, Browsing History,
   Purchases, etc. UNCHECKED.

3. Click **Save**.

4. **Health & Fitness configuration** (next screen):

| Question | Answer |
|---|---|
| How is this data used? | ☑ **App Functionality** ONLY. Uncheck Analytics, Product Personalization, App Functionality, Developer's Advertising or Marketing, Third-Party Advertising, Other Purposes. |
| Is the data linked to the user's identity? | **No** |
| Is the data used for tracking? | **No** |

5. **Save**.

✓ The Privacy Nutrition Label preview should show:
- "Data Used to Track You" → Data Not Collected
- "Data Linked to You" → Data Not Collected
- "Data Not Linked to You" → Health & Fitness

If a reviewer rejects: come back here, re-verify the Health & Fitness
checkbox. Cross-reference against `landing/privacy.html` — they must
match.

## Page: 1.0 Prepare for Submission

Sidebar → **Vela → iOS App → 1.0 Prepare for Submission**.

**Screenshots**: tab **iPhone 6.7" Display** → drag in
`screenshots/67/01-welcome.png` ... `06-history.png`. Reorder so the
carousel reads: Welcome, Insights, Ask Vela, Today, Paywall, History.
Same for **iPhone 6.5" Display** with `screenshots/65/*.png`.

| Field | Value |
|---|---|
| Promotional Text | `Track perimenopause and menopause symptoms in seconds. Spot patterns, ask AI grounded in your own data, and bring the picture to your doctor.` |
| Description | Paste the block under `## Description` in `appstore-metadata.md` (starts "Your body is changing.", ends "Always consult your healthcare provider.") |
| Keywords | `perimenopause,hot flashes,night sweats,HRT,estrogen,hormones,cycle,brain fog,mood,tracker,log` |
| Support URL | `mailto:support@velahealth.health` |
| Marketing URL | `https://velahealth.health` |
| Version | `1.0.0` |
| Copyright | `© 2026 Lindsay Kristopher` |
| What's New | `Hello. This is the first release of Vela, built for women in perimenopause and menopause. Track what's happening, see the patterns, and walk into your next appointment prepared.` |

## Page: App Review Information

Same scroll, lower. Sign-In Required **No**. Contact: name, phone,
`lindsaykristopher@gmail.com`. Demo Account: blank. Notes (paste):

> Vela has no login or account. Tap "Begin" on the welcome screen to start the 90-second onboarding. To exercise premium features without a real subscription, please use the App Store sandbox tester flow against the in-app paywall. The "Ask Vela" feature sends an anonymized summary of symptom data (no notes, no custom symptom names, no exact dates) to Anthropic's Claude API via our Netlify proxy. Disclosure in Settings → Privacy & Data and in our privacy policy at velahealth.health/privacy.html.

**Save**. The Build slot stays empty until Xcode (see `xcode-build.md`).

## After approval — public-listing verification

Visit `https://apps.apple.com/us/app/vela-menopause-companion/id<APP_ID>`
(App ID from ASC → App Information). Confirm the public listing shows:
subtitle "Track symptoms. See patterns.", description starting with
"Your body is changing.", privacy "Health & Fitness — Not Linked to
You", IAP prices $69.99/yr + $8.99/mo, screenshots in the right
carousel order. If anything drifted, edit in ASC → Save → metadata-only
update (no re-review).

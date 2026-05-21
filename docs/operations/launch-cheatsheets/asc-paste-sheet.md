# App Store Connect paste sheet

Every ASC form field, in the order ASC presents them, with the exact
text from `appstore-metadata.md`. Open this side-by-side with
<https://appstoreconnect.apple.com>.

Narrative source: `docs/operations/launch-walkthrough.md` § Phase 4.
Trust source of truth: `docs/operations/app-store-trust-packet.md`.
Metadata source of truth: `appstore-metadata.md` (last review:
2026-05-21).

**Working together.** ASC sign-in needs your Apple ID, so the
clicking is yours. I'll be on standby for: (a) reading any paste-ready
string out of `appstore-metadata.md` if you'd rather not switch
windows, (b) decoding any reviewer-rejection email Apple sends, (c)
once the listing is live, say "check the public listing" and I'll
fetch `apps.apple.com/.../id<APP_ID>` from Chrome and diff against
`appstore-metadata.md`.

## Sign in + create the app record

1. <https://appstoreconnect.apple.com> → sign in.
2. **Apps** → blue **+** → **New App**. Fill:

| Field | Value |
|---|---|
| Platforms | ☑ iOS |
| Name | `Vela - Menopause Companion` |
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
| Category — Secondary | Leave blank |
| Content Rights — Third-party content? | No |

Click **Save** (top right).

## Page: Pricing and Availability

Sidebar → **Pricing and Availability** → Price **Free** + Availability
**All territories**. (The IAPs are where the money lives.)

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
`Tap the Annual purchase button on the paywall. If the sandbox Apple ID is eligible for the introductory offer, the button says "Start 14 days free · then $69.99/yr"; otherwise it says "Continue with Annual · $69.99/yr". Sandbox tester accounts work normally.`

Both end at "Ready to Submit" (yellow) — turns green after first build
ships alongside them.

## Page: App Privacy - highest rejection risk

Sidebar → **App Privacy** → **Get Started** (or **Edit**). Sequence:

1. **"Do you or your third-party partners collect data?"** → **Yes**.
   Counter-intuitive but correct — Ask Vela sends an anonymized
   summary to our Netlify proxy → Anthropic, which counts as
   collection (even with notes / custom names / exact dates stripped).
2. **Data Type screen** — check:
   - ☑ **Health & Fitness → Health**
   - ☑ **Purchases → Purchase History**
   - ☑ **Identifiers → User ID**
   - ☑ **Usage Data → Product Interaction**
   - ☑ **Diagnostics → Crash Data**
   - ☑ **Diagnostics → Other Diagnostic Data**
3. Configure each selected type:

| Data type | Use | Linked? | Tracking? |
|---|---|---|---|
| Health | App Functionality + Product Personalization | No | No |
| Purchase History | App Functionality + Analytics | No, while using anonymous RevenueCat IDs | No |
| User ID | App Functionality | No, while anonymous and not tied to email/login | No |
| Product Interaction | Analytics | No | No |
| Crash Data | App Functionality | No | No |
| Other Diagnostic Data | App Functionality | No | No |

4. **Save**. Preview should show no tracking, no data linked to
   identity, and the selected categories under "Data Not Linked to You."

If a reviewer rejects, re-verify this list against `landing/privacy.html`
and `ios/App/App/PrivacyInfo.xcprivacy` — they must match.

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
| Support URL | `https://velahealth.health/support.html` |
| Marketing URL | `https://velahealth.health` |
| Version | `1.0.0` |
| Copyright | `2026 Lindsay Kristopher` |
| What's New | `Hello. This is the first release of Vela, built for women in perimenopause and menopause. Track what's happening, see the patterns, and walk into your next appointment prepared.` |

## Page: App Review Information

Same scroll, lower. Sign-In Required **No**. Contact: name, phone,
`support@velahealth.health`. Demo Account: blank. Notes (paste):

> Vela has no login or account. Tap "Begin" on the welcome screen to start onboarding. To exercise premium features, use the App Store sandbox tester flow against the in-app paywall. Ask Vela and Daily Brief send anonymized summaries of symptom data through Vela's Netlify API to Anthropic's Claude API. The summaries exclude notes, custom symptom names, exact dates, name, email, and advertising identifiers. Apple Health is optional and reads sleep hours only after the user enables it in Settings. Vela is informational and not medical advice. Backend services are live at `https://velahealth.health/api/*`.

**Save**. The Build slot stays empty until Xcode (see `xcode-build.md`).

## After approval — public-listing verification

Visit `https://apps.apple.com/us/app/vela-menopause-companion/id<APP_ID>`
(App ID from ASC → App Information). Confirm the public listing shows:
subtitle "Track symptoms. See patterns.", description starting with
"Your body is changing.", privacy "Health & Fitness — Not Linked to
You", IAP prices $69.99/yr + $8.99/mo, screenshots in the right
carousel order. If anything drifted, edit in ASC → Save → metadata-only
update (no re-review).

# App Store Trust Packet

Current as of 2026-05-21. This is the single review-safe packet for App
Store Connect, App Review notes, privacy answers, HealthKit justification,
and subscription disclosures.

Use this with:
- [../../appstore-metadata.md](../../appstore-metadata.md) for exact
  customer-facing listing text.
- [launch-cheatsheets/asc-paste-sheet.md](launch-cheatsheets/asc-paste-sheet.md)
  for click-by-click App Store Connect entry.
- [manual-tasks.md](manual-tasks.md) for human-only dashboard blockers.

## Apple guidance checked

Official Apple sources checked on 2026-05-21:
- App privacy labels must include data collected by Vela and third-party
  partners, and privacy answers must stay accurate:
  <https://developer.apple.com/app-store/app-privacy-details/>
- iOS apps require a privacy policy URL in App Store Connect:
  <https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy>
- Support URL is required and must be a full URL with real contact info:
  <https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information>
- App Review wants complete metadata, live backend services, and clear
  explanations for non-obvious features and in-app purchases:
  <https://developer.apple.com/app-store/review/guidelines/>
- HealthKit apps must request only needed data, include usage strings, and
  disclose specific health data collected:
  <https://developer.apple.com/documentation/healthkit/setting-up-healthkit>

## Store URLs

Use these in App Store Connect:

| Field | Value |
|---|---|
| Privacy Policy URL | `https://velahealth.health/privacy.html` |
| Support URL | `https://velahealth.health/support.html` |
| Marketing URL | `https://velahealth.health` |

Do not use a `mailto:` link for Support URL. Apple expects a full URL with
the protocol. The committed support page includes the support email,
subscription restore guidance, privacy links, and medical disclaimer.

## App identity

| Field | Value |
|---|---|
| Platforms | iOS |
| Bundle ID | `com.velahealth.app` |
| SKU | `vela-ios-001` |
| App Name | `Vela - Menopause Companion` |
| Subtitle | `Track symptoms. See patterns.` |
| Primary category | Health & Fitness |
| Secondary category | Leave blank |
| Content rights | No third-party content |
| Copyright | `2026 Lindsay Kristopher` unless a legal entity is active before submission |
| Age rating | Let ASC calculate from the questionnaire. Accept 12+ if menopause education is classified as Medical/Treatment Information. |

## Privacy nutrition label

Answer "Yes" to data collection. Vela is local-first, but the label must
include AI summaries, RevenueCat purchase state, PostHog product events,
and Sentry diagnostics.

| Data type | Purposes | Linked to user? | Tracking? | Why |
|---|---|---|---|---|
| Health | App Functionality, Product Personalization | No | No | Ask Vela and Daily Brief send anonymized health summaries. Apple Health sleep import is HealthKit-derived. |
| Purchase History | App Functionality, Analytics | No | No | RevenueCat receives Apple receipts and anonymous app user IDs for subscription status. |
| User ID | App Functionality | No | No | Anonymous RevenueCat app user ID, also used for Sentry grouping. No login/email identity. |
| Product Interaction | Analytics | No | No | PostHog captures small event names and status/count labels only. |
| Crash Data | App Functionality | No | No | Sentry crash/error reports. |
| Other Diagnostic Data | App Functionality | No | No | Sentry diagnostics and non-health error context. |

Leave unchecked:
- Contact Info
- Location
- Contacts
- User Content
- Browsing History
- Search History
- Identifiers used for tracking or advertising
- Sensitive Info beyond the Health category above
- Advertising Data

Review expectation: Product Page Preview should show no tracking, no data
linked to identity, and the selected categories under Data Not Linked to You.

## AI disclosure

Paste-ready reviewer explanation:

> Vela has no login or account. Ask Vela and Daily Brief are premium AI
> features. They send an anonymized summary of recent symptom data through
> Vela's Netlify API to Anthropic's Claude API. The summary includes recent
> counts, averages, correlations, cycle context, and active experiments. It
> does not include notes, custom symptom names, exact dates, name, email, or
> advertising identifiers. The app discloses this in Settings > Privacy &
> Data and in the privacy policy.

Do not claim:
- "Your data never leaves your device."
- "No cloud uploads."
- "AI doctor."
- "Diagnose", "treat", "cure", or "prevent" menopause or any condition.
- Real-user testimonials unless Kris can prove consent and source.

Safe phrasing:
- "Your detailed health log stays on your device."
- "AI features use anonymized summaries."
- "Informational, not medical advice."
- "Bring better questions to your healthcare provider."

## HealthKit justification

Current implementation:
- Reads Apple Health sleep analysis only.
- Does not write health data.
- Uses `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription`
  because iOS requires both strings for HealthKit authorization flows.
- Requires Xcode Signing & Capabilities > HealthKit before the App Store
  provisioning profile is valid.

Paste-ready HealthKit note:

> Vela requests Apple Health permission only when the user enables Apple
> Health in Settings. Vela reads sleep hours from HealthKit so the user does
> not have to retype sleep data in the daily log. Vela does not write data to
> Apple Health, does not request Clinical Health Records, and does not use
> HealthKit data for advertising, tracking, or marketing.

## Subscription disclosure

Products:

| Product ID | Type | Price | Trial | RevenueCat package |
|---|---|---|---|---|
| `com.velahealth.app.premium.annual` | Auto-renewable subscription | $69.99/year | 14 days | `$rc_annual` |
| `com.velahealth.app.premium.monthly` | Auto-renewable subscription | $8.99/month | 14 days | `$rc_monthly` |

Premium value prop to use consistently:
- Ask Vela, grounded in anonymized user summaries.
- Daily Brief and tomorrow forecast.
- Doctor-ready PDF reports.
- Personalized experiments based on detected patterns.
- Cycle prediction, including irregular cycles.
- Apple Health sleep auto-fill.
- Full history beyond the free tier's last 7 days.

Paste-ready IAP review note:

> Tap the paywall from any premium feature. The Annual button shows the
> 14-day introductory offer when RevenueCat reports sandbox eligibility; if
> the sandbox Apple ID is not eligible, it shows standard pricing. Restore
> purchase is available on the same paywall.

## App Review notes

Paste this into App Review Information:

> Vela has no login or account. Tap "Begin" on the welcome screen to start
> onboarding. To exercise premium features, use the App Store sandbox tester
> flow against the in-app paywall. Ask Vela and Daily Brief send anonymized
> summaries of symptom data through Vela's Netlify API to Anthropic's Claude
> API. The summaries exclude notes, custom symptom names, exact dates, name,
> email, and advertising identifiers. Apple Health is optional and reads
> sleep hours only after the user enables it in Settings. Vela is
> informational and not medical advice. Backend services are live at
> `https://velahealth.health/api/*`.

Contact:
- Email: `support@velahealth.health`
- Phone: Kris's phone number in ASC only
- Sign-in required: No
- Demo account: blank

## Pre-submit checks

Do all of these before Submit for Review:

- `CI=true npm test -- --watchAll=false`
- `CI=true npm run build`
- `npx cap sync ios`
- Physical iPhone TestFlight boot
- Onboarding completes
- Daily log saves and appears in History
- Sandbox annual purchase unlocks Premium
- Restore purchase works
- Ask Vela returns a real response
- Daily Brief returns or fails gracefully
- Doctor PDF generates and shares
- Apple Health permission prompt appears only from Settings
- Privacy policy, terms, and support URLs load publicly
- App Store privacy label matches `ios/App/App/PrivacyInfo.xcprivacy`

## Current blockers

Still blocked on Kris, by design:
- Apple Developer Program enrollment/payment.
- App Store Connect app record.
- App Store Connect IAPs, shared secret, and API key.
- RevenueCat App Store connection and real iOS public key.
- Xcode signing team plus HealthKit capability.
- TestFlight sandbox purchase.

# Vela — Design System

Self-contained reference for the Vela design language. Hand this whole document to Claude Design (or any design AI) as context when designing new surfaces. Source-of-truth for tokens lives in `src/App.jsx` `:root { ... }` and `[data-theme="dark"] { ... }` blocks; this doc mirrors them in human + AI readable form.

---

## Brand essence

**Audience:** women 45–55 navigating perimenopause / menopause. Often dismissed by the medical system, often underserved by tech apps that skew younger.

**Voice:** calm, editorial, mature, evidence-based. Never cute, never urgent, never childish. Closer to a New York Times Magazine wellness feature than a wellness-tech app.

**One-line positioning:** "Your body, finally understood."

**What we are NOT:**
- Not pink-pastel "girlboss wellness"
- Not aggressively gamified (gamification exists but is restrained)
- Not buzzword-y ("AI-powered", "revolutionary", "cutting-edge" all forbidden)
- Not paywall-noisy
- Not full of system emojis

---

## Color tokens

### Light mode (`:root`)

| Token | Value | Use |
|-------|-------|-----|
| `--clay` | `#C97B5C` | Primary accent (CTAs, active states, highlights) |
| `--clay-light` | `#F2E8E1` | Soft clay tint for active backgrounds, chips |
| `--clay-dark` | `#8C4E32` | Headlines on accent, icon stroke color |
| `--sage` | `#7A9E87` | Secondary accent (success, growth, evidence-based callouts) |
| `--sage-light` | `#EAF0EC` | Soft sage card fills, completion states |
| `--sage-dark` | `#3D6B4F` | Sage headlines, deep accents |
| `--cream` | `#FAF6F1` | Page background — the dominant surface |
| `--ink` | `#2C1F17` | Primary text |
| `--ink-mid` | `#6B5347` | Secondary text |
| `--ink-light` | `#A89080` | Tertiary text, labels |
| `--gold` | `#D4A853` | Premium accent only — paywall CTA, premium badges |
| `--border` | `#EDE0D8` | Card / input borders |
| `--card-bg` | `#FFFFFF` | Card surfaces |

### Dark mode (`[data-theme="dark"]`)

Warm dark tones — never cool gray. The dark mode is "candlelight," not "midnight."

| Token | Value |
|-------|-------|
| `--clay` | `#D9977E` |
| `--clay-light` | `#3A2A22` |
| `--clay-dark` | `#E8B59E` |
| `--sage` | `#8FB89B` |
| `--sage-light` | `#1E2E24` |
| `--sage-dark` | `#A8D4B4` |
| `--cream` | `#1A1412` |
| `--ink` | `#F0E8E2` |
| `--ink-mid` | `#BDA898` |
| `--ink-light` | `#887568` |
| `--gold` | `#E0BD6D` |
| `--border` | `#342820` |
| `--card-bg` | `#241C17` |

### Color usage rules

- **Cream is the page.** Every screen background. Never white in light mode.
- **White cards on cream.** Cards lift off the page via white fill + subtle border.
- **Clay is conviction.** Use for primary actions, never for ambient decoration.
- **Sage is reassurance.** Evidence-based content, completion states, growth.
- **Gold is premium.** Reserved for paywall CTAs and premium-only callouts.
- **Earth tones, not pastels.** If a designer reaches for pink/lavender, they've drifted.

---

## Liquid Glass material tokens

Apple's iOS 26 Liquid Glass language, tinted in the brand palette. Used for **floating UI surfaces only** (tab bar, toasts, modal scrims, reveal cards). Not for static content cards.

| Token | Value | Where |
|-------|-------|-------|
| `--glass-cream` | `rgba(250, 246, 241, 0.72)` | Bottom nav, primary floating surfaces |
| `--glass-cream-strong` | `rgba(250, 246, 241, 0.88)` | High-contrast contexts |
| `--glass-sage` | `rgba(122, 158, 135, 0.16)` | Subtle sage-tinted accents |
| `--glass-sage-card` | `rgba(234, 240, 236, 0.78)` | Reveal cards, tip cards |
| `--glass-modal-scrim` | `rgba(60, 45, 35, 0.32)` | Scrim under blurred modals (warm, never harsh black) |
| `--glass-edge` | `rgba(255, 255, 255, 0.55)` | Inner top-edge highlight (the "lift") |
| `--glass-blur` | `blur(40px) saturate(180%)` | Standard depth |
| `--glass-blur-strong` | `blur(60px) saturate(180%)` | Prominent floating elements |

**Always include `-webkit-backdrop-filter` for iOS WebView compatibility.**

Standard glass surface recipe:
```css
background: var(--glass-cream);
-webkit-backdrop-filter: var(--glass-blur);
backdrop-filter: var(--glass-blur);
border: 1px solid var(--border);
box-shadow:
  inset 0 1px 0 var(--glass-edge),  /* the lift */
  0 6px 24px rgba(140, 78, 50, 0.12),
  0 1px 3px rgba(140, 78, 50, 0.08);
```

---

## Typography

| Family | Weight | Use |
|--------|--------|-----|
| `'DM Serif Display', serif` | regular + italic | All headers, hero text, screen titles, card titles in editorial moments |
| `'DM Sans', sans-serif` | 400 / 500 / 600 | Body text, labels, buttons, all chrome |

**Scale:**
- Hero / screen title: 22–28px serif
- Card title: 16px serif
- Body: 13–15px sans
- Label / caption: 10–12px sans, often uppercase + letter-spaced 0.06em
- Section label: `font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-light);`

**Italics matter.** Hero headlines often emphasize a phrase via italic in the serif:
> Your body,&nbsp;*finally understood.*

Don't bold-emphasize body text. Use italics or color-shift to ink-mid.

---

## Geometry

| Token | Value |
|-------|-------|
| `--radius` | `16px` (cards, modals, primary surfaces) |
| `--radius-sm` | `10px` (small chips, secondary buttons) |
| Floating dock | `24px` |
| Reveal cards | `22px` |
| Pill chips, segmented controls | `14–18px` (concentric — child radius < parent) |

**Concentric radii:** child element radius should be smaller than parent. Bottom nav (24px) wraps tab buttons (18px). Settings card (16px) wraps rows (no radius).

**Phone-first.** App container: `max-width: 420px` centered. The design is iPhone-shaped.

**Whitespace:** generous. Sections separated by 16–24px vertical padding. Cards spaced 12px apart in stacks.

---

## Iconography

**Phosphor Icons** (`@phosphor-icons/react`), **duotone weight**. Always.

- **Inactive:** `color: var(--clay-dark)`
- **Active:** `color: var(--clay)` (or `var(--sage-dark)` in sage contexts)
- **Sizes:** 14px (inline chips), 22px (UI icon default), 26px (symptom tile), 48px (hero icon in reveal cards)

**Two registries** in `src/App.jsx`:
- `SYMPTOM_ICONS` — health-symptom names (Flame for hot flash, Brain for brain fog, BatteryLow for fatigue, etc.)
- `UI_ICONS` — chrome (Bell for reminders, Lock for privacy, Star for premium, etc.)

**Emoji is allowed in two places only:**
1. **Mood selector:** 😔 😕 😐 🙂 😊 — emojis ARE the right vocabulary for human emotion
2. **Plant-themed milestone badges:** 🌱 Seedling → 🌿 Sprouting → 🌳 Taking Root → 🌲 Deeply Rooted — brand language

Anywhere else, system emojis read childish for the audience. Use Phosphor.

---

## Component patterns

### Button — primary
Clay fill, white text, full width, 14px padding, 10px radius. `font-weight: 600`. Hover: `opacity: 0.9`. Active: `transform: scale(0.97)`.

### Button — secondary / glass
Cream background, ink text, 1px border, same dimensions as primary. Used for "skip" / "continue" actions adjacent to a primary CTA.

### Card — content
White (`--card-bg`) on cream, 16px radius, 1px border, 16–18px padding. No shadow by default. Stationary content (settings rows, history entries, lessons).

### Card — accent (Evidence-Based Tip)
Solid `--sage` background, white text, 16px radius. Deliberately the only solid-sage element on most screens.

### Card — glass (reveal, accent floating)
`--glass-sage-card` background + backdrop-filter blur + edge highlight. Floats over content. Reveal carousel uses these.

### Bottom nav (floating pill-dock)
Glass cream surface with backdrop blur. Floats `env(safe-area-inset-bottom) + 10px` above the bottom edge. 5 equal-width tabs. Active tab: solid clay fill, white text, rounded pill (18px) inside the parent (24px). 1px border, layered shadow.

### Toast
Sage glass (`rgba(61, 107, 79, 0.78)` + blur), white text, 22px pill, floats 86px above bottom (clears the nav). Inset white edge highlight.

### Section label
```css
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.06em;
color: var(--ink-light);
```
Always paired with a card or grid below it.

### Segmented control (3-way)
Cream background pill (14px radius), 4px padding. Inactive buttons transparent. Active button: clay fill, white text, 10px radius, `font-weight: 600`. Used for theme toggle.

---

## Voice & tone

Sample copy to calibrate to:

> ✓ "Your body, finally understood."
> ✓ "Track for free. Understand with Premium."
> ✓ "Walk in prepared. Generate a doctor-ready PDF with your symptom history."
> ✓ "Hot flashes appeared on 7 of the last 7 days — your most frequent symptom this week."
> ✓ "Vela is personalized for perimenopause, with a focus on hot flashes and sleep."

> ✗ "🔥 Unlock the secret to crushing menopause!"
> ✗ "Our AI-powered platform leverages cutting-edge insights..."
> ✗ "You've earned 50 XP! Keep going!"
> ✗ "Limited-time offer — only 24 hours left!"

**Rules:**
- Address the user directly: "your body," "your patterns," "you logged"
- Concrete numbers over adjectives: "7 of the last 7 days" not "frequent"
- Say "menopause" / "perimenopause" plainly. Don't euphemize.
- Cite evidence when it strengthens trust ("up to 80% of women...")
- Never overclaim. We surface patterns; we don't diagnose.

---

## Privacy posture (affects every design decision)

**"Your data stays on your device."** This is reinforced in:
- The paywall fine print
- Settings → Data storage row
- Privacy policy
- App Store metadata

Any new design that proposes cloud sync, account creation, or data sharing **breaks the brand promise**. If a design needs server-side anything, the privacy story has to be redesigned alongside it.

---

## What's distinctive about Vela vs the menopause-app cluster

Quick reference for "is this design choice on-brand":

| Dimension | Vela | Caria / Balance / Flo |
|-----------|------|------------------------|
| Header type | Serif (DM Serif Display) | Sans |
| Palette | Earth (clay/sage/cream) | Pastel / wellness-tech |
| Material | Liquid Glass tinted | Mostly flat |
| Iconography | Phosphor Duotone | System emoji or stock icons |
| Tab bar | Floating glass pill-dock | Edge-to-edge solid |
| Voice | Editorial, evidence | Cheerful, motivational |
| Onboarding | 4 questions, with Back | Often 8+ |
| Privacy story | Lead | Afterthought |

When a new screen design is proposed, ask: does it look more like Vela or more like the cluster? If it's drifting toward the cluster, it's wrong.

---

## File references

- Tokens (canonical): `src/App.jsx` lines ~1885–2050
- Theme switching: `src/theme.js`
- Icon registries: `src/App.jsx` `SYMPTOM_ICONS` and `UI_ICONS` constants
- Glass material recipes: `src/App.jsx` `.nav-bottom`, `.toast`, `.reveal-card`
- Bottom nav assembly: search `nav-bottom` in `src/App.jsx`

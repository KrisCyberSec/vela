# Architecture

Technical reference for the Vela codebase. Use this to navigate the single-file React app and understand how major systems fit together.

## Tech stack

| Layer | Tech | Why |
|-------|------|-----|
| UI framework | React 18 | Mature, well-understood |
| File structure | Single file (`src/App.jsx`) | All components, CSS-in-JS, constants in one place — fast to grep, zero import overhead for MVP |
| Build tool | Create React App (react-scripts 5) | Defer build tooling decisions until scaling warrants them |
| iOS shell | Capacitor 8 | Native iOS app from React with minimal platform code |
| PDF generation | jsPDF 4 | Doctor reports |
| Community backend | Firebase 12 (Firestore + anonymous auth) | Ready to enable; see [community-firebase.md](community-firebase.md) |
| Storage | `localStorage` | On-device, privacy-first, no server required |
| Haptics | `@capacitor/haptics` | Native iOS feedback on badges, level-ups, nudges |

## File layout

```
src/
├── App.jsx       ← everything (~7800 lines)
└── index.js      ← React entry point
src/community.js  ← Firebase community module (flip-ready)
```

**Why a single file?** During MVP, keeping all components in `App.jsx` means:
- Grep-friendly (find any symbol in one pass)
- Zero import ceremony
- Refactor friction-free — no file churn when renaming components

When the file grows past a threshold where navigation is painful, we'll split by screen (`TrackerScreen.jsx`, `InsightsScreen.jsx`, etc.). Not yet.

## `App.jsx` section map

Navigate the file by line range:

| Lines | Section |
|-------|---------|
| 1–11 | Imports + haptic feedback wrapper |
| 13–121 | Symptom/UI constants: `SYMPTOM_CATEGORIES`, `SYMPTOMS` (51), `QUESTIONS`, `MOODS` |
| 122–177 | Utility helpers: `getGreeting`, `localDateStr`, `getStreak`, `applyStreakFreeze` |
| 180–250 | Profile personalization: `getPersonalization` |
| 251–265 | Early analytics: `computeEarlyStats` |
| 266–360 | Pattern analysis: `analyzePatterns` (sequences, weekday peaks, mood correlations, co-occurrence) |
| 362–488 | Prediction & insights: `predictSymptoms`, `analyzeCorrelations`, `getBestInsight`, `monthlyComparison` |
| 509–763 | Doctor report: `analyzeSymptomTrend`, `analyzeTriggerImpact`, `generateDoctorSummary` |
| 779–1007 | Ask Vela legacy knowledge base (kept as fallback): `SYMPTOM_KNOWLEDGE`, `TRIGGER_KNOWLEDGE`, `getSymptomKnowledge`, `getStageContext` |
| 1008–1475 | Ask Vela legacy router (fallback path): `matchQuestion`, `generateResponse`, `generateWeeklyDigest` |
| see ai-companion.md | **Real Ask Vela + Daily Brief** are now Anthropic Claude-backed via Netlify Functions (`netlify/functions/ask-vela.js`, `daily-brief.js`). Client helpers `buildAskVelaSummary`, `buildDailyBriefSummary`, `looksLikeCrisis`, `CrisisSupportCard` live in App.jsx. Full spec in `docs/engineering/ai-companion.md`. |
| see App.jsx | **Other intelligence engines (statistical, on-device):** `analyzeCorrelations` (adaptive same-day + lag), `detectAnomalies` (z-score), `predictNextCycle`, `forecastTomorrow` (Bayesian), `suggestExperiments`, `buildWeeklySummary`, `compareExperiment`, `getInsightFeedback` + `applyFeedbackRanking`. |
| Note | Line numbers are approximate and drift as the file evolves. Use grep with the symbol name. |
| 1549–1669 | Gamification: `BADGES` (23), `LEVELS` (10), `computeGamificationStats`, `computeXP`, `getLevel` |
| 1677–1870 | Content libraries: `EXPERIMENTS` (16), `DAILY_LESSONS` (60), `CBT_PROGRAMS` (3) |
| 1874–3588 | Global styles (CSS-in-JS) |
| 3589–6800 | Screen components (see below) |
| 6800–7375 | Community: `COMMUNITY_TOPICS` (5), `CommunityScreen`, post/reply/vote logic |
| 7376–7843 | Main `App` component: state, tab routing, badge/level-up detection |

## Screen components

| Component | Line | Role |
|-----------|------|------|
| `OnboardingScreen` | 3589 | 4-question wizard (stage, concerns, goals, guidance) |
| `TrackerScreen` | 3730 | Main daily log: mood, energy, symptoms, context, notes |
| `HistoryScreen` | 4599 | Calendar/table view of past logs |
| `MoodLineChart` | 4699 | Mood over time |
| `SymptomHeatmap` | 4798 | Symptom frequency by day-of-week |
| `SleepSymptomScatter` | 4874 | Sleep hours vs symptom count |
| `InsightLibrary` | 4948 | Browse curated insights |
| `InsightsReveal` | 4990 | First-time 7-step animated insights reveal |
| `InsightsScreen` | 5094 | Main insights hub |
| `PaywallScreen` | 6039 | Premium subscription upsell |
| `EditQuestionScreen` | 6421 | Edit onboarding answers |
| `MilestonesCard` | 6485 | Badges + level display |
| `SettingsScreen` | 6526 | Profile, data export, reminders, debug |
| `CommunityScreen` | 6940 | Topics, posts, replies, voting |

## Key systems

### Logging (core loop)

- `TrackerScreen` (3730) — the UI
- `handleLog` (7451) — persists an entry, updates streak, fires toasts, triggers badge detection
- Storage: `localStorage["vela_logs"]` — array of entries with `{ date, mood, energy, symptoms[], context{}, notes }`

### Pattern analysis

- `analyzePatterns` (266) — four pattern types: symptom sequences, weekday peaks, mood-symptom inverse, co-occurring pairs
- `analyzeCorrelations` (418) — sleep vs symptoms, trigger impact scores, symptom clusters
- Surfaced in `InsightsScreen` and the weekly digest

### Ask Vela (AI companion)

Full reference in [ai-companion.md](ai-companion.md). Summary:

- `matchQuestion(input)` (1008) — regex router → returns `{ handler, param, timeRange }`
- `generateResponse(handler, logs, profile)` (1106) — 14 handlers, each assembling `data → 📚 science → 💡 strategy → 📋 stage context → ⚕️ doctor nudge → follow-up suggestion`
- Knowledge: `SYMPTOM_KNOWLEDGE` (15 symptoms), `TRIGGER_KNOWLEDGE` (5 triggers)
- Conversational memory: module-level `_lastHandler`, `_lastParam` (around line 826)

### Doctor PDF report

- `generateDoctorReport` (6130) — jsPDF export with symptom frequency, severity trends, trigger analysis, patterns
- `generateDoctorSummary` (709) — structured text summary that feeds the PDF
- Entry point: `SettingsScreen` → "Generate doctor report" button

### CBT programs

- `CBT_PROGRAMS` (1759) — 3 programs: Hot Flashes (4wk), Sleep (3wk), Anxiety/Mood (4wk)
- Each has 3–4 modules with 5–7 daily lessons
- XP rewards: 200/150/200 per program
- Storage: `vela_active_cbt`, `vela_completed_cbt`

### Self-experiments

- `EXPERIMENTS` (1677) — 16 structured experiments, 7–14 days each
- Tracked via context fields (e.g., `caffeine: false`, `exercise: true`)
- XP: 40–75 per experiment
- Storage: `vela_active_experiment`, `vela_completed_experiments`

### Daily lessons

- `DAILY_LESSONS` (1696) — 60 lessons, 10 XP each
- Storage: `vela_completed_lessons`

### Community

- Feature-complete in `CommunityScreen` (6940)
- Source of truth during MVP: `localStorage` (5 keys, see below)
- Moderation: `communityMod.moderateContent()` from `src/community.js` — blocks profanity, hate speech, dangerous health claims
- Flip to live: set `LIVE_COMMUNITY = true` in `src/community.js` — see [community-firebase.md](community-firebase.md)

### Gamification

- 23 badges (`BADGES`, line 1549) — streaks, logging milestones, feature discovery, community
- 10 levels (`LEVELS`, line 1581) — XP thresholds 0 → 4,000
- `computeXP` (line at ~1618) — 10/log + 5/unique day + 3/streak day + bonuses
- `checkNewBadges` (7428) — triggers badge toasts and level-up modal

### Premium/paywall

- `isPremium` state (7393) — gates features
- `showPaywall` (7394) — overlay for premium CTAs
- `handleSubscribe` / `handleRestore` (7554) — currently no-ops, RevenueCat integration pending

## State management

All state lives in the main `App` component (7376) via `useState` hooks, persisted to `localStorage` on change.

### `localStorage` keys

| Key | Content |
|-----|---------|
| `vela_onboarded` | boolean — onboarding complete |
| `vela_logs` | JSON — daily log entries |
| `vela_profile` | JSON — `[stage, concerns, goals, guidance]` |
| `vela_reminders_enabled` | boolean |
| `vela_reminder_times` | JSON — `{morning, evening, weekly}` |
| `vela_streak_freezes` | JSON — frozen dates |
| `vela_streak_freeze_count` | number |
| `vela_custom_symptoms` | JSON — user-added symptoms |
| `vela_completed_lessons` | JSON — lesson IDs |
| `vela_completed_experiments` | JSON — experiment IDs |
| `vela_active_experiment` | JSON |
| `vela_completed_cbt` | JSON |
| `vela_active_cbt` | JSON |
| `vela_chat_messages` | JSON — Ask Vela history |
| `vela_community_posts` | JSON |
| `vela_community_votes` | JSON |
| `vela_community_bookmarks` | JSON |
| `vela_community_reactions` | JSON |
| `vela_community_replies` | JSON |
| `vela_community_guidelines_seen` | boolean |
| `vela_community_user_topics` | JSON |
| `vela_last_digest_date` | string |
| `vela_insights_revealed` | boolean |
| Various nudge dismissals | booleans |

## External integrations

- **jsPDF** — doctor report generation (`generateDoctorReport`, line 6130)
- **Capacitor** — iOS native shell
- **Haptics** — medium (badge), heavy (level-up), light (nudge dismiss)
- **Firebase** — community backend, ready to enable

## How to navigate the codebase

Quick reference: what you're doing → where to look.

| Task | Location |
|------|----------|
| Add a symptom | `SYMPTOMS` array, line 22; also `AI_SYMPTOM_NAMES` line 812 |
| Add AI knowledge for a symptom | `SYMPTOM_KNOWLEDGE`, line 834 — see [ai-companion.md](ai-companion.md) |
| Add a badge | `BADGES` array, line 1549 |
| Add a daily lesson | `DAILY_LESSONS`, line 1696 |
| Add a CBT program | `CBT_PROGRAMS`, line 1759 |
| Change tabs | tabs array in `App()`, line 7567 |
| Persist new state | add a `useEffect` around line 7416 |
| Understand a log's flow | `handleLog`, line 7451 |

## Build & run

```bash
npm install      # install deps
npm start        # dev server at localhost:3000
npm run build    # production build into /build
```

Zero ESLint warnings on build is the bar — the last dead-code sweep (see commit history) brought it to a clean compile. Keep it clean.

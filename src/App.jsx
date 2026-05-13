import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
// import * as communityMod from "./community"; // Re-enable when LIVE_COMMUNITY=true
import { initAnalytics, track, isAnalyticsOptedOut, setAnalyticsOptedOut } from "./analytics";
import { initPurchases, checkSubscription, purchasePlan, restorePurchases, getAppUserId } from "./subscription";
import { identifyUser, clearUser, reportError } from "./errorReporting";
import { readJSON as safeReadJSON } from "./safeStorage";
import { getThemePref, setTheme } from "./theme";
import {
  isHealthKitEnabled,
  enableHealthKit,
  disableHealthKit,
  fetchYesterdaySleep,
  getHealthKitStatus,
} from "./healthkit";

import { SymptomIcon, UIIcon, MoodFace, EnergyGlyph, RevealChart } from "./components/icons";
import { haptic } from "./lib/haptic";

import {
  SYMPTOMS,
  CANONICAL_SYMPTOM_NAMES,
  CONCERN_TO_SYMPTOM_NAMES,
  prioritizedSymptomsForCat,
  MOODS,
} from "./lib/symptoms";
import { QUESTIONS } from "./lib/questions";

import {
  getGreeting,
  getAdaptiveGreeting,
  localDateStr,
  localISOString,
  getStreak,
  getJourneyLabel,
} from "./lib/formatters";

import {
  getPersonalization,
} from "./lib/personalization";

import {
  computeEarlyStats,
  analyzePatterns,
  buildWeeklySummary,
} from "./lib/patterns";




import {
  ASK_VELA_MONTHLY_CAP,
  ASK_VELA_COUNT_KEY,
  getMonthlyCount,
  checkAndUpdateMonthlyCap,
  bumpMonthlyCapTo,
} from "./lib/quota";

import {
  buildDailyBriefSummary,
  buildAskVelaSummary,
} from "./lib/summaries";


import { analyzeCorrelations } from "./lib/correlations";


import { CRISIS_PATTERNS, looksLikeCrisis, CRISIS_RESOURCES } from "./lib/crisis";

import { CrisisSupportCard } from "./components/CrisisSupportCard";

import {
  FEEDBACK_KEY,
  getInsightFeedback,
  setInsightFeedback,
  insightKey,
  recordFeedback,
  applyFeedbackRanking,
  getThumbsUpInsights,
} from "./lib/insightFeedback";

import {
  forecastTomorrow,
} from "./lib/forecast";

import {
  detectAnomalies,
  anomalyToQuestion,
} from "./lib/anomalies";


import {
  predictNextCycle,
} from "./lib/cycle";

import {
  EXPERIMENT_LIBRARY,
  EXPERIMENT_BRIEF_KEYWORDS,
  parseBriefForExperiments,
  renderBriefBody,
  compareExperiment,
  matchExperimentForInsight,
  suggestExperiments,
} from "./lib/experiments";







import {
  REMINDER_MESSAGES,
  cancelAllReminders,
  scheduleReminders,
  generateTalkingPoints,
} from "./lib/reminders";





// ─── AI Analysis Functions ───────────────────────────────────────────────────

import {
  analyzeSymptomTrend,
  analyzeTriggerImpact,
  analyzeOverallTrend,
  analyzeBestWorstDays,
  analyzeRecentPattern,
  generateDoctorSummary,
} from "./lib/aiAnalysis";






// ─── AI Question Matching & Response Generation ──────────────────────────────

import {
  AI_SYMPTOM_NAMES,
  AI_TRIGGER_NAMES,
  SYMPTOM_KNOWLEDGE,
  TRIGGER_KNOWLEDGE,
  getSymptomKnowledge,
  getStageContext,
  matchQuestion,
  generateResponse,
} from "./lib/cannedAI";

// ─── Evidence-Based Knowledge Base ─────────────────────────────────────────
// Sources: NAMS (North American Menopause Society), NHS, Mayo Clinic,
// Cochrane reviews, Journal of Midlife Health, Menopause journal









import {
  computeGamificationStats,
  getStreakMultiplier,
  computeXP,
  getLevel,
  BADGES,
  LEVELS,
} from "./lib/gamification";

// Screen components (Phase 2 refactor — these used to be inline below
// alongside the styles block, but ESLint's `import/first` rule trips
// `npm run build` when any import appears after a non-import statement).
import OnboardingScreen from "./screens/Onboarding";
import TrackerScreen from "./screens/Today";
import HistoryScreen from "./screens/History";
import InsightsScreen from "./screens/Insights";
import PaywallScreen from "./screens/Paywall";
import EditQuestionScreen from "./screens/EditQuestion";
import SettingsScreen from "./screens/Settings";
import CommunityScreen from "./screens/Community";

import { generateDoctorReport } from "./lib/doctorReport";
import { exportCSV } from "./lib/csv";


// ─── Styles ──────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --clay:       #C97B5C;
    --clay-light: #F2E8E1;
    --clay-dark:  #8C4E32;
    --sage:       #7A9E87;
    --sage-light: #EAF0EC;
    --sage-dark:  #3D6B4F;
    --cream:      #FAF6F1;
    --ink:        #2C1F17;
    --ink-mid:    #6B5347;
    --ink-light:  #A89080;
    --gold:       #D4A853;
    --border:     #EDE0D8;
    --radius:     16px;
    --radius-sm:  10px;
    --radius-pill: 999px;
    --card-bg:    #FFFFFF;
    --font-serif: 'DM Serif Display', 'Georgia', serif;
    --font-sans:  'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;

    /* ── Liquid Glass tokens (light) ────────────────────────────────────────
       Translucent surfaces with backdrop-filter blur. Sage-tinted creams
       preserve the brand identity over content while adding the depth +
       refraction that defines Apple's iOS 26 Liquid Glass language. */
    --glass-cream:        rgba(250, 246, 241, 0.72);   /* warm cream glass. Primary floating surfaces */
    --glass-cream-strong: rgba(250, 246, 241, 0.88);   /* heavier opacity for high-contrast contexts */
    --glass-sage:         rgba(122, 158, 135, 0.16);   /* sage-tinted glass for accent surfaces */
    --glass-sage-card:    rgba(234, 240, 236, 0.78);   /* sage-cream glass for tip / insight cards */
    --glass-modal-scrim:  rgba(60, 45, 35, 0.32);      /* warm scrim under glass-blurred modals */
    --glass-edge:         rgba(255, 255, 255, 0.55);   /* inner top-edge highlight (the "lift") */
    --glass-edge-soft:    rgba(255, 255, 255, 0.30);   /* subtler edge for less prominent surfaces */
    --glass-blur:         blur(40px) saturate(180%);   /* standard depth */
    --glass-blur-strong:  blur(60px) saturate(180%);   /* for prominent floating elements */
    --glass-blur-soft:    blur(20px) saturate(150%);   /* for subtle accent cards */
  }

  /* Dark theme overrides — activated by data-theme="dark" on <html>.
     src/theme.js sets the attribute synchronously based on user pref
     (light/dark/system) and watches matchMedia for system changes. */
  [data-theme="dark"] {
    --clay:       #D9977E;
    --clay-light: #3A2A22;
    --clay-dark:  #E8B59E;
    --sage:       #8FB89B;
    --sage-light: #1E2E24;
    --sage-dark:  #A8D4B4;
    --cream:      #1A1412;
    --ink:        #F0E8E2;
    --ink-mid:    #BDA898;
    --ink-light:  #887568;
    --gold:       #E0BD6D;
    --border:     #342820;
    --card-bg:    #241C17;

    /* Liquid Glass tokens (dark). Warm dark glass keeps the calm, never reads as gray */
    --glass-cream:        rgba(26, 20, 18, 0.68);
    --glass-cream-strong: rgba(26, 20, 18, 0.86);
    --glass-sage:         rgba(143, 184, 155, 0.14);
    --glass-sage-card:    rgba(30, 46, 36, 0.72);
    --glass-modal-scrim:  rgba(0, 0, 0, 0.45);
    --glass-edge:         rgba(255, 255, 255, 0.10);
    --glass-edge-soft:    rgba(255, 255, 255, 0.05);
  }
  [data-theme="dark"] .nav { background: #1A1412 !important; }
  [data-theme="dark"] .nav-bottom {
    background: var(--glass-cream) !important;
    border-color: rgba(255,255,255,0.08) !important;
    box-shadow:
      inset 0 1px 0 var(--glass-edge),
      0 6px 24px rgba(0,0,0,0.4),
      0 1px 3px rgba(0,0,0,0.2) !important;
  }
  [data-theme="dark"] .symptom-tile, [data-theme="dark"] .q-opt, [data-theme="dark"] .q-card, [data-theme="dark"] .notes-input, [data-theme="dark"] .ctx-step-btn, [data-theme="dark"] .ctx-dot, [data-theme="dark"] .ctx-pill,
  [data-theme="dark"] .settings-card, [data-theme="dark"] .weekly-summary, [data-theme="dark"] .trend-card, [data-theme="dark"] .symptom-list, [data-theme="dark"] .patterns-card,
  [data-theme="dark"] .comparison-card, [data-theme="dark"] .chart-container, [data-theme="dark"] .chart-toggle-btn, [data-theme="dark"] .reminder-time-input,
  [data-theme="dark"] .streak-milestone, [data-theme="dark"] .settings-danger-btn, [data-theme="dark"] .insight-callout, [data-theme="dark"] .prediction-card,
  [data-theme="dark"] .note-chip, [data-theme="dark"] .symptom-filter, [data-theme="dark"] .comm-reaction-btn, [data-theme="dark"] .comm-header-btn,
  [data-theme="dark"] .comm-compose-input, [data-theme="dark"] .comm-compose-card, [data-theme="dark"] .comm-emoji-opt, [data-theme="dark"] .comm-tag-btn,
  [data-theme="dark"] .comm-sort-tab, [data-theme="dark"] .chat-text, [data-theme="dark"] .chat-chip, [data-theme="dark"] .chat-input, [data-theme="dark"] .digest-card,
  [data-theme="dark"] .gamification-bar, [data-theme="dark"] .gam-badge, [data-theme="dark"] .exp-card, [data-theme="dark"] .lesson-card,
  [data-theme="dark"] .add-symptom-card, [data-theme="dark"] .add-symptom-input, [data-theme="dark"] .milestone-card,
  [data-theme="dark"] .symptom-cat-tab, [data-theme="dark"] .active-symptom-chip, [data-theme="dark"] .energy-chip,
  [data-theme="dark"] .cbt-card, [data-theme="dark"] .cbt-program-item, [data-theme="dark"] .cbt-lesson-done-btn, [data-theme="dark"] .nudge-card,
  [data-theme="dark"] .reflection-card {
    background: var(--card-bg) !important;
  }
  [data-theme="dark"] .reveal-card {
    background: var(--glass-sage-card) !important;
    box-shadow:
      inset 0 1px 0 var(--glass-edge),
      0 12px 36px rgba(0, 0, 0, 0.4),
      0 2px 8px rgba(0, 0, 0, 0.2) !important;
  }
  [data-theme="dark"] .reveal-premium { background: linear-gradient(145deg, #1a2420 0%, #0f1714 100%) !important; border-color: rgba(143,184,155,0.25) !important; }
  [data-theme="dark"] .milestone-card { border-color: var(--sage-light) !important; background: var(--sage-light) !important; }
  [data-theme="dark"] .chat-bubble.user .chat-text { background: var(--clay) !important; }
  [data-theme="dark"] .digest-spotlight { background: var(--sage-light) !important; }
  [data-theme="dark"] .digest-tip { background: var(--sage-light) !important; }
  [data-theme="dark"] .comm-guidelines-dismiss { background: var(--card-bg) !important; color: var(--sage-dark) !important; }
  [data-theme="dark"] .comm-compose-overlay { background: var(--glass-modal-scrim) !important; }
  [data-theme="dark"] .comm-reaction-active { background: var(--sage-light) !important; }
  [data-theme="dark"] .comm-sort-active { background: var(--clay) !important; color: white !important; }
  [data-theme="dark"] .comm-emoji-selected { background: var(--clay-light) !important; }
  [data-theme="dark"] .symptom-tile.active { background: var(--clay-light) !important; }
  [data-theme="dark"] .symptom-cat-tab.active { background: var(--sage) !important; color: white !important; border-color: var(--sage) !important; }
  [data-theme="dark"] .active-symptom-chip { background: var(--clay-light) !important; color: var(--clay) !important; border-color: var(--clay) !important; }
  [data-theme="dark"] .energy-chip.active { background: var(--sage-light) !important; border-color: var(--sage) !important; }
  [data-theme="dark"] .cbt-lesson-header:active { background: rgba(255,255,255,0.05) !important; }
  [data-theme="dark"] .cbt-program-item:active { background: var(--sage-light) !important; }
  [data-theme="dark"] .ctx-dot.active { background: var(--clay-light) !important; }
  [data-theme="dark"] .ctx-pill.on { background: var(--sage-light) !important; }
  [data-theme="dark"] .streak-milestone.earned { background: var(--sage) !important; }
  [data-theme="dark"] .chart-toggle-btn.active { background: var(--clay) !important; }
  [data-theme="dark"] .q-opt.selected { background: var(--clay) !important; color: white !important; }
  [data-theme="dark"] .nav-tab.active { background: var(--clay) !important; }
  [data-theme="dark"] .wb-face { background: rgba(255,255,255,0.08) !important; }
  [data-theme="dark"] .wb-face.selected { background: rgba(255,255,255,0.2) !important; }
  [data-theme="dark"] svg text { fill: var(--ink-light); }

  body {
    background: var(--cream);
    min-height: 100vh;
    font-family: 'DM Sans', sans-serif;
  }

  .app {
    background: var(--cream);
    width: 100%;
    max-width: 420px;
    min-height: 100vh;
    margin: 0 auto;
    overflow: hidden;
    position: relative;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* ── NAV ── */
  /* Slim top header: just the wordmark, no tabs (tabs moved to bottom for thumb reach) */
  .nav {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(env(safe-area-inset-top, 0px) + 16px) 24px 8px;
  }
  .nav-logo {
    font-family: 'DM Serif Display', serif;
    font-size: 22px;
    color: var(--clay-dark);
    letter-spacing: -0.5px;
  }
  .nav-logo em { color: var(--clay); font-style: italic; }

  /* Floating pill-dock at bottom — Liquid Glass material.
     Translucent sage-cream over content with backdrop blur + saturation
     boost (Apple's iOS 26 tab-bar approach). Inset top edge highlight
     gives the surface a "lift" against whatever scrolls behind it. */
  .nav-bottom {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
    left: 16px;
    right: 16px;
    max-width: 388px;
    margin: 0 auto;
    display: flex;
    gap: 4px;
    padding: 5px;
    background: var(--glass-cream);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    border-radius: 24px;
    box-shadow:
      inset 0 1px 0 var(--glass-edge),
      0 6px 24px rgba(140, 78, 50, 0.12),
      0 1px 3px rgba(140, 78, 50, 0.08);
    z-index: 50;
  }
  .nav-bottom-tab {
    flex: 1;
    padding: 9px 4px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--ink-light);
    background: transparent;
    border: none;
    border-radius: 18px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.2s ease, color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.1px;
    line-height: 1;
  }
  .nav-bottom-tab.active {
    background: var(--clay);
    color: white;
    font-weight: 600;
  }
  .nav-bottom-tab:active { transform: scale(0.95); transition: transform 0.1s; }

  /* ════════════════════════════════════════════════════════════════════════
     Today screen redesign (Claude Design handoff, Apr 30 2026)
     New patterns: glass header, serif greeting, reveal card, mood faces,
     energy bars, severity strip, context grid, sticky save bar.
     ════════════════════════════════════════════════════════════════════════ */

  /* Today screen wrapper — extra bottom padding so content clears both
     the sticky save bar (~50px tall, floating ~80px from bottom) AND the
     bottom nav dock. Total clearance needed: ~180px. */
  .screen.vela-app { padding-bottom: 180px; padding-top: 0; }

  /* Sticky glass header on Today — bleeds back to viewport edges using
     negative margin to counter the .screen 16px gutter. */
  .vela-header {
    position: sticky; top: 0; z-index: 10;
    margin: 0 -16px;
    padding: calc(env(safe-area-inset-top, 0px) + 14px) 18px 10px;
    background: var(--glass-cream);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    box-shadow: inset 0 1px 0 var(--glass-edge), 0 1px 0 rgba(140, 78, 50, 0.06);
  }
  .vela-header-row { display: flex; align-items: center; justify-content: space-between; }
  .vela-wordmark {
    font-family: var(--font-serif); font-size: 22px;
    color: var(--clay-dark); letter-spacing: -0.005em;
  }
  .vela-wordmark em { font-style: italic; color: var(--clay); }
  .vela-header-streak {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px 5px 8px; border-radius: var(--radius-pill);
    background: var(--glass-sage-card);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid var(--border);
    font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
    text-transform: uppercase; color: var(--sage-dark);
    box-shadow: inset 0 1px 0 var(--glass-edge);
  }

  /* Greeting block */
  .vela-greeting { padding: 18px 0 10px; }
  .vela-greeting h1 {
    margin: 0 0 4px; font-family: var(--font-serif); font-weight: 400;
    font-size: 30px; line-height: 1.08; letter-spacing: -0.01em; color: var(--ink);
  }
  .vela-greeting h1 em { font-style: italic; color: var(--clay); }
  .vela-greeting .meta { margin: 0; font-size: 13px; color: var(--ink-mid); letter-spacing: 0.01em; }
  .vela-greeting .meta .dot { margin: 0 7px; color: var(--ink-light); }

  /* Section label (single source. Overrides earlier .section-label) */
  .today-section-label {
    font-size: 11px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--ink-light);
    margin: 18px 2px 10px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .today-section-label .hint {
    text-transform: none; letter-spacing: 0.01em; font-weight: 400;
    color: var(--ink-light); font-size: 11px;
  }

  /* Reveal card. Sage glass with radial gradient overlay */
  /* Forecast card — light surface, list of probabilities + reason.
     Locked variant uses the gold gating accent. */
  .forecast-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
  .forecast-card.locked { background: linear-gradient(135deg, rgba(212,168,83,0.10), rgba(201,123,92,0.06)); border-color: rgba(212,168,83,0.26); }
  .forecast-card .forecast-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 10px; }
  .forecast-card .forecast-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .forecast-card .forecast-list li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink); padding: 6px 0; border-bottom: 1px solid var(--border); }
  .forecast-card .forecast-list li:last-child { border-bottom: none; }
  .forecast-card .forecast-list .prob { font-family: var(--font-serif); font-size: 17px; color: var(--clay-dark); min-width: 46px; }
  .forecast-card .forecast-list .sym { font-weight: 500; }
  .forecast-card .forecast-list .why { color: var(--ink-light); font-size: 12px; }
  .forecast-card .forecast-foot { font-size: 11.5px; color: var(--ink-light); margin: 10px 0 0; font-style: italic; }
  .forecast-card .forecast-teaser { font-size: 13px; color: var(--ink-mid); line-height: 1.5; margin: 0 0 12px; }
  .forecast-card .forecast-unlock { display: inline-flex; align-items: center; gap: 5px; background: linear-gradient(135deg, var(--gold), #BD8F38); color: #fff; border: none; border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }

  /* Daily AI brief card — sage-tinted glass surface. Distinct from
     the static reveal card so users learn "this is the live AI read,
     not the same dashboard text I see every day." */
  .brief-card { background: linear-gradient(135deg, rgba(143,184,155,0.18), rgba(212,168,83,0.06)); border: 1px solid rgba(143,184,155,0.32); border-radius: var(--radius); padding: 18px; }
  .brief-card .brief-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 10px; }
  .brief-card .brief-eyebrow svg { color: var(--sage-dark); }
  .brief-card .brief-body { font-family: var(--font-serif); font-weight: 400; font-size: 18px; line-height: 1.4; color: var(--ink); margin: 0 0 14px; letter-spacing: -0.005em; }
  .brief-card .brief-body em { font-style: italic; color: var(--clay); }
  .brief-card .brief-foot { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: var(--ink-light); }
  .brief-card .brief-link { display: inline-flex; align-items: center; gap: 4px; color: var(--sage-dark); font-weight: 600; cursor: pointer; }
  /* Inline experiment link inside the brief body. Inherits the serif
     font so it reads as part of the sentence, not a button bolted on.
     Subtle sage underline so it's discoverable without shouting. */
  .brief-card .brief-body-link { background: none; border: none; padding: 0; margin: 0; font: inherit; color: var(--sage-dark); border-bottom: 1px solid rgba(122,158,135,0.45); cursor: pointer; font-style: italic; }
  .brief-card .brief-body-link:hover { color: var(--clay-dark); border-bottom-color: rgba(201,123,92,0.55); }
  .brief-card .brief-body-link:active { transform: scale(0.99); }

  .reveal-card-v2 {
    position: relative; border-radius: 22px; padding: 18px 18px 16px;
    background: var(--glass-sage-card);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    box-shadow:
      inset 0 1px 0 var(--glass-edge),
      0 8px 24px rgba(61, 107, 79, 0.10),
      0 1px 3px rgba(61, 107, 79, 0.06);
    overflow: hidden;
  }
  .reveal-card-v2::before {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(120% 80% at 100% 0%, rgba(122,158,135,0.18), transparent 55%);
  }
  .reveal-eyebrow {
    font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--sage-dark);
    display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px;
  }
  .reveal-headline-v2 {
    font-family: var(--font-serif); font-weight: 400;
    font-size: 22px; line-height: 1.2; color: var(--ink); margin: 0 0 10px;
  }
  .reveal-headline-v2 em { font-style: italic; color: var(--sage-dark); }
  .reveal-body-v2 { font-size: 13.5px; line-height: 1.55; color: var(--ink-mid); margin: 0 0 14px; }
  .reveal-mini-chart { display: flex; align-items: flex-end; gap: 4px; height: 38px; padding: 6px 0 0; position: relative; margin-bottom: 20px; }
  .reveal-mini-chart .bar { flex: 1; border-radius: 3px 3px 1px 1px; background: var(--sage); opacity: 0.8; position: relative; }
  .reveal-mini-chart .bar.dim { background: var(--ink-light); opacity: 0.35; }
  .reveal-mini-chart .bar .cap { position: absolute; inset: 0 0 auto 0; height: 2px; background: var(--glass-edge); border-radius: 2px 2px 0 0; }
  .reveal-mini-chart .bar .label { position: absolute; top: 100%; left: 50%; transform: translate(-50%, 4px); font-size: 9px; letter-spacing: 0.04em; color: var(--ink-light); }
  .reveal-foot { margin-top: 18px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--ink-mid); }
  .reveal-link { color: var(--sage-dark); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }

  /* Mood row. Square aspect tiles with custom SVG faces */
  .mood-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .mood-tile {
    aspect-ratio: 1; background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 16px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px; line-height: 1;
    color: var(--ink-mid); cursor: pointer;
    transition: transform 120ms ease, background 200ms ease, border-color 200ms ease, color 200ms ease;
  }
  .mood-tile .label {
    font-size: 10px; font-weight: 500; letter-spacing: 0.04em;
    text-transform: uppercase; color: var(--ink-light);
  }
  .mood-tile.active { background: var(--clay-light); border-color: var(--clay); color: var(--clay); }
  .mood-tile.active .label { color: var(--clay-dark); }
  .mood-tile:active { transform: scale(0.96); }

  /* Energy row. 5 tiles with custom SVG bar glyph */
  .energy-row-v2 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .energy-tile {
    background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px;
    padding: 12px 6px 10px; display: flex; flex-direction: column;
    align-items: center; gap: 4px; color: var(--clay-dark); cursor: pointer;
    transition: transform 120ms ease, background 200ms ease, border-color 200ms ease;
  }
  .energy-tile .label { font-size: 10.5px; font-weight: 500; color: var(--ink-mid); }
  .energy-tile.active { background: var(--clay-light); border-color: var(--clay); color: var(--clay-dark); }
  .energy-tile.active .label { color: var(--clay-dark); font-weight: 600; }
  .energy-tile:active { transform: scale(0.96); }

  /* Symptom category segmented control */
  .seg {
    display: flex; background: var(--clay-light); border-radius: 14px;
    padding: 4px; gap: 2px; margin-bottom: 12px;
    overflow-x: auto; scrollbar-width: none;
  }
  .seg::-webkit-scrollbar { display: none; }
  .seg button {
    flex: 0 0 auto; padding: 8px 14px; border-radius: 10px;
    font-size: 12px; font-weight: 500; color: var(--ink-mid);
    white-space: nowrap; border: none; background: transparent;
    cursor: pointer; font-family: var(--font-sans);
    transition: background 200ms ease, color 200ms ease, font-weight 200ms ease;
  }
  .seg button.active { background: var(--clay); color: #fff; font-weight: 600; }

  /* Symptom grid. 3 columns, severity strip below name */
  .symptom-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .symptom-tile-v2 {
    background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px;
    padding: 12px 8px 10px; display: flex; flex-direction: column;
    align-items: center; gap: 6px; text-align: center;
    color: var(--clay-dark); cursor: pointer; position: relative; min-height: 84px;
    transition: transform 120ms ease, background 200ms ease, border-color 200ms ease;
  }
  .symptom-tile-v2 .name {
    font-size: 11.5px; font-weight: 500; color: var(--ink); line-height: 1.2;
  }
  .symptom-tile-v2.active { background: var(--clay-light); border-color: var(--clay); }
  .symptom-tile-v2.active .name { color: var(--clay-dark); font-weight: 600; }
  .symptom-tile-v2:active { transform: scale(0.96); }
  .severity-strip {
    display: flex; gap: 3px; margin-top: 4px; width: 100%; justify-content: center; cursor: pointer;
  }
  .severity-strip .sev-dot {
    height: 5px; flex: 1; max-width: 16px; border-radius: 2px;
    background: rgba(140,78,50,0.18); transition: background 180ms ease;
  }
  .severity-strip .sev-dot.on { background: var(--clay); }

  /* Context cards. 2-col grid */
  /* Cross-screen nudge on Today: surfaces when the user logs a known
     trigger + symptom pair that already correlates in their history.
     Soft sage so it reads as helpful, not alarmist. */
  .trigger-nudge { background: linear-gradient(135deg, rgba(143,184,155,0.16), rgba(255,255,255,0.40)); border: 1px solid rgba(143,184,155,0.32); border-radius: 14px; padding: 14px; margin-top: 12px; }
  .trigger-nudge-head { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 8px; }
  .trigger-nudge p { font-size: 13px; line-height: 1.5; color: var(--ink); margin: 0 0 12px; }
  .trigger-nudge-cta { display: inline-flex; align-items: center; gap: 6px; background: var(--sage); color: #fff; border: none; border-radius: 999px; padding: 8px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .trigger-nudge-cta.locked { background: linear-gradient(135deg, var(--gold), #BD8F38); }

  .context-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .context-card {
    background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px;
    padding: 12px 14px 10px; min-height: 86px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .context-card .label {
    font-size: 10px; font-weight: 500; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--ink-light);
    display: flex; align-items: center; gap: 6px;
  }
  .context-card .value {
    font-family: var(--font-serif); font-size: 22px; color: var(--ink); letter-spacing: -0.01em;
  }
  .context-card .unit { font-family: var(--font-sans); font-size: 12px; color: var(--ink-mid); margin-left: 4px; }
  .hk-pill { display: inline-flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--sage-dark); background: var(--sage-light); padding: 2px 6px; border-radius: 999px; }
  .context-stepper { display: flex; align-items: center; gap: 8px; }
  .context-stepper button {
    width: 26px; height: 26px; border-radius: 9px;
    background: var(--clay-light); color: var(--clay-dark);
    font-size: 16px; font-weight: 600; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .context-stepper button:active { transform: scale(0.94); }
  .context-dots { display: flex; gap: 6px; margin-top: 4px; }
  .context-dots button {
    width: 26px; height: 26px; border-radius: 9px;
    background: rgba(140,78,50,0.08); color: var(--clay-dark);
    font-size: 12px; font-weight: 600; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 150ms ease, color 150ms ease;
  }
  .context-dots button.on { background: var(--clay); color: #fff; }
  .period-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .period-chips button {
    font-size: 11px; font-weight: 500; padding: 6px 10px;
    border-radius: 999px; background: rgba(140,78,50,0.06);
    color: var(--ink-mid); border: 1px solid transparent; cursor: pointer;
  }
  .period-chips button.on { background: var(--clay-light); color: var(--clay-dark); border-color: var(--clay); }

  /* Notes card */
  .notes-card-v2 { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 14px 14px 12px; }
  .notes-card-v2 textarea {
    width: 100%; min-height: 64px; border: none; resize: none;
    font-family: var(--font-sans); font-size: 14px; color: var(--ink);
    background: transparent; outline: none; line-height: 1.5;
  }
  .notes-card-v2 textarea::placeholder { color: var(--ink-light); font-style: italic; }

  /* Privacy footer at bottom of scroll */
  .privacy-footer {
    display: flex; align-items: center; justify-content: center;
    gap: 6px; font-size: 11px; color: var(--ink-light);
    letter-spacing: 0.04em; text-transform: uppercase; padding: 8px 0 16px;
  }

  /* Sticky glass save bar */
  .save-bar {
    position: fixed;
    left: 16px; right: 16px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
    max-width: 388px; margin: 0 auto;
    pointer-events: none; z-index: 40;
  }
  .save-bar .inner {
    pointer-events: auto;
    background: var(--glass-cream-strong);
    -webkit-backdrop-filter: var(--glass-blur-strong);
    backdrop-filter: var(--glass-blur-strong);
    border: 1px solid var(--border); border-radius: 18px;
    padding: 8px 8px 8px 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    box-shadow:
      inset 0 1px 0 var(--glass-edge),
      0 10px 30px rgba(140, 78, 50, 0.14),
      0 2px 6px rgba(140, 78, 50, 0.08);
  }
  .save-summary { font-size: 12px; color: var(--ink-mid); flex: 1; min-width: 0; }
  .save-summary strong { color: var(--ink); font-weight: 600; }
  .save-summary em { font-style: italic; }
  .save-btn {
    padding: 11px 18px; border-radius: 12px; background: var(--clay); color: #fff;
    font-size: 13.5px; font-weight: 600; letter-spacing: 0.01em;
    border: none; cursor: pointer; white-space: nowrap; font-family: var(--font-sans);
    transition: opacity 150ms ease, transform 100ms ease;
  }
  .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .save-btn:not(:disabled):active { transform: scale(0.97); }

  /* ════════════════════════════════════════════════════════════════════════
     Insights screen redesign (Claude Design handoff, Apr 30 2026)
     ════════════════════════════════════════════════════════════════════════ */
  .insights-greeting { padding: 18px 0 8px; }
  .insights-greeting h1 { margin: 0 0 4px; font-family: var(--font-serif); font-weight: 400; font-size: 28px; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); }
  .insights-greeting h1 em { font-style: italic; color: var(--clay); }
  .insights-greeting .meta { margin: 0; font-size: 13px; color: var(--ink-mid); }
  .insights-greeting .meta .dot { margin: 0 7px; color: var(--ink-light); }

  /* Locked state (< 7 days) */
  .locked-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px 18px 22px; text-align: center; }
  .locked-card .lock-glyph { width: 48px; height: 48px; border-radius: 14px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  .locked-card h3 { font-family: var(--font-serif); font-weight: 400; font-size: 22px; line-height: 1.2; margin: 0 0 8px; color: var(--ink); }
  .locked-card h3 em { font-style: italic; color: var(--clay); }
  .locked-card p { font-size: 14px; line-height: 1.55; color: var(--ink-mid); margin: 0 0 16px; }
  .locked-progress { display: flex; gap: 4px; justify-content: center; margin-bottom: 14px; }
  .locked-progress .pip { width: 8px; height: 8px; border-radius: 4px; background: rgba(140,78,50,0.14); }
  .locked-progress .pip.on { background: var(--clay); }
  .locked-foot { font-size: 11px; color: var(--ink-light); letter-spacing: 0.04em; text-transform: uppercase; margin-top: 4px; }

  /* Day-7 unlock hero */
  .unlock-card { position: relative; border-radius: 22px; padding: 22px 20px 20px; background: var(--glass-sage-card); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border: 1px solid var(--border); box-shadow: inset 0 1px 0 var(--glass-edge), 0 10px 30px rgba(61, 107, 79, 0.12), 0 1px 3px rgba(61, 107, 79, 0.06); overflow: hidden; }
  .unlock-card::before { content: ""; position: absolute; inset: 0; background: radial-gradient(120% 80% at 100% 0%, rgba(122,158,135,0.22), transparent 55%); pointer-events: none; }
  .unlock-eyebrow { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sage-dark); display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px; }
  .unlock-headline { font-family: var(--font-serif); font-weight: 400; font-size: 26px; line-height: 1.15; color: var(--ink); margin: 0 0 10px; letter-spacing: -0.01em; }
  .unlock-headline em { font-style: italic; color: var(--sage-dark); }
  .unlock-body { font-size: 14px; line-height: 1.55; color: var(--ink-mid); margin: 0 0 16px; }
  .unlock-row { display: flex; gap: 8px; padding-top: 6px; }
  .unlock-btn-primary { flex: 1; padding: 12px 14px; border-radius: 12px; background: var(--sage-dark); color: #fff; font-size: 13px; font-weight: 600; border: none; cursor: pointer; font-family: var(--font-sans); }
  .unlock-btn-primary:active { transform: scale(0.98); }
  .unlock-btn-secondary { padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.5); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); color: var(--sage-dark); font-size: 13px; font-weight: 500; border: 1px solid var(--border); cursor: pointer; font-family: var(--font-sans); }

  /* Established week-hero */
  .week-hero { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; }
  .week-hero .quote { font-family: var(--font-serif); font-weight: 400; font-size: 22px; line-height: 1.25; color: var(--ink); margin: 6px 0 12px; letter-spacing: -0.01em; }
  .week-hero .quote em { font-style: italic; color: var(--clay); }
  .week-eyebrow { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-light); display: inline-flex; align-items: center; gap: 6px; }
  .week-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
  .week-stats .stat .v { font-family: var(--font-serif); font-size: 22px; color: var(--ink); letter-spacing: -0.01em; line-height: 1; }
  .week-stats .stat .l { font-size: 10px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-light); margin-top: 4px; }
  .week-stats .stat .delta { font-size: 11px; color: var(--sage-dark); font-weight: 600; margin-left: 4px; }
  .week-stats .stat .delta.up { color: var(--clay-dark); }

  /* Top symptom callout */
  .callout { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 16px 14px; }
  .callout-row { display: flex; align-items: center; gap: 12px; }
  .callout-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .callout-body { flex: 1; min-width: 0; }
  .callout-name { font-family: var(--font-serif); font-size: 18px; color: var(--ink); line-height: 1.1; }
  .callout-meta { font-size: 12px; color: var(--ink-mid); margin-top: 3px; line-height: 1.4; }
  .callout-trend { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 999px; letter-spacing: 0.02em; }
  .callout-trend.up { background: var(--clay-light); color: var(--clay-dark); }
  .callout-trend.down { background: var(--sage-light); color: var(--sage-dark); }
  .callout-trend.flat { background: rgba(140,78,50,0.06); color: var(--ink-mid); }

  /* Bar chart */
  .bars-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 16px 12px; }
  .bars-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
  .bars-title { font-family: var(--font-serif); font-size: 16px; color: var(--ink); }
  .bars-sub { font-size: 11px; color: var(--ink-light); letter-spacing: 0.04em; text-transform: uppercase; }
  .bars-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; align-items: end; height: 110px; padding-bottom: 22px; position: relative; }
  .bar-col { display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: end; position: relative; }
  .bar-col .bar { width: 100%; border-radius: 6px 6px 2px 2px; background: var(--clay); position: relative; min-height: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.4); }
  .bar-col.dim .bar { background: rgba(140,78,50,0.18); }
  .bar-col .day { position: absolute; top: 100%; padding-top: 6px; font-size: 10px; color: var(--ink-light); letter-spacing: 0.04em; }
  .bar-col .period-dot { position: absolute; top: calc(100% + 22px); width: 5px; height: 5px; border-radius: 3px; background: var(--sage); }
  .legend { display: flex; gap: 14px; align-items: center; padding-top: 8px; font-size: 11px; color: var(--ink-light); }
  .legend .swatch { width: 8px; height: 8px; border-radius: 4px; display: inline-block; margin-right: 5px; vertical-align: middle; }

  /* Mood week */
  .mood-row-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 14px 12px; }
  .mood-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 8px; }
  .mood-day { display: flex; flex-direction: column; align-items: center; gap: 5px; }
  .mood-day .em { font-size: 22px; line-height: 1; }
  .mood-day .dot { width: 5px; height: 5px; border-radius: 3px; background: rgba(140,78,50,0.18); }
  .mood-day .lab { font-size: 10px; color: var(--ink-light); letter-spacing: 0.04em; }
  .mood-summary { font-size: 12px; color: var(--ink-mid); margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); line-height: 1.5; }
  .mood-summary em { color: var(--clay-dark); font-style: italic; font-weight: 600; }

  /* Pattern findings */
  .pattern-list { display: flex; flex-direction: column; gap: 10px; }
  .pattern-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 14px 12px; display: flex; gap: 12px; align-items: flex-start; }
  .pattern-card .ico { width: 32px; height: 32px; border-radius: 10px; background: var(--sage-light); color: var(--sage-dark); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pattern-card .body { flex: 1; min-width: 0; }
  .pattern-card .head { font-size: 14px; color: var(--ink); font-weight: 500; line-height: 1.4; }
  .pattern-card .head em { color: var(--clay-dark); font-style: italic; font-weight: 600; }
  .pattern-card .conf { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--ink-light); letter-spacing: 0.04em; text-transform: uppercase; margin-top: 6px; }
  .pattern-card .conf .conf-dots { display: inline-flex; gap: 2px; }
  .pattern-card .conf .conf-dots span { width: 4px; height: 4px; border-radius: 2px; background: rgba(140,78,50,0.2); }
  .pattern-card .conf .conf-dots span.on { background: var(--sage-dark); }
  .pattern-card .pattern-feedback { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 11px; color: var(--ink-light); }
  .pattern-card .pattern-feedback .ask { letter-spacing: 0.04em; text-transform: uppercase; font-size: 10px; }
  .pattern-card .pattern-feedback .fb-btn { width: 24px; height: 24px; border-radius: 8px; background: transparent; border: 1px solid var(--border); color: var(--ink-light); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 100ms ease, color 100ms ease; }
  .pattern-card .pattern-feedback .fb-btn:hover { background: var(--card-bg-soft, rgba(140,78,50,0.05)); color: var(--ink); }
  .pattern-card .pattern-feedback .fb-btn.on { background: var(--sage-light); color: var(--sage-dark); border-color: rgba(143,184,155,0.4); }
  .pattern-card .pattern-feedback .fb-btn.on.down { background: var(--clay-light); color: var(--clay-dark); border-color: rgba(201,123,92,0.3); }
  .pattern-card .pattern-feedback .fb-thanks { font-style: italic; }
  /* Cross-screen action: jump from a pattern straight into the matching
     experiment. Sage = available (premium). Gold = locked (free user). */
  .pattern-card .pattern-exp-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--sage); color: #fff; border: none; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 8px; }
  .pattern-card .pattern-exp-btn.locked { background: linear-gradient(135deg, var(--gold), #BD8F38); }
  .pattern-card .pattern-exp-btn:active { transform: scale(0.98); }
  .pattern-card .pattern-exp-running { display: inline-block; margin-top: 8px; font-size: 11.5px; color: var(--ink-light); font-style: italic; }

  /* Anomaly cards — quieter than pattern cards (no confidence dots, no
     correlation framing). They say "I'm noticing something different
     about THIS week vs your normal." */
  .anomaly-list { display: flex; flex-direction: column; gap: 8px; }
  .anomaly-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; display: flex; gap: 10px; align-items: flex-start; }
  .anomaly-card.locked { background: linear-gradient(135deg, rgba(212,168,83,0.10), rgba(201,123,92,0.06)); border-color: rgba(212,168,83,0.26); }
  .anomaly-card .ico { width: 26px; height: 26px; border-radius: 8px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .anomaly-card .body { flex: 1; min-width: 0; }
  .anomaly-card .head { font-size: 13px; color: var(--ink); line-height: 1.45; }
  .anomaly-unlock { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; background: linear-gradient(135deg, var(--gold), #BD8F38); color: #fff; border: none; border-radius: 999px; padding: 5px 11px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
  /* "Ask Vela why" handoff on a premium-tier anomaly card. Quiet
     inline button that mirrors the History day-detail Ask handoff. */
  .anomaly-card .anomaly-ask { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 999px; padding: 5px 11px; font-size: 11.5px; font-weight: 600; color: var(--clay-dark); cursor: pointer; font-family: inherit; }
  .anomaly-card .anomaly-ask:hover { background: var(--clay-light); border-color: var(--clay); }
  .anomaly-card .anomaly-ask:active { transform: scale(0.98); }

  .weak-banner { margin-top: 8px; padding: 10px 12px; background: var(--clay-light); border-radius: 12px; font-size: 12px; color: var(--clay-dark); display: flex; align-items: center; gap: 8px; line-height: 1.4; }

  /* Doctor export CTA */
  .export-cta { background: var(--sage); color: #fff; border-radius: var(--radius); padding: 18px 16px; display: flex; align-items: center; gap: 14px; width: 100%; border: none; cursor: pointer; font-family: var(--font-sans); text-align: left; }
  .export-cta .ico { width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.18); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .export-cta .body { flex: 1; min-width: 0; }
  .export-cta h4 { font-family: var(--font-serif); font-weight: 400; font-size: 17px; margin: 0 0 3px; line-height: 1.2; }
  .export-cta p { font-size: 12px; margin: 0; opacity: 0.9; line-height: 1.4; }
  .export-cta .arrow { width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.2); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }

  /* ─── Weekly summary card (Premium) ────────────────────────────────────
     Quiet card on weekdays, lifted with a subtle gradient on Sundays so
     it earns the "your week is ready" promotion. Locked variant uses
     the gold accent like Cycle. */
  .week-summary-card { display: block; width: 100%; text-align: left; background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; cursor: pointer; font-family: inherit; transition: transform 100ms ease; }
  .week-summary-card:active { transform: scale(0.99); }
  .week-summary-card.sunday { background: linear-gradient(135deg, rgba(143,184,155,0.20), rgba(212,168,83,0.08)); border-color: rgba(143,184,155,0.36); }
  .week-summary-card.locked { background: linear-gradient(135deg, rgba(212,168,83,0.10), rgba(201,123,92,0.10)); border-color: rgba(212,168,83,0.30); }
  .week-summary-card .ws-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 6px; }
  .week-summary-card.locked .ws-eyebrow { color: var(--clay-dark); }
  .week-summary-card .ws-tag { background: var(--gold); color: #2C1F17; padding: 1px 8px; border-radius: 999px; font-size: 9.5px; margin-left: 6px; letter-spacing: 0.06em; }
  .week-summary-card .ws-summary { font-size: 13.5px; color: var(--ink); line-height: 1.5; margin: 0 0 10px; font-family: var(--font-serif); font-weight: 400; }
  .week-summary-card .ws-foot { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--ink-light); }
  .week-summary-card .ws-arrow { display: inline-flex; color: var(--clay-dark); margin-left: auto; }

  /* Weekly summary sheet */
  .ws-sheet-body { padding: 4px 0 16px; overflow-y: auto; }
  .ws-sheet-head { margin-bottom: 14px; }
  .ws-sheet-head .eye { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 4px; }
  .ws-sheet-head h2 { font-family: var(--font-serif); font-size: 22px; font-weight: 400; color: var(--ink); margin: 0 0 8px; line-height: 1.2; }
  .ws-sheet-head .ws-sheet-summary { font-size: 14px; color: var(--ink-mid); line-height: 1.55; margin: 0; }
  .ws-stat-row { display: flex; gap: 8px; margin-bottom: 14px; }
  .ws-stat { flex: 1; background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 10px 12px; text-align: center; }
  .ws-stat .v { font-family: var(--font-serif); font-size: 22px; color: var(--ink); line-height: 1; min-height: 28px; display: inline-flex; align-items: center; justify-content: center; }
  .ws-stat .v small { font-size: 12px; color: var(--ink-light); margin-left: 2px; }
  .ws-stat .l { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-light); margin-top: 4px; }
  .ws-stat .l .delta.up { color: var(--sage-dark); }
  .ws-stat .l .delta.down { color: var(--clay-dark); }
  .ws-section { margin-bottom: 14px; }
  .ws-section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-light); margin-bottom: 8px; }
  .ws-symptom-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .ws-symptom-row:last-child { border-bottom: none; }
  .ws-symptom-row .ico { color: var(--clay-dark); display: inline-flex; }
  .ws-symptom-row .sym { flex: 1; color: var(--ink); }
  .ws-symptom-row .counts { color: var(--ink-mid); font-size: 12.5px; }
  .ws-symptom-row .counts small { color: var(--ink-light); font-size: 11px; }
  .ws-symptom-row .delta { font-size: 11.5px; font-weight: 600; min-width: 38px; text-align: right; }
  .ws-symptom-row .delta.good { color: var(--sage-dark); }
  .ws-symptom-row .delta.bad { color: var(--clay-dark); }
  .ws-symptom-row .delta.flat { color: var(--ink-light); }
  .ws-pill-row { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-mid); background: var(--card-bg); border: 1px solid var(--border); border-radius: 999px; padding: 6px 12px; margin: 4px 4px 4px 0; }
  .ws-pdf-btn { display: inline-flex; align-items: center; gap: 7px; background: var(--sage); color: #fff; border: none; border-radius: 12px; padding: 11px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 14px; }

  /* ─── Cycle prediction card (Premium) ──────────────────────────────────
     Soft sage gradient when active so it reads as a "Vela is working in
     the background" surface, not another data card. Locked variant uses
     the upgrade-gold accent to match the Settings premium row. */
  .cycle-card { background: linear-gradient(135deg, rgba(143,184,155,0.16), rgba(255,255,255,0.55)); border: 1px solid rgba(143,184,155,0.32); border-radius: var(--radius); padding: 16px; }
  .cycle-card.locked { background: linear-gradient(135deg, rgba(212,168,83,0.10), rgba(201,123,92,0.10)); border-color: rgba(212,168,83,0.30); }
  .cycle-card .cycle-head { display: inline-flex; align-items: center; gap: 8px; color: var(--sage-dark); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 8px; }
  .cycle-card.locked .cycle-head { color: var(--clay-dark); }
  .cycle-card .cycle-head .ico { color: var(--sage-dark); display: inline-flex; }
  .cycle-card.locked .cycle-head .ico { color: var(--clay); }
  .cycle-card .cycle-head strong { font-family: var(--font-sans); font-size: 12px; color: inherit; }
  .cycle-card .cycle-window { font-family: var(--font-serif); font-size: 22px; line-height: 1.2; color: var(--ink); margin: 0 0 6px; }
  .cycle-card .cycle-meta { font-size: 12px; color: var(--ink-mid); margin: 0; line-height: 1.5; }
  .cycle-card .cycle-body { font-size: 13.5px; color: var(--ink-mid); line-height: 1.5; margin: 0 0 12px; }
  .cycle-card .cycle-cta { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, var(--gold), #BD8F38); color: #fff; border: none; border-radius: 999px; padding: 8px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }

  /* ─── Experiments (Premium) ────────────────────────────────────────────
     Active card uses the same surface as data cards but adds a top
     accent strip + progress bar. Completed cards drop the accent and
     show only the deltas. */
  .exp-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 14px 12px; margin-bottom: 10px; position: relative; overflow: hidden; }
  .exp-card.active::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--clay), var(--sage)); }
  /* Brief deep-link arrival flash. Pulsed sage halo so the user lands
     exactly at the experiment they tapped on Today's brief. */
  .exp-card.flash { animation: expFlash 1.6s ease-out; }
  @keyframes expFlash {
    0% { box-shadow: 0 0 0 0 rgba(143,184,155,0.55); }
    100% { box-shadow: 0 0 0 14px rgba(143,184,155,0); }
  }
  .exp-card.completed { border-style: dashed; }
  .exp-card .exp-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .exp-card .exp-head .ico { width: 32px; height: 32px; border-radius: 10px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .exp-card .exp-head .ttl { flex: 1; min-width: 0; }
  .exp-card .exp-head strong { display: block; font-family: var(--font-serif); font-weight: 400; font-size: 16px; color: var(--ink); line-height: 1.2; }
  .exp-card .exp-head small { display: block; font-size: 11.5px; color: var(--ink-light); margin-top: 2px; letter-spacing: 0.02em; }
  .exp-card .exp-badge { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sage-dark); background: rgba(143,184,155,0.18); padding: 3px 8px; border-radius: 999px; align-self: flex-start; }
  .exp-card .exp-progress { height: 4px; background: var(--card-bg-soft, rgba(0,0,0,0.05)); border-radius: 999px; overflow: hidden; margin-bottom: 10px; }
  .exp-card .exp-progress .fill { height: 100%; background: linear-gradient(90deg, var(--clay), var(--sage)); transition: width 200ms ease; }
  .exp-card .exp-deltas { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: rgba(0,0,0,0.025); border-radius: 10px; margin-bottom: 8px; }
  .exp-card .exp-delta { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; }
  .exp-card .exp-delta .sym { color: var(--ink); font-weight: 500; }
  .exp-card .exp-delta .val { color: var(--ink-mid); font-size: 12px; text-align: right; }
  .exp-card .exp-delta .val.good { color: var(--sage-dark); font-weight: 600; }
  .exp-card .exp-delta .val.bad { color: var(--clay-dark); font-weight: 600; }
  .exp-card .exp-actions { display: flex; gap: 8px; margin-top: 6px; }
  .exp-card .exp-btn { padding: 8px 14px; border-radius: 10px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--border); background: transparent; color: var(--ink-mid); }
  .exp-card .exp-btn.primary { background: var(--clay); color: #fff; border-color: var(--clay); }
  .exp-card .exp-btn.secondary:hover { background: var(--card-bg-soft, rgba(0,0,0,0.04)); }

  /* Personalized experiment suggestions — premium, derived from
     correlations + top symptoms. Reason headline reads first so the
     user understands why this suggestion appeared. */
  .suggest-list { display: flex; flex-direction: column; gap: 10px; }
  .suggest-card { background: linear-gradient(135deg, rgba(143,184,155,0.12), rgba(255,255,255,0.55)); border: 1px solid rgba(143,184,155,0.26); border-radius: var(--radius); padding: 14px; }
  .suggest-card .suggest-head { display: flex; gap: 10px; margin-bottom: 8px; }
  .suggest-card .suggest-head .ico { width: 28px; height: 28px; border-radius: 9px; background: var(--sage-light); color: var(--sage-dark); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .suggest-card .reason { flex: 1; margin: 0; font-size: 13px; color: var(--ink); line-height: 1.45; font-style: italic; }
  .suggest-card .suggest-body { padding-left: 38px; margin-bottom: 10px; }
  .suggest-card .suggest-body strong { display: block; font-family: var(--font-serif); font-weight: 400; font-size: 16px; color: var(--ink); line-height: 1.2; }
  .suggest-card .suggest-body small { display: block; font-size: 11.5px; color: var(--ink-light); margin-top: 2px; }
  /* Sage = action available (premium user, "Start"); gold gradient =
     locked behind paywall ("Unlock with Premium"). Same convention as
     the Cycle prediction card so the gating accent reads consistently. */
  .suggest-card .suggest-cta { display: inline-flex; align-items: center; gap: 6px; background: var(--sage); color: #fff; border: none; border-radius: 999px; padding: 8px 14px 8px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; margin-left: 38px; }
  .suggest-card .suggest-cta.locked { background: linear-gradient(135deg, var(--gold), #BD8F38); }

  /* Experiment promo CTA. When no experiments exist */
  .exp-promo { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; align-items: center; gap: 14px; width: 100%; cursor: pointer; font-family: var(--font-sans); text-align: left; }
  .exp-promo .ico { width: 40px; height: 40px; border-radius: 12px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .exp-promo .body { flex: 1; min-width: 0; }
  .exp-promo h4 { font-family: var(--font-serif); font-weight: 400; font-size: 16px; margin: 0 0 3px; color: var(--ink); line-height: 1.2; }
  .exp-promo p { font-size: 12.5px; margin: 0; color: var(--ink-mid); line-height: 1.45; }
  .exp-promo .arrow { width: 28px; height: 28px; border-radius: 999px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }

  /* Experiment library inside the picker sheet */
  .exp-library { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 12px; overflow-y: auto; }
  .exp-lib-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; text-align: left; cursor: pointer; font-family: inherit; transition: border-color 100ms ease, transform 100ms ease; position: relative; }
  .exp-lib-card:active:not(:disabled) { transform: scale(0.99); }
  .exp-lib-card:hover:not(:disabled) { border-color: var(--clay); }
  .exp-lib-card:disabled { opacity: 0.55; cursor: not-allowed; }
  .exp-lib-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .exp-lib-head .ico { width: 28px; height: 28px; border-radius: 9px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .exp-lib-head strong { flex: 1; font-family: var(--font-serif); font-weight: 400; font-size: 16px; color: var(--ink); line-height: 1.2; }
  .exp-lib-head .dur { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--ink-light); text-transform: uppercase; }
  .exp-lib-desc { font-size: 12.5px; color: var(--ink-mid); line-height: 1.5; margin: 0 0 6px; }
  .exp-lib-targets { font-size: 11px; color: var(--ink-light); letter-spacing: 0.02em; }
  .exp-lib-status { display: inline-block; margin-top: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--sage-dark); }

  /* Shelf. Horizontal scroll cards */
  .shelf-row { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; padding: 2px 0 4px; margin: 0 -16px; padding-left: 16px; padding-right: 16px; }
  .shelf-row::-webkit-scrollbar { display: none; }
  .shelf-card { flex: 0 0 220px; background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; }
  .shelf-card .kicker { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--clay-dark); display: inline-flex; align-items: center; gap: 5px; }
  .shelf-card .ttl { font-family: var(--font-serif); font-size: 16px; color: var(--ink); line-height: 1.2; }
  .shelf-card .desc { font-size: 12px; color: var(--ink-mid); line-height: 1.4; }
  .shelf-card .mins { font-size: 11px; color: var(--ink-light); letter-spacing: 0.04em; text-transform: uppercase; margin-top: auto; }

  /* Ask Vela floating button — discrete pill in the corner. Avatar carries
     the brand (gold = premium upgrade, clay = active premium); the label
     stays tight ("Ask Vela") so the FAB never dominates the viewport like
     the original Premium · 7 Questions variant. */
  .ask-vela-fab { position: fixed; right: 14px; bottom: calc(env(safe-area-inset-bottom, 0px) + 84px); background: var(--glass-cream-strong); -webkit-backdrop-filter: var(--glass-blur-strong); backdrop-filter: var(--glass-blur-strong); border: 1px solid var(--border); box-shadow: inset 0 1px 0 var(--glass-edge), 0 10px 24px rgba(140, 78, 50, 0.18), 0 2px 6px rgba(140, 78, 50, 0.10); border-radius: 999px; padding: 6px 12px 6px 6px; display: inline-flex; align-items: center; gap: 7px; z-index: 25; cursor: pointer; font-family: var(--font-sans); transition: transform 240ms cubic-bezier(0.2,0.8,0.3,1), opacity 200ms ease; }
  .ask-vela-fab:active { transform: scale(0.97); }
  .ask-vela-fab.hidden { transform: translateY(120%); opacity: 0; pointer-events: none; }
  .ask-vela-fab .av { width: 26px; height: 26px; border-radius: 999px; background: var(--clay); color: #fff; font-family: var(--font-serif); font-size: 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ask-vela-fab.locked .av { background: var(--gold); }
  .ask-vela-fab .lbl { font-size: 12.5px; font-weight: 600; color: var(--ink); text-align: left; line-height: 1; }
  .ask-vela-fab .lbl .sub { display: none; }

  /* Ask Vela glass sheet */
  .av-scrim { position: fixed; inset: 0; background: var(--glass-modal-scrim); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); z-index: 50; opacity: 0; pointer-events: none; transition: opacity 200ms ease; }
  .av-scrim.show { opacity: 1; pointer-events: auto; }
  .av-sheet { position: fixed; left: 8px; right: 8px; bottom: 8px; max-width: 420px; margin: 0 auto; border-radius: 24px; background: var(--glass-cream-strong); -webkit-backdrop-filter: var(--glass-blur-strong); backdrop-filter: var(--glass-blur-strong); border: 1px solid var(--border); box-shadow: inset 0 1px 0 var(--glass-edge), 0 16px 40px rgba(140, 78, 50, 0.18); z-index: 51; padding: 18px 18px 16px; max-height: 78vh; display: flex; flex-direction: column; transform: translateY(20px); opacity: 0; pointer-events: none; transition: transform 240ms cubic-bezier(0.2,0.8,0.3,1), opacity 240ms ease; }
  .av-sheet.show { transform: translateY(0); opacity: 1; pointer-events: auto; }
  .av-handle { width: 36px; height: 4px; border-radius: 3px; background: rgba(140,78,50,0.2); margin: -6px auto 14px; }
  .av-head { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
  .av-avatar { width: 40px; height: 40px; border-radius: 999px; background: var(--clay); color: #fff; font-family: var(--font-serif); font-size: 18px; display: inline-flex; align-items: center; justify-content: center; }
  .av-name { font-family: var(--font-serif); font-size: 18px; color: var(--ink); line-height: 1.1; }
  .av-sub { font-size: 11px; color: var(--ink-light); margin-top: 2px; display: inline-flex; gap: 5px; align-items: center; }
  .av-q-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; padding: 4px 0; }

  /* Crisis support card — appears in two places (Ask Vela sheet inline,
     Today screen when sustained mood crash detected). Same surface in
     both so the user recognizes the safety affordance wherever it
     shows up. Soft sage to read as care, not alarm. */
  .crisis-card { background: linear-gradient(135deg, rgba(143,184,155,0.18), rgba(255,255,255,0.55)); border: 1px solid rgba(143,184,155,0.40); border-radius: 16px; padding: 16px; margin: 8px 0; }
  .crisis-card .crisis-head { display: flex; gap: 12px; margin-bottom: 12px; }
  .crisis-card .crisis-head .ico { width: 32px; height: 32px; border-radius: 999px; background: var(--sage); color: #fff; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .crisis-card .crisis-head strong { display: block; font-family: var(--font-serif); font-weight: 400; font-size: 18px; color: var(--ink); line-height: 1.2; margin-bottom: 4px; }
  .crisis-card .crisis-head p { margin: 0; font-size: 13px; color: var(--ink-mid); line-height: 1.5; }
  .crisis-card .crisis-list { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-direction: column; gap: 8px; }
  .crisis-card .crisis-list li { display: grid; grid-template-columns: 1fr; gap: 2px; padding: 8px 10px; background: rgba(255,255,255,0.4); border: 1px solid var(--border); border-radius: 10px; }
  .crisis-card .crisis-list .region { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--ink-light); text-transform: uppercase; }
  .crisis-card .crisis-list .line { font-family: var(--font-serif); font-size: 18px; color: var(--ink); }
  .crisis-card .crisis-list .note { font-size: 12px; color: var(--ink-mid); }
  .crisis-card .crisis-foot { font-size: 12px; color: var(--ink-light); line-height: 1.5; margin: 0; font-style: italic; }
  .av-q { background: rgba(255,255,255,0.55); border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; font-size: 13px; color: var(--ink); line-height: 1.4; text-align: left; cursor: pointer; font-family: var(--font-sans); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .av-q em { font-style: italic; color: var(--clay-dark); }
  .av-q .arr { flex-shrink: 0; color: var(--ink-light); }
  .av-input { display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border); margin-top: 8px; }
  .av-input input { flex: 1; background: rgba(255,255,255,0.55); border: 1px solid var(--border); border-radius: 12px; padding: 11px 14px; font-family: var(--font-sans); font-size: 13px; color: var(--ink); outline: none; }
  .av-input input::placeholder { color: var(--ink-light); font-style: italic; }
  .av-input button { background: var(--clay); color: #fff; width: 42px; height: 42px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; border: none; cursor: pointer; }

  /* ════════════════════════════════════════════════════════════════════════
     Settings screen redesign (Claude Design handoff, Apr 30 2026)
     ════════════════════════════════════════════════════════════════════════ */
  .set-greeting { padding: 18px 0 18px; }
  .set-greeting h1 { margin: 0 0 6px; font-family: var(--font-serif); font-weight: 400; font-size: 30px; line-height: 1.08; letter-spacing: -0.01em; color: var(--ink); }
  .set-greeting h1 em { font-style: italic; color: var(--clay); }
  .set-greeting .meta { margin: 0; font-size: 13px; color: var(--ink-mid); }

  .journey-card { position: relative; border-radius: 22px; padding: 20px 20px 18px; background: var(--glass-sage-card); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border: 1px solid var(--border); box-shadow: inset 0 1px 0 var(--glass-edge), 0 8px 24px rgba(61, 107, 79, 0.08); overflow: hidden; margin-bottom: 4px; }
  .journey-card::before { content: ""; position: absolute; inset: 0; background: radial-gradient(120% 80% at 0% 0%, rgba(122,158,135,0.18), transparent 55%); pointer-events: none; }
  .journey-card .eye { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sage-dark); display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .journey-card .name { font-family: var(--font-serif); font-size: 22px; line-height: 1.2; margin: 0 0 4px; color: var(--ink); }
  .journey-card .name em { font-style: italic; color: var(--sage-dark); }
  .journey-card .since { font-size: 12px; color: var(--ink-mid); margin: 0 0 14px; }
  .journey-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px; }
  .journey-cell { text-align: left; }
  .journey-cell .v { font-family: var(--font-serif); font-size: 26px; line-height: 1; color: var(--ink); letter-spacing: -0.01em; display: flex; align-items: baseline; gap: 4px; }
  .journey-cell .v small { font-family: var(--font-sans); font-size: 11px; font-weight: 500; color: var(--ink-mid); letter-spacing: 0.04em; text-transform: uppercase; }
  .journey-cell .l { font-size: 11px; color: var(--ink-light); letter-spacing: 0.04em; text-transform: uppercase; font-weight: 500; margin-top: 4px; }
  .journey-arc { position: relative; height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 4px 0 14px; }
  .journey-arc .marker { position: absolute; top: -3px; width: 7px; height: 7px; border-radius: 999px; background: var(--sage-dark); box-shadow: 0 0 0 3px rgba(122,158,135,0.18); }
  .journey-card .quote { font-family: var(--font-serif); font-style: italic; font-size: 14px; line-height: 1.5; color: var(--sage-dark); margin: 0; }

  .set-section-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-light); margin: 22px 4px 10px; display: flex; align-items: center; justify-content: space-between; }

  .set-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
  .set-row { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 0; border-bottom: 1px solid var(--border); width: 100%; text-align: left; background: transparent; color: inherit; cursor: pointer; font-family: var(--font-sans); transition: background 150ms ease; }
  .set-row:last-child { border-bottom: none; }
  .set-row:active { background: rgba(140,78,50,0.06); }
  .set-row .glyph { width: 32px; height: 32px; border-radius: 10px; background: var(--clay-light); color: var(--clay-dark); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .set-row .body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .set-row .label { font-size: 14px; font-weight: 500; color: var(--ink); }
  .set-row .sub { font-size: 12px; color: var(--ink-light); margin-top: 1px; }
  .set-row .value { font-size: 13px; color: var(--ink-mid); margin-right: 4px; }
  .set-row .value.gold { color: var(--gold); font-weight: 600; }
  .set-row .value.sage { color: var(--sage-dark); font-weight: 600; }
  .set-row .arrow { font-size: 18px; color: var(--ink-light); font-weight: 300; margin-left: 2px; }

  .set-toggle { position: relative; width: 44px; height: 26px; border-radius: 999px; background: rgba(140,78,50,0.18); transition: background 200ms ease; flex-shrink: 0; cursor: pointer; }
  .set-toggle .thumb { position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 999px; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.18); transition: left 200ms ease; }
  .set-toggle.on { background: var(--sage); }
  .set-toggle.on .thumb { left: 20px; }

  .set-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; margin: 4px 14px 14px; background: var(--clay-light); border-radius: 12px; }
  .set-seg button { padding: 9px 6px; border-radius: 9px; font-size: 12px; font-weight: 500; color: var(--ink-mid); display: flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit; border: none; background: transparent; cursor: pointer; transition: all 200ms ease; }
  .set-seg button.on { background: var(--clay); color: #fff; font-weight: 600; }

  .set-time { font-size: 13px; color: var(--ink); font-family: inherit; background: rgba(140,78,50,0.06); border: none; border-radius: 8px; padding: 6px 10px; font-weight: 500; }

  .set-premium-row { background: linear-gradient(135deg, rgba(212,168,83,0.10), rgba(201,123,92,0.10)); border: 1px solid rgba(212,168,83,0.3); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 14px; font-family: inherit; text-align: left; width: 100%; cursor: pointer; }
  .set-premium-row .crest { width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, var(--gold), #BD8F38); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(212,168,83,0.3); }
  .set-premium-row .body { flex: 1; }
  .set-premium-row .body strong { display: block; font-size: 14px; font-weight: 600; color: var(--ink); }
  .set-premium-row .body small { display: block; font-size: 12px; color: var(--ink-mid); margin-top: 2px; line-height: 1.4; }
  .set-premium-row .cta { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--clay-dark); text-transform: uppercase; }

  /* "Patterns you've marked helpful" — Settings card pulling thumbs-up'd
     correlations from Insights, so the user can see validated patterns
     still surface. Tap to jump to Insights. Hidden when none. */
  .set-recent { display: block; width: 100%; text-align: left; background: linear-gradient(135deg, rgba(143,184,155,0.10), rgba(212,168,83,0.05)); border: 1px solid rgba(143,184,155,0.26); border-radius: 16px; padding: 14px 16px; cursor: pointer; font-family: inherit; }
  .set-recent:active { transform: scale(0.99); }
  .set-recent .eye { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 8px; }
  .set-recent ul { list-style: none; padding: 0; margin: 0 0 10px; display: flex; flex-direction: column; gap: 6px; }
  .set-recent li { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; color: var(--ink); line-height: 1.45; }
  .set-recent li svg { color: var(--clay); flex-shrink: 0; margin-top: 3px; }
  .set-recent .cta { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--sage-dark); font-weight: 600; }

  .set-danger { display: block; width: 100%; margin: 22px 0 12px; padding: 14px; border-radius: 14px; background: transparent; color: #B0463A; font-size: 13px; font-weight: 500; border: 1px solid rgba(176,70,58,0.2); font-family: inherit; cursor: pointer; }
  .set-danger:active { background: rgba(176,70,58,0.05); }

  .set-footer { text-align: center; padding: 20px 0 16px; font-size: 11px; color: var(--ink-light); letter-spacing: 0.02em; line-height: 1.6; }
  .set-footer a { color: var(--clay-dark); text-decoration: underline; text-decoration-color: rgba(140,78,50,0.3); }
  .set-footer .v { font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }

  /* ════════════════════════════════════════════════════════════════════════
     Paywall screen redesign (Claude Design handoff, Apr 30 2026)
     ════════════════════════════════════════════════════════════════════════ */
  .pw-app { position: fixed; inset: 0; max-width: 420px; margin: 0 auto; background: radial-gradient(120% 70% at 100% 0%, rgba(212,168,83,0.18), transparent 55%), radial-gradient(100% 60% at 0% 100%, rgba(122,158,135,0.16), transparent 55%), var(--cream); color: var(--ink); font-family: var(--font-sans); display: flex; flex-direction: column; overflow: hidden; z-index: 1000; }
  .pw-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: calc(env(safe-area-inset-top, 0px) + 60px) 20px 200px; }
  .pw-scroll::-webkit-scrollbar { width: 0; }
  .pw-close { position: absolute; top: calc(env(safe-area-inset-top, 0px) + 18px); right: 18px; z-index: 5; width: 32px; height: 32px; border-radius: 999px; background: var(--glass-cream); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); border: 1px solid var(--border); color: var(--ink-mid); display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; line-height: 1; }
  .pw-eyebrow { font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--clay-dark); display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
  .pw-eyebrow .crest { width: 18px; height: 18px; border-radius: 999px; background: linear-gradient(135deg, var(--gold), #BD8F38); display: inline-flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 2px 6px rgba(212,168,83,0.4); }
  .pw-headline { font-family: var(--font-serif); font-weight: 400; font-size: 34px; line-height: 1.06; letter-spacing: -0.015em; color: var(--ink); margin: 0 0 12px; }
  .pw-headline em { font-style: italic; color: var(--clay); }
  .pw-sub { font-size: 14px; line-height: 1.55; color: var(--ink-mid); margin: 0 0 22px; max-width: 320px; }
  .pw-hero { position: relative; border-radius: 22px; background: var(--card-bg); border: 1px solid var(--border); box-shadow: inset 0 1px 0 var(--glass-edge), 0 14px 40px rgba(140, 78, 50, 0.12), 0 2px 6px rgba(140, 78, 50, 0.06); padding: 18px 18px 16px; margin-bottom: 26px; overflow: hidden; }
  .pw-hero::before { content: ""; position: absolute; inset: 0; background: radial-gradient(80% 60% at 100% 0%, rgba(212,168,83,0.12), transparent 60%); pointer-events: none; }
  .pw-hero-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; position: relative; }
  .pw-hero-row .badge { width: 36px; height: 36px; border-radius: 12px; background: var(--clay-light); color: var(--clay-dark); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pw-hero-row .title { font-family: var(--font-serif); font-size: 18px; color: var(--ink); line-height: 1.15; }
  .pw-hero-row .title em { font-style: italic; color: var(--clay); }
  .pw-hero-row .title small { display: block; font-family: var(--font-sans); font-size: 11px; color: var(--ink-light); letter-spacing: 0.04em; text-transform: uppercase; margin-top: 3px; font-weight: 500; }
  .pw-pdf { position: relative; border-radius: 12px; background: linear-gradient(180deg, #fdfaf6, #f7f0e8); border: 1px solid var(--border); padding: 14px 14px 12px; box-shadow: inset 0 1px 0 #fff; }
  .pw-pdf .pdf-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .pw-pdf .pdf-head .name { font-family: var(--font-serif); font-size: 13px; color: var(--ink); }
  .pw-pdf .pdf-head .meta { font-size: 9px; color: var(--ink-light); letter-spacing: 0.06em; text-transform: uppercase; }
  .pw-pdf .pdf-line { height: 4px; background: rgba(140,78,50,0.10); border-radius: 2px; margin-bottom: 5px; }
  .pw-pdf .pdf-line.short { width: 60%; }
  .pw-pdf .pdf-line.shorter { width: 35%; }
  .pw-pdf .pdf-mini-chart { display: flex; align-items: flex-end; gap: 3px; height: 30px; margin: 10px 0 8px; }
  .pw-pdf .pdf-mini-chart span { flex: 1; background: var(--sage); opacity: 0.55; border-radius: 2px 2px 0 0; }
  .pw-pdf .pdf-foot { font-size: 9px; color: var(--ink-light); letter-spacing: 0.04em; margin-top: 4px; }
  .pw-pillars { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 26px; }
  .pw-pillar { display: flex; gap: 13px; padding: 14px; border-radius: 16px; background: var(--card-bg); border: 1px solid var(--border); align-items: flex-start; }
  .pw-pillar .ico { width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pw-pillar.sage .ico { background: var(--sage-light); color: var(--sage-dark); }
  .pw-pillar.clay .ico { background: var(--clay-light); color: var(--clay-dark); }
  .pw-pillar.gold .ico { background: rgba(212,168,83,0.18); color: var(--gold); }
  .pw-pillar h3 { font-family: var(--font-serif); font-size: 16px; font-weight: 400; margin: 1px 0 3px; color: var(--ink); }
  .pw-pillar p { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--ink-mid); }
  .pw-quote { border-radius: 18px; background: var(--glass-sage-card); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border: 1px solid var(--border); padding: 16px 18px; margin-bottom: 26px; position: relative; }
  .pw-quote .body { font-family: var(--font-serif); font-style: italic; font-size: 15px; line-height: 1.45; color: var(--sage-dark); margin: 0 0 10px; }
  .pw-quote .who { font-size: 11px; color: var(--ink-mid); letter-spacing: 0.04em; }
  .pw-quote .who strong { color: var(--ink); font-weight: 600; }
  .pw-plans { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
  .pw-plan { position: relative; background: var(--card-bg); border: 1.5px solid var(--border); border-radius: 16px; padding: 14px 12px 12px; font-family: inherit; text-align: left; cursor: pointer; transition: all 200ms ease; }
  .pw-plan.on { border-color: var(--clay); background: var(--clay-light); box-shadow: 0 4px 14px rgba(201,123,92,0.12); }
  .pw-plan .term { font-size: 11px; color: var(--ink-light); letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; }
  .pw-plan.on .term { color: var(--clay-dark); }
  .pw-plan .price { font-family: var(--font-serif); font-size: 24px; color: var(--ink); margin: 6px 0 2px; letter-spacing: -0.01em; }
  .pw-plan.on .price { color: var(--clay-dark); }
  .pw-plan .price small { font-family: var(--font-sans); font-size: 12px; font-weight: 500; color: var(--ink-mid); }
  .pw-plan.on .price small { color: var(--clay-dark); opacity: 0.8; }
  .pw-plan .note { font-size: 11px; color: var(--ink-mid); margin-top: 4px; }
  .pw-plan.on .note { color: var(--clay-dark); }
  .pw-plan .save-badge { position: absolute; top: -8px; right: 10px; background: var(--sage); color: #fff; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 999px; letter-spacing: 0.04em; text-transform: uppercase; }
  .pw-cta-bar { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 18px calc(env(safe-area-inset-bottom, 0px) + 24px); background: linear-gradient(180deg, transparent, var(--cream) 30%); z-index: 5; }
  .pw-cta { display: block; width: 100%; padding: 16px; border-radius: 16px; background: var(--clay); color: #fff; font-size: 15px; font-weight: 600; letter-spacing: 0.01em; border: none; font-family: inherit; cursor: pointer; box-shadow: 0 8px 24px rgba(201,123,92,0.32), inset 0 1px 0 rgba(255,255,255,0.18); transition: transform 100ms ease; }
  .pw-cta:active { transform: scale(0.98); }
  .pw-cta-fine { text-align: center; font-size: 11px; color: var(--ink-light); margin-top: 10px; letter-spacing: 0.01em; }
  .pw-cta-fine a { color: var(--ink-mid); text-decoration: underline; text-decoration-color: rgba(107,83,71,0.3); }
  .pw-restore { text-align: center; margin-top: 8px; font-size: 12px; color: var(--ink-mid); }
  .pw-restore button { color: var(--clay-dark); font-weight: 600; text-decoration: underline; text-decoration-color: rgba(140,78,50,0.3); background: none; border: none; cursor: pointer; font-family: inherit; font-size: 12px; }

  /* ════════════════════════════════════════════════════════════════════════
     Onboarding screen redesign (Claude Design handoff, Apr 30 2026)
     ════════════════════════════════════════════════════════════════════════ */
  .onb-app { position: relative; width: 100%; min-height: 100vh; background: var(--cream); color: var(--ink); font-family: var(--font-sans); display: flex; flex-direction: column; overflow: hidden; padding-bottom: 0; }
  .onb-app::before { content: ""; position: absolute; inset: 0; background: radial-gradient(140% 80% at 100% 0%, rgba(122,158,135,0.18), transparent 55%), radial-gradient(140% 80% at 0% 100%, rgba(201,123,92,0.14), transparent 55%); pointer-events: none; }
  .onb-scroll { position: relative; flex: 1; overflow-y: auto; overflow-x: hidden; padding: 24px 22px 140px; z-index: 1; }
  .onb-scroll::-webkit-scrollbar { width: 0; }

  .onb-progress { display: flex; align-items: center; gap: 10px; padding: 6px 0 22px; }
  .onb-progress .back { width: 32px; height: 32px; border-radius: 999px; background: var(--card-bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--ink-mid); flex-shrink: 0; cursor: pointer; transition: transform 100ms ease; }
  .onb-progress .back:active { transform: scale(0.94); }
  .onb-progress .back.invisible { visibility: hidden; }
  .onb-progress .track { flex: 1; height: 4px; border-radius: 999px; background: rgba(140,78,50,0.10); overflow: hidden; }
  .onb-progress .fill { height: 100%; background: linear-gradient(90deg, var(--clay), var(--clay-dark)); border-radius: 999px; transition: width 360ms cubic-bezier(0.22, 1, 0.36, 1); }
  .onb-progress .step { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-light); min-width: 36px; text-align: right; }

  .onb-question .eyebrow { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--clay-dark); display: inline-flex; align-items: center; gap: 6px; margin: 4px 0 14px; }
  .onb-question h1 { font-family: var(--font-serif); font-weight: 400; font-size: 32px; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 10px; }
  .onb-question h1 em { font-style: italic; color: var(--clay); }
  .onb-question .subhead { font-size: 14px; line-height: 1.55; color: var(--ink-mid); margin: 0 0 24px; }

  .onb-options { display: flex; flex-direction: column; gap: 8px; }
  .onb-option { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; text-align: left; width: 100%; font-family: inherit; cursor: pointer; transition: transform 100ms ease, background 200ms ease, border-color 200ms ease; }
  .onb-option:active { transform: scale(0.98); }
  .onb-option .glyph { width: 36px; height: 36px; border-radius: 12px; background: var(--clay-light); color: var(--clay-dark); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .onb-option .body { flex: 1; min-width: 0; }
  .onb-option .label { display: block; font-size: 15px; font-weight: 500; color: var(--ink); line-height: 1.3; }
  .onb-option .hint { display: block; font-size: 12px; color: var(--ink-light); margin-top: 2px; line-height: 1.4; }
  .onb-option .check { width: 22px; height: 22px; border-radius: 999px; border: 1.5px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: transparent; transition: all 200ms ease; font-size: 12px; }
  .onb-option.selected { background: var(--clay-light); border-color: var(--clay); }
  .onb-option.selected .check { background: var(--clay); border-color: var(--clay); color: #fff; }

  .onb-chip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .onb-chip { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px 14px 12px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; text-align: left; font-family: inherit; position: relative; min-height: 88px; cursor: pointer; transition: transform 100ms ease, background 200ms ease, border-color 200ms ease; }
  .onb-chip:active { transform: scale(0.97); }
  .onb-chip .glyph { width: 30px; height: 30px; border-radius: 10px; background: var(--clay-light); color: var(--clay-dark); display: flex; align-items: center; justify-content: center; }
  .onb-chip .label { font-size: 13px; font-weight: 500; color: var(--ink); line-height: 1.25; }
  .onb-chip.selected { background: var(--clay-light); border-color: var(--clay); }
  .onb-chip.selected .label { color: var(--clay-dark); font-weight: 600; }
  .onb-chip .pin { position: absolute; top: 10px; right: 10px; width: 18px; height: 18px; border-radius: 999px; background: var(--clay); color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.6); transition: all 200ms ease; }
  .onb-chip.selected .pin { opacity: 1; transform: scale(1); }

  .onb-footer { position: fixed; left: 0; right: 0; bottom: 0; max-width: 420px; margin: 0 auto; padding: 14px 22px calc(env(safe-area-inset-bottom, 0px) + 28px); background: linear-gradient(to top, var(--cream) 70%, transparent); z-index: 5; }
  .onb-footer .helper { font-size: 11.5px; color: var(--ink-light); text-align: center; margin: 0 0 10px; }
  .onb-next { width: 100%; padding: 16px; border-radius: 16px; background: var(--clay); color: #fff; font-size: 15px; font-weight: 600; letter-spacing: 0.01em; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; cursor: pointer; font-family: inherit; transition: opacity 150ms ease, transform 100ms ease; }
  .onb-next:disabled { opacity: 0.35; cursor: not-allowed; }
  .onb-next:not(:disabled):active { transform: scale(0.98); }

  .onb-welcome { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; padding: calc(env(safe-area-inset-top, 0px) + 24px) 26px 24px; min-height: 100vh; min-height: 100dvh; }
  .onb-welcome .top { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 18px; }
  .onb-welcome .mark { font-family: var(--font-serif); font-size: 56px; line-height: 1; color: var(--ink); letter-spacing: -0.02em; position: relative; margin-bottom: 4px; }
  .onb-welcome .mark em { font-style: italic; color: var(--clay); }
  .onb-welcome .mark::after { content: ""; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 36px; height: 1px; background: var(--clay); opacity: 0.4; }
  .onb-welcome .tag { font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-light); }
  .onb-welcome h1 { font-family: var(--font-serif); font-weight: 400; font-size: 30px; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); margin: 0; max-width: 14ch; }
  .onb-welcome h1 em { font-style: italic; color: var(--clay); }
  .onb-welcome .blurb { font-size: 14.5px; line-height: 1.6; color: var(--ink-mid); margin: 0; max-width: 30ch; }
  .onb-welcome .pillars { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; margin-top: 4px; }
  .onb-welcome .pillar { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--ink-mid); font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 500; }
  .onb-welcome .pillar .ico { width: 38px; height: 38px; border-radius: 12px; background: var(--card-bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--clay-dark); }
  .onb-welcome .bottom { display: flex; flex-direction: column; gap: 10px; padding-bottom: env(safe-area-inset-bottom, 0px); }
  .onb-welcome .privacy { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; letter-spacing: 0.04em; color: var(--ink-light); text-transform: uppercase; }
  .onb-welcome .secondary { background: transparent; color: var(--ink-mid); font-size: 13px; padding: 8px; font-weight: 500; border: none; cursor: pointer; font-family: inherit; }
  .onb-welcome .secondary u { text-decoration-color: var(--ink-light); }

  .onb-summary { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; padding: calc(env(safe-area-inset-top, 0px) + 28px) 22px 28px; min-height: 100vh; }
  .onb-summary .body { flex: 1; padding-bottom: 100px; }
  .onb-summary h1 { font-family: var(--font-serif); font-weight: 400; font-size: 32px; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 10px; }
  .onb-summary h1 em { font-style: italic; color: var(--clay); }
  .onb-summary .lede { font-size: 14px; line-height: 1.55; color: var(--ink-mid); margin: 0 0 22px; }
  .onb-summary-card { background: var(--glass-sage-card); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border: 1px solid var(--border); border-radius: 22px; padding: 18px 18px 16px; margin-bottom: 14px; box-shadow: inset 0 1px 0 var(--glass-edge), 0 8px 24px rgba(61, 107, 79, 0.08); }
  .onb-summary-card .eye { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 6px; display: inline-flex; align-items: center; gap: 6px; }
  .onb-summary-card h2 { font-family: var(--font-serif); font-weight: 400; font-size: 22px; line-height: 1.2; margin: 0 0 8px; color: var(--ink); }
  .onb-summary-card h2 em { font-style: italic; color: var(--sage-dark); }
  .onb-summary-card p { font-size: 13.5px; line-height: 1.55; color: var(--ink-mid); margin: 0; }
  .onb-summary-list { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 4px 0; }
  .onb-summary-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .onb-summary-row:last-child { border-bottom: none; }
  .onb-summary-row .num { width: 22px; height: 22px; border-radius: 999px; background: var(--clay-light); color: var(--clay-dark); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .onb-summary-row .text { flex: 1; min-width: 0; }
  .onb-summary-row .text strong { display: block; font-size: 13.5px; font-weight: 600; color: var(--ink); }
  .onb-summary-row .text small { display: block; font-size: 12px; color: var(--ink-mid); line-height: 1.45; margin-top: 2px; }
  .onb-summary-edits { margin-top: 14px; padding: 12px 16px; border-radius: 14px; background: rgba(140,78,50,0.04); font-size: 12px; color: var(--ink-mid); display: flex; align-items: center; gap: 8px; }
  .onb-summary-edits a { color: var(--clay-dark); font-weight: 600; text-decoration: underline; cursor: pointer; }

  /* ════════════════════════════════════════════════════════════════════════
     History screen redesign (Claude Design handoff, Apr 30 2026)
     ════════════════════════════════════════════════════════════════════════ */
  .history-greeting { padding: 18px 0 12px; }
  .history-greeting h1 { margin: 0 0 4px; font-family: var(--font-serif); font-weight: 400; font-size: 28px; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); }
  .history-greeting h1 em { font-style: italic; color: var(--clay); }
  .history-greeting .meta { margin: 0; font-size: 13px; color: var(--ink-mid); }
  .history-greeting .meta .dot { margin: 0 7px; color: var(--ink-light); }

  .empty-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px 22px 24px; text-align: center; }
  .empty-card .glyph { width: 56px; height: 56px; border-radius: 16px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; }
  .empty-card h3 { font-family: var(--font-serif); font-weight: 400; font-size: 22px; line-height: 1.2; margin: 0 0 10px; color: var(--ink); }
  .empty-card h3 em { font-style: italic; color: var(--clay); }
  .empty-card p { font-size: 14px; line-height: 1.55; color: var(--ink-mid); margin: 0 0 18px; }
  .empty-card .cta { display: inline-flex; align-items: center; gap: 6px; padding: 12px 18px; border-radius: 12px; background: var(--clay); color: #fff; font-size: 13px; font-weight: 600; border: none; cursor: pointer; font-family: inherit; }

  .streak-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stat-cell { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 12px 12px 10px; display: flex; flex-direction: column; gap: 2px; min-height: 70px; justify-content: center; }
  .stat-cell .v { font-family: var(--font-serif); font-size: 24px; line-height: 1; letter-spacing: -0.01em; color: var(--ink); }
  .stat-cell .v small { font-family: var(--font-sans); font-size: 12px; color: var(--ink-mid); font-weight: 500; margin-left: 3px; }
  .stat-cell .l { font-size: 10px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-light); margin-top: 2px; }

  .cal-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 14px 14px; }
  .cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .cal-month { font-family: var(--font-serif); font-size: 18px; letter-spacing: -0.005em; color: var(--ink); }
  .cal-month em { font-style: italic; color: var(--clay); }
  .cal-nav { display: flex; gap: 6px; }
  .cal-nav button { width: 28px; height: 28px; border-radius: 9px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; border: none; cursor: pointer; }
  .cal-nav button:disabled { opacity: 0.35; cursor: not-allowed; }
  .cal-nav button:active:not(:disabled) { transform: scale(0.94); }
  .cal-dows { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 6px; }
  .cal-dows span { font-size: 10px; color: var(--ink-light); letter-spacing: 0.04em; text-align: center; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .cal-cell { aspect-ratio: 1; border-radius: 9px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; font-size: 12px; color: var(--ink); background: rgba(140,78,50,0.04); border: none; cursor: pointer; transition: transform 100ms ease, background 200ms ease; }
  .cal-cell.empty { background: transparent; pointer-events: none; cursor: default; }
  .cal-cell.future { color: var(--ink-light); background: transparent; opacity: 0.4; pointer-events: none; cursor: default; }
  .cal-cell.today { outline: 2px solid var(--clay); outline-offset: -1px; font-weight: 600; }
  .cal-cell.has-entry { background: rgba(201,123,92,0.18); }
  .cal-cell.h2 { background: rgba(201,123,92,0.32); }
  .cal-cell.h3 { background: rgba(201,123,92,0.50); color: #fff; }
  .cal-cell.h4 { background: var(--clay); color: #fff; }
  .cal-cell.locked { color: var(--ink-light); cursor: not-allowed; }
  .cal-cell.locked::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(-45deg, transparent 0 4px, rgba(140,78,50,0.06) 4px 5px); border-radius: inherit; pointer-events: none; }
  .cal-cell .period { position: absolute; bottom: 4px; width: 4px; height: 4px; border-radius: 3px; background: var(--sage-dark); }
  .cal-cell.h3 .period, .cal-cell.h4 .period { background: #fff; }
  .cal-cell:active:not(.empty):not(.future):not(.locked) { transform: scale(0.92); }
  .cal-legend { display: flex; align-items: center; gap: 10px; font-size: 10px; color: var(--ink-light); letter-spacing: 0.04em; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); flex-wrap: wrap; }
  .cal-legend .row { display: inline-flex; align-items: center; gap: 4px; }
  .cal-legend .scale { display: inline-flex; gap: 2px; }
  .cal-legend .scale i { width: 11px; height: 11px; border-radius: 3px; display: block; }

  .filter-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 2px 16px 4px; }
  .filter-row::-webkit-scrollbar { display: none; }
  .filter-chip { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 999px; font-size: 12px; font-weight: 500; background: rgba(140,78,50,0.06); color: var(--ink-mid); border: 1px solid transparent; white-space: nowrap; cursor: pointer; font-family: inherit; transition: background 150ms ease, color 150ms ease, border-color 150ms ease; }
  .filter-chip.on { background: var(--clay-light); color: var(--clay-dark); border-color: var(--clay); }
  .filter-chip .ct { font-size: 10px; opacity: 0.7; }

  .day-group { margin-top: 4px; }
  .day-label { display: flex; align-items: baseline; gap: 8px; margin: 18px 2px 8px; }
  .day-label .num { font-family: var(--font-serif); font-size: 24px; color: var(--ink); letter-spacing: -0.01em; line-height: 1; }
  .day-label .num em { font-style: italic; color: var(--clay); }
  .day-label .day { font-size: 11px; color: var(--ink-light); letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; }
  .day-label .relative { font-size: 11px; color: var(--ink-light); margin-left: auto; }

  .entry-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 14px 12px; display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; text-align: left; cursor: pointer; font-family: inherit; width: 100%; transition: transform 100ms ease, border-color 200ms ease; }
  .entry-card:active { transform: scale(0.985); }
  .entry-card.standout { background: var(--glass-sage-card); border-color: var(--sage); }
  .entry-card .top-row { display: flex; align-items: center; gap: 10px; }
  .entry-card .e-mood { width: 32px; height: 32px; font-size: 22px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .entry-card .e-meta { flex: 1; min-width: 0; font-size: 12px; color: var(--ink-mid); line-height: 1.4; }
  .entry-card .e-meta strong { color: var(--ink); font-weight: 600; }
  .entry-card .e-time { font-size: 11px; color: var(--ink-light); letter-spacing: 0.04em; text-transform: uppercase; flex-shrink: 0; }
  .entry-card .e-pills { display: flex; gap: 5px; flex-wrap: wrap; }
  .entry-card .pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; padding: 4px 8px; border-radius: 999px; background: var(--clay-light); color: var(--clay-dark); }
  .entry-card .pill.sage { background: var(--sage-light); color: var(--sage-dark); }
  .entry-card .e-note { font-family: var(--font-serif); font-style: italic; font-weight: 400; font-size: 14px; line-height: 1.5; color: var(--ink); padding-left: 10px; border-left: 2px solid var(--clay-light); }
  .entry-card .e-context { display: flex; gap: 12px; align-items: center; padding-top: 8px; border-top: 1px solid var(--border); font-size: 11px; color: var(--ink-mid); }
  .entry-card .e-context span { display: inline-flex; align-items: center; gap: 4px; }
  .entry-card .e-context strong { color: var(--ink); font-weight: 600; }
  .entry-card.skipped { background: transparent; border: 1px dashed var(--border); color: var(--ink-light); font-size: 12px; padding: 10px 14px; display: flex; flex-direction: row; align-items: center; gap: 8px; }
  .entry-card.skipped:active { transform: none; }

  .lock-banner { margin-top: 18px; background: var(--glass-cream-strong); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border: 1px solid var(--border); border-radius: 18px; padding: 18px 16px; text-align: center; position: relative; overflow: hidden; }
  .lock-banner::before { content: ""; position: absolute; left: 0; right: 0; top: -28px; height: 28px; background: linear-gradient(to bottom, transparent, var(--cream)); pointer-events: none; }
  .lock-banner .ico { width: 40px; height: 40px; border-radius: 12px; background: var(--clay-light); color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
  .lock-banner h4 { font-family: var(--font-serif); font-weight: 400; font-size: 18px; margin: 0 0 6px; color: var(--ink); }
  .lock-banner h4 em { font-style: italic; color: var(--clay); }
  .lock-banner p { font-size: 13px; color: var(--ink-mid); line-height: 1.5; margin: 0 0 14px; }
  .lock-banner button { padding: 10px 18px; border-radius: 12px; background: var(--clay); color: #fff; font-size: 13px; font-weight: 600; border: none; cursor: pointer; font-family: inherit; }

  .dd-scrim { position: fixed; inset: 0; background: var(--glass-modal-scrim); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); z-index: 50; opacity: 0; pointer-events: none; transition: opacity 200ms ease; }
  .dd-scrim.show { opacity: 1; pointer-events: auto; }
  .dd-sheet { position: fixed; left: 8px; right: 8px; bottom: 8px; max-width: 420px; margin: 0 auto; border-radius: 24px; background: var(--cream); border: 1px solid var(--border); box-shadow: inset 0 1px 0 var(--glass-edge), 0 18px 50px rgba(140, 78, 50, 0.20); z-index: 51; padding: 18px; max-height: 78vh; display: flex; flex-direction: column; transform: translateY(40px); opacity: 0; pointer-events: none; transition: transform 260ms cubic-bezier(0.2,0.8,0.3,1), opacity 240ms ease; overflow-y: auto; }
  .dd-ask-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--clay); color: #fff; border: none; border-radius: 12px; padding: 11px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .dd-ask-btn:active { transform: scale(0.98); }
  .dd-sheet.show { transform: translateY(0); opacity: 1; pointer-events: auto; }
  .dd-handle { width: 36px; height: 4px; border-radius: 3px; background: rgba(140,78,50,0.2); margin: -6px auto 14px; }
  .dd-head { margin-bottom: 14px; }
  .dd-head .num { font-family: var(--font-serif); font-size: 30px; line-height: 1; letter-spacing: -0.01em; color: var(--ink); }
  .dd-head .num em { font-style: italic; color: var(--clay); }
  .dd-head .day { font-size: 11px; color: var(--ink-light); letter-spacing: 0.06em; text-transform: uppercase; margin-top: 4px; }
  .dd-section { margin-top: 16px; }
  .dd-label { font-size: 10px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-light); margin-bottom: 8px; }
  .dd-mood-row { display: flex; align-items: center; gap: 12px; }
  .dd-mood-row .em { font-size: 36px; line-height: 1; }
  .dd-mood-row .lbl { font-family: var(--font-serif); font-size: 22px; color: var(--ink); }
  .dd-mood-row .lbl small { display: block; font-family: var(--font-sans); font-size: 12px; color: var(--ink-mid); margin-top: 3px; }
  .dd-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .dd-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; padding: 7px 11px; border-radius: 999px; background: var(--clay-light); color: var(--clay-dark); }
  .dd-pill .sev { font-family: var(--font-serif); font-size: 10px; background: rgba(255,255,255,0.55); padding: 1px 5px; border-radius: 4px; }
  .dd-context-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .dd-context-cell { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 12px; }
  .dd-context-cell .lab { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-light); margin-bottom: 4px; display: inline-flex; align-items: center; gap: 5px; }
  .dd-context-cell .v { font-family: var(--font-serif); font-size: 20px; color: var(--ink); }
  .dd-context-cell .v small { font-family: var(--font-sans); font-size: 11px; color: var(--ink-mid); margin-left: 3px; }
  .dd-note { font-family: var(--font-serif); font-style: italic; font-size: 16px; line-height: 1.5; color: var(--ink); background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 14px; }

  /* ════════════════════════════════════════════════════════════════════════
     Circle (Community) screen redesign (Claude Design handoff, Apr 30 2026)
     ════════════════════════════════════════════════════════════════════════ */
  .cir-greeting { padding: 18px 0 14px; }
  .cir-greeting h1 { margin: 0 0 6px; font-family: var(--font-serif); font-weight: 400; font-size: 30px; line-height: 1.08; letter-spacing: -0.01em; color: var(--ink); }
  .cir-greeting h1 em { font-style: italic; color: var(--clay); }
  .cir-greeting .meta { margin: 0; font-size: 13px; color: var(--ink-mid); }

  .cir-prompt { position: relative; border-radius: 22px; padding: 20px 20px 18px; background: linear-gradient(135deg, rgba(122,158,135,0.18), rgba(212,168,83,0.12)); border: 1px solid var(--border); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); box-shadow: inset 0 1px 0 var(--glass-edge), 0 8px 24px rgba(61, 107, 79, 0.10); overflow: hidden; margin-bottom: 22px; }
  .cir-prompt::before { content: ""; position: absolute; inset: 0; background: radial-gradient(120% 80% at 100% 0%, rgba(122,158,135,0.20), transparent 55%); pointer-events: none; }
  .cir-prompt .eye { font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--sage-dark); display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px; }
  .cir-prompt .eye .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--sage); box-shadow: 0 0 0 3px rgba(122,158,135,0.22); }
  .cir-prompt h2 { font-family: var(--font-serif); font-weight: 400; font-size: 22px; line-height: 1.18; color: var(--ink); margin: 0 0 14px; }
  .cir-prompt h2 em { font-style: italic; color: var(--sage-dark); }
  .cir-prompt-meta { display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: var(--ink-mid); margin-bottom: 16px; }
  .cir-prompt-meta .dot { color: var(--ink-light); }
  .cir-prompt-meta .live { display: inline-flex; align-items: center; gap: 5px; color: var(--sage-dark); font-weight: 600; }
  .cir-prompt-meta .live .pulse { width: 6px; height: 6px; border-radius: 999px; background: var(--sage); animation: cir-pulse 1.6s ease-out infinite; }
  @keyframes cir-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(122,158,135,0.6); } 70% { box-shadow: 0 0 0 6px rgba(122,158,135,0); } }
  .cir-share-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 13px; border-radius: 14px; background: var(--ink); color: var(--cream); font-size: 13.5px; font-weight: 600; font-family: inherit; border: none; cursor: pointer; transition: transform 100ms ease; }
  .cir-share-btn:active { transform: scale(0.98); }
  .cir-share-btn .anon { font-size: 11px; font-weight: 500; opacity: 0.7; letter-spacing: 0.04em; }

  .cir-section-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-light); margin: 18px 4px 12px; display: flex; align-items: center; justify-content: space-between; }
  .cir-section-label .filter-chip { text-transform: none; letter-spacing: 0.01em; color: var(--ink-mid); font-size: 11.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; background: none; border: none; }

  .cir-reply { background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; padding: 14px 16px 12px; margin-bottom: 10px; position: relative; }
  .cir-reply-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 11.5px; color: var(--ink-mid); }
  .cir-avatar { width: 24px; height: 24px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-family: var(--font-serif); font-size: 11px; color: #fff; flex-shrink: 0; }
  .cir-avatar.a { background: var(--sage); }
  .cir-avatar.b { background: var(--clay); }
  .cir-avatar.c { background: var(--gold); }
  .cir-avatar.d { background: var(--clay-dark); }
  .cir-avatar.e { background: var(--sage-dark); }
  .cir-reply-head .who { color: var(--ink); font-weight: 600; }
  .cir-reply-head .age { color: var(--ink-light); }
  .cir-reply-head .when { margin-left: auto; color: var(--ink-light); font-size: 11px; }
  .cir-reply-body { font-size: 14px; line-height: 1.55; color: var(--ink); margin: 0 0 10px; }
  .cir-reply-body em { font-family: var(--font-serif); font-style: italic; color: var(--sage-dark); }
  .cir-reply-foot { display: flex; align-items: center; gap: 12px; font-size: 11.5px; color: var(--ink-mid); padding-top: 6px; border-top: 1px solid var(--border); }
  .cir-reply-foot .react { display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px 5px 7px; border-radius: 999px; background: rgba(122,158,135,0.10); color: var(--sage-dark); font-weight: 500; border: none; font-family: inherit; cursor: pointer; transition: background 200ms ease; }
  .cir-reply-foot .react.on { background: var(--sage-light); color: var(--sage-dark); }
  .cir-reply-foot .save { margin-left: auto; color: var(--ink-light); font-family: inherit; font-size: 12px; display: inline-flex; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; }
  .cir-reply-foot .save.on { color: var(--clay-dark); }
  .cir-reply.featured { background: linear-gradient(180deg, var(--card-bg), rgba(212,168,83,0.04)); border-color: rgba(212,168,83,0.28); }
  .cir-reply.featured::before { content: "Most echoed"; position: absolute; top: -7px; left: 14px; background: var(--card-bg); border: 1px solid rgba(212,168,83,0.4); color: var(--gold); font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; }

  .cir-past { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
  .cir-past-row { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-bottom: 1px solid var(--border); background: none; border-left: none; border-right: none; border-top: none; width: 100%; text-align: left; font-family: inherit; cursor: pointer; }
  .cir-past-row:last-child { border-bottom: none; }
  .cir-past-row:active { background: rgba(140,78,50,0.06); }
  .cir-past-row .day { width: 38px; flex-shrink: 0; text-align: center; }
  .cir-past-row .day .num { font-family: var(--font-serif); font-size: 18px; color: var(--clay); line-height: 1; }
  .cir-past-row .day .mo { font-size: 9px; color: var(--ink-light); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 3px; }
  .cir-past-row .body { flex: 1; min-width: 0; }
  .cir-past-row .q { font-size: 13px; color: var(--ink); font-weight: 500; line-height: 1.35; }
  .cir-past-row .stats { font-size: 11px; color: var(--ink-light); margin-top: 3px; }
  .cir-past-row .arrow { font-size: 18px; color: var(--ink-light); }

  .cir-privacy { margin-top: 22px; padding: 14px 16px; background: var(--sage-light); border-radius: 14px; border: 1px solid var(--border); display: flex; gap: 12px; align-items: flex-start; }
  .cir-privacy .ico { width: 28px; height: 28px; border-radius: 8px; background: var(--sage); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cir-privacy .body { font-size: 12px; line-height: 1.5; color: var(--sage-dark); }
  .cir-privacy .body strong { display: block; font-size: 12.5px; font-weight: 600; color: var(--sage-dark); margin-bottom: 2px; }

  /* First-time welcome card — uses translucent surface tokens that adapt
     to light/dark theme instead of a hardcoded cream gradient (the
     hardcoded gradient + var(--ink) text rendered as white-on-cream in
     dark mode and was unreadable). */
  .cir-first-welcome { margin: 4px 0 18px; padding: 18px 18px 16px; border-radius: 18px; background: var(--card-bg); border: 1px solid var(--border); }
  .cir-first-eye { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 10px; }
  .cir-first-welcome h3 { margin: 0 0 8px; font-family: var(--font-serif); font-weight: 400; font-size: 22px; line-height: 1.18; color: var(--ink); }
  .cir-first-welcome h3 em { font-style: italic; color: var(--clay); }
  .cir-first-welcome p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.55; color: var(--ink-mid); }
  .cir-first-rules { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 11.5px; color: var(--ink-light); }
  .cir-first-rules span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 999px; background: var(--card-bg-soft, rgba(140,78,50,0.06)); border: 1px solid var(--border); }

  /* ── SCREENS ── */
  /* padding-bottom leaves room for the fixed bottom bar (52px + safe-area + breathing room) */
  /* All screens get a 16px horizontal gutter so cards don't bleed to
     the absolute viewport edge. Sticky/fixed children (vela-header,
     nav-bottom, ask-vela-fab, modal sheets) compensate via negative
     margin or position:fixed. */
  .screen { display: none; flex-direction: column; padding: 0 16px 96px; animation: fadeIn 0.3s ease; }
  .screen.active { display: flex; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

  /* ── ONBOARDING ── */
  .onboard-hero { padding: 20px 24px 0; }
  .onboard-hero h1 {
    font-family: 'DM Serif Display', serif;
    font-size: 30px;
    line-height: 1.2;
    color: var(--ink);
    margin-bottom: 8px;
  }
  .onboard-hero h1 em { font-style: italic; color: var(--clay); }
  .onboard-hero p { font-size: 14px; color: var(--ink-mid); line-height: 1.6; }

  .progress-bar { height: 3px; background: var(--border); border-radius: 2px; margin: 20px 24px 0; }
  .progress-fill { height: 100%; border-radius: 2px; background: var(--clay); transition: width 0.4s ease; }

  .q-card {
    margin: 16px 16px 0;
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 20px;
    border: 1px solid var(--border);
    flex: 1;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .q-fade-in { opacity: 1; transform: translateX(0); }
  .q-fade-out { opacity: 0; transform: translateX(-16px); }
  .q-step {
    font-size: 11px;
    font-weight: 500;
    color: var(--clay);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .q-text {
    font-family: 'DM Serif Display', serif;
    font-size: 20px;
    line-height: 1.3;
    color: var(--ink);
    margin-bottom: 18px;
  }
  .q-options { display: flex; flex-direction: column; gap: 8px; }
  .q-opt {
    padding: 13px 16px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border);
    cursor: pointer;
    font-size: 14px;
    color: var(--ink);
    transition: all 0.18s;
    background: var(--cream);
    text-align: left;
    font-family: 'DM Sans', sans-serif;
  }
  .q-opt:hover { border-color: var(--clay); background: var(--clay-light); }
  .q-opt.selected { border-color: var(--clay); background: var(--clay-light); color: var(--clay-dark); font-weight: 500; }

  .onboard-btn {
    margin: 16px 16px 0;
    padding: 15px;
    background: var(--clay-dark);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
  .onboard-btn:hover { background: var(--clay); }
  .onboard-btn:disabled { background: var(--border); color: var(--ink-light); cursor: default; box-shadow: none; }

  /* ── ONBOARD COMPLETE ── */
  .onboard-complete {
    padding: 40px 24px 24px; text-align: center;
    animation: revealFade 0.5s ease;
  }
  .onboard-complete-icon { font-size: 48px; margin-bottom: 16px; }
  .onboard-complete-title {
    font-family: 'DM Serif Display', serif; font-size: 26px; color: var(--ink);
    margin-bottom: 10px;
  }
  .onboard-complete-text {
    font-size: 15px; color: var(--ink-mid); line-height: 1.55; margin-bottom: 24px;
  }
  .onboard-plan {
    background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border);
    padding: 16px 18px; text-align: left; margin-bottom: 20px;
  }
  .onboard-plan-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--sage-dark); margin-bottom: 12px;
  }
  .onboard-plan-step {
    display: flex; gap: 12px; align-items: baseline; padding: 6px 0;
    border-top: 1px solid var(--border);
  }
  .onboard-plan-step:first-of-type { border-top: none; }
  .onboard-plan-day {
    font-size: 12px; font-weight: 600; color: var(--clay); white-space: nowrap; min-width: 56px;
  }
  .onboard-plan-desc { font-size: 13px; color: var(--ink); line-height: 1.4; }
  .onboard-complete-sub {
    font-size: 13px; color: var(--ink-light); margin-bottom: 20px;
  }

  /* ── TRACKER ── */
  .tracker-header { padding: 16px 24px 0; }
  .tracker-header h2 { font-family: 'DM Serif Display', serif; font-size: 24px; color: var(--ink); }
  .tracker-header p { font-size: 13px; color: var(--ink-light); margin-top: 2px; }
  .personalized-welcome {
    font-size: 13px; color: var(--sage-dark); margin-top: 6px; line-height: 1.4;
    font-style: italic; opacity: 0.9;
  }

  .wellbeing-card {
    margin: 14px 16px 0;
    background: linear-gradient(135deg, #C97B5C 0%, #A85A3A 100%);
    border-radius: var(--radius);
    padding: 18px 20px;
    color: white;
  }
  .wb-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.8;
    margin-bottom: 10px;
  }
  .wb-faces { display: flex; justify-content: space-between; }
  .wb-face {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.18s;
    font-size: 22px;
    border: 2px solid transparent;
  }
  .wb-face:hover, .wb-face.selected {
    background: rgba(255,255,255,0.35);
    border-color: rgba(255,255,255,0.7);
    transform: scale(1.1);
  }

  .section-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-light);
    margin-bottom: 10px;
  }

  .energy-section { margin: 14px 16px 0; }
  .energy-row {
    display: flex; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .energy-row::-webkit-scrollbar { display: none; }
  .energy-chip {
    flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center;
    padding: 10px 4px; border-radius: var(--radius-sm); border: 1.5px solid var(--border);
    background: var(--card-bg); cursor: pointer; transition: all 0.15s; gap: 4px;
  }
  .energy-chip:active { transform: scale(0.94); }
  .energy-chip.active { border-color: var(--sage); background: var(--sage-light); }
  .energy-icon { font-size: 20px; color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; }
  .energy-chip.active .energy-icon { color: var(--sage-dark); }
  .energy-label { font-size: 10px; font-weight: 500; color: var(--ink-light); text-align: center; }
  .energy-chip.active .energy-label { color: var(--sage-dark); font-weight: 600; }

  .symptoms-section { margin: 14px 16px 0; }
  .symptom-filter {
    width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--ink); background: var(--card-bg);
    margin-bottom: 8px; outline: none;
  }
  .symptom-filter:focus { border-color: var(--clay); }
  .symptom-filter::placeholder { color: var(--ink-light); }

  .active-symptoms-summary {
    display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;
  }
  .active-symptom-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
    background: var(--clay-light); color: var(--clay-dark); border: 1px solid var(--clay);
    cursor: pointer; transition: all 0.15s;
  }
  .active-symptom-chip:active { transform: scale(0.94); opacity: 0.7; }

  .symptom-cat-tabs {
    display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 8px;
    -webkit-overflow-scrolling: touch; scrollbar-width: none;
  }
  .symptom-cat-tabs::-webkit-scrollbar { display: none; }
  .symptom-cat-tab {
    flex-shrink: 0; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500;
    font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--border); background: var(--card-bg);
    color: var(--ink-light); cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .symptom-cat-tab:active { transform: scale(0.96); }
  .symptom-cat-tab.active {
    background: var(--sage); color: white; border-color: var(--sage);
  }

  .symptom-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .symptom-tile {
    background: var(--card-bg);
    border-radius: var(--radius-sm);
    padding: 12px;
    border: 1.5px solid var(--border);
    cursor: pointer;
    transition: all 0.18s;
    text-align: left;
  }
  .symptom-tile:hover { border-color: var(--clay); }
  .symptom-tile.active { border-color: var(--clay); background: var(--clay-light); }
  .s-icon { font-size: 18px; margin-bottom: 4px; color: var(--clay-dark); display: flex; align-items: center; justify-content: center; min-height: 28px; }
  .symptom-tile.active .s-icon { color: var(--clay); }
  .s-name { font-size: 13px; font-weight: 500; color: var(--ink); display: block; }
  .symptom-tile.active .s-name { color: var(--clay-dark); }
  .s-severity { display: none; gap: 4px; margin-top: 6px; }
  .symptom-tile.active .s-severity { display: flex; }
  .sev-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
    cursor: pointer;
    transition: background 0.15s;
  }
  .sev-dot.on { background: var(--clay); }

  /* ── CONTEXT SECTION ── */
  .context-section { margin: 14px 16px 0; }
  .ctx-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 0; border-bottom: 1px solid var(--border);
  }
  .ctx-label { font-size: 14px; color: var(--ink); font-weight: 500; }
  .ctx-stepper { display: flex; align-items: center; gap: 12px; }
  .ctx-step-btn {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--card-bg); border: 1.5px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 600; color: var(--ink);
    cursor: pointer; transition: all 0.15s; user-select: none;
  }
  .ctx-step-btn:hover { border-color: var(--clay); color: var(--clay); }
  .ctx-value { font-size: 15px; font-weight: 500; color: var(--ink); min-width: 36px; text-align: center; }
  .ctx-value.unset { color: var(--ink-light); }
  .ctx-dots { display: flex; gap: 8px; }
  .ctx-dot {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--card-bg); border: 1.5px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 500; color: var(--ink-light);
    cursor: pointer; transition: all 0.15s;
  }
  .ctx-dot.active { background: var(--clay-light); border-color: var(--clay); color: var(--clay-dark); }
  .ctx-pills { display: flex; gap: 8px; margin-top: 12px; }
  .ctx-pill {
    flex: 1; padding: 10px 8px; border-radius: 10px;
    background: var(--card-bg); border: 1.5px solid var(--border);
    text-align: center; font-size: 13px; font-weight: 500;
    color: var(--ink); cursor: pointer; transition: all 0.15s;
  }
  .ctx-pill.on { background: rgba(122,158,135,0.12); border-color: var(--sage); color: var(--sage-dark); }

  .notes-area { margin: 14px 16px 0; }
  .notes-input {
    width: 100%;
    background: var(--card-bg);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: var(--ink);
    resize: none;
    height: 70px;
    outline: none;
    transition: border-color 0.2s;
  }
  .notes-input:focus { border-color: var(--clay); }
  .notes-input::placeholder { color: var(--ink-light); }
  .note-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .note-chip {
    font-size: 12px; padding: 5px 10px; border-radius: 14px; cursor: pointer;
    border: 1px solid var(--border); color: var(--ink-mid); background: var(--card-bg);
    font-family: 'DM Sans', sans-serif; transition: all 0.15s;
  }
  .note-chip.on { background: var(--sage-light); border-color: var(--sage); color: var(--sage-dark); }

  .log-btn {
    margin: 14px 16px 0;
    padding: 15px;
    background: var(--sage-dark);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .log-btn:hover { background: #2D5239; }

  /* ── INSIGHTS ── */
  .insights-header { padding: 16px 24px 0; }
  .insights-header h2 { font-family: 'DM Serif Display', serif; font-size: 24px; color: var(--ink); }
  .insights-header p { font-size: 13px; color: var(--ink-light); margin-top: 2px; }

  .insight-callout {
    margin: 14px 16px 0;
    background: var(--sage-light);
    border-radius: var(--radius);
    padding: 16px 18px;
    border-left: 3px solid var(--sage);
  }
  .ic-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sage-dark);
    margin-bottom: 4px;
  }
  .ic-text { font-size: 14px; color: var(--ink); line-height: 1.5; }
  .ic-text strong { color: var(--sage-dark); }

  .trend-card {
    margin: 12px 16px 0;
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 18px;
    border: 1px solid var(--border);
  }
  .trend-title { font-size: 13px; font-weight: 500; color: var(--ink); margin-bottom: 14px; }
  .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 80px; }
  .bar-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
    justify-content: flex-end;
  }
  .bar {
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: var(--clay-light);
    border: 1px solid var(--border);
    min-height: 4px;
  }
  .bar.high { background: var(--clay); border-color: var(--clay-dark); }
  .bar-day { font-size: 10px; color: var(--ink-light); }

  .symptom-list { margin: 12px 16px 0; }
  .sym-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid #F2EBE5;
  }
  .sym-row:last-child { border-bottom: none; }
  .sym-rank {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--clay-light);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 500;
    color: var(--clay-dark);
    flex-shrink: 0;
  }
  .sym-info { flex: 1; }
  .sym-info-name { font-size: 13px; font-weight: 500; color: var(--ink); }
  .sym-info-days { font-size: 12px; color: var(--ink-light); }
  .sym-mini-bar { height: 6px; border-radius: 3px; background: var(--clay); }
  .sym-trend { font-size: 11px; margin-left: 4px; font-weight: 600; }
  .sym-trend.up { color: var(--clay); }
  .sym-trend.down { color: var(--sage); }
  .sym-trend.same { color: var(--ink-light); }

  .unlock-card {
    margin: 12px 16px 0;
    background: #2C1F17;
    border-radius: var(--radius);
    padding: 20px;
    color: #F0E8E2;
    border: 1px solid rgba(212, 168, 83, 0.2);
  }
  .unlock-tag {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--gold);
    margin-bottom: 8px;
  }
  .unlock-title { font-family: 'DM Serif Display', serif; font-size: 18px; margin-bottom: 6px; }
  .unlock-body { font-size: 13px; color: rgba(240,232,226,0.7); line-height: 1.5; margin-bottom: 14px; }
  .unlock-btn {
    padding: 11px 20px;
    background: var(--gold);
    color: #2C1F17;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
  }
  .unlock-btn:hover { background: #BF9440; }

  /* ── HISTORY ── */
  .history-header { padding: 16px 24px 0; }
  .history-header h2 { font-family: 'DM Serif Display', serif; font-size: 24px; color: var(--ink); }
  .history-header p { font-size: 13px; color: var(--ink-light); margin-top: 2px; }

  .history-empty {
    margin: 60px 24px;
    text-align: center;
    color: var(--ink-light);
    font-size: 14px;
    line-height: 1.6;
  }
  .history-empty-cta {
    display: inline-block; padding: 12px 28px; background: var(--clay);
    color: white; border: none; border-radius: var(--radius-sm);
    font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif;
    cursor: pointer; transition: background 0.2s;
  }
  .history-empty-cta:hover { background: var(--clay-dark); }

  .history-day { margin: 14px 16px 0; }
  .history-day-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-light);
    margin-bottom: 8px;
  }
  .history-entry {
    background: var(--card-bg);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    border: 1px solid var(--border);
    margin-bottom: 8px;
  }
  .he-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .he-mood { font-size: 20px; }
  .he-time { font-size: 12px; color: var(--ink-light); }
  .he-symptoms { display: flex; flex-wrap: wrap; gap: 6px; }
  .he-pill {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 12px;
    background: var(--clay-light);
    color: var(--clay-dark);
    font-weight: 500;
  }
  .he-notes {
    font-size: 13px;
    color: var(--ink-mid);
    margin-top: 8px;
    font-style: italic;
    line-height: 1.4;
  }

  /* ── MOOD TREND ── */
  .mood-trend {
    margin: 12px 16px 0;
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 16px 18px;
    border: 1px solid var(--border);
  }
  .mood-trend-title { font-size: 13px; font-weight: 500; color: var(--ink); margin-bottom: 10px; }
  .mood-trend-row { display: flex; justify-content: space-between; }
  .mood-trend-day { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
  .mood-trend-emoji { font-size: 20px; height: 28px; display: flex; align-items: center; }
  .mood-trend-label { font-size: 10px; color: var(--ink-light); }

  /* ── PAYWALL ── */
  .paywall { padding: 0 16px; }
  .paywall-hero { text-align: center; padding: 20px 0 16px; }
  .paywall-hero h2 {
    font-family: 'DM Serif Display', serif;
    font-size: 26px;
    color: var(--ink);
    margin-bottom: 8px;
  }
  .paywall-hero p { font-size: 14px; color: var(--ink-mid); line-height: 1.5; }

  .paywall-plans {
    display: flex; gap: 10px; margin-bottom: 20px;
  }
  .paywall-plan {
    flex: 1; padding: 16px 12px; border-radius: var(--radius);
    border: 2px solid var(--border); background: var(--card-bg);
    cursor: pointer; text-align: center; position: relative;
    font-family: 'DM Sans', sans-serif; transition: all 0.2s;
  }
  .paywall-plan.selected {
    border-color: var(--clay); background: rgba(196,145,115,0.08);
  }
  .plan-save {
    position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
    background: var(--sage); color: white; font-size: 10px; font-weight: 600;
    padding: 2px 10px; border-radius: 10px; text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .plan-period { font-size: 13px; font-weight: 500; color: var(--ink-mid); margin-bottom: 4px; }
  .plan-price { font-size: 22px; font-weight: 600; color: var(--ink); }
  .plan-price span { font-size: 13px; font-weight: 400; color: var(--ink-mid); }
  .plan-monthly { font-size: 12px; color: var(--ink-light); margin-top: 2px; }

  .paywall-lead {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 16px; margin-bottom: 20px;
    background: rgba(122,158,135,0.1); border: 1px solid rgba(122,158,135,0.25);
    border-radius: var(--radius);
  }
  .pw-lead-icon { font-size: 28px; flex-shrink: 0; }
  .pw-lead-text strong { display: block; font-size: 15px; color: var(--ink); margin-bottom: 4px; }
  .pw-lead-text span { font-size: 13px; color: var(--ink-mid); line-height: 1.5; }

  .paywall-features { margin-bottom: 20px; }
  .pw-feature {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .pw-feature:last-child { border-bottom: none; }
  .pw-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
  .pw-text strong { display: block; font-size: 14px; color: var(--ink); margin-bottom: 2px; }
  .pw-text span { font-size: 13px; color: var(--ink-mid); }

  .paywall-cta {
    width: 100%;
    padding: 16px;
    background: var(--clay);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    margin-bottom: 10px;
  }
  .paywall-cta:hover { background: var(--clay-dark); }

  .paywall-restore {
    width: 100%;
    padding: 12px;
    background: transparent;
    border: none;
    color: var(--ink-light);
    font-size: 13px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    text-decoration: underline;
  }

  .paywall-price {
    text-align: center;
    font-size: 13px;
    color: var(--ink-light);
    margin-bottom: 16px;
  }

  /* ── PREMIUM LOCK ── */
  .premium-locked {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius);
  }
  .premium-locked::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(250,246,241,0) 0%, rgba(250,246,241,0.95) 60%);
    pointer-events: none;
  }
  .premium-lock-badge {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    background: var(--clay);
    color: white;
    padding: 6px 16px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── DISCLAIMER ── */
  .disclaimer {
    text-align: center;
    font-size: 11px;
    color: var(--ink-light);
    padding: 16px 24px 0;
  }

  /* ── SETTINGS ── */
  .settings-header { padding: 16px 24px 0; }
  .settings-header h2 { font-family: 'DM Serif Display', serif; font-size: 24px; color: var(--ink); }
  .settings-header p { font-size: 13px; color: var(--ink-light); margin-top: 2px; }

  .settings-section { margin: 14px 16px 0; }
  .settings-section-label {
    font-size: 11px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--ink-light); margin-bottom: 8px;
  }
  .settings-card {
    background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border); overflow: hidden;
  }
  /* 3-way segmented control (used for Theme: Light / System / Dark) */
  .seg-control {
    display: flex; gap: 4px; padding: 4px;
    background: var(--cream); border: 1px solid var(--border);
    border-radius: 14px; margin: 0 16px 14px;
  }
  .seg-control-btn {
    flex: 1; padding: 10px 6px; font-size: 12px; font-weight: 500;
    color: var(--ink-light); background: transparent; border: none;
    border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif;
    transition: background 0.2s ease, color 0.2s ease;
    display: flex; align-items: center; justify-content: center; gap: 4px;
  }
  .seg-control-btn.active { background: var(--clay); color: white; font-weight: 600; }
  .seg-control-btn:active { transform: scale(0.97); transition: transform 0.1s; }
  .settings-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid var(--border); cursor: pointer;
  }
  .settings-row:last-child { border-bottom: none; }
  .settings-row:hover { background: var(--cream); }
  .sr-left { display: flex; align-items: center; gap: 10px; }
  .sr-icon { font-size: 18px; color: var(--clay-dark); display: inline-flex; align-items: center; justify-content: center; min-width: 22px; }
  .sr-label { font-size: 14px; color: var(--ink); }
  .sr-value { font-size: 13px; color: var(--ink-light); }
  .sr-arrow { font-size: 14px; color: var(--ink-light); }

  .settings-danger-btn {
    margin: 20px 16px 0; padding: 13px; background: var(--card-bg); border: 1.5px solid #E8C0B0;
    border-radius: var(--radius-sm); font-size: 14px; color: var(--clay-dark);
    cursor: pointer; font-family: 'DM Sans', sans-serif; width: calc(100% - 32px);
    text-align: center;
  }
  .settings-danger-btn:hover { background: #FDF0EB; }

  /* Toggle switch */
  .toggle-wrap { position: relative; width: 44px; height: 26px; cursor: pointer; flex-shrink: 0; }
  .toggle-track { width: 100%; height: 100%; border-radius: 13px; background: var(--border); transition: background 0.2s; }
  .toggle-track.on { background: var(--sage); }
  .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
  .toggle-thumb.on { transform: translateX(18px); }

  /* Reminder time input */
  .reminder-time-input {
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--ink);
    border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
    background: var(--card-bg); outline: none;
  }
  .reminder-time-input:focus { border-color: var(--clay); }

  /* SVG Charts */
  .chart-container { margin: 12px 16px 0; background: var(--card-bg); border-radius: var(--radius); padding: 18px; border: 1px solid var(--border); }
  .chart-container svg { width: 100%; height: auto; display: block; }
  .chart-toggle { display: flex; gap: 4px; }
  .chart-toggle-btn { font-size: 11px; font-weight: 500; padding: 4px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--card-bg); color: var(--ink-light); cursor: pointer; font-family: 'DM Sans', sans-serif; }
  .chart-toggle-btn.active { background: var(--clay); color: white; border-color: var(--clay); }
  .heatmap-legend { display: flex; align-items: center; gap: 4px; margin-top: 10px; justify-content: flex-end; }
  .heatmap-legend-label { font-size: 10px; color: var(--ink-light); }
  .heatmap-legend-box { width: 12px; height: 12px; border-radius: 2px; }

  .settings-footer {
    text-align: center; padding: 20px 24px 0; font-size: 12px; color: var(--ink-light);
  }
  .settings-footer a { color: var(--clay); text-decoration: underline; }

  /* ── COMMUNITY ── */
  .comm-header { padding: 16px 16px 0; }
  .comm-header h2 { font-family: 'DM Serif Display', serif; font-size: 28px; color: var(--ink); }
  .comm-header p { color: var(--ink-mid); font-size: 14px; margin-top: 4px; line-height: 1.5; }

  .comm-stat-bar {
    margin: 16px 16px 0; padding: 16px 20px;
    background: linear-gradient(135deg, var(--sage), var(--sage-dark)); border-radius: var(--radius);
    text-align: center;
  }
  .comm-banner-text {
    font-family: 'DM Serif Display', serif; font-size: 16px;
    color: white; line-height: 1.4;
  }

  .comm-topics { margin-top: 16px; }
  .comm-topic-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    border-bottom: 1px solid var(--border); cursor: pointer;
  }
  .comm-topic-row:active { background: var(--clay-light); }
  .comm-row-icon { font-size: 24px; flex-shrink: 0; }
  .comm-row-info { flex: 1; }
  .comm-row-title { font-size: 14px; font-weight: 500; color: var(--ink); }
  .comm-row-desc { font-size: 12px; color: var(--ink-light); margin-top: 2px; }
  .comm-row-count {
    background: var(--clay-light); color: var(--clay-dark); font-size: 12px; font-weight: 600;
    padding: 2px 8px; border-radius: 10px;
  }

  .comm-share-prompt {
    display: flex; gap: 12px; align-items: flex-start; margin: 20px 16px;
    padding: 16px; background: var(--sage-light); border-radius: var(--radius);
    border: 1px solid var(--sage); border-style: dashed;
  }
  .comm-share-icon { font-size: 24px; }
  .comm-share-text strong { font-size: 14px; color: var(--sage-dark); }
  .comm-share-text p { font-size: 12px; color: var(--ink-mid); margin-top: 4px; line-height: 1.5; }

  .comm-back {
    background: none; border: none; font-size: 14px; color: var(--clay-dark);
    cursor: pointer; padding: 4px 0; font-family: 'DM Sans', sans-serif;
  }
  .comm-topic-header {
    display: flex; gap: 12px; align-items: center; padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .comm-topic-icon { font-size: 32px; }
  .comm-topic-title { font-family: 'DM Serif Display', serif; font-size: 20px; color: var(--ink); }
  .comm-topic-desc { font-size: 12px; color: var(--ink-mid); margin-top: 2px; }

  .comm-posts { padding: 0 16px; }
  .comm-post {
    padding: 14px 0; border-bottom: 1px solid var(--border);
  }
  .comm-post-inner { display: flex; gap: 10px; }
  .comm-post-body { flex: 1; min-width: 0; }
  .comm-post-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .comm-post-author { font-size: 12px; font-weight: 500; color: var(--ink-mid); }
  .comm-post-time { font-size: 11px; color: var(--ink-light); }
  .comm-post-text { font-size: 14px; color: var(--ink); line-height: 1.6; }
  .comm-post-footer { margin-top: 8px; }
  .comm-post-actions { display: flex; align-items: center; gap: 12px; }
  @keyframes heartPop { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
  .comm-bookmark { font-size: 14px; cursor: pointer; user-select: none; }
  .comm-bookmark-active { animation: heartPop 0.3s ease; }

  .comm-vote { display: flex; flex-direction: column; align-items: center; gap: 0; padding-top: 2px; }
  .comm-vote-btn {
    background: none; border: none; font-size: 12px; color: var(--ink-light);
    cursor: pointer; padding: 2px 6px; line-height: 1; transition: color 0.15s ease;
  }
  .comm-vote-btn:active { transform: scale(0.85); }
  .comm-vote-active-up { color: var(--sage-dark); font-weight: 700; }
  .comm-vote-active-down { color: var(--clay); font-weight: 700; }
  .comm-vote-score { font-size: 13px; font-weight: 600; color: var(--ink-mid); min-width: 20px; text-align: center; }

  .comm-sort-tabs { display: flex; gap: 6px; padding: 10px 16px; border-bottom: 1px solid var(--border); }
  .comm-sort-tab {
    font-size: 12px; background: var(--clay-light); border: none; padding: 6px 12px;
    border-radius: var(--radius-sm); color: var(--ink-mid); font-family: 'DM Sans', sans-serif; cursor: pointer;
  }
  .comm-sort-tab:active { opacity: 0.7; }
  .comm-sort-active { background: var(--clay); color: white; }

  .comm-reply { margin-left: 24px; border-left: 2px solid var(--border); padding-left: 12px; }
  .comm-reply-btn {
    background: none; border: none; font-size: 12px; color: var(--ink-light);
    cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0;
  }
  .comm-reply-btn:active { color: var(--clay); }

  .comm-reactions { display: flex; gap: 8px; margin-top: 8px; }
  .comm-reaction-btn {
    font-size: 16px; background: var(--clay-light); border: none; width: 36px; height: 36px;
    border-radius: 50%; cursor: pointer; transition: transform 0.15s ease, background 0.15s ease;
  }
  .comm-reaction-btn:active { transform: scale(0.9); }
  .comm-reaction-active { background: var(--sage-light); box-shadow: 0 0 0 2px var(--sage); }

  .comm-header-row { display: flex; justify-content: space-between; align-items: center; }
  .comm-header-actions { display: flex; gap: 8px; }
  .comm-header-btn {
    font-size: 12px; background: var(--clay-light); border: none; padding: 6px 10px;
    border-radius: var(--radius-sm); color: var(--clay-dark); font-family: 'DM Sans', sans-serif; cursor: pointer;
  }
  .comm-header-btn:active { opacity: 0.7; }

  .comm-guidelines {
    margin: 12px 16px 0; padding: 14px 16px; background: var(--sage-light);
    border: 1px solid var(--sage); border-radius: var(--radius); display: flex; flex-direction: column; gap: 10px;
  }
  .comm-guidelines-text strong { font-size: 14px; color: var(--sage-dark); }
  .comm-guidelines-text p { font-size: 12px; color: var(--ink-mid); line-height: 1.5; margin-top: 4px; }
  .comm-guidelines-dismiss {
    align-self: flex-end; font-size: 12px; font-weight: 500; color: var(--sage-dark);
    background: var(--card-bg); border: 1px solid var(--sage); border-radius: var(--radius-sm);
    padding: 6px 16px; cursor: pointer; font-family: 'DM Sans', sans-serif;
  }

  .comm-resources { padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .comm-resource-row {
    display: flex; gap: 8px; align-items: center; padding: 8px 0;
    font-size: 13px; color: var(--ink-mid);
  }

  .comm-compose-btn {
    display: flex; gap: 8px; align-items: center; justify-content: center; margin: 16px 16px 20px;
    padding: 14px 16px; background: var(--clay); color: white; border-radius: var(--radius);
    font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif;
  }
  .comm-compose-btn:active { opacity: 0.8; }
  .comm-compose-overlay {
    position: fixed; inset: 0; background: var(--glass-modal-scrim); z-index: 100;
    -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur);
    display: flex; align-items: flex-end;
  }
  .comm-compose-card {
    background: var(--cream); border-radius: var(--radius) var(--radius) 0 0;
    padding: 16px; width: 100%;
  }
  .comm-compose-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
  }
  .comm-compose-header button {
    background: none; border: none; font-size: 14px; color: var(--ink-mid);
    font-family: 'DM Sans', sans-serif; cursor: pointer;
  }
  .comm-compose-header strong { font-size: 14px; color: var(--ink); }
  .comm-compose-submit { color: var(--clay-dark) !important; font-weight: 600; }
  .comm-compose-submit:disabled { opacity: 0.4; }
  .comm-compose-input {
    width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 12px; font-family: 'DM Sans', sans-serif; font-size: 14px;
    resize: none; background: var(--card-bg); color: var(--ink); box-sizing: border-box;
  }
  .comm-compose-input:focus { outline: none; border-color: var(--clay); }
  .comm-compose-counter { text-align: right; font-size: 11px; color: var(--ink-light); margin-top: 4px; }

  .comm-post-topic-tag {
    font-size: 11px; color: var(--sage-dark); background: var(--sage-light);
    padding: 2px 8px; border-radius: 8px; display: inline-block; margin-top: 8px;
  }

  .comm-new-topic-btn {
    font-size: 12px; font-weight: 600; background: var(--clay); color: white; border: none;
    padding: 5px 12px; border-radius: var(--radius-sm); cursor: pointer; font-family: 'DM Sans', sans-serif;
  }
  .comm-new-topic-btn:active { opacity: 0.8; }
  .comm-pin { font-size: 11px; margin-right: 4px; }
  .comm-topic-tags { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
  .comm-topic-tag-pill {
    font-size: 10px; padding: 1px 6px; border-radius: 6px;
    background: var(--clay-light); color: var(--clay-dark);
  }

  .comm-topic-form { display: flex; flex-direction: column; gap: 12px; }
  .comm-emoji-picker label { font-size: 12px; color: var(--ink-mid); margin-bottom: 4px; display: block; }
  .comm-emoji-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .comm-emoji-opt {
    font-size: 22px; width: 40px; height: 40px; border: 1px solid var(--border);
    border-radius: var(--radius-sm); background: var(--card-bg); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .comm-emoji-opt:active { transform: scale(0.9); }
  .comm-emoji-selected { border-color: var(--clay); background: var(--clay-light); }

  .comm-tag-picker { display: flex; flex-wrap: wrap; gap: 6px; }
  .comm-tag-btn {
    font-size: 12px; padding: 4px 10px; border-radius: 12px;
    border: 1px solid var(--border); background: var(--card-bg); color: var(--ink-mid);
    cursor: pointer; font-family: 'DM Sans', sans-serif;
  }
  .comm-tag-btn:active { opacity: 0.7; }
  .comm-tag-active { border-color: var(--sage); background: var(--sage-light); color: var(--sage-dark); }

  .comm-topic-title-input { font-size: 16px; font-weight: 500; }

  .comm-empty { padding: 32px 16px; text-align: center; color: var(--ink-light); font-size: 14px; line-height: 1.6; }

  /* ── STREAK BADGE ── */
  .streak-row {
    display: flex; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap;
  }
  .streak-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--sage-light); color: var(--sage-dark);
    padding: 4px 10px; border-radius: 12px;
    font-size: 12px; font-weight: 500;
  }
  .streak-badge.milestone { background: var(--sage); color: white; }
  .streak-milestone {
    width: 26px; height: 26px; border-radius: 50%; font-size: 10px; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid var(--border); color: var(--ink-light); background: var(--card-bg);
  }
  .streak-milestone.earned {
    background: var(--sage); border-color: var(--sage); color: white; font-size: 11px;
  }

  /* ── WEEKLY SUMMARY ── */
  .weekly-summary {
    margin: 14px 16px 0; background: var(--card-bg); border-radius: var(--radius);
    padding: 16px 18px; border: 1px solid var(--border);
  }
  .ws-title { font-size: 13px; font-weight: 500; color: var(--ink); margin-bottom: 8px; }
  .ws-stats { display: flex; gap: 12px; }
  .ws-stat { flex: 1; text-align: center; }
  .ws-stat-value { font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--ink); }
  .ws-stat-label { font-size: 11px; color: var(--ink-light); margin-top: 2px; }

  /* ── PERSONALIZED TIP ── */
  .tip-card {
    margin: 12px 16px 0; background: linear-gradient(135deg, var(--sage) 0%, var(--sage-dark) 100%);
    border-radius: var(--radius); padding: 16px 18px; color: white;
  }
  .tip-label {
    font-size: 10px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.06em; opacity: 0.8; margin-bottom: 6px;
  }
  .tip-text { font-size: 13px; line-height: 1.5; }

  /* ── Nudge Card ── */
  .nudge-card {
    margin: 12px 16px 0; padding: 14px 16px; border-radius: var(--radius);
    background: linear-gradient(135deg, var(--sage-light), white);
    border: 1.5px solid var(--sage); cursor: pointer;
    display: flex; gap: 12px; align-items: center; transition: all 0.15s;
  }
  .nudge-card:active { transform: scale(0.98); opacity: 0.85; }
  .nudge-icon { font-size: 24px; flex-shrink: 0; }
  .nudge-content { flex: 1; }
  .nudge-title { font-size: 14px; font-weight: 600; color: var(--sage-dark); }
  .nudge-text { font-size: 12px; color: var(--ink-mid); margin-top: 2px; line-height: 1.4; }
  .nudge-dismiss {
    font-size: 18px; color: var(--ink-light); cursor: pointer; padding: 4px 8px;
    line-height: 1; flex-shrink: 0;
  }

  /* ── TOAST ── */
  /* Toast — Liquid Glass with sage tint. Floats above the bottom dock,
     translucent so the user still feels grounded in the screen. */
  .toast {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 86px);
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: rgba(61, 107, 79, 0.78);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    color: white;
    padding: 11px 22px;
    border-radius: 22px;
    font-size: 13px;
    font-weight: 500;
    opacity: 0;
    transition: all 0.3s;
    white-space: nowrap;
    pointer-events: none;
    z-index: 100;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 8px 24px rgba(0, 0, 0, 0.18);
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  /* ── HISTORY LOCKED ── */
  .history-locked {
    margin: 20px 16px;
    text-align: center;
    padding: 24px 16px;
    background: var(--ink);
    border-radius: var(--radius);
    color: white;
  }
  .history-locked-icon { font-size: 28px; margin-bottom: 8px; }
  .history-locked-text { font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 14px; }
  .history-locked .unlock-btn {
    background: var(--gold); color: var(--ink); border: none;
    padding: 10px 24px; border-radius: 20px; font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif;
  }

  /* ── PREDICTION CARD ── */
  .prediction-card {
    margin: 10px 16px 0;
    background: rgba(122, 158, 135, 0.1);
    border-radius: var(--radius);
    padding: 14px 16px;
    border: 1px solid rgba(122, 158, 135, 0.2);
  }
  .pred-label {
    font-size: 11px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sage); margin-bottom: 4px;
  }
  .pred-text { font-size: 13px; color: var(--ink-mid); line-height: 1.5; }
  .pred-text strong { color: var(--ink); }
  .pred-teaser { cursor: pointer; }
  .pred-teaser:active { transform: scale(0.98); }
  .pred-teaser-body { display: flex; flex-direction: column; align-items: center; padding: 12px 0 4px; gap: 8px; }
  .pred-teaser-icon { font-size: 28px; }
  .pred-teaser-text { font-size: 14px; color: var(--ink); font-weight: 500; text-align: center; }
  .pred-teaser-unlock {
    font-size: 12px; font-weight: 600; color: var(--gold);
    display: flex; align-items: center; gap: 4px; margin-top: 4px;
  }
  .pred-teaser-lock { font-size: 11px; }

  /* ── REFLECTION CARD ── */
  .reflection-card {
    margin: 10px 16px 0; padding: 12px 16px;
    background: var(--card-bg); border-radius: var(--radius);
    border: 1px solid var(--border);
  }
  .reflection-label {
    font-size: 11px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--ink-light); margin-bottom: 6px;
  }
  .reflection-content { display: flex; align-items: center; gap: 8px; }
  .reflection-mood { font-size: 20px; }
  .reflection-text { font-size: 13px; color: var(--ink); }
  .reflection-compare {
    font-size: 12px; color: var(--sage-dark); margin-top: 6px; font-weight: 500;
  }

  /* ── PATTERNS CARD ── */
  .patterns-card {
    margin: 14px 16px 0;
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 18px 20px;
    border: 1px solid var(--border);
  }
  .patterns-title { font-family: 'DM Serif Display', serif; font-size: 16px; color: var(--ink); }
  .patterns-subtitle { font-size: 12px; color: var(--ink-light); margin-bottom: 12px; }
  .pattern-item {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 10px 0; border-top: 1px solid var(--border);
  }
  .pattern-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .pattern-text { font-size: 13px; color: var(--ink-mid); line-height: 1.5; }

  /* ── COMPARISON CARD ── */
  .comparison-card {
    margin: 14px 16px 0;
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 18px 20px;
    border: 1px solid var(--border);
  }
  .comp-title { font-family: 'DM Serif Display', serif; font-size: 16px; color: var(--ink); margin-bottom: 14px; }
  .comp-grid { display: flex; gap: 16px; margin-bottom: 14px; }
  .comp-stat { flex: 1; text-align: center; }
  .comp-value { font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--ink); }
  .comp-label { font-size: 12px; color: var(--ink-light); }
  .comp-delta { font-size: 11px; font-weight: 500; margin-top: 2px; }
  .comp-delta.up { color: var(--sage); }
  .comp-delta.down { color: var(--clay); }
  .comp-row {
    display: flex; gap: 8px; align-items: center;
    padding: 8px 0; border-top: 1px solid var(--border);
    font-size: 13px; color: var(--ink-mid);
  }
  .comp-row strong { color: var(--ink); }
  .comp-row-icon { flex-shrink: 0; }

  /* ── DOCTOR PREP CARD ── */
  .doctor-prep {
    margin: 14px 16px 0;
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 18px 20px;
    border: 1px solid var(--border);
  }
  .dp-title { font-family: 'DM Serif Display', serif; font-size: 16px; color: var(--ink); margin-bottom: 12px; }
  .dp-section-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--clay); margin-bottom: 6px; }
  .dp-point { display: flex; gap: 8px; padding: 4px 0; font-size: 13px; color: var(--ink-mid); line-height: 1.5; }
  .dp-point.question { color: var(--sage); }
  .dp-bullet { font-weight: 700; color: var(--clay); flex-shrink: 0; width: 14px; }
  .dp-point.question .dp-bullet { color: var(--sage); }
  .dp-empty { font-size: 13px; color: var(--ink-light); }

  /* ─── Ask Vela Button ─── */
  .ask-vela-btn { display: flex; align-items: center; gap: 6px; background: var(--sage); color: white; border: none; border-radius: 20px; padding: 6px 14px 6px 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
  .ask-vela-btn:active { transform: scale(0.95); }
  .ask-vela-btn.locked { background: var(--card-bg); color: var(--ink-light); border: 1px solid var(--border); }
  .ask-vela-avatar { width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-family: 'DM Serif Display', serif; font-size: 13px; }
  .ask-vela-lock { font-size: 12px; }
  .ask-vela-premium-tag { font-size: 10px; background: var(--gold); color: #2C1F17; padding: 1px 6px; border-radius: 8px; font-weight: 600; letter-spacing: 0.02em; }

  /* ─── AI Companion Chat ─── */
  .companion-container { display: flex; flex-direction: column; min-height: calc(100vh - 200px); margin: 0 16px; }
  .companion-header { display: flex; align-items: center; gap: 10px; padding: 12px 0 8px; }
  .companion-name { font-family: 'DM Serif Display', serif; font-size: 15px; color: var(--ink); }
  .companion-sub { font-size: 11px; color: var(--ink-light); }
  .chat-messages { flex: 1; min-height: 200px; overflow-y: auto; padding: 8px 0; display: flex; flex-direction: column; gap: 12px; }
  .chat-bubble { display: flex; gap: 8px; max-width: 90%; animation: fadeInUp 0.25s ease; }
  .chat-bubble.assistant { align-self: flex-start; }
  .chat-bubble.user { align-self: flex-end; flex-direction: row-reverse; }
  .chat-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .chat-avatar span { font-family: 'DM Serif Display', serif; font-size: 14px; color: white; }
  .chat-text { background: var(--card-bg); border-radius: 16px; padding: 10px 14px; font-size: 13px; line-height: 1.55; color: var(--ink); border: 1px solid var(--border); }
  .chat-bubble.user .chat-text { background: var(--clay); color: white; border-color: var(--clay); }
  .chat-bubble.assistant .chat-text { border-radius: 16px 16px 16px 4px; }
  .chat-bubble.user .chat-text { border-radius: 16px 16px 4px 16px; }
  .chat-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; }
  .chat-chip { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 6px 12px; font-size: 12px; color: var(--sage); font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s; }
  .chat-chip:active { background: var(--sage-light); transform: scale(0.96); }
  .chat-input-row { display: flex; gap: 8px; padding: 8px 0 12px; }
  .chat-input { flex: 1; background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px; padding: 10px 16px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--ink); outline: none; }
  .chat-input:focus { border-color: var(--sage); }
  .chat-send { width: 40px; height: 40px; border-radius: 50%; background: var(--sage); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
  .chat-send:disabled { opacity: 0.4; }
  .chat-send:active { transform: scale(0.9); }
  .chat-disclaimer { font-size: 11px; color: var(--ink-light); text-align: center; padding: 4px 12px 8px; line-height: 1.4; }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  /* ─── Weekly Digest Card ─── */
  .digest-card { background: var(--card-bg); border-radius: 16px; margin: 12px 16px; padding: 16px; border: 1px solid var(--border); }
  .digest-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .digest-title { font-family: 'DM Serif Display', serif; font-size: 16px; color: var(--ink); }
  .digest-subtitle { font-size: 11px; color: var(--sage); font-weight: 500; }
  .digest-lock { font-size: 11px; color: var(--ink-light); }
  .digest-section { padding: 8px 0; border-top: 1px solid var(--border); }
  .digest-section:first-of-type { border-top: none; padding-top: 0; }
  .digest-section-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sage); margin-bottom: 4px; }
  .digest-section-text { font-size: 13px; color: var(--ink-mid); line-height: 1.5; }
  .digest-spotlight { background: var(--sage-light); margin: 0 -16px; padding: 10px 16px; }
  .digest-tip { background: linear-gradient(135deg, var(--sage-light), transparent); margin: 0 -16px -16px; padding: 12px 16px; border-radius: 0 0 16px 16px; }
  .digest-delta.up { color: var(--sage); font-weight: 500; }
  .digest-delta.down { color: var(--clay); font-weight: 500; }
  .digest-teaser { cursor: pointer; opacity: 0.8; }
  .digest-teaser:active { opacity: 0.6; }

  /* ─── CBT Programs ─── */
  .cbt-section { margin: 0 0 8px; }
  .cbt-card {
    background: var(--card-bg); border-radius: 16px; margin: 12px 16px; padding: 16px;
    border: 1px solid var(--border);
  }
  .cbt-card-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  .cbt-card-icon { font-size: 28px; flex-shrink: 0; }
  .cbt-card-title { font-family: 'DM Serif Display', serif; font-size: 17px; color: var(--ink); }
  .cbt-card-sub { font-size: 12px; color: var(--ink-light); margin-top: 2px; }
  .cbt-progress-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .cbt-progress-bg { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .cbt-progress-fill { height: 100%; background: var(--sage); border-radius: 3px; transition: width 0.4s ease; }
  .cbt-progress-label { font-size: 11px; color: var(--ink-light); white-space: nowrap; }
  .cbt-btn {
    width: 100%; padding: 10px; border: none; border-radius: var(--radius-sm);
    background: var(--sage); color: white; font-weight: 600; font-size: 14px;
    font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 8px;
  }
  .cbt-btn:active { opacity: 0.85; transform: scale(0.98); }
  .cbt-btn.cbt-abandon { background: transparent; color: var(--ink-light); font-size: 12px; font-weight: 400; margin-top: 8px; }
  .cbt-complete-msg { text-align: center; padding: 12px; font-size: 14px; color: var(--sage-dark); font-weight: 500; }
  .cbt-lessons { display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; }
  .cbt-lesson { border-radius: var(--radius-sm); overflow: hidden; }
  .cbt-lesson-header {
    display: flex; align-items: center; gap: 8px; padding: 10px 8px; cursor: pointer;
    transition: background 0.15s;
  }
  .cbt-lesson-header:active { background: var(--cream); }
  .cbt-lesson-check { font-size: 14px; color: var(--ink-light); width: 20px; text-align: center; }
  .cbt-lesson.done .cbt-lesson-check { color: var(--sage); font-weight: 700; }
  .cbt-lesson-title { flex: 1; font-size: 13px; color: var(--ink); font-weight: 500; }
  .cbt-lesson.done .cbt-lesson-title { color: var(--ink-light); text-decoration: line-through; }
  .cbt-lesson-arrow { font-size: 11px; color: var(--ink-light); }
  .cbt-lesson-content { padding: 4px 8px 12px 36px; }
  .cbt-lesson-content p { font-size: 13px; color: var(--ink-mid); line-height: 1.5; }
  .cbt-lesson-done-btn {
    margin-top: 10px; padding: 6px 16px; border: 1.5px solid var(--sage); border-radius: 20px;
    background: transparent; color: var(--sage); font-size: 12px; font-weight: 600;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
  }
  .cbt-lesson-done-btn:active { background: var(--sage-light); }
  .cbt-next-week-hint { font-size: 12px; color: var(--sage); text-align: center; padding: 8px 0 4px; font-weight: 500; }
  .cbt-prev-weeks { margin-top: 8px; }
  .cbt-prev-weeks summary { font-size: 12px; color: var(--ink-light); cursor: pointer; padding: 4px 0; }
  .cbt-prev-week { margin: 8px 0; }
  .cbt-prev-week-title { font-size: 12px; font-weight: 600; color: var(--ink-mid); margin-bottom: 4px; }
  .cbt-prev-lesson { font-size: 12px; color: var(--ink-light); padding: 2px 0 2px 8px; }
  .cbt-program-list { display: flex; flex-direction: column; gap: 10px; }
  .cbt-program-item {
    display: flex; gap: 12px; padding: 12px; border-radius: var(--radius-sm);
    border: 1.5px solid var(--border); cursor: pointer; transition: all 0.15s;
  }
  .cbt-program-item:active { border-color: var(--sage); background: var(--sage-light); transform: scale(0.98); }
  .cbt-program-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }
  .cbt-program-name { font-size: 14px; font-weight: 600; color: var(--ink); }
  .cbt-program-meta { font-size: 11px; color: var(--sage); font-weight: 500; margin-top: 2px; }
  .cbt-program-desc { font-size: 12px; color: var(--ink-light); line-height: 1.4; margin-top: 4px; }
  .cbt-completed-badge { font-size: 11px; color: var(--sage); font-weight: 500; margin-bottom: 2px; }
  .cbt-program-item.completed { opacity: 0.7; }
  .cbt-program-item.completed:active { opacity: 0.55; }
  .cbt-recommended-badge {
    font-size: 10px; font-weight: 600; color: var(--sage); text-transform: uppercase;
    letter-spacing: 0.05em; margin-bottom: 2px;
  }
  .cbt-program-item.recommended { border-color: var(--sage); background: var(--sage-light); }
  .cbt-completed-note { font-size: 12px; color: var(--sage); font-weight: 500; text-align: center; padding: 4px; }
  .cbt-teaser { opacity: 0.85; }
  .cbt-teaser:active { opacity: 0.65; }

  /* ─── Enhanced Prediction Card ─── */
  .pred-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .pred-day { font-size: 12px; color: var(--ink-light); font-weight: 500; }
  .pred-items { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
  .pred-item { display: flex; align-items: center; gap: 8px; }
  .pred-item-name { font-size: 13px; color: var(--ink); width: 90px; flex-shrink: 0; }
  .pred-item-bar-bg { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .pred-item-bar { height: 100%; background: var(--clay); border-radius: 3px; transition: width 0.6s ease; }
  .pred-item-pct { font-size: 12px; color: var(--clay); font-weight: 600; width: 32px; text-align: right; }
  .pred-item-trend { font-size: 13px; width: 16px; text-align: center; }
  .pred-item-trend.up { color: var(--clay); }
  .pred-item-trend.down { color: var(--sage); }
  .pred-item-trend.stable { color: var(--ink-light); }
  .pred-mood { font-size: 12px; color: var(--ink-mid); margin-top: 4px; }
  .pred-tip { font-size: 12px; color: var(--sage); margin-top: 6px; font-style: italic; line-height: 1.4; }

  /* ─── Custom Symptoms ─── */
  .symptom-tile.add-symptom { border: 2px dashed var(--border); background: transparent; cursor: pointer; }
  .symptom-tile.add-symptom .s-icon { font-size: 22px; color: var(--ink-light); }
  .symptom-tile.add-symptom .s-name { color: var(--ink-light); }
  .symptom-tile.custom { position: relative; }
  .custom-remove { position: absolute; top: 4px; right: 6px; font-size: 14px; color: var(--ink-light); cursor: pointer; line-height: 1; z-index: 1; }
  .custom-remove:hover { color: var(--clay); }
  .add-symptom-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
  .add-symptom-card { background: var(--card-bg); border-radius: 16px; padding: 20px; width: 100%; max-width: 320px; }
  .add-symptom-title { font-family: 'DM Serif Display', serif; font-size: 16px; color: var(--ink); margin-bottom: 12px; }
  .add-symptom-input { width: 100%; background: var(--cream); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--ink); outline: none; }
  .add-symptom-input:focus { border-color: var(--sage); }
  .add-symptom-actions { display: flex; gap: 8px; margin-top: 14px; }
  .add-symptom-cancel { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: transparent; color: var(--ink-mid); font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer; }
  .add-symptom-confirm { flex: 1; padding: 10px; border-radius: 10px; border: none; background: var(--sage); color: white; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; }
  .add-symptom-confirm:disabled { opacity: 0.4; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* ─── Period Tracking ─── */
  .ctx-period { padding: 10px 0 0; }
  .ctx-period .ctx-pills { flex-wrap: wrap; }

  /* ─── First-Week Milestones ─── */
  .milestone-card { display: flex; gap: 14px; align-items: flex-start; background: linear-gradient(135deg, var(--sage-light), transparent); border: 1px solid var(--sage); border-radius: 16px; padding: 16px; margin: 0 16px 10px; animation: slideDown 0.4s ease; }
  .milestone-icon { font-size: 28px; flex-shrink: 0; }
  .milestone-content { flex: 1; }
  .milestone-title { font-family: 'DM Serif Display', serif; font-size: 16px; color: var(--ink); margin-bottom: 4px; }
  .milestone-text { font-size: 13px; color: var(--ink-mid); line-height: 1.5; margin-bottom: 10px; }
  .milestone-progress { }
  .milestone-bar-bg { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
  .milestone-bar { height: 100%; background: var(--sage); border-radius: 3px; transition: width 0.6s ease; }
  .milestone-label { font-size: 11px; color: var(--ink-light); }

  /* Early Stats */
  .early-stats { display: flex; flex-direction: column; gap: 5px; margin: 10px 0 4px; padding: 8px 10px; background: rgba(122,158,135,0.1); border-radius: 10px; }
  .early-stat { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink); }
  .early-stat-icon { font-size: 14px; flex-shrink: 0; width: 18px; text-align: center; }
  .early-stat-text { font-weight: 500; }

  /* Post-Log Celebration */
  .post-log-celebration {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    z-index: 90; animation: fadeIn 0.3s ease;
    -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  }
  .celebration-card {
    background: var(--card-bg); border-radius: 20px; padding: 28px 24px;
    text-align: center; max-width: 300px; width: 85%;
    animation: celebPop 0.4s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
  .celebration-icon { font-size: 44px; margin-bottom: 10px; }
  .celebration-title { font-family: 'DM Serif Display', serif; font-size: 20px; color: var(--ink); margin-bottom: 6px; }
  .celebration-mood { font-size: 24px; margin-bottom: 8px; }
  .celebration-text { font-size: 13px; color: var(--ink-light); line-height: 1.5; margin-bottom: 12px; }
  .celebration-streak { font-size: 13px; font-weight: 600; color: var(--clay); margin-bottom: 10px; }
  .celebration-progress { margin-top: 8px; }
  @keyframes celebPop { 0% { opacity: 0; transform: scale(0.85); } 50% { transform: scale(1.03); } 100% { opacity: 1; transform: scale(1); } }

  /* ── INSIGHTS REVEAL ── */
  .reveal-container {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: calc(100vh - 240px); padding: 24px 20px; text-align: center;
    cursor: pointer; user-select: none; -webkit-user-select: none;
  }
  .reveal-card {
    background: var(--glass-sage-card);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    border-radius: 22px; padding: 32px 24px;
    max-width: 340px; width: 100%;
    border: 1px solid var(--border);
    box-shadow:
      inset 0 1px 0 var(--glass-edge),
      0 12px 36px rgba(122, 158, 135, 0.12),
      0 2px 8px rgba(122, 158, 135, 0.08);
    animation: revealFade 0.5s ease;
  }
  .reveal-intro { padding: 40px 24px; }
  .reveal-icon { font-size: 48px; margin-bottom: 16px; }
  .reveal-heading {
    font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--ink);
    margin-bottom: 10px;
  }
  .reveal-body { font-size: 14px; color: var(--ink); line-height: 1.55; margin-bottom: 8px; }
  .reveal-body-light { font-size: 13px; color: var(--ink-light); line-height: 1.5; }
  .reveal-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--sage-dark); margin-bottom: 14px;
  }
  .reveal-insight-icon { font-size: 36px; margin-bottom: 12px; }
  .reveal-insight-text { font-size: 15px; color: var(--ink); line-height: 1.55; }
  .reveal-pattern { padding: 28px 24px; }
  .reveal-mood-row {
    display: flex; justify-content: space-around; margin: 16px 0;
    background: rgba(122,158,135,0.08); border-radius: 12px; padding: 12px 8px;
  }
  .reveal-mood-day { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .reveal-mood-emoji { font-size: 20px; height: 28px; display: flex; align-items: center; }
  .reveal-mood-label { font-size: 10px; color: var(--ink-light); font-weight: 500; }
  .reveal-top-symptoms { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; }
  .reveal-mini-label { font-size: 11px; color: var(--ink-light); font-weight: 500; }
  .reveal-symptom-chip {
    font-size: 12px; padding: 3px 10px; border-radius: 10px;
    background: var(--clay-light); color: var(--clay-dark); font-weight: 500;
  }
  .reveal-best-day { margin-top: 10px; font-size: 13px; color: var(--ink); }
  .reveal-premium {
    background: linear-gradient(145deg, #2d3a35 0%, #1a2420 100%);
    border: 1px solid rgba(122,158,135,0.3); color: var(--cream);
  }
  .reveal-premium .reveal-heading { color: var(--cream); }
  .reveal-premium .reveal-label { color: var(--sage-light); }
  .reveal-premium-features {
    display: flex; flex-direction: column; gap: 10px; margin: 18px 0 20px;
    text-align: left;
  }
  .reveal-pf { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: rgba(240,232,226,0.85); line-height: 1.4; }
  .reveal-cta {
    width: 100%; padding: 14px; border: none; border-radius: var(--radius-sm);
    background: var(--gold); color: #1a2420; font-size: 15px; font-weight: 600;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
  }
  .reveal-cta:active { opacity: 0.85; }
  .reveal-skip-premium {
    margin-top: 12px; padding: 10px 16px; font-size: 14px;
    color: rgba(240,232,226,0.75); background: transparent;
    border: 1px solid rgba(240,232,226,0.25); border-radius: var(--radius-sm);
    cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500;
    width: 100%;
  }
  .reveal-skip-premium:active { background: rgba(240,232,226,0.06); }
  .reveal-dots { display: flex; gap: 8px; margin-top: 24px; }
  .reveal-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--border); transition: all 0.3s ease;
  }
  .reveal-dot.active { background: var(--sage); width: 20px; border-radius: 4px; }
  /* Prominent secondary action — present on every reveal step so users
     never feel trapped in the ceremony. Goes TO patterns, not away from them. */
  .reveal-skip {
    margin-top: 20px; padding: 12px 24px; font-size: 14px; font-weight: 500;
    color: var(--clay-dark); background: var(--card-bg);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    cursor: pointer; font-family: 'DM Sans', sans-serif;
    transition: all 0.15s ease;
  }
  .reveal-skip:hover { background: var(--cream); border-color: var(--clay); }
  .reveal-skip:active { transform: scale(0.97); }
  @keyframes revealFade { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }

  @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

  /* ─── Animation Polish ─── */
  .tip-card, .prediction-card, .wellbeing-card, .weekly-summary, .insight-callout, .digest-card, .trend-card, .patterns-card {
    animation: fadeInUp 0.35s ease;
  }
  .symptom-tile { transition: all 0.15s ease; }
  .symptom-tile:active { transform: scale(0.94); }
  .symptom-tile.active { animation: popIn 0.2s ease; }
  .wb-face { transition: all 0.15s ease; }
  .wb-face:active { transform: scale(0.88); }
  .wb-face.selected { animation: popIn 0.2s ease; }
  .ctx-pill { transition: all 0.15s ease; }
  .ctx-pill:active { transform: scale(0.93); }
  .note-chip { transition: all 0.15s ease; }
  .note-chip:active { transform: scale(0.93); }
  .log-btn { transition: all 0.2s ease; }
  .log-btn:active:not(:disabled) { transform: scale(0.96); }
  .nav-tab { transition: all 0.15s ease; }
  .streak-badge { animation: slideDown 0.4s ease; }
  .comm-post-card { animation: fadeInUp 0.3s ease; }
  @keyframes popIn { 0% { transform: scale(0.85); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }

  /* ─── Chat typing indicator ─── */
  .chat-typing { display: flex; align-items: center; gap: 8px; align-self: flex-start; }
  .chat-typing .chat-text { display: flex; gap: 4px; padding: 12px 18px; }
  .typing-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-light); animation: typingBounce 1.2s infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }

  /* ─── Gamification ─── */
  .gamification-bar { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 8px 12px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border); }
  .journey-bar { margin-top: 6px; display: flex; align-items: center; gap: 6px; }
  .journey-text { font-size: 13px; color: var(--ink-light); }
  .journey-streak { font-size: 14px; }
  .gam-level-badge { display: flex; flex-direction: column; align-items: center; min-width: 48px; }
  .gam-level-num { font-family: 'DM Serif Display', serif; font-size: 16px; color: var(--clay); line-height: 1; }
  .gam-level-name { font-size: 9px; color: var(--ink-light); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
  .gam-xp-section { flex: 1; }
  .gam-xp-bar-bg { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
  .gam-xp-bar { height: 100%; background: linear-gradient(90deg, var(--clay), var(--sage)); border-radius: 4px; transition: width 0.6s ease; }
  .gam-xp-label { font-size: 10px; color: var(--ink-light); margin-top: 2px; }
  .gam-next-unlock { font-size: 10px; color: var(--gold); margin-top: 2px; font-weight: 500; }
  .xp-gain-flash { color: var(--sage); font-weight: 700; animation: xpFlash 2s ease forwards; }
  @keyframes xpFlash { 0% { opacity: 0; transform: translateY(4px); } 15% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }
  .gam-streak { font-size: 14px; font-weight: 600; color: var(--clay); white-space: nowrap; }

  .gam-profile { padding: 4px 0; }
  .gam-profile-level { text-align: center; margin-bottom: 8px; }
  .gam-big-level { font-family: 'DM Serif Display', serif; font-size: 28px; color: var(--clay); }
  .gam-big-name { font-size: 13px; color: var(--ink-light); font-weight: 500; }
  .gam-profile-stats { display: flex; justify-content: space-around; padding: 8px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .gam-ps { text-align: center; }
  .gam-ps-val { font-family: 'DM Serif Display', serif; font-size: 20px; color: var(--ink); }
  .gam-ps-label { font-size: 11px; color: var(--ink-light); }

  .gam-badges-title { font-size: 13px; font-weight: 500; color: var(--ink); margin-bottom: 10px; padding: 4px 0; }
  .gam-badges-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-bottom: 4px; }
  .gam-badge { text-align: center; padding: 10px 4px; border-radius: 12px; border: 1px solid var(--border); background: var(--cream); transition: all 0.2s; }
  .gam-badge.earned { background: var(--sage-light); border-color: var(--sage); }
  .gam-badge.locked { opacity: 0.45; }
  .gam-badge-icon { font-size: 24px; margin-bottom: 4px; }
  .milestones-expand {
    width: 100%; margin-top: 10px; padding: 10px; border: 1px solid var(--border);
    border-radius: var(--radius-sm); background: transparent; color: var(--ink-light);
    font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif;
    cursor: pointer; transition: color 0.15s;
  }
  .milestones-expand:hover { color: var(--ink); }
  .gam-badge-name { font-size: 11px; font-weight: 600; color: var(--ink); line-height: 1.2; }
  .gam-badge-desc { font-size: 9px; color: var(--ink-light); line-height: 1.3; margin-top: 2px; }

  @keyframes badgeEarned { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
  .gam-badge.earned { animation: badgeEarned 0.4s ease; }

  .badge-toast { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 9999; background: rgba(122, 158, 135, 0.82); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); color: white; padding: 14px 22px; border-radius: 18px; display: flex; align-items: center; gap: 12px; font-size: 14px; font-family: 'DM Sans', sans-serif; box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 30px rgba(0,0,0,0.25); animation: badgeSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), toastFade 0.4s ease 2.6s forwards; max-width: 90%; }
  .badge-toast-icon { font-size: 32px; animation: badgeBounce 0.6s ease 0.3s; }
  .badge-toast-content { display: flex; flex-direction: column; gap: 2px; }
  .badge-toast-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; }
  .badge-toast-text { font-weight: 600; font-size: 14px; }
  @keyframes badgeSlideIn { 0% { transform: translateX(-50%) translateY(-30px) scale(0.8); opacity: 0; } 100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; } }
  @keyframes badgeBounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }

  .streak-mult { font-size: 10px; font-weight: 700; color: var(--gold); margin-left: 2px; }

  .levelup-overlay { position: fixed; inset: 0; z-index: 10000; background: var(--glass-modal-scrim); -webkit-backdrop-filter: var(--glass-blur-strong); backdrop-filter: var(--glass-blur-strong); display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease; }
  .levelup-card { background: var(--card-bg); border-radius: 24px; padding: 40px 32px; text-align: center; max-width: 320px; width: 90%; animation: levelUpPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .levelup-sparkle { font-size: 48px; animation: sparkleRotate 2s linear infinite; }
  .levelup-title { font-size: 14px; text-transform: uppercase; letter-spacing: 3px; color: var(--gold); margin-top: 12px; font-weight: 600; }
  .levelup-level { font-size: 56px; font-weight: 800; color: var(--ink); margin-top: 8px; font-family: 'DM Serif Display', serif; }
  .levelup-name { font-size: 20px; color: var(--sage); font-weight: 600; margin-top: 4px; }
  .levelup-unlock { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px; padding: 12px 16px; background: rgba(111,145,103,0.15); border-radius: 12px; font-size: 14px; color: var(--ink); font-weight: 500; animation: unlockSlide 0.5s ease 0.4s both; }
  .levelup-unlock-icon { font-size: 20px; }
  .levelup-btn { margin-top: 24px; padding: 12px 40px; background: var(--sage); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: transform 0.15s; }
  .levelup-btn:active { transform: scale(0.95); }
  @keyframes levelUpPop { 0% { transform: scale(0.5) translateY(40px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
  @keyframes sparkleRotate { 0% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(5deg) scale(1.1); } 50% { transform: rotate(0deg) scale(1); } 75% { transform: rotate(-5deg) scale(1.1); } 100% { transform: rotate(0deg) scale(1); } }
  @keyframes unlockSlide { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
  @keyframes toastSlide { from { transform: translateX(-50%) translateY(-20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
  @keyframes toastFade { to { opacity: 0; transform: translateX(-50%) translateY(-10px); } }

  /* ─── Daily Lesson Card ─── */
  .lesson-card { background: var(--sage-light); border-radius: 16px; margin: 12px 16px; padding: 16px; border: 1px solid var(--sage); }
  .lesson-card.completed { opacity: 0.7; }
  .lesson-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .lesson-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; color: var(--sage); }
  .lesson-xp { font-size: 12px; font-weight: 600; color: var(--sage); }
  .lesson-title { font-family: 'DM Serif Display', serif; font-size: 15px; color: var(--ink); margin-bottom: 6px; }
  .lesson-text { font-size: 13px; color: var(--ink-mid); line-height: 1.5; }
  .lesson-btn { width: 100%; margin-top: 10px; padding: 10px; background: var(--sage); color: white; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .lesson-btn:active { transform: scale(0.97); }

  /* Insight Library */
  .insight-library {
    margin: 12px 16px 0; background: var(--card-bg); border-radius: var(--radius);
    border: 1px solid var(--border); overflow: hidden;
  }
  .insight-library-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 16px; cursor: pointer;
  }
  .insight-library-title { font-size: 14px; font-weight: 500; color: var(--ink); }
  .insight-library-sub { font-size: 12px; color: var(--ink-light); margin-top: 2px; }
  .insight-library-toggle { font-size: 12px; color: var(--ink-light); }
  .insight-library-list { padding: 0 16px 14px; }
  .insight-library-item { border-bottom: 1px solid var(--border); }
  .insight-library-item:last-of-type { border-bottom: none; }
  .insight-library-item summary {
    padding: 10px 0; font-size: 13px; font-weight: 500; color: var(--ink);
    cursor: pointer; list-style: none;
  }
  .insight-library-item summary::marker { display: none; }
  .insight-library-item summary::-webkit-details-marker { display: none; }
  .insight-library-item p {
    font-size: 13px; color: var(--ink-mid); line-height: 1.5;
    padding: 0 0 10px; margin: 0;
  }
  .insight-library-more {
    text-align: center; font-size: 12px; color: var(--ink-light);
    padding: 10px 0 0; font-style: italic;
  }

  /* ─── Experiment Card ─── */
  .exp-card { background: var(--card-bg); border-radius: 16px; margin: 12px 16px; padding: 16px; border: 1px solid var(--border); cursor: default; }
  .exp-card.exp-start { cursor: pointer; border-style: dashed; opacity: 0.8; }
  .exp-card.exp-start:active { opacity: 0.6; }
  .exp-card.exp-complete { border-color: var(--sage); background: var(--sage-light); }
  .exp-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .exp-icon { font-size: 20px; }
  .exp-label { font-size: 13px; font-weight: 500; color: var(--sage); }
  .exp-title { font-family: 'DM Serif Display', serif; font-size: 15px; color: var(--ink); }
  .exp-badge { font-size: 12px; font-weight: 600; color: var(--sage); margin-left: auto; }
  .exp-desc { font-size: 12px; color: var(--ink-light); line-height: 1.4; margin-bottom: 10px; }
  .exp-progress-row { display: flex; align-items: center; gap: 8px; }
  .exp-progress-bg { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .exp-progress-fill { height: 100%; background: var(--sage); border-radius: 3px; transition: width 0.4s ease; }
  .exp-progress-label { font-size: 11px; color: var(--ink-light); white-space: nowrap; }
  .exp-btn { width: 100%; margin-top: 10px; padding: 10px; background: var(--sage); color: white; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }
  .exp-btn.exp-abandon { background: transparent; color: var(--ink-light); font-size: 12px; font-weight: 400; }
  .exp-btn:active { transform: scale(0.97); }
  .exp-result { font-size: 13px; color: var(--sage); line-height: 1.5; margin: 10px 0 4px; padding: 10px; background: var(--sage-light); border-radius: 10px; }

  /* ─── Period Overlay ─── */
  .bar-period-dot { width: 6px; height: 6px; border-radius: 50%; background: #E07070; margin-top: 3px; }

  /* ─── UI Polish & Animations ─── */
  .screen { animation: screenFadeIn 0.3s ease; }
  @keyframes screenFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

  .tip-card, .prediction-card, .weekly-summary, .insight-callout, .milestone-card,
  .digest-card, .gamification-bar, .wellbeing-card, .trend-card, .patterns-card,
  .comparison-card, .chart-container, .doctor-prep, .unlock-card {
    animation: cardSlideIn 0.35s ease;
  }
  @keyframes cardSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

  .symptom-tile { transition: all 0.15s ease; }
  .symptom-tile:active { transform: scale(0.94); }
  .symptom-tile.active { animation: tileActivate 0.2s ease; }
  @keyframes tileActivate { 0% { transform: scale(1); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }

  .ctx-pill { transition: all 0.15s ease; }
  .ctx-pill:active { transform: scale(0.94); }
  .ctx-pill.on { animation: pillActivate 0.2s ease; }
  @keyframes pillActivate { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }

  .wb-face { transition: all 0.15s ease; }
  .wb-face:active { transform: scale(0.88); }
  .wb-face.selected { animation: faceSelect 0.3s ease; }
  @keyframes faceSelect { 0% { transform: scale(1); } 40% { transform: scale(1.2); } 100% { transform: scale(1); } }

  .nav-tab { transition: all 0.2s ease; }
  .nav-tab:active { transform: scale(0.92); }

  .log-btn { transition: all 0.2s ease; }
  .log-btn:active { transform: scale(0.96); }

  .bar { transition: height 0.4s ease; }

  .streak-badge { animation: streakPulse 2s ease infinite; }
  @keyframes streakPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }

  .gam-xp-bar { transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1); }

  /* Staggered card animations */
  .tip-card { animation-delay: 0.05s; animation-fill-mode: both; }
  .prediction-card { animation-delay: 0.1s; animation-fill-mode: both; }
  .gamification-bar { animation-delay: 0.0s; animation-fill-mode: both; }
  .wellbeing-card { animation-delay: 0.15s; animation-fill-mode: both; }
`;

// Screen components + lib helpers (doctorReport, csv) imported at the
// top of this file — see the block right after the gamification import.

export default function App() {
  // App-init reads use safeReadJSON: a localStorage exception (e.g. Safari private mode,
  // some iOS WebView edge cases) here would white-screen the app before any UI paints.
  // The top-level ErrorBoundary catches everything else.
  const [onboarded, setOnboarded] = useState(() => safeReadJSON("vela_onboarded", false));
  const [screen, setScreen] = useState(() => safeReadJSON("vela_onboarded", false) ? "tracker" : "onboard");
  const [logs, setLogs] = useState(() => safeReadJSON("vela_logs", []));
  const [profile, setProfile] = useState(() => safeReadJSON("vela_profile", null));
  const [toast, setToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [badgeToast, setBadgeToast] = useState(null);
  const [levelUp, setLevelUp] = useState(null); // { level, name, unlock }
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    return JSON.parse(localStorage.getItem("vela_reminders_enabled") || "true");
  });
  const [reminderTimes, setReminderTimes] = useState(() => {
    return JSON.parse(localStorage.getItem("vela_reminder_times") || '{"morning":"09:00","evening":"20:00","weekly":"10:00"}');
  });

  // Inject global styles
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = css;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // Dev-only URL trigger: visiting /?seed=demo seeds 30 days of synthetic
  // data + skips onboarding + unlocks premium for the session, then strips
  // the query param so a refresh doesn't re-seed. Same data shape as the
  // hidden "Seed Demo Data" button in Settings → debug, but URL-driven so
  // you don't need DevTools or the debug screen. Compiled out in prod
  // (process.env.NODE_ENV === "production" tree-shakes the whole block).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("seed") !== "demo") return;
    const pad = (n) => String(n).padStart(2, "0");
    const localISO = (d) => {
      const tz = -d.getTimezoneOffset(), sign = tz >= 0 ? "+" : "-", tzA = Math.abs(tz);
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(tzA/60))}:${pad(tzA%60)}`;
    };
    const demoLogs = [];
    for (let day = 30; day >= 0; day--) {
      const d = new Date();
      d.setDate(d.getDate() - day);
      d.setHours(9 + (day % 3), 15, 0, 0);
      const caf = day % 2 === 0;
      const sleepHours = caf ? 5 + Math.random() * 0.8 : 7 + Math.random() * 0.8;
      const symptoms = {}, severities = {};
      symptoms["Brain fog"] = true; severities["Brain fog"] = caf ? 2 : 1;
      if (caf) {
        symptoms["Hot flash"] = true; severities["Hot flash"] = 2 + (day % 2);
        symptoms["Night sweats"] = true; severities["Night sweats"] = 2;
        symptoms["Poor sleep"] = true; severities["Poor sleep"] = 3;
        symptoms["Irritability"] = true; severities["Irritability"] = 2;
      } else {
        symptoms["Fatigue"] = true; severities["Fatigue"] = 1;
      }
      if (day % 7 === 0) { symptoms["Joint stiffness"] = true; severities["Joint stiffness"] = 1; }
      const notes = day === 5
        ? "Bad night. Woke up drenched around 3am after the late espresso."
        : (day === 12 ? "Felt great today. Slept 8 hours and walked 5k." : "");
      demoLogs.unshift({
        date: localISO(d),
        mood: caf ? 1 : 3,
        energy: caf ? 1 : 3,
        symptoms, severities, notes,
        context: {
          sleepHours: parseFloat(sleepHours.toFixed(1)),
          stress: caf ? 4 : 2,
          caffeine: caf, alcohol: false, exercise: !caf,
          period: null, periodFlow: null,
        },
      });
    }
    try {
      localStorage.setItem("vela_logs", JSON.stringify(demoLogs));
      localStorage.setItem("vela_profile", JSON.stringify([1, [0, 1, 2], 4, "sometimes"]));
      localStorage.setItem("vela_onboarded", "true");
    } catch { /* private mode */ }
    setLogs(demoLogs);
    setProfile([1, [0, 1, 2], 4, "sometimes"]);
    setOnboarded(true);
    setScreen("tracker"); // otherwise the screen-state initializer leaves us on "onboard"
    setIsPremium(true); // dev shortcut so you don't have to click through paywall
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Initialize analytics + RevenueCat, then sync subscription status on launch
  useEffect(() => {
    initAnalytics();
    (async () => {
      await initPurchases();
      const { isPremium: livePremium } = await checkSubscription();
      if (livePremium) setIsPremium(true);
      // Set Sentry user context so errors group by user. We use the
      // anonymous RevenueCat appUserId — never PII.
      try {
        const uid = await getAppUserId();
        if (uid) identifyUser(uid);
      } catch { /* getAppUserId already reports its own errors */ }
    })();
  }, []);

  // Persist onboarded state
  useEffect(() => {
    localStorage.setItem("vela_onboarded", JSON.stringify(onboarded));
  }, [onboarded]);

  // Persist logs
  useEffect(() => {
    localStorage.setItem("vela_logs", JSON.stringify(logs));
  }, [logs]);

  // Persist reminder settings
  useEffect(() => {
    localStorage.setItem("vela_reminders_enabled", JSON.stringify(remindersEnabled));
  }, [remindersEnabled]);
  useEffect(() => {
    localStorage.setItem("vela_reminder_times", JSON.stringify(reminderTimes));
  }, [reminderTimes]);

  function checkNewBadges(prevLogs, newLogs) {
    const prevStats = computeGamificationStats(prevLogs);
    const newStats = computeGamificationStats(newLogs);
    const prevEarned = new Set(BADGES.filter((b) => b.check(prevStats)).map((b) => b.id));
    const newEarned = BADGES.filter((b) => b.check(newStats) && !prevEarned.has(b.id));
    if (newEarned.length > 0) {
      haptic("Medium");
      setBadgeToast(newEarned[0]);
      setTimeout(() => setBadgeToast(null), 3000);
    }
    // Level-up detection
    const prevXp = computeXP(prevLogs);
    const newXp = computeXP(newLogs);
    const prevLvl = getLevel(prevXp);
    const newLvl = getLevel(newXp);
    if (newLvl.level > prevLvl.level) {
      setTimeout(() => {
        haptic("Heavy");
        setLevelUp({ level: newLvl.level, name: newLvl.name, unlock: LEVELS.find((l) => l.level === newLvl.level)?.unlock });
      }, newEarned.length > 0 ? 3500 : 500); // delay if badge toast is showing
    }
  }

  function handleLog(entry) {
    // Stamp the log with a LOCAL-time ISO string. new Date().toISOString()
    // returns UTC, so a user logging at 8pm ET (= 12am UTC the next day)
    // would see the entry land on tomorrow's date in History — broke the
    // calendar highlight and "newest first" ordering. Computing the local
    // ISO keeps `date.slice(0, 10)` aligned with the user's local day.
    const logEntry = { ...entry, date: localISOString(new Date()) };
    const newLogs = [logEntry, ...logs];
    setLogs(newLogs);
    // Smart contextual toast messages — personalized by profile
    const uniqueDays = new Set(newLogs.map((l) => l.date.slice(0, 10))).size;
    const streak = getStreak(newLogs);
    track("log_completed", {
      uniqueDays,
      streak,
      symptomCount: Object.keys(entry.symptoms || {}).length,
      hasNotes: !!(entry.notes && entry.notes.length > 0),
    });
    const p = getPersonalization(profile);
    const concern = p?.topConcernNames?.[0];
    const symptoms = Object.keys(entry.symptoms || {});
    // Plain-language toasts. No emoji (project rule), no overselling
    // ("first patterns emerging" after one log is fiction). Day-7
    // explicitly references the unlock so the user knows what to look at.
    let msg = "Entry logged.";
    if (uniqueDays === 1) msg = concern ? `First entry in. Vela starts watching your ${concern} from here.` : "First entry in. Keep going.";
    else if (uniqueDays === 3) msg = "3 days logged. Halfway to the day-7 pattern unlock.";
    else if (uniqueDays === 7) msg = "7 days. Your first pattern is ready. Tap Insights.";
    else if (uniqueDays === 14) msg = "Two weeks in. Patterns get sharper from here.";
    else if (streak >= 7 && streak % 7 === 0) msg = `${streak}-day streak. That's a real record.`;
    else if (symptoms.length >= 3) {
      const matched = concern && symptoms.some((s) => s.toLowerCase().includes(concern.toLowerCase()));
      msg = matched ? `${symptoms.length} symptoms logged, including your ${concern} focus.` : `${symptoms.length} symptoms logged.`;
    }
    else if (entry.notes && entry.notes.length > 20) msg = "Notes saved. The detail helps later.";
    else if (entry.energy !== null && entry.energy !== undefined && entry.mood !== null && entry.mood !== undefined) msg = "Mood and energy in.";
    setToastMsg(msg);
    setToast(true);
    setTimeout(() => setToast(false), 3500);
    setTimeout(() => checkNewBadges(logs, newLogs), 500);
  }

  function handleOnboardComplete(answers) {
    localStorage.setItem("vela_profile", JSON.stringify(answers));
    setProfile(answers);
    setOnboarded(true);
    setScreen("tracker");
    // Schedule reminders based on Q4 preference
    if (answers[3] !== undefined && answers[3] !== null && remindersEnabled) {
      scheduleReminders(answers[3]);
    }
  }

  const [editingQuestion, setEditingQuestion] = useState(null);

  function handleEditQuestion(qIndex) {
    setEditingQuestion(qIndex);
    setScreen("edit-question");
  }

  function handleSaveQuestion(qIndex, answer) {
    const updated = { ...profile, [qIndex]: answer };
    localStorage.setItem("vela_profile", JSON.stringify(updated));
    setProfile(updated);
    setEditingQuestion(null);
    setScreen("settings");
    // Re-schedule reminders if guidance preference changed
    if (qIndex === 3 && remindersEnabled) {
      scheduleReminders(answer, reminderTimes);
    }
  }

  function handleBackFromEdit() {
    setEditingQuestion(null);
    setScreen("settings");
  }

  function handleClearData() {
    if (window.confirm("This will delete all your logs and profile data. This cannot be undone.")) {
      // Belt-and-suspenders: enumerate the known keys so theme/system
      // localStorage isn't touched, then sweep anything starting with
      // "vela_" to catch keys added since this list was last updated.
      // If you add a new vela_* key, also add it here so reviewers can
      // see at a glance that "Reset all data" still means all data.
      const knownKeys = [
        // Core
        "vela_logs", "vela_profile", "vela_onboarded",
        "vela_onboarding_progress", "vela_custom_symptoms",
        // Reminders
        "vela_reminders_enabled", "vela_reminder_times",
        // Streaks
        "vela_streak_freezes", "vela_streak_freeze_count",
        // Ask Vela / chat
        "vela_chat_messages", "vela_pending_question",
        "vela_ask_monthly_count",
        // Daily brief
        "vela_daily_brief", "vela_last_brief_date",
        "vela_last_digest_date",
        // Insights / experiments
        "vela_experiments", "vela_focus_experiment",
        "vela_insight_feedback", "vela_insights_revealed",
        // Lessons / CBT
        "vela_completed_lessons", "vela_active_cbt", "vela_completed_cbt",
        // Community (gated until LIVE_COMMUNITY ships)
        "vela_circle_first_visit", "vela_community_votes",
        "vela_community_likes", "vela_community_bookmarks",
        "vela_community_reactions", "vela_community_posts",
        "vela_community_guidelines_seen", "vela_community_user_topics",
        "vela_community_replies",
        // Connected health
        "vela_healthkit_enabled",
        // Nudges (per-row dismissals)
        "vela_insights_nudge_dismissed", "vela_doctor_nudge_dismissed",
        "vela_community_nudge_dismissed", "vela_relief_nudge_dismissed",
        // Aesthetic — debatable, but Reset means reset
        "vela_theme_pref",
      ];
      knownKeys.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
      // Sweep any vela_* keys not in the list above.
      try {
        const stragglers = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("vela_")) stragglers.push(k);
        }
        stragglers.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
      } catch {}
      cancelAllReminders();
      clearUser(); // drop Sentry user context so next session starts fresh
      setLogs([]);
      setProfile(null);
      setOnboarded(false);
      setRemindersEnabled(true);
      setReminderTimes({ morning: "09:00", evening: "20:00", weekly: "10:00" });
      setScreen("onboard");
    }
  }

  // Dev-only: populate the app with 30 days of realistic synthetic data so
  // App Store screenshots can be taken in the simulator without manually
  // onboarding + logging dozens of entries. Surface from the hidden debug
  // screen (Settings → tap version number 5×). Pattern: caffeine days have
  // worse hot flashes / insomnia / mood; non-caffeine days correlate with
  // exercise + better sleep — produces real correlations in Insights.
  function seedDemoData() {
    if (!window.confirm("Replace your current data with 30 days of demo content? This is intended for App Store screenshots.")) return;
    const demoProfile = [1, [0, 1, 2], 4, "sometimes"]; // perimenopause; concerns: hot flashes/sleep/mood
    const demoLogs = [];
    for (let day = 30; day >= 0; day--) {
      const d = new Date();
      d.setDate(d.getDate() - day);
      d.setHours(9 + (day % 3), 15, 0, 0);
      const caffeine = day % 2 === 0;
      const sleepHours = caffeine ? 5 + Math.random() * 0.8 : 7 + Math.random() * 0.8;
      const symptoms = {};
      const severities = {};
      symptoms["Brain fog"] = true;
      severities["Brain fog"] = caffeine ? 2 : 1;
      if (caffeine) {
        symptoms["Hot flash"] = true; severities["Hot flash"] = 2 + (day % 2);
        symptoms["Night sweats"] = true; severities["Night sweats"] = 2;
        symptoms["Poor sleep"] = true; severities["Poor sleep"] = 3;
        symptoms["Irritability"] = true; severities["Irritability"] = 2;
      } else {
        symptoms["Fatigue"] = true; severities["Fatigue"] = 1;
      }
      if (day % 7 === 0) { symptoms["Joint stiffness"] = true; severities["Joint stiffness"] = 1; }
      const notes = day === 5 ? "Bad night. Woke up drenched around 3am after the late espresso." : (day === 12 ? "Felt great today. Slept 8 hours and walked 5k." : "");
      demoLogs.unshift({
        date: localISOString(d),
        mood: caffeine ? 1 : 3,
        energy: caffeine ? 1 : 3,
        symptoms,
        severities,
        notes,
        context: {
          sleepHours: parseFloat(sleepHours.toFixed(1)),
          stress: caffeine ? 4 : 2,
          caffeine,
          alcohol: false,
          exercise: !caffeine,
          period: null,
          periodFlow: null,
        },
      });
    }
    try {
      localStorage.setItem("vela_logs", JSON.stringify(demoLogs));
      localStorage.setItem("vela_profile", JSON.stringify(demoProfile));
      localStorage.setItem("vela_onboarded", "true");
    } catch { /* private mode */ }
    setLogs(demoLogs);
    setProfile(demoProfile);
    setOnboarded(true);
    setScreen("insights");
  }

  function openPaywall(trigger) {
    track("paywall_shown", { trigger });
    setShowPaywall(true);
  }

  async function handleSubscribe(plan) {
    const result = await purchasePlan(plan);
    if (result.isPremium) {
      track("paywall_converted", { plan });
      setIsPremium(true);
      setShowPaywall(false);
    } else if (result.cancelled) {
      // user dismissed the native sheet — leave paywall open, no toast
    } else if (result.error === "web_fallback") {
      // Browser dev preview only — no Apple receipt to validate. Unlock locally for testing.
      // This branch is unreachable in production iOS builds (mode would be 'native' or 'misconfigured').
      setIsPremium(true);
      setShowPaywall(false);
    } else if (result.error === "misconfigured") {
      // Native iOS build is missing the RevenueCat API key — surfaced as a user-friendly error,
      // logged to Sentry inside subscription.js. Critically: do NOT grant premium.
      setToastMsg("Subscriptions are temporarily unavailable. Please try again shortly.");
      setToast(true);
      setTimeout(() => setToast(false), 3500);
    } else {
      // no_offering / no_package / network error / unknown — surface a generic failure
      setToastMsg("Purchase didn't go through. Try again or contact support.");
      setToast(true);
      setTimeout(() => setToast(false), 3500);
    }
  }

  async function handleRestore() {
    const result = await restorePurchases();
    if (result.isPremium) {
      setIsPremium(true);
      setShowPaywall(false);
      setToastMsg("Premium restored. ✨");
    } else if (result.error === "misconfigured") {
      setToastMsg("Subscriptions are temporarily unavailable. Please try again shortly.");
    } else {
      setToastMsg("No previous purchase found on this Apple ID.");
    }
    setToast(true);
    setTimeout(() => setToast(false), 3500);
  }

  const tabs = [
    { id: "tracker", label: "Today" },
    { id: "history", label: "History" },
    { id: "insights", label: "Insights" },
    { id: "community", label: "Community" },
    { id: "settings", label: "Settings" },
  ];

  // Show paywall overlay
  if (showPaywall) {
    return (
      <div className="app">
        <PaywallScreen
          onClose={() => setShowPaywall(false)}
          onSubscribe={handleSubscribe}
          onRestore={handleRestore}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {/* Slim top header — wordmark only. Hidden on Today (which has its
          own sticky glass header per the redesign) and Onboarding (which
          renders its own giant Vela mark in the welcome screen and needs
          full-bleed height for the welcome → questions → summary flow). */}
      {onboarded && screen !== "tracker" && (
        <div className="nav">
          <div className="nav-logo">
            Ve<em>la</em>
          </div>
        </div>
      )}

      {/* Screens */}
      {!onboarded && (
        <OnboardingScreen onComplete={handleOnboardComplete} />
      )}
      {onboarded && screen === "tracker" && <TrackerScreen onLog={handleLog} logs={logs} profile={profile} isPremium={isPremium} onNavigate={setScreen} onShowPaywall={(sub) => openPaywall(sub ? `tracker_${sub}` : "tracker")} />}
      {onboarded && screen === "history" && <HistoryScreen logs={logs} isPremium={isPremium} onShowPaywall={(sub) => openPaywall(sub ? `history_${sub}` : "history")} onNavigate={setScreen} />}
      {onboarded && screen === "insights" && (
        <InsightsScreen
          logs={logs}
          profile={profile}
          isPremium={isPremium}
          onShowPaywall={(sub) => openPaywall(sub ? `insights_${sub}` : "insights")}
        />
      )}
      {onboarded && screen === "community" && <CommunityScreen />}
      {onboarded && screen === "settings" && (
        <SettingsScreen
          profile={profile}
          logs={logs}
          isPremium={isPremium}
          onShowPaywall={(sub) => openPaywall(sub ? `settings_${sub}` : "settings")}
          onEditQuestion={handleEditQuestion}
          onClearData={handleClearData}
          remindersEnabled={remindersEnabled}
          onToggleReminders={async (enabled) => {
            setRemindersEnabled(enabled);
            if (enabled && profile) {
              await scheduleReminders(profile[3] ?? 3, reminderTimes);
            } else {
              await cancelAllReminders();
            }
          }}
          reminderTimes={reminderTimes}
          onUpdateReminderTime={async (key, time) => {
            const updated = { ...reminderTimes, [key]: time };
            setReminderTimes(updated);
            if (remindersEnabled && profile) {
              await scheduleReminders(profile[3] ?? 3, updated);
            }
          }}
          onNavigate={setScreen}
        />
      )}
      {onboarded && screen === "edit-question" && editingQuestion !== null && (
        <EditQuestionScreen
          questionIndex={editingQuestion}
          profile={profile}
          onSave={handleSaveQuestion}
          onBack={handleBackFromEdit}
        />
      )}

      {/* Debug Panel */}
      {onboarded && screen === "debug" && (
        <div className="screen active" style={{ padding: "20px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Gamification Debugger</h2>
            <button style={{ background: "var(--sage)", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }} onClick={() => setScreen("settings")}>Back</button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="settings-section-label">DEMO DATA (FOR APP STORE SCREENSHOTS)</div>
            <div className="settings-card" style={{ padding: 12 }}>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-light)", lineHeight: 1.4 }}>
                Replaces your data with 30 days of perimenopause-pattern logs (caffeine ↔ hot flashes ↔ sleep correlations). Lands you on Insights so the patterns are immediately visible.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={seedDemoData}
                  style={{ background: "var(--clay)", color: "white", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", fontWeight: 500 }}
                >
                  Seed 30-day demo
                </button>
                <button
                  onClick={handleClearData}
                  style={{ background: "var(--card-bg)", color: "var(--ink-light)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
                >
                  Clear all data
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="settings-section-label">TRIGGER LEVEL-UP CELEBRATIONS</div>
            <div className="settings-card" style={{ padding: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LEVELS.map((lvl) => (
                  <button key={lvl.level} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--ink)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 80 }}
                    onClick={() => { haptic("Heavy"); setLevelUp({ level: lvl.level, name: lvl.name, unlock: lvl.unlock }); }}>
                    <strong>Lv.{lvl.level}</strong>
                    <span style={{ fontSize: 11, color: "var(--ink-light)" }}>{lvl.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="settings-section-label">TRIGGER BADGE TOASTS</div>
            <div className="settings-card" style={{ padding: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {BADGES.slice(0, 12).map((b) => (
                  <button key={b.id} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--ink)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={() => { haptic("Medium"); setBadgeToast(b); setTimeout(() => setBadgeToast(null), 3000); }}>
                    <span>{b.icon}</span> {b.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="settings-section-label">STREAK MULTIPLIERS</div>
            <div className="settings-card" style={{ padding: 16 }}>
              {[
                { days: 1, label: "1 day" },
                { days: 5, label: "5 days" },
                { days: 7, label: "7 days" },
                { days: 14, label: "14 days" },
                { days: 30, label: "30 days" },
                { days: 60, label: "60 days" },
              ].map((s) => (
                <div key={s.days} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
                  <span>🔥 {s.label} streak</span>
                  <span style={{ fontWeight: 600, color: getStreakMultiplier(s.days) > 1 ? "var(--gold)" : "var(--ink-light)" }}>{getStreakMultiplier(s.days)}x XP</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="settings-section-label">XP BREAKDOWN</div>
            <div className="settings-card" style={{ padding: 16, fontSize: 13 }}>
              {[
                { label: "Log an entry", xp: "10 XP" },
                { label: "Unique day bonus", xp: "5 XP" },
                { label: "Streak day (cap 60)", xp: "3 XP" },
                { label: "Log mood", xp: "2 XP" },
                { label: "Log context", xp: "3 XP" },
                { label: "Add notes", xp: "5 XP" },
                { label: "Earn a badge", xp: "25 XP" },
                { label: "Daily insight", xp: "10 XP" },
                { label: "Complete experiment", xp: "50 XP" },
                { label: "Complete CBT program", xp: "100-150 XP" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{item.label}</span>
                  <span style={{ fontWeight: 600, color: "var(--sage)" }}>{item.xp}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="settings-section-label">LEVEL PROGRESSION</div>
            <div className="settings-card" style={{ padding: 16 }}>
              {LEVELS.map((lvl, i) => {
                const next = LEVELS[i + 1];
                const range = next ? `${lvl.xpNeeded} – ${next.xpNeeded - 1} XP` : `${lvl.xpNeeded}+ XP`;
                return (
                  <div key={lvl.level} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < LEVELS.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
                    <div>
                      <strong>Lv.{lvl.level}</strong> <span style={{ color: "var(--ink-light)" }}>{lvl.name}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "var(--ink-light)" }}>{range}</div>
                      {lvl.unlock && <div style={{ fontSize: 11, color: "var(--gold)" }}>🔓 {lvl.unlock}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="settings-section-label">SIMULATE LOG TOAST</div>
            <div className="settings-card" style={{ padding: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { label: "Basic log", msg: "Entry logged! Keep it up. 🌿 +15 XP" },
                  { label: "First entry", msg: "First entry logged! Vela is now learning your hot flashes patterns. 🌱 +20 XP" },
                  { label: "Day 7", msg: "7 days! Your hot flashes insights are ready. Tap Insights. ✨ +20 XP" },
                  { label: "With streak 1.5x", msg: "Entry logged! Keep it up. 🌿 +23 XP (1.5x streak bonus!)" },
                  { label: "With streak 3x", msg: "Entry logged! Keep it up. 🌿 +45 XP (3x streak bonus!)" },
                  { label: "Detailed entry", msg: "Tracking your hot flashes + 2 more. Great detail! 💡 +25 XP" },
                ].map((t, i) => (
                  <button key={i} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--ink)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
                    onClick={() => { setToastMsg(t.msg); setToast(true); setTimeout(() => setToast(false), 3500); }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="settings-section-label">ALL BADGES ({BADGES.length})</div>
            <div className="settings-card" style={{ padding: 12 }}>
              <div className="gam-badges-grid">
                {BADGES.map((b) => (
                  <div key={b.id} className="gam-badge earned" style={{ cursor: "pointer" }} onClick={() => { haptic("Medium"); setBadgeToast(b); setTimeout(() => setBadgeToast(null), 3000); }}>
                    <div className="gam-badge-icon">{b.icon}</div>
                    <div className="gam-badge-name">{b.name}</div>
                    <div className="gam-badge-desc">{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav. Hidden during onboarding */}
      {onboarded && (
        <nav className="nav-bottom" aria-label="Main navigation">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`nav-bottom-tab${screen === t.id ? " active" : ""}`}
              onClick={() => { setScreen(t.id); window.scrollTo(0, 0); }}
              aria-current={screen === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {/* Toast */}
      <div className={`toast${toast ? " show" : ""}`}>
        {toastMsg || "Entry logged."}
      </div>

      {/* Badge Toast */}
      {badgeToast && (
        <div className="badge-toast">
          <span className="badge-toast-icon">{badgeToast.icon}</span>
          <div className="badge-toast-content">
            <span className="badge-toast-title">Milestone reached!</span>
            <span className="badge-toast-text">{badgeToast.icon} {badgeToast.name}</span>
          </div>
        </div>
      )}

      {/* Journey Milestone Celebration */}
      {levelUp && (
        <div className="levelup-overlay" onClick={() => setLevelUp(null)}>
          <div className="levelup-card">
            <div className="levelup-sparkle" style={{ color: "var(--sage-dark)", display: "inline-flex", justifyContent: "center" }}>
              <UIIcon name="Sparkle" size={36} weight="fill" />
            </div>
            <div className="levelup-title">Milestone reached</div>
            <div className="levelup-level" style={{ fontSize: 28 }}>{levelUp.name}</div>
            {levelUp.unlock && (
              <div className="levelup-unlock">
                <span>{levelUp.unlock}</span>
              </div>
            )}
            <button className="levelup-btn" onClick={() => setLevelUp(null)}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}

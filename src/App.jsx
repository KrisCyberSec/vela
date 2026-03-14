import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";

const SYMPTOMS = [
  { icon: "🌡", name: "Hot flash" },
  { icon: "🌙", name: "Night sweats" },
  { icon: "😴", name: "Poor sleep" },
  { icon: "🧠", name: "Brain fog" },
  { icon: "💔", name: "Mood shifts" },
  { icon: "⚡", name: "Fatigue" },
  { icon: "💧", name: "Dryness" },
  { icon: "💊", name: "Headache" },
  { icon: "🦴", name: "Joint pain" },
  { icon: "😰", name: "Anxiety" },
  { icon: "⚖️", name: "Weight change" },
  { icon: "❤️", name: "Low libido" },
];

const QUESTIONS = [
  {
    text: "Where are you in your hormonal journey?",
    opts: [
      "Still having regular periods",
      "Periods are irregular (perimenopause)",
      "No period for 12+ months",
      "Post-surgical menopause",
    ],
  },
  {
    text: "Which symptoms bother you most right now?",
    opts: [
      "Hot flashes & night sweats",
      "Sleep problems",
      "Mood changes & anxiety",
      "Brain fog & fatigue",
    ],
  },
  {
    text: "What's your main goal with Vela?",
    opts: [
      "Understand what's happening to my body",
      "Track symptoms to show my doctor",
      "Find relief strategies",
      "Connect with others going through this",
    ],
  },
  {
    text: "How do you prefer to receive guidance?",
    opts: [
      "Daily check-ins & reminders",
      "Weekly summaries",
      "Only when I ask",
      "Let the app decide",
    ],
  },
];

const MOODS = ["😔", "😕", "😐", "🙂", "😊"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getStreak(logs) {
  if (logs.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const hasLog = logs.some((l) => l.date.slice(0, 10) === dayStr);
    if (hasLog) streak++;
    else if (i > 0) break; // allow today to be missing
    else break;
  }
  return streak;
}

function getJourneyLabel(profileIndex) {
  const labels = [
    "regular cycles",
    "perimenopause",
    "postmenopause",
    "surgical menopause",
  ];
  return labels[profileIndex] || null;
}

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
  }

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
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(env(safe-area-inset-top, 0px) + 20px) 24px 12px;
  }
  .nav-logo {
    font-family: 'DM Serif Display', serif;
    font-size: 22px;
    color: var(--clay-dark);
    letter-spacing: -0.5px;
  }
  .nav-logo em { color: var(--clay); font-style: italic; }
  .nav-tabs {
    display: flex;
    gap: 4px;
    background: white;
    border-radius: 20px;
    padding: 4px;
    border: 1px solid var(--border);
  }
  .nav-tab {
    font-size: 11px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 16px;
    cursor: pointer;
    color: var(--ink-light);
    transition: all 0.2s;
    border: none;
    background: transparent;
    font-family: 'DM Sans', sans-serif;
  }
  .nav-tab.active { background: var(--clay); color: white; }

  /* ── SCREENS ── */
  .screen { display: none; flex-direction: column; padding-bottom: 32px; animation: fadeIn 0.3s ease; }
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
    background: white;
    border-radius: var(--radius);
    padding: 20px;
    border: 1px solid var(--border);
    flex: 1;
  }
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
    background: var(--clay);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.2s;
  }
  .onboard-btn:hover { background: var(--clay-dark); }
  .onboard-btn:disabled { background: #D4B5A8; cursor: default; }

  /* ── TRACKER ── */
  .tracker-header { padding: 16px 24px 0; }
  .tracker-header h2 { font-family: 'DM Serif Display', serif; font-size: 24px; color: var(--ink); }
  .tracker-header p { font-size: 13px; color: var(--ink-light); margin-top: 2px; }

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

  .symptoms-section { margin: 14px 16px 0; }
  .symptom-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .symptom-tile {
    background: white;
    border-radius: var(--radius-sm);
    padding: 12px;
    border: 1.5px solid var(--border);
    cursor: pointer;
    transition: all 0.18s;
    text-align: left;
  }
  .symptom-tile:hover { border-color: var(--clay); }
  .symptom-tile.active { border-color: var(--clay); background: var(--clay-light); }
  .s-icon { font-size: 18px; margin-bottom: 4px; }
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

  .notes-area { margin: 14px 16px 0; }
  .notes-input {
    width: 100%;
    background: white;
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
    background: white;
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

  .unlock-card {
    margin: 12px 16px 0;
    background: var(--ink);
    border-radius: var(--radius);
    padding: 20px;
    color: white;
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
  .unlock-body { font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 14px; }
  .unlock-btn {
    padding: 11px 20px;
    background: var(--gold);
    color: var(--ink);
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
    margin: 40px 16px;
    text-align: center;
    color: var(--ink-light);
    font-size: 14px;
    line-height: 1.6;
  }
  .history-empty span { font-size: 32px; display: block; margin-bottom: 8px; }

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
    background: white;
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
    background: white;
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
    background: white; border-radius: var(--radius); border: 1px solid var(--border); overflow: hidden;
  }
  .settings-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid var(--border); cursor: pointer;
  }
  .settings-row:last-child { border-bottom: none; }
  .settings-row:hover { background: var(--cream); }
  .sr-left { display: flex; align-items: center; gap: 10px; }
  .sr-icon { font-size: 18px; }
  .sr-label { font-size: 14px; color: var(--ink); }
  .sr-value { font-size: 13px; color: var(--ink-light); }
  .sr-arrow { font-size: 14px; color: var(--ink-light); }

  .settings-danger-btn {
    margin: 20px 16px 0; padding: 13px; background: white; border: 1.5px solid #E8C0B0;
    border-radius: var(--radius-sm); font-size: 14px; color: var(--clay-dark);
    cursor: pointer; font-family: 'DM Sans', sans-serif; width: calc(100% - 32px);
    text-align: center;
  }
  .settings-danger-btn:hover { background: #FDF0EB; }

  .settings-footer {
    text-align: center; padding: 20px 24px 0; font-size: 12px; color: var(--ink-light);
  }
  .settings-footer a { color: var(--clay); text-decoration: underline; }

  /* ── STREAK BADGE ── */
  .streak-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--sage-light); color: var(--sage-dark);
    padding: 4px 10px; border-radius: 12px;
    font-size: 12px; font-weight: 500; margin-top: 6px;
  }

  /* ── WEEKLY SUMMARY ── */
  .weekly-summary {
    margin: 14px 16px 0; background: white; border-radius: var(--radius);
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

  /* ── TOAST ── */
  .toast {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 36px);
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--sage-dark);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    opacity: 0;
    transition: all 0.3s;
    white-space: nowrap;
    pointer-events: none;
    z-index: 100;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

// ─── Onboarding Screen ────────────────────────────────────────────────────────

function OnboardingScreen({ onComplete }) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);

  const q = QUESTIONS[qIndex];
  const progress = ((qIndex + 1) / QUESTIONS.length) * 100;
  const isLast = qIndex === QUESTIONS.length - 1;

  function handleSelect(i) {
    setSelected(i);
    setAnswers((prev) => ({ ...prev, [qIndex]: i }));
  }

  function handleNext() {
    if (isLast) {
      onComplete(answers);
    } else {
      setQIndex((i) => i + 1);
      setSelected(answers[qIndex + 1] ?? null);
    }
  }

  return (
    <div className="screen active">
      <div className="onboard-hero">
        <h1>
          Your body,<br /><em>finally understood.</em>
        </h1>
        <p>A few quick questions to personalize your experience.</p>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="q-card">
        <div className="q-step">
          Question {qIndex + 1} of {QUESTIONS.length}
        </div>
        <div className="q-text">{q.text}</div>
        <div className="q-options">
          {q.opts.map((opt, i) => (
            <button
              key={i}
              className={`q-opt${selected === i ? " selected" : ""}`}
              onClick={() => handleSelect(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <button
        className="onboard-btn"
        onClick={handleNext}
        disabled={selected === null}
      >
        {isLast ? "Start my journey →" : "Continue"}
      </button>
    </div>
  );
}

// ─── Tracker Screen ───────────────────────────────────────────────────────────

function TrackerScreen({ onLog, logs, profile }) {
  const [mood, setMood] = useState(null);
  const [activeSymptoms, setActiveSymptoms] = useState({});
  const [severities, setSeverities] = useState({});
  const [notes, setNotes] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const streak = getStreak(logs);
  const journeyStage = profile ? getJourneyLabel(profile[0]) : null;

  // Rotating evidence-based tips based on onboarding symptom concern
  const tipSets = {
    0: [
      "Hot flashes and night sweats are the most common perimenopausal symptoms. Tracking their frequency helps identify triggers.",
      "Many women find hot flashes worsen with caffeine, alcohol, or spicy food. Your logs can help spot these patterns.",
      "Hot flashes typically peak 1-2 years after your last period and gradually ease. Tracking duration helps monitor progress.",
      "Deep breathing when a hot flash starts can reduce its intensity. Log severity to see if coping strategies help.",
      "Layered clothing and keeping your bedroom cool (65°F/18°C) are evidence-backed strategies for managing night sweats.",
    ],
    1: [
      "Sleep disruption affects up to 60% of women during the menopausal transition. Consistent logging reveals patterns your doctor can act on.",
      "Poor sleep during menopause is often linked to night sweats. Tracking both helps your doctor see the connection.",
      "Maintaining a consistent wake time — even on weekends — is one of the strongest evidence-based sleep strategies.",
      "Screen time before bed suppresses melatonin production. Note your evening habits to find what helps you sleep better.",
      "Sleep quality often improves as you move through the menopausal transition. Your logs will show this progress over time.",
    ],
    2: [
      "Mood changes during perimenopause are linked to fluctuating estrogen. Tracking helps distinguish hormonal shifts from other factors.",
      "Anxiety is more common than depression during perimenopause. Logging mood alongside symptoms helps paint the full picture.",
      "Regular exercise has been shown to reduce perimenopausal mood symptoms as effectively as some medications.",
      "Mood shifts often correlate with sleep quality. Your combined logs help your doctor see these connections.",
      "Many women find their mood stabilizes as they move from perimenopause into postmenopause. Tracking shows your trajectory.",
    ],
    3: [
      "Brain fog and fatigue often correlate with sleep quality. Your logs can reveal these connections over time.",
      "Perimenopausal brain fog is real — estrogen affects neurotransmitters involved in memory and concentration.",
      "Staying hydrated and maintaining stable blood sugar can help reduce brain fog episodes. Track what works for you.",
      "Fatigue during perimenopause may be compounded by iron deficiency. If persistent, share your logs with your doctor.",
      "Cognitive function typically returns to baseline after the menopausal transition. Your tracking data captures the journey.",
    ],
  };
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const tips = profile ? tipSets[profile[1]] || tipSets[0] : null;
  const tipText = tips ? tips[dayOfYear % tips.length] : null;

  function toggleSymptom(name) {
    setActiveSymptoms((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = true;
      return next;
    });
  }

  function setSev(symptomName, level) {
    setSeverities((prev) => ({ ...prev, [symptomName]: level }));
  }

  function handleLog() {
    onLog({ mood, symptoms: activeSymptoms, severities, notes });
    setMood(null);
    setActiveSymptoms({});
    setSeverities({});
    setNotes("");
  }

  return (
    <div className="screen active">
      <div className="tracker-header">
        <h2>{getGreeting()}</h2>
        <p>{today}{journeyStage ? ` · ${journeyStage}` : ""}</p>
        {streak > 1 && <div className="streak-badge">🔥 {streak}-day streak</div>}
      </div>

      {tipText && (
        <div className="tip-card">
          <div className="tip-label">Evidence-based tip</div>
          <div className="tip-text">{tipText}</div>
        </div>
      )}

      <div className="wellbeing-card">
        <div className="wb-label">How are you feeling overall?</div>
        <div className="wb-faces">
          {MOODS.map((emoji, i) => (
            <div
              key={i}
              className={`wb-face${mood === i ? " selected" : ""}`}
              onClick={() => setMood(i)}
            >
              {emoji}
            </div>
          ))}
        </div>
      </div>

      <div className="symptoms-section">
        <div className="section-label">Symptoms today</div>
        <div className="symptom-grid">
          {SYMPTOMS.map((s) => {
            const isActive = !!activeSymptoms[s.name];
            const sev = severities[s.name] || 0;
            return (
              <div
                key={s.name}
                className={`symptom-tile${isActive ? " active" : ""}`}
                onClick={() => toggleSymptom(s.name)}
              >
                <div className="s-icon">{s.icon}</div>
                <span className="s-name">{s.name}</span>
                <div className="s-severity">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`sev-dot${sev >= level ? " on" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSev(s.name, level);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="notes-area">
        <textarea
          className="notes-input"
          placeholder="Any notes or observations..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button className="log-btn" onClick={handleLog}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        Log today's entry
      </button>

      <div className="disclaimer">Vela is not medical advice. Always consult your healthcare provider.</div>
      <div className="disclaimer" style={{ marginTop: 4 }}>🔒 Your data stays on your device. Always.</div>
    </div>
  );
}

// ─── History Screen ──────────────────────────────────────────────────────────

function HistoryScreen({ logs }) {
  if (logs.length === 0) {
    return (
      <div className="screen active">
        <div className="history-header">
          <h2>History</h2>
          <p>Your logged entries</p>
        </div>
        <div className="history-empty">
          <span>📝</span>
          No entries yet. Log your first day on the Today tab.
        </div>
      </div>
    );
  }

  // Group logs by date
  const grouped = {};
  logs.forEach((log) => {
    const dayStr = log.date.slice(0, 10);
    if (!grouped[dayStr]) grouped[dayStr] = [];
    grouped[dayStr].push(log);
  });

  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="screen active">
      <div className="history-header">
        <h2>History</h2>
        <p>{logs.length} entr{logs.length === 1 ? "y" : "ies"} total</p>
      </div>

      {sortedDays.map((dayStr) => {
        const dayDate = new Date(dayStr + "T12:00:00");
        const label = dayDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
        return (
          <div key={dayStr} className="history-day">
            <div className="history-day-label">{label}</div>
            {grouped[dayStr].map((log, i) => {
              const time = new Date(log.date).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              const symptoms = Object.keys(log.symptoms || {});
              return (
                <div key={i} className="history-entry">
                  <div className="he-top">
                    {log.mood !== null && log.mood !== undefined && (
                      <span className="he-mood">{MOODS[log.mood]}</span>
                    )}
                    <span className="he-time">{time}</span>
                  </div>
                  {symptoms.length > 0 && (
                    <div className="he-symptoms">
                      {symptoms.map((s) => (
                        <span key={s} className="he-pill">
                          {s}
                          {log.severities?.[s] ? ` · ${log.severities[s]}/3` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.notes && <div className="he-notes">"{log.notes}"</div>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Insights Screen ──────────────────────────────────────────────────────────

function InsightsScreen({ logs, profile, isPremium, onShowPaywall }) {
  const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

  // Get logs from the last 7 days
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentLogs = logs.filter((l) => new Date(l.date) >= weekAgo);

  // Build per-day symptom counts for the bar chart (last 7 days)
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayLogs = recentLogs.filter(
      (l) => l.date.slice(0, 10) === dayStr
    );
    const count = dayLogs.reduce(
      (sum, l) => sum + Object.keys(l.symptoms || {}).length,
      0
    );
    weekData.push({ day: DAY_NAMES[d.getDay()], count });
  }
  const maxCount = Math.max(...weekData.map((d) => d.count), 1);

  // Compute top symptoms from recent logs
  const symptomDays = {};
  const seenDays = {};
  recentLogs.forEach((l) => {
    const dayStr = l.date.slice(0, 10);
    Object.keys(l.symptoms || {}).forEach((name) => {
      const key = `${name}_${dayStr}`;
      if (!seenDays[key]) {
        seenDays[key] = true;
        symptomDays[name] = (symptomDays[name] || 0) + 1;
      }
    });
  });
  const topSymptoms = Object.entries(symptomDays)
    .map(([name, days]) => ({ name, days, pct: Math.round((days / 7) * 100) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 4);

  // Find most common symptom for the insight callout
  const topSymptom = topSymptoms[0];

  // Mood trend for the last 7 days
  const moodData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayMoods = recentLogs
      .filter((l) => l.date.slice(0, 10) === dayStr && l.mood !== null && l.mood !== undefined)
      .map((l) => l.mood);
    const avg = dayMoods.length > 0 ? Math.round(dayMoods.reduce((a, b) => a + b, 0) / dayMoods.length) : null;
    moodData.push({ day: DAY_NAMES[d.getDay()], mood: avg });
  }

  return (
    <div className="screen active">
      <div className="insights-header">
        <h2>Your patterns</h2>
        <p>
          Last 7 days · {recentLogs.length} entr{recentLogs.length === 1 ? "y" : "ies"} logged
        </p>
      </div>

      {recentLogs.length === 0 ? (
        <div className="insight-callout">
          <div className="ic-label">Getting started</div>
          <div className="ic-text">
            Log your first entry on the <strong>Today</strong> tab to start
            seeing patterns here.
          </div>
        </div>
      ) : (
        <>
          {/* Weekly summary — free tier */}
          <div className="weekly-summary">
            <div className="ws-title">This week at a glance</div>
            <div className="ws-stats">
              <div className="ws-stat">
                <div className="ws-stat-value">{recentLogs.length}</div>
                <div className="ws-stat-label">entries</div>
              </div>
              <div className="ws-stat">
                <div className="ws-stat-value">{Object.keys(symptomDays).length}</div>
                <div className="ws-stat-label">symptoms</div>
              </div>
              <div className="ws-stat">
                <div className="ws-stat-value">{getStreak(logs)}</div>
                <div className="ws-stat-label">day streak</div>
              </div>
            </div>
          </div>

          {topSymptom && (
            <div className="insight-callout">
              <div className="ic-label">Top pattern</div>
              <div className="ic-text">
                <strong>{topSymptom.name}</strong> appeared on{" "}
                {topSymptom.days} of the last 7 days — your most frequent
                symptom this week.
              </div>
            </div>
          )}

          {moodData.some((d) => d.mood !== null) && (
            <div className="mood-trend">
              <div className="mood-trend-title">Mood this week</div>
              <div className="mood-trend-row">
                {moodData.map((d, i) => (
                  <div key={i} className="mood-trend-day">
                    <div className="mood-trend-emoji">
                      {d.mood !== null ? MOODS[d.mood] : "·"}
                    </div>
                    <div className="mood-trend-label">{d.day}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isPremium ? (
            <>
              <div className="trend-card">
                <div className="trend-title">Symptom intensity this week</div>
                <div className="chart-bars">
                  {weekData.map(({ day, count }, i) => {
                    const height = Math.round((count / maxCount) * 100);
                    return (
                      <div key={i} className="bar-wrap">
                        <div
                          className={`bar${height >= 70 ? " high" : ""}`}
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                        <div className="bar-day">{day}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {topSymptoms.length > 0 && (
                <div className="symptom-list">
                  <div className="section-label" style={{ padding: "12px 0 2px" }}>
                    Top symptoms
                  </div>
                  {topSymptoms.map((s, i) => (
                    <div key={i} className="sym-row">
                      <div className="sym-rank">{i + 1}</div>
                      <div className="sym-info">
                        <div className="sym-info-name">{s.name}</div>
                        <div className="sym-info-days">{s.days} of 7 days</div>
                      </div>
                      <div style={{ width: 80 }}>
                        <div className="sym-mini-bar" style={{ width: `${s.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ margin: "12px 16px 0", position: "relative" }}>
              <div className="premium-locked">
                <div className="trend-card" style={{ marginLeft: 0, marginRight: 0 }}>
                  <div className="trend-title">Symptom intensity this week</div>
                  <div className="chart-bars">
                    {weekData.map(({ day }, i) => (
                      <div key={i} className="bar-wrap">
                        <div className="bar" style={{ height: `${30 + (i * 10) % 50}%` }} />
                        <div className="bar-day">{day}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="premium-lock-badge" onClick={onShowPaywall}>
                  Unlock with Premium
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isPremium ? (
        <div style={{ margin: "14px 16px 0" }}>
          <button
            className="log-btn"
            onClick={() => generateDoctorReport(logs, profile)}
            style={{ margin: 0 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Generate doctor report (PDF)
          </button>
        </div>
      ) : (
        <div className="unlock-card">
          <div className="unlock-tag">Premium</div>
          <div className="unlock-title">Doctor-ready reports</div>
          <div className="unlock-body">
            Export clinician-informed 30-day symptom reports as a PDF. Built to
            help you have better conversations with your provider.
          </div>
          <button className="unlock-btn" onClick={onShowPaywall}>Unlock for $14.99/mo</button>
        </div>
      )}
    </div>
  );
}

// ─── Paywall Screen ──────────────────────────────────────────────────────────

function PaywallScreen({ onClose, onSubscribe, onRestore }) {
  const features = [
    { icon: "📊", title: "Evidence-based trend charts", desc: "Clinician-informed symptom tracking over time" },
    { icon: "📋", title: "Doctor-ready reports", desc: "PDF exports designed for your OB/GYN visit" },
    { icon: "🔮", title: "Personalized insights", desc: "AI-powered pattern detection tailored to you" },
    { icon: "🔒", title: "100% private, on-device", desc: "Your health data never leaves your phone" },
  ];

  return (
    <div className="screen active">
      <div style={{ padding: "8px 16px 0", textAlign: "right" }}>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", fontSize: 22,
            color: "var(--ink-light)", cursor: "pointer", padding: 8,
          }}
        >
          ✕
        </button>
      </div>

      <div className="paywall">
        <div className="paywall-hero">
          <h2>Your menopause journey, understood</h2>
          <p>
            Evidence-based tracking built for perimenopause and menopause.
            Your data stays on your device — always.
          </p>
        </div>

        <div className="paywall-features">
          {features.map((f, i) => (
            <div key={i} className="pw-feature">
              <div className="pw-icon">{f.icon}</div>
              <div className="pw-text">
                <strong>{f.title}</strong>
                <span>{f.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <button className="paywall-cta" onClick={onSubscribe}>
          Start Premium — $14.99/month
        </button>
        <div className="paywall-price">Cancel anytime. No commitment. 7-day free trial.</div>
        <button className="paywall-restore" onClick={onRestore}>
          Restore previous purchase
        </button>
      </div>
    </div>
  );
}

// ─── PDF Report Generator ────────────────────────────────────────────────────

function generateDoctorReport(logs, profile) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  function addPage() {
    doc.addPage();
    y = 20;
  }

  function checkPage(needed) {
    if (y + needed > 270) addPage();
  }

  // Header
  doc.setFontSize(22);
  doc.setTextColor(140, 78, 50); // clay-dark
  doc.text("Vela Symptom Report", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(100);
  const now = new Date();
  const thirtyAgo = new Date(now);
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  doc.text(
    `Report period: ${thirtyAgo.toLocaleDateString()} – ${now.toLocaleDateString()}`,
    margin, y
  );
  y += 5;
  doc.text("Generated by Vela — velahealth.app", margin, y);
  y += 10;

  // Line
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Patient profile
  if (profile) {
    doc.setFontSize(14);
    doc.setTextColor(44, 31, 23); // ink
    doc.text("Patient Profile", margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(80);
    const stages = ["Regular cycles", "Perimenopause", "Postmenopause", "Surgical menopause"];
    doc.text(`Hormonal stage: ${stages[profile[0]] || "Not specified"}`, margin, y);
    y += 6;
    const concerns = ["Hot flashes & night sweats", "Sleep problems", "Mood changes & anxiety", "Brain fog & fatigue"];
    doc.text(`Primary concern: ${concerns[profile[1]] || "Not specified"}`, margin, y);
    y += 12;
  }

  // Filter to last 30 days
  const recentLogs = logs.filter((l) => new Date(l.date) >= thirtyAgo);

  if (recentLogs.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("No entries logged in the last 30 days.", margin, y);
    doc.save("Vela-Symptom-Report.pdf");
    return;
  }

  // Summary stats
  doc.setFontSize(14);
  doc.setTextColor(44, 31, 23);
  doc.text("30-Day Summary", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Total entries logged: ${recentLogs.length}`, margin, y);
  y += 6;

  // Symptom frequency
  const symptomCount = {};
  recentLogs.forEach((l) => {
    Object.keys(l.symptoms || {}).forEach((s) => {
      symptomCount[s] = (symptomCount[s] || 0) + 1;
    });
  });
  const sortedSymptoms = Object.entries(symptomCount).sort((a, b) => b[1] - a[1]);

  if (sortedSymptoms.length > 0) {
    doc.text("Symptom frequency (days reported):", margin, y);
    y += 6;
    sortedSymptoms.forEach(([name, count]) => {
      checkPage(6);
      doc.text(`  • ${name}: ${count} of ${recentLogs.length} entries`, margin, y);
      y += 5;
    });
    y += 4;
  }

  // Average severity
  const sevTotals = {};
  const sevCounts = {};
  recentLogs.forEach((l) => {
    Object.entries(l.severities || {}).forEach(([s, v]) => {
      if (v > 0) {
        sevTotals[s] = (sevTotals[s] || 0) + v;
        sevCounts[s] = (sevCounts[s] || 0) + 1;
      }
    });
  });
  const sevAvgs = Object.entries(sevTotals).map(([name, total]) => ({
    name, avg: (total / sevCounts[name]).toFixed(1),
  })).sort((a, b) => b.avg - a.avg);

  if (sevAvgs.length > 0) {
    checkPage(10 + sevAvgs.length * 5);
    doc.setFontSize(10);
    doc.text("Average severity (1-3 scale):", margin, y);
    y += 6;
    sevAvgs.forEach(({ name, avg }) => {
      doc.text(`  • ${name}: ${avg}/3`, margin, y);
      y += 5;
    });
    y += 4;
  }

  // Mood overview
  const moodEntries = recentLogs.filter((l) => l.mood !== null && l.mood !== undefined);
  if (moodEntries.length > 0) {
    checkPage(12);
    const avgMood = (moodEntries.reduce((s, l) => s + l.mood, 0) / moodEntries.length).toFixed(1);
    const moodLabels = ["Very low", "Low", "Neutral", "Good", "Very good"];
    const moodLabel = moodLabels[Math.round(avgMood)] || "Neutral";
    doc.text(`Average mood: ${avgMood}/4 (${moodLabel})`, margin, y);
    y += 10;
  }

  // Daily log detail
  checkPage(15);
  doc.setFontSize(14);
  doc.setTextColor(44, 31, 23);
  doc.text("Daily Log Detail", margin, y);
  y += 8;

  const moodEmojis = ["Very low", "Low", "Neutral", "Good", "Very good"];
  const sortedLogs = [...recentLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedLogs.forEach((log) => {
    const dateStr = new Date(log.date).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    const time = new Date(log.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const symptoms = Object.keys(log.symptoms || {});
    const neededHeight = 12 + (symptoms.length > 0 ? 6 : 0) + (log.notes ? 6 : 0);
    checkPage(neededHeight);

    doc.setFontSize(10);
    doc.setTextColor(44, 31, 23);
    doc.text(`${dateStr} at ${time}`, margin, y);
    if (log.mood !== null && log.mood !== undefined) {
      doc.setTextColor(100);
      doc.text(`Mood: ${moodEmojis[log.mood]}`, margin + 80, y);
    }
    y += 5;

    if (symptoms.length > 0) {
      doc.setTextColor(100);
      const symText = symptoms.map((s) => {
        const sev = log.severities?.[s];
        return sev ? `${s} (${sev}/3)` : s;
      }).join(", ");
      const lines = doc.splitTextToSize(`Symptoms: ${symText}`, contentWidth);
      lines.forEach((line) => {
        checkPage(5);
        doc.text(line, margin, y);
        y += 5;
      });
    }

    if (log.notes) {
      doc.setTextColor(120);
      const noteLines = doc.splitTextToSize(`Note: "${log.notes}"`, contentWidth);
      noteLines.forEach((line) => {
        checkPage(5);
        doc.text(line, margin, y);
        y += 5;
      });
    }
    y += 3;
  });

  // Footer disclaimer
  checkPage(20);
  y += 5;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("This report is generated from self-reported data and is intended to support", margin, y);
  y += 4;
  doc.text("conversations with your healthcare provider. It does not constitute medical advice.", margin, y);
  y += 4;
  doc.text("All data is stored locally on the user's device and is not transmitted to any server.", margin, y);

  doc.save("Vela-Symptom-Report.pdf");
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

function exportCSV(logs) {
  const header = "Date,Time,Mood,Symptoms,Severities,Notes";
  const moodLabels = ["Very low", "Low", "Neutral", "Good", "Very good"];
  const rows = logs.map((log) => {
    const d = new Date(log.date);
    const date = d.toLocaleDateString("en-US");
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const mood = log.mood !== null && log.mood !== undefined ? moodLabels[log.mood] : "";
    const symptoms = Object.keys(log.symptoms || {}).join("; ");
    const sevs = Object.entries(log.severities || {}).map(([s, v]) => `${s}:${v}/3`).join("; ");
    const notes = (log.notes || "").replace(/"/g, '""');
    return `${date},${time},${mood},"${symptoms}","${sevs}","${notes}"`;
  });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Vela-Symptom-Log.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Edit Single Question Screen ─────────────────────────────────────────────

function EditQuestionScreen({ questionIndex, profile, onSave, onBack }) {
  const q = QUESTIONS[questionIndex];
  const [selected, setSelected] = useState(profile ? profile[questionIndex] : null);

  function handleSave() {
    onSave(questionIndex, selected);
  }

  return (
    <div className="screen active">
      <div style={{ padding: "8px 16px 0" }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", fontSize: 14,
            color: "var(--clay-dark)", cursor: "pointer", padding: "4px 0",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ← Back to Settings
        </button>
      </div>

      <div className="q-card">
        <div className="q-text">{q.text}</div>
        <div className="q-options">
          {q.opts.map((opt, i) => (
            <button
              key={i}
              className={`q-opt${selected === i ? " selected" : ""}`}
              onClick={() => setSelected(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <button
        className="onboard-btn"
        onClick={handleSave}
        disabled={selected === null}
      >
        Save
      </button>
    </div>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

function SettingsScreen({ profile, logs, isPremium, onShowPaywall, onEditQuestion, onClearData }) {
  const journeyStage = profile ? getJourneyLabel(profile[0]) : "Not set";
  const goalLabels = [
    "Understand my body",
    "Track for my doctor",
    "Find relief strategies",
    "Connect with others",
  ];
  const goal = profile ? goalLabels[profile[2]] : "Not set";

  return (
    <div className="screen active">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Manage your profile and preferences</p>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Profile</div>
        <div className="settings-card">
          <div className="settings-row" onClick={() => onEditQuestion(0)}>
            <div className="sr-left">
              <span className="sr-icon">🌸</span>
              <span className="sr-label">Hormonal stage</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="sr-value">{journeyStage || "Not set"}</span>
              <span className="sr-arrow">›</span>
            </div>
          </div>
          <div className="settings-row" onClick={() => onEditQuestion(2)}>
            <div className="sr-left">
              <span className="sr-icon">🎯</span>
              <span className="sr-label">Primary goal</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="sr-value">{goal}</span>
              <span className="sr-arrow">›</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Subscription</div>
        <div className="settings-card">
          <div className="settings-row" onClick={isPremium ? undefined : onShowPaywall}>
            <div className="sr-left">
              <span className="sr-icon">{isPremium ? "✅" : "⭐"}</span>
              <span className="sr-label">{isPremium ? "Premium active" : "Upgrade to Premium"}</span>
            </div>
            {!isPremium && <span className="sr-arrow">›</span>}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Privacy & Data</div>
        <div className="settings-card">
          <div className="settings-row" onClick={() => window.open("/privacy.html", "_blank")}>
            <div className="sr-left">
              <span className="sr-icon">🔒</span>
              <span className="sr-label">Privacy policy</span>
            </div>
            <span className="sr-arrow">›</span>
          </div>
          <div className="settings-row">
            <div className="sr-left">
              <span className="sr-icon">📱</span>
              <span className="sr-label">Data storage</span>
            </div>
            <span className="sr-value">On-device only</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Export</div>
        <div className="settings-card">
          <div className="settings-row" onClick={() => {
            if (!isPremium) { onShowPaywall(); return; }
            generateDoctorReport(logs, profile);
          }}>
            <div className="sr-left">
              <span className="sr-icon">📋</span>
              <span className="sr-label">Doctor report (PDF)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {!isPremium && <span className="sr-value" style={{ color: "var(--gold)" }}>Premium</span>}
              <span className="sr-arrow">›</span>
            </div>
          </div>
          <div className="settings-row" onClick={() => exportCSV(logs)}>
            <div className="sr-left">
              <span className="sr-icon">📊</span>
              <span className="sr-label">Export data (CSV)</span>
            </div>
            <span className="sr-arrow">›</span>
          </div>
        </div>
      </div>

      <button className="settings-danger-btn" onClick={onClearData}>
        Reset all data
      </button>

      <div className="settings-footer">
        <p>Vela v1.0.0</p>
        <p style={{ marginTop: 4 }}>
          Questions? <a href="mailto:support@velahealth.app">support@velahealth.app</a>
        </p>
        <p style={{ marginTop: 8, fontSize: 11 }}>
          Vela is not medical advice. Always consult your healthcare provider.
        </p>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [onboarded, setOnboarded] = useState(() => {
    return JSON.parse(localStorage.getItem("vela_onboarded") || "false");
  });
  const [screen, setScreen] = useState(() => {
    return JSON.parse(localStorage.getItem("vela_onboarded") || "false") ? "tracker" : "onboard";
  });
  const [logs, setLogs] = useState(() => {
    return JSON.parse(localStorage.getItem("vela_logs") || "[]");
  });
  const [profile, setProfile] = useState(() => {
    return JSON.parse(localStorage.getItem("vela_profile") || "null");
  });
  const [toast, setToast] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Inject global styles
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = css;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // Persist onboarded state
  useEffect(() => {
    localStorage.setItem("vela_onboarded", JSON.stringify(onboarded));
  }, [onboarded]);

  // Persist logs
  useEffect(() => {
    localStorage.setItem("vela_logs", JSON.stringify(logs));
  }, [logs]);

  function handleLog(entry) {
    const logEntry = { ...entry, date: new Date().toISOString() };
    setLogs((prev) => [logEntry, ...prev]);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  function handleOnboardComplete(answers) {
    localStorage.setItem("vela_profile", JSON.stringify(answers));
    setProfile(answers);
    setOnboarded(true);
    setScreen("tracker");
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
  }

  function handleBackFromEdit() {
    setEditingQuestion(null);
    setScreen("settings");
  }

  function handleClearData() {
    if (window.confirm("This will delete all your logs and profile data. This cannot be undone.")) {
      localStorage.removeItem("vela_logs");
      localStorage.removeItem("vela_profile");
      localStorage.removeItem("vela_onboarded");
      setLogs([]);
      setProfile(null);
      setOnboarded(false);
      setScreen("onboard");
    }
  }

  function handleSubscribe() {
    // TODO: Wire to RevenueCat purchasePackage() once configured
    // For now, simulate premium unlock for testing
    setIsPremium(true);
    setShowPaywall(false);
  }

  function handleRestore() {
    // TODO: Wire to RevenueCat restorePurchases() once configured
    setIsPremium(true);
    setShowPaywall(false);
  }

  const tabs = [
    { id: "tracker", label: "Today" },
    { id: "history", label: "History" },
    { id: "insights", label: "Insights" },
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
      {/* Nav — hidden during onboarding */}
      {onboarded && (
        <div className="nav">
          <div className="nav-logo">
            Ve<em>la</em>
          </div>
          <div className="nav-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`nav-tab${screen === t.id ? " active" : ""}`}
                onClick={() => setScreen(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Onboarding (shown when not onboarded) */}
      {!onboarded && (
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
      {onboarded && screen === "tracker" && <TrackerScreen onLog={handleLog} logs={logs} profile={profile} />}
      {onboarded && screen === "history" && <HistoryScreen logs={logs} />}
      {onboarded && screen === "insights" && (
        <InsightsScreen
          logs={logs}
          profile={profile}
          isPremium={isPremium}
          onShowPaywall={() => setShowPaywall(true)}
        />
      )}
      {onboarded && screen === "settings" && (
        <SettingsScreen
          profile={profile}
          logs={logs}
          isPremium={isPremium}
          onShowPaywall={() => setShowPaywall(true)}
          onEditQuestion={handleEditQuestion}
          onClearData={handleClearData}
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

      {/* Toast */}
      <div className={`toast${toast ? " show" : ""}`}>
        Entry logged! Keep it up. 🌿
      </div>
    </div>
  );
}

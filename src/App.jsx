import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
// import * as communityMod from "./community"; // Re-enable when LIVE_COMMUNITY=true
import { initAnalytics, track } from "./analytics";
import { initPurchases, checkSubscription, purchasePlan, restorePurchases, getAppUserId } from "./subscription";
import { readJSON as safeReadJSON } from "./safeStorage";
import { getThemePref, setTheme } from "./theme";
import {
  isHealthKitEnabled,
  enableHealthKit,
  disableHealthKit,
  fetchYesterdaySleep,
  // fetchYesterdayHRV — wired in the module, will surface in a future
  // Insights HRV-vs-symptom card. Skipped at the import site for now.
  getHealthKitStatus,
} from "./healthkit";
import {
  // Symptom-tile icons
  Flame, MoonStars, Bed, Brain, HeartHalf, BatteryLow, CloudLightning, Lightning,
  CloudMoon, Heartbeat, Question, ChatTeardrop, Target, Waveform, HourglassLow,
  Aperture, Sparkle, Bone, PersonSimple, Spiral, Snowflake, ArrowsClockwise,
  SpeakerHigh, Hand, Footprints, Drop, SunDim, Heart, Scales, DropHalfBottom,
  HeartBreak, Circle, Smiley, ArrowUp, ArrowRight, Repeat, Wind, Eye, Tooth, Bug,
  // UI / settings icons
  Flower, Palette, Bell, ListChecks, SunHorizon, Moon, Calendar, CheckCircle, Star,
  Lock, FileText, DeviceMobile, ChartBar, MagnifyingGlass, Flask, Lightbulb,
  FirstAidKit, ChatCircle, ChatCircleText, Sun, Gear,
  // Energy-chip icons
  BatteryEmpty, BatteryMedium, BatteryHigh, BatteryFull,
} from "@phosphor-icons/react";

// Phosphor icon registry for symptom tiles. Mature, sophisticated alternative
// to system emojis (which differ between iOS versions and read childish for
// the 45-55 audience). Duotone weight pairs with DM Serif Display + the
// earth palette without feeling like a generic dev-tool dashboard.
const SYMPTOM_ICONS = {
  Flame, MoonStars, Bed, Brain, HeartHalf, BatteryLow, CloudLightning, Lightning,
  CloudMoon, Heartbeat, Question, ChatTeardrop, Target, Waveform, HourglassLow,
  Aperture, Sparkle, Bone, PersonSimple, Spiral, Snowflake, ArrowsClockwise,
  SpeakerHigh, Hand, Footprints, Drop, SunDim, Heart, Scales, DropHalfBottom,
  HeartBreak, Circle, Smiley, ArrowUp, Repeat, Wind, Eye, Tooth, Bug,
};

function SymptomIcon({ name, size = 24, weight = "duotone", style }) {
  const Cmp = SYMPTOM_ICONS[name];
  // Fallback for custom user-defined symptoms (still using glyph string)
  if (!Cmp) {
    return <span style={{ fontSize: size, lineHeight: 1, ...style }}>{name}</span>;
  }
  return <Cmp size={size} weight={weight} style={style} />;
}

// UI icons (settings rows, energy chips, reveal carousel, theme toggle, etc.)
// Same Phosphor duotone treatment as SymptomIcon. We bundle every imported
// Phosphor name here so any UIIcon name="…" call resolves — the redesign
// refactor introduced new call sites (ArrowRight chevrons, pattern cards
// referencing Bed/Wind, onboarding chip icons) that previously rendered as
// empty squares because the registry was symptom-only.
const UI_ICONS = {
  // Original UI set
  Flower, Palette, Bell, ListChecks, SunHorizon, Moon, Calendar, CheckCircle, Star,
  Lock, FileText, DeviceMobile, ChartBar, MagnifyingGlass, Flask, Lightbulb,
  FirstAidKit, ChatCircle, ChatCircleText, Sun, Gear, Sparkle, Eye, Target, Brain,
  BatteryEmpty, BatteryLow, BatteryMedium, BatteryHigh, BatteryFull,
  // Chevrons / arrows used by row CTAs and the doctor-report card
  ArrowRight, ArrowUp,
  // Symptom-domain icons surfaced in pattern cards, shelf items, onboarding
  // chip selectors, and Today triggers
  Flame, MoonStars, Bed, HeartHalf, CloudLightning, Lightning, CloudMoon,
  Heartbeat, ChatTeardrop, Waveform, HourglassLow, Aperture, Bone, PersonSimple,
  Spiral, Snowflake, ArrowsClockwise, SpeakerHigh, Hand, Footprints, Drop, SunDim,
  Heart, Scales, DropHalfBottom, HeartBreak, Circle, Smiley, Repeat, Wind, Tooth,
  Bug, Question,
};

function UIIcon({ name, size = 22, weight = "duotone", style }) {
  const Cmp = UI_ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} weight={weight} style={style} />;
}

// Hand-drawn mood face — single SVG follows currentColor so the active state
// lights up in clay just like the rest of the system. Five expressive levels
// instead of system emojis (which look childish for the audience).
function MoodFace({ kind, size = 30 }) {
  const stroke = 7;
  const eye = (cx, cy) => <circle key={cx + ":" + cy} cx={cx} cy={cy} r="6" fill="currentColor" />;
  const mouths = {
    rough: <path d="M58 78 Q64 70 72 71 Q80 72 86 78" />,
    low:   <path d="M58 76 Q72 73 86 76" />,
    okay:  <path d="M58 74 L86 74" />,
    good:  <path d="M58 71 Q72 79 86 71" />,
    great: <path d="M56 68 Q72 86 88 68" />,
  };
  const eyeY = kind === "rough" || kind === "low" ? 56 : 54;
  return (
    <svg width={size} height={size} viewBox="0 0 144 144" aria-hidden="true">
      <circle cx="72" cy="72" r="58" fill="currentColor" opacity="0.16" />
      {eye(54, eyeY)}
      {eye(90, eyeY)}
      <g fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
        {mouths[kind]}
      </g>
    </svg>
  );
}

// Energy glyph — five ascending bars, filled count = level. Replaces the
// emoji battery progression with something that follows currentColor and
// scales cleanly at any size.
function EnergyGlyph({ level, size = 30 }) {
  const bars = 5;
  const barW = 5;
  const gap = 2;
  const totalW = bars * barW + (bars - 1) * gap;
  return (
    <svg width={size} height={(size * 22) / 30} viewBox={`0 0 ${totalW} 22`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const h = 4 + i * 3.5;
        const x = i * (barW + gap);
        const y = 20 - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx="1.5"
            fill="currentColor"
            opacity={i < level ? 0.95 : 0.16}
          />
        );
      })}
    </svg>
  );
}

// Mini bar chart for the reveal card. Pure SVG, brand-tinted via currentColor.
function RevealChart({ kind }) {
  if (kind === "none") return null;
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const buildData = [0, 1, 0, 0.7, 0.9, null, null];
  const richData  = [0.4, 0.6, 0.5, 0.85, 0.7, 0.95, 0.55];
  const data = kind === "build" ? buildData : richData;
  return (
    <div className="reveal-mini-chart">
      {data.map((v, i) => (
        <div
          key={i}
          className={`bar ${v === null ? "dim" : ""}`}
          style={{ height: `${(v ?? 0.18) * 100}%`, minHeight: 4 }}
        >
          <div className="cap" />
          <div className="label">{days[i]}</div>
        </div>
      ))}
    </div>
  );
}

function haptic(style = "Light") {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle[style] }).catch(() => {});
  }
}

// Icons are Phosphor component names (rendered via SymptomIcon at use sites,
// duotone weight). Custom user symptoms use the literal "✦" glyph.
const SYMPTOMS = [
  // Most common (shown first)
  { icon: "Flame", name: "Hot flash", cat: "common" },
  { icon: "MoonStars", name: "Night sweats", cat: "common" },
  { icon: "Bed", name: "Poor sleep", cat: "common" },
  { icon: "Brain", name: "Brain fog", cat: "common" },
  { icon: "HeartHalf", name: "Mood shifts", cat: "common" },
  { icon: "BatteryLow", name: "Fatigue", cat: "common" },
  { icon: "CloudLightning", name: "Anxiety", cat: "common" },
  { icon: "Lightning", name: "Irritability", cat: "common" },
  // Mood & cognitive
  { icon: "CloudMoon", name: "Depression", cat: "mood" },
  { icon: "Heartbeat", name: "Panic attacks", cat: "mood" },
  { icon: "Question", name: "Memory lapse", cat: "mood" },
  { icon: "ChatTeardrop", name: "Word-finding difficulty", cat: "mood" },
  { icon: "Target", name: "Difficulty concentrating", cat: "mood" },
  { icon: "Waveform", name: "Mood swings", cat: "mood" },
  { icon: "HourglassLow", name: "Low motivation", cat: "mood" },
  // Physical
  { icon: "Aperture", name: "Headache", cat: "physical" },
  { icon: "Sparkle", name: "Migraine", cat: "physical" },
  { icon: "Bone", name: "Joint pain", cat: "physical" },
  { icon: "PersonSimple", name: "Muscle aches", cat: "physical" },
  { icon: "PersonSimple", name: "Back pain", cat: "physical" },
  { icon: "Heartbeat", name: "Palpitations", cat: "physical" },
  { icon: "Snowflake", name: "Chills", cat: "physical" },
  { icon: "ArrowsClockwise", name: "Dizziness", cat: "physical" },
  { icon: "SpeakerHigh", name: "Tinnitus", cat: "physical" },
  { icon: "Hand", name: "Tingling/numbness", cat: "physical" },
  { icon: "Footprints", name: "Restless legs", cat: "physical" },
  { icon: "Drop", name: "Hair thinning", cat: "physical" },
  { icon: "SunDim", name: "Dry skin", cat: "physical" },
  { icon: "Heart", name: "Breast tenderness", cat: "physical" },
  { icon: "Scales", name: "Weight change", cat: "physical" },
  // Intimate health
  { icon: "Drop", name: "Vaginal dryness", cat: "intimate" },
  { icon: "Flame", name: "Vaginal irritation", cat: "intimate" },
  { icon: "HeartBreak", name: "Low libido", cat: "intimate" },
  { icon: "DropHalfBottom", name: "Urinary urgency", cat: "intimate" },
  { icon: "Drop", name: "Incontinence", cat: "intimate" },
  // Digestive
  { icon: "Circle", name: "Bloating", cat: "digestive" },
  { icon: "Smiley", name: "Nausea", cat: "digestive" },
  { icon: "ArrowUp", name: "Acid reflux", cat: "digestive" },
  { icon: "Repeat", name: "Digestive changes", cat: "digestive" },
  // Other
  { icon: "Wind", name: "Shortness of breath", cat: "other" },
  { icon: "Drop", name: "Dry mouth", cat: "other" },
  { icon: "Eye", name: "Dry eyes", cat: "other" },
  { icon: "Tooth", name: "Gum problems", cat: "other" },
  { icon: "Bug", name: "Crawling skin", cat: "other" },
];

// Each option has: label (canonical, persisted by index), icon (Phosphor),
// hint (shown beneath label in onboarding). Indices are stable for backwards
// compat with stored vela_profile arrays.
const QUESTIONS = [
  {
    text: "Where are you in your hormonal journey?",
    eyebrow: "About you",
    headline: <>Where are you in the <em>transition?</em></>,
    sub: "There's no right answer — and you can change this any time. We use it to surface what's most relevant for your stage.",
    opts: [
      { label: "Still having regular periods", hint: "Cycles haven't shifted yet", icon: "Flower" },
      { label: "Periods are irregular (perimenopause)", hint: "Cycles still happen, but they're shifting", icon: "Sparkle" },
      { label: "No period for 12+ months", hint: "Well past the transition", icon: "SunHorizon" },
      { label: "Post-surgical menopause", hint: "Hysterectomy, cancer treatment, or other", icon: "FirstAidKit" },
    ],
  },
  {
    text: "Which symptoms bother you most?",
    multi: true,
    eyebrow: "What's on your mind",
    headline: <>What would you most like to <em>understand?</em></>,
    sub: "Pick up to five. We'll prioritize these on your daily check-in — everything else is one tap away.",
    max: 5,
    opts: [
      { label: "Hot flashes & night sweats", icon: "Flame" },
      { label: "Sleep problems", icon: "Bed" },
      { label: "Mood changes & anxiety", icon: "HeartHalf" },
      { label: "Brain fog & fatigue", icon: "Brain" },
      { label: "Joint pain & body aches", icon: "Bone" },
      { label: "Weight changes & bloating", icon: "Scales" },
      { label: "Low libido & dryness", icon: "Drop" },
      { label: "Heart palpitations", icon: "Heartbeat" },
    ],
  },
  {
    text: "What's your main goal with Vela?",
    multi: true,
    eyebrow: "Why you're here",
    headline: <>What would feel like a <em>good outcome?</em></>,
    sub: "Choose what matters most right now. We'll tune insights, prompts, and exports around it.",
    opts: [
      { label: "Understand what's happening to my body", hint: "Make sense of the patterns", icon: "MagnifyingGlass" },
      { label: "Track symptoms to show my doctor", hint: "Bring real data to appointments", icon: "FirstAidKit" },
      { label: "Find relief strategies", hint: "Test small changes, see what helps", icon: "Flask" },
      { label: "Connect with others going through this", hint: "Hear from others on the same path", icon: "ChatCircleText" },
    ],
  },
  {
    text: "How do you prefer to receive guidance?",
    eyebrow: "How we'll show up",
    headline: <>How much should Vela <em>nudge you?</em></>,
    sub: "You can always change this. The most consistent users tend to choose 'gentle daily' — but if you'd rather come to us, that works too.",
    opts: [
      { label: "Daily check-ins & reminders", hint: "A morning and evening nudge", icon: "Sun" },
      { label: "Weekly summaries", hint: "Sundays only — no pressure", icon: "Calendar" },
      { label: "Only when I ask", hint: "I'll come to the app", icon: "Hand" },
      { label: "Let the app decide", hint: "Adapt to how I'm using it", icon: "Sparkle" },
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

// Helper: get YYYY-MM-DD in local timezone (avoids UTC date shift bug)
function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getStreak(logs) {
  if (logs.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  const freezes = (() => { try { return JSON.parse(localStorage.getItem("vela_streak_freezes") || "[]"); } catch { return []; } })();
  for (let i = 0; i <= 120; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = localDateStr(d);
    const hasLog = logs.some((l) => l.date.slice(0, 10) === dayStr);
    const isFrozen = freezes.includes(dayStr);
    if (hasLog) streak++;
    else if (isFrozen && i > 0) streak++; // freeze counts as a streak day
    else if (i > 0) break;
    else break; // today with no log and no freeze
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

// ─── Profile-Based Personalization Engine ─────────────────────────────────────

function getPersonalization(profile) {
  if (!profile) return null;

  const stage = profile[0]; // 0=regular, 1=peri, 2=post, 3=surgical
  const concerns = Array.isArray(profile[1]) ? profile[1] : (profile[1] !== null && profile[1] !== undefined ? [profile[1]] : []);
  const goals = Array.isArray(profile[2]) ? profile[2] : (profile[2] !== null && profile[2] !== undefined ? [profile[2]] : []);
  const guidance = profile[3] ?? 3;

  // Concern indices: 0=hot flashes, 1=sleep, 2=mood, 3=brain fog, 4=joint pain, 5=weight, 6=libido, 7=palpitations

  // Map concerns to default symptom category
  const concernToCat = { 0: "common", 1: "common", 2: "mood", 3: "mood", 4: "physical", 5: "digestive", 6: "intimate", 7: "physical" };
  const defaultSymptomCat = concerns.length > 0 ? (concernToCat[concerns[0]] || "common") : "common";

  // Map concerns to recommended CBT program
  const concernToCBT = { 0: "cbt-hot-flashes", 1: "cbt-sleep", 2: "cbt-anxiety", 3: "cbt-anxiety", 7: "cbt-anxiety" };
  const recommendedCBT = concerns.map((c) => concernToCBT[c]).filter(Boolean);

  // Map concerns to recommended experiment order
  const concernToExp = {
    0: ["no-caffeine-7", "no-alcohol-14", "stress-mgmt-7"],
    1: ["sleep-hygiene-7", "no-caffeine-7", "stress-mgmt-7"],
    2: ["stress-mgmt-7", "exercise-7", "mood-journal-7"],
    3: ["sleep-hygiene-7", "exercise-7", "hydration-7"],
    4: ["exercise-7", "hydration-7", "stress-mgmt-7"],
    5: ["exercise-7", "no-alcohol-14", "hydration-7"],
    6: ["stress-mgmt-7", "exercise-7", "sleep-hygiene-7"],
    7: ["stress-mgmt-7", "no-caffeine-7", "exercise-7"],
  };
  const expPriority = [...new Set(concerns.flatMap((c) => concernToExp[c] || []))].slice(0, 3);

  // Stage-aware greeting subtitles
  const stageMessages = [
    "Your cycle patterns matter — tracking now builds a baseline for what's ahead.",
    "Your body is changing — every log helps you understand and navigate this transition.",
    "You've crossed the threshold — tracking helps optimize this new chapter.",
    "Your journey is unique — Vela adapts to your specific experience.",
  ];
  const stageMessage = stageMessages[stage] || stageMessages[1];

  // Goal-driven feature emphasis
  // 0=understand body, 1=track for doctor, 2=find relief, 3=connect with others
  const wantsDoctor = goals.includes(1);
  const wantsRelief = goals.includes(2);
  const wantsCommunity = goals.includes(3);
  const wantsUnderstanding = goals.includes(0);

  // Personalized welcome after onboarding
  const concernNames = {
    0: "hot flashes", 1: "sleep", 2: "mood", 3: "brain fog",
    4: "joint pain", 5: "weight", 6: "intimate health", 7: "palpitations",
  };
  const topConcernNames = concerns.slice(0, 2).map((c) => concernNames[c]).filter(Boolean);

  // Personalized companion greeting
  const companionGreeting = topConcernNames.length > 0
    ? `I'm here to help you understand your ${topConcernNames.join(" and ")} patterns. Ask me anything about your logged data.`
    : "I'm here to help you understand your symptom patterns. Ask me anything about your logged data.";

  return {
    stage, concerns, goals, guidance,
    defaultSymptomCat,
    recommendedCBT: [...new Set(recommendedCBT)],
    expPriority: [...new Set(expPriority)],
    stageMessage,
    wantsDoctor, wantsRelief, wantsCommunity, wantsUnderstanding,
    topConcernNames,
    companionGreeting,
  };
}

function computeEarlyStats(logs) {
  if (logs.length === 0) return null;
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const moodLogs = logs.filter((l) => l.mood !== null && l.mood !== undefined);
  const avgMood = moodLogs.length > 0 ? moodLogs.reduce((s, l) => s + l.mood, 0) / moodLogs.length : null;
  const energyLogs = logs.filter((l) => l.energy !== null && l.energy !== undefined);
  const avgEnergy = energyLogs.length > 0 ? energyLogs.reduce((s, l) => s + l.energy, 0) / energyLogs.length : null;
  const symptomCounts = {};
  logs.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; }));
  const sortedSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]);
  const topSymptom = sortedSymptoms[0] || null;
  const uniqueSymptomCount = sortedSymptoms.length;
  return { uniqueDays, avgMood, avgEnergy, topSymptom, uniqueSymptomCount, symptomCounts };
}

function analyzePatterns(logs) {
  if (logs.length < 7) return [];
  const patterns = [];
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byDate = {};
  logs.forEach((l) => {
    const d = l.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  });
  const dates = Object.keys(byDate).sort();
  const symptomNames = [...new Set(logs.flatMap((l) => Object.keys(l.symptoms || {})))];

  // Pattern 1: Symptom follows another symptom
  const followPatterns = [];
  symptomNames.forEach((target) => {
    symptomNames.forEach((trigger) => {
      if (target === trigger) return;
      let afterTrigger = 0, afterTriggerTotal = 0, noTrigger = 0, noTriggerTotal = 0;
      for (let i = 1; i < dates.length; i++) {
        const prevSyms = byDate[dates[i - 1]].flatMap((l) => Object.keys(l.symptoms || {}));
        const todaySyms = byDate[dates[i]].flatMap((l) => Object.keys(l.symptoms || {}));
        if (prevSyms.includes(trigger)) { afterTriggerTotal++; if (todaySyms.includes(target)) afterTrigger++; }
        else { noTriggerTotal++; if (todaySyms.includes(target)) noTrigger++; }
      }
      if (afterTriggerTotal >= 3 && afterTrigger / afterTriggerTotal > 0.6) {
        const ratio = (afterTrigger / afterTriggerTotal) / ((noTrigger / Math.max(noTriggerTotal, 1)) || 0.1);
        if (ratio >= 2) followPatterns.push({ ratio, text: `You logged ${target.toLowerCase()} ${Math.round(ratio)}x more on days after ${trigger.toLowerCase()}` });
      }
    });
  });
  followPatterns.sort((a, b) => b.ratio - a.ratio);
  if (followPatterns[0]) patterns.push(followPatterns[0].text);

  // Pattern 2: Symptom peaks on a weekday
  const weekdayCounts = {};
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  dates.forEach((d) => {
    const dow = new Date(d + "T12:00:00").getDay();
    weekdayTotals[dow]++;
    const syms = [...new Set(byDate[d].flatMap((l) => Object.keys(l.symptoms || {})))];
    syms.forEach((s) => {
      if (!weekdayCounts[s]) weekdayCounts[s] = [0, 0, 0, 0, 0, 0, 0];
      weekdayCounts[s][dow]++;
    });
  });
  let bestWeekday = null;
  Object.entries(weekdayCounts).forEach(([symptom, counts]) => {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total < 3) return;
    counts.forEach((c, dow) => {
      if (weekdayTotals[dow] < 2) return;
      const rate = c / weekdayTotals[dow];
      const avgRate = total / dates.length;
      if (rate > avgRate * 1.5 && c >= 2) {
        const score = rate / Math.max(avgRate, 0.1);
        if (!bestWeekday || score > bestWeekday.score) bestWeekday = { score, text: `${symptom} appeared most often on ${DAY_NAMES[dow]}s in your logs` };
      }
    });
  });
  if (bestWeekday) patterns.push(bestWeekday.text);

  // Pattern 3: Mood vs symptom count
  const moodDays = dates.filter((d) => byDate[d].some((l) => l.mood !== null && l.mood !== undefined));
  if (moodDays.length >= 5) {
    let highSymLow = 0, lowSymHigh = 0, total = 0;
    const avgSym = moodDays.reduce((s, d) => s + byDate[d].reduce((ss, l) => ss + Object.keys(l.symptoms || {}).length, 0), 0) / moodDays.length;
    moodDays.forEach((d) => {
      const symCount = byDate[d].reduce((s, l) => s + Object.keys(l.symptoms || {}).length, 0);
      const avgMood = byDate[d].filter((l) => l.mood !== null).reduce((s, l) => s + l.mood, 0) / byDate[d].filter((l) => l.mood !== null).length;
      if (symCount > avgSym && avgMood < 2) highSymLow++;
      if (symCount < avgSym && avgMood >= 3) lowSymHigh++;
      total++;
    });
    if ((highSymLow + lowSymHigh) / total > 0.4) patterns.push("Your mood averages higher on days you log fewer symptoms");
  }

  // Pattern 4: Co-occurring symptoms
  const coOccur = {};
  dates.forEach((d) => {
    const syms = [...new Set(byDate[d].flatMap((l) => Object.keys(l.symptoms || {})))];
    for (let i = 0; i < syms.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        const key = [syms[i], syms[j]].sort().join("|");
        coOccur[key] = (coOccur[key] || 0) + 1;
      }
    }
  });
  const topCo = Object.entries(coOccur).sort((a, b) => b[1] - a[1])[0];
  if (topCo && topCo[1] >= 3 && patterns.length < 3) {
    const [a, b] = topCo[0].split("|");
    patterns.push(`${a} and ${b} appeared together on ${topCo[1]} days`);
  }
  return patterns.slice(0, 3);
}


// ─── Weekly Summary (Premium) ───────────────────────────────────────────
// Computes a quiet "your week" snapshot: 7 days back vs the 7 days before
// that. Returns deltas + a 1-paragraph plain-language summary. Designed
// to be opened from a Sunday-ready card on Insights and (eventually)
// from a tapped weekly notification.
function buildWeeklySummary(logs) {
  if (!logs || logs.length === 0) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 7);
  const fourteenAgo = new Date(now); fourteenAgo.setDate(fourteenAgo.getDate() - 14);

  const inWindow = (l, a, b) => {
    const d = new Date(l.date); d.setHours(0, 0, 0, 0);
    return d >= a && d < b;
  };
  const week = logs.filter((l) => inWindow(l, sevenAgo, now));
  const prior = logs.filter((l) => inWindow(l, fourteenAgo, sevenAgo));

  if (week.length === 0) return null;

  // Symptom counts
  const tally = (set) => {
    const c = {};
    set.forEach((l) => {
      const seen = new Set();
      Object.keys(l.symptoms || {}).forEach((s) => seen.add(s));
      seen.forEach((s) => { c[s] = (c[s] || 0) + 1; });
    });
    return c;
  };
  const wCounts = tally(week);
  const pCounts = tally(prior);
  const topSymptoms = Object.entries(wCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sym, count]) => ({
      sym,
      count,
      prior: pCounts[sym] || 0,
      delta: count - (pCounts[sym] || 0),
      icon: SYMPTOMS.find((s) => s.name === sym)?.icon,
    }));

  // Mood
  const moodAvg = (set) => {
    const m = set.filter((l) => l.mood !== null && l.mood !== undefined);
    return m.length === 0 ? null : { avg: m.reduce((s, l) => s + l.mood, 0) / m.length, samples: m.length };
  };
  const wMood = moodAvg(week);
  const pMood = moodAvg(prior);
  const moodDelta = (wMood && pMood) ? wMood.avg - pMood.avg : null;

  // Sleep
  const sleepAvg = (set) => {
    const s = set.filter((l) => l.context && l.context.sleepHours !== null && l.context.sleepHours !== undefined);
    return s.length === 0 ? null : { avg: s.reduce((sum, l) => sum + l.context.sleepHours, 0) / s.length, samples: s.length };
  };
  const wSleep = sleepAvg(week);
  const pSleep = sleepAvg(prior);
  const sleepDelta = (wSleep && pSleep) ? wSleep.avg - pSleep.avg : null;

  // Period days this week
  const periodDays = week.filter((l) => l.context && l.context.period && l.context.period !== "none").length;

  // Stress
  const stressAvg = (set) => {
    const s = set.filter((l) => l.context && l.context.stress !== null && l.context.stress !== undefined);
    return s.length === 0 ? null : s.reduce((sum, l) => sum + l.context.stress, 0) / s.length;
  };
  const wStress = stressAvg(week);
  const pStress = stressAvg(prior);

  // Build the plain-language paragraph
  const moodLabels = ["rough", "low", "okay", "good", "great"];
  const parts = [];
  const uniqueDays = new Set(week.map((l) => l.date.slice(0, 10))).size;
  parts.push(`You logged ${uniqueDays} of 7 days.`);
  if (topSymptoms[0]) {
    const t = topSymptoms[0];
    if (t.delta < 0) parts.push(`${t.sym} was your top symptom (${t.count} days) — down from ${t.prior} the week before.`);
    else if (t.delta > 0) parts.push(`${t.sym} showed up most (${t.count} days, up from ${t.prior}).`);
    else parts.push(`${t.sym} showed up most (${t.count} days, same as the week before).`);
  }
  if (wMood && wMood.samples >= 3) {
    const lbl = moodLabels[Math.round(wMood.avg)];
    if (moodDelta !== null && Math.abs(moodDelta) >= 0.4) {
      parts.push(`Mood averaged ${lbl} — ${moodDelta > 0 ? "lifted" : "dipped"} from the week before.`);
    } else {
      parts.push(`Mood averaged ${lbl}.`);
    }
  }
  if (wSleep && wSleep.samples >= 3) {
    if (sleepDelta !== null && Math.abs(sleepDelta) >= 0.4) {
      parts.push(`Sleep averaged ${wSleep.avg.toFixed(1)}h — ${sleepDelta > 0 ? "more" : "less"} than the week before.`);
    } else {
      parts.push(`Sleep held around ${wSleep.avg.toFixed(1)}h.`);
    }
  }

  return {
    windowStart: sevenAgo.toISOString().slice(0, 10),
    windowEnd: now.toISOString().slice(0, 10),
    daysLogged: uniqueDays,
    topSymptoms,
    mood: wMood ? { avg: wMood.avg, label: moodLabels[Math.round(wMood.avg)], delta: moodDelta, samples: wMood.samples } : null,
    sleep: wSleep ? { avg: wSleep.avg, delta: sleepDelta, samples: wSleep.samples } : null,
    stress: wStress != null ? { avg: wStress, delta: pStress != null ? wStress - pStress : null } : null,
    periodDays,
    summary: parts.join(" "),
  };
}

// ─── Ask Vela monthly soft-cap (client-side hint) ───────────────────────
// The real per-24h limit is enforced server-side. This is just a local
// counter that prevents pointless round-trips and shows the user a
// "X of Y left" indicator in the sheet so the limit doesn't feel
// arbitrary when they hit it.
const ASK_VELA_MONTHLY_CAP = 60;
const ASK_VELA_COUNT_KEY = "vela_ask_monthly_count";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthlyCount() {
  try {
    const raw = JSON.parse(localStorage.getItem(ASK_VELA_COUNT_KEY) || "null");
    if (!raw || raw.month !== currentMonthKey()) return 0;
    return raw.count || 0;
  } catch { return 0; }
}

function checkAndUpdateMonthlyCap() {
  const month = currentMonthKey();
  let raw;
  try { raw = JSON.parse(localStorage.getItem(ASK_VELA_COUNT_KEY) || "null"); } catch { raw = null; }
  if (!raw || raw.month !== month) raw = { month, count: 0 };
  if (raw.count >= ASK_VELA_MONTHLY_CAP) {
    const next = new Date();
    next.setMonth(next.getMonth() + 1, 1);
    return {
      ok: false,
      resetsOn: next.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
    };
  }
  raw.count += 1;
  try { localStorage.setItem(ASK_VELA_COUNT_KEY, JSON.stringify(raw)); } catch { /* private mode */ }
  return { ok: true, count: raw.count };
}

function bumpMonthlyCapTo(target) {
  const month = currentMonthKey();
  try { localStorage.setItem(ASK_VELA_COUNT_KEY, JSON.stringify({ month, count: target })); } catch {}
}

// ─── Anonymized summary for Ask Vela API ────────────────────────────────
// Strips notes (free-text), exact dates, custom symptom names, location.
// Returns an aggregated, sliced view that the model can reason about
// without seeing anything personally identifying.
function buildAskVelaSummary(logs) {
  if (!logs || logs.length === 0) return { daysLogged: 0 };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const thirtyAgo = new Date(now); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const recent = logs.filter((l) => new Date(l.date) >= thirtyAgo);

  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const lastEntry = logs.length > 0 ? new Date(logs[logs.length - 1].date) : null;
  const lastEntryDaysAgo = lastEntry ? Math.floor((now - lastEntry) / (1000 * 60 * 60 * 24)) : null;

  // Symptom counts (last 30 days)
  const symptomCounts = {};
  recent.forEach((l) => {
    Object.keys(l.symptoms || {}).forEach((s) => {
      // Skip custom user symptoms (stored as raw glyph) to avoid
      // leaking anything personal
      if (typeof s === "string" && s.length < 40) {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      }
    });
  });

  // Mood/sleep/stress aggregates
  const moodSamples = recent.filter((l) => l.mood !== null && l.mood !== undefined);
  const avgMood = moodSamples.length ? moodSamples.reduce((s, l) => s + l.mood, 0) / moodSamples.length : null;
  const moodLabels = ["Rough", "Low", "Okay", "Good", "Great"];
  const avgMoodLabel = avgMood !== null ? moodLabels[Math.round(avgMood)] : null;

  const sleepSamples = recent.filter((l) => l.context && l.context.sleepHours !== null && l.context.sleepHours !== undefined);
  const avgSleep = sleepSamples.length ? sleepSamples.reduce((s, l) => s + l.context.sleepHours, 0) / sleepSamples.length : null;
  const stressSamples = recent.filter((l) => l.context && l.context.stress !== null && l.context.stress !== undefined);
  const avgStress = stressSamples.length ? stressSamples.reduce((s, l) => s + l.context.stress, 0) / stressSamples.length : null;

  // Reuse the correlation engine output as plain-language strings
  const corr = analyzeCorrelations(logs).slice(0, 6).map((c) => c.text);

  // Cycle prediction snapshot if present
  const cp = predictNextCycle(logs);
  const cyclePrediction = (cp && cp.cyclesLogged >= 2) ? {
    cyclesLogged: cp.cyclesLogged,
    cycleLengthMean: cp.cycleLengthMean,
    cycleLengthStddev: cp.cycleLengthStddev,
    windowStart: cp.windowStart,
    windowEnd: cp.windowEnd,
  } : null;

  // Active experiments summary
  const experiments = (() => { try { return JSON.parse(localStorage.getItem("vela_experiments") || "[]"); } catch { return []; } })();
  const activeExperiments = experiments.filter((e) => e.status === "active").map((e) => {
    const start = new Date(e.startDate + "T00:00:00");
    const day = Math.min(e.duration, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);
    return { name: e.name, day, duration: e.duration };
  });

  return {
    daysLogged: logs.length,
    uniqueDays,
    lastEntryDaysAgo,
    symptomCounts,
    avgMood,
    avgMoodLabel,
    avgSleep,
    avgStress,
    correlations: corr,
    cyclePrediction,
    activeExperiments,
  };
}

function analyzeCorrelations(logs) {
  const contextLogs = logs.filter((l) => l.context && Object.values(l.context).some((v) => v !== null));
  if (contextLogs.length < 14) return [];
  const byDate = {};
  contextLogs.forEach((l) => {
    const d = l.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = { context: { ...l.context }, symptoms: {}, mood: null };
    Object.keys(l.symptoms || {}).forEach((s) => { byDate[d].symptoms[s] = true; });
    if (l.mood !== null && l.mood !== undefined) byDate[d].mood = l.mood;
    if (l.context) Object.entries(l.context).forEach(([k, v]) => { if (v !== null && byDate[d].context[k] === null) byDate[d].context[k] = v; });
  });
  const days = Object.values(byDate);
  const allSymptoms = [...new Set(days.flatMap((d) => Object.keys(d.symptoms)))];
  const insights = [];

  // Boolean triggers
  ["caffeine", "alcohol", "exercise"].forEach((trigger) => {
    const withT = days.filter((d) => d.context[trigger] === true);
    const withoutT = days.filter((d) => d.context[trigger] !== true);
    if (withT.length < 5 || withoutT.length < 5) return;
    allSymptoms.forEach((symptom) => {
      const rateW = withT.filter((d) => d.symptoms[symptom]).length / withT.length;
      const rateWO = withoutT.filter((d) => d.symptoms[symptom]).length / withoutT.length;
      if (rateWO > 0.05 && rateW / rateWO >= 2.0) {
        insights.push({ score: rateW / rateWO, text: `${symptom} appeared ${(rateW / rateWO).toFixed(1)}x more often on days you logged ${trigger === "exercise" ? "exercise" : trigger}`, icon: trigger === "caffeine" ? "☕" : trigger === "alcohol" ? "🍷" : "🏃" });
      }
      if (trigger === "exercise" && rateWO > 0.1 && rateW < rateWO * 0.5) {
        insights.push({ score: rateWO / Math.max(rateW, 0.05), text: `${symptom} appeared ${(rateWO / Math.max(rateW, 0.05)).toFixed(1)}x less often on days you logged exercise`, icon: "🏃" });
      }
    });
    const moodW = withT.filter((d) => d.mood !== null);
    const moodWO = withoutT.filter((d) => d.mood !== null);
    if (moodW.length >= 5 && moodWO.length >= 5) {
      const avgW = moodW.reduce((s, d) => s + d.mood, 0) / moodW.length;
      const avgWO = moodWO.reduce((s, d) => s + d.mood, 0) / moodWO.length;
      const delta = avgW - avgWO;
      if (Math.abs(delta) >= 0.5) {
        insights.push({ score: Math.abs(delta), text: `Your mood averages ${Math.abs(delta).toFixed(1)} points ${delta > 0 ? "higher" : "lower"} on days you ${trigger === "exercise" ? "exercise" : `have ${trigger}`}`, icon: trigger === "caffeine" ? "☕" : trigger === "alcohol" ? "🍷" : "🏃" });
      }
    }
  });

  // Sleep < 6 hours
  const sleepLow = days.filter((d) => d.context.sleepHours !== null && d.context.sleepHours < 6);
  const sleepOk = days.filter((d) => d.context.sleepHours !== null && d.context.sleepHours >= 6);
  if (sleepLow.length >= 5 && sleepOk.length >= 5) {
    allSymptoms.forEach((symptom) => {
      const rL = sleepLow.filter((d) => d.symptoms[symptom]).length / sleepLow.length;
      const rO = sleepOk.filter((d) => d.symptoms[symptom]).length / sleepOk.length;
      if (rO > 0.05 && rL / rO >= 2.0) {
        insights.push({ score: rL / rO, text: `${symptom} appeared ${(rL / rO).toFixed(1)}x more often after nights with less than 6 hours of sleep`, icon: "🛏️" });
      }
    });
  }

  // Stress >= 4
  const stressHi = days.filter((d) => d.context.stress !== null && d.context.stress >= 4);
  const stressLo = days.filter((d) => d.context.stress !== null && d.context.stress < 4);
  if (stressHi.length >= 5 && stressLo.length >= 5) {
    allSymptoms.forEach((symptom) => {
      const rH = stressHi.filter((d) => d.symptoms[symptom]).length / stressHi.length;
      const rL = stressLo.filter((d) => d.symptoms[symptom]).length / stressLo.length;
      if (rL > 0.05 && rH / rL >= 2.0) {
        insights.push({ score: rH / rL, text: `${symptom} appeared ${(rH / rL).toFixed(1)}x more often on high-stress days`, icon: "😤" });
      }
    });
  }

  return insights.sort((a, b) => b.score - a.score).slice(0, 4);
}

// ─── Cycle prediction (Premium) ──────────────────────────────────────────
// Looks at logged period flow days, infers cycle starts (transition from
// non-period → period day-1), computes mean cycle length + spread, and
// predicts the next likely period window. Returns null when there isn't
// enough signal — never invents a window from < 2 cycles.
//
// For perimenopausal users with irregular cycles, the *spread* matters as
// much as the mean: we always show a 5-day window centered on the next
// expected start (or wider if their stddev is high).
function predictNextCycle(logs) {
  if (!logs || logs.length === 0) return null;

  // Collect period day-1 starts. A "start" = first day of a period after
  // ≥ 3 non-period days. We sort by date and walk forward.
  const dayMap = new Map(); // dateStr -> hasPeriod boolean
  logs.forEach((l) => {
    const d = l.date.slice(0, 10);
    const isPeriod = !!(l.context && l.context.period && l.context.period !== "none");
    // OR across multiple logs same day
    dayMap.set(d, dayMap.get(d) || isPeriod);
  });
  const sortedDays = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, hasPeriod]) => ({ date, hasPeriod }));

  // Find day-1 starts: a hasPeriod=true day preceded by a hasPeriod=false day
  // (allowing for log gaps — we treat unlogged days as non-period)
  const starts = [];
  for (let i = 0; i < sortedDays.length; i++) {
    if (!sortedDays[i].hasPeriod) continue;
    // Check the previous logged day; if it was period or we're at start, skip
    if (i > 0 && sortedDays[i - 1].hasPeriod) {
      // Was previous logged day adjacent (within 1 day)? If yes, this is mid-period
      const prevD = new Date(sortedDays[i - 1].date);
      const curD = new Date(sortedDays[i].date);
      const gap = (curD - prevD) / (1000 * 60 * 60 * 24);
      if (gap <= 1) continue; // adjacent period day — not a new cycle
    }
    starts.push(sortedDays[i].date);
  }

  if (starts.length < 2) {
    // Need at least 2 cycles to predict the next one
    return {
      hasData: starts.length === 1,
      lastStart: starts[0] || null,
      cyclesLogged: starts.length,
      reason: starts.length === 0
        ? "Log your period for 2+ cycles and Vela will predict the next."
        : "One cycle logged. After your next period, Vela will start predicting.",
    };
  }

  // Compute cycle lengths
  const lengths = [];
  for (let i = 1; i < starts.length; i++) {
    const a = new Date(starts[i - 1]);
    const b = new Date(starts[i]);
    const days = Math.round((b - a) / (1000 * 60 * 60 * 24));
    if (days >= 14 && days <= 90) lengths.push(days); // sanity bounds
  }
  if (lengths.length === 0) return { hasData: true, lastStart: starts[starts.length - 1], cyclesLogged: starts.length, reason: "Cycle gaps look unusual — keep logging and we'll try again." };

  const mean = lengths.reduce((s, x) => s + x, 0) / lengths.length;
  const variance = lengths.reduce((s, x) => s + (x - mean) ** 2, 0) / lengths.length;
  const stddev = Math.sqrt(variance);

  // Predicted next start = last start + mean cycle length
  const lastStart = new Date(starts[starts.length - 1]);
  const predictedDate = new Date(lastStart);
  predictedDate.setDate(predictedDate.getDate() + Math.round(mean));

  // Window: ± max(2, ceil(stddev)) days around predicted center, clamped to [2, 7]
  const windowSpread = Math.min(7, Math.max(2, Math.ceil(stddev)));
  const windowStart = new Date(predictedDate);
  windowStart.setDate(windowStart.getDate() - windowSpread);
  const windowEnd = new Date(predictedDate);
  windowEnd.setDate(windowEnd.getDate() + windowSpread);

  // Confidence label
  const confidence =
    lengths.length >= 4 && stddev <= 3 ? "high" :
    lengths.length >= 3 && stddev <= 6 ? "medium" : "low";

  // Days from today
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((predictedDate - today) / (1000 * 60 * 60 * 24));

  return {
    hasData: true,
    cyclesLogged: starts.length,
    cycleLengthMean: Math.round(mean),
    cycleLengthStddev: Math.round(stddev * 10) / 10,
    lastStart: starts[starts.length - 1],
    predictedDate: predictedDate.toISOString().slice(0, 10),
    windowStart: windowStart.toISOString().slice(0, 10),
    windowEnd: windowEnd.toISOString().slice(0, 10),
    windowSpread,
    daysUntil,
    confidence,
  };
}

// ─── Experiments engine (Premium) ────────────────────────────────────────
// Compares symptom frequency during an experiment window vs the equivalent
// window immediately before. Returns plain-language deltas — never claims
// causation.
const EXPERIMENT_LIBRARY = [
  {
    id: "caffeine_cutoff",
    name: "Caffeine cutoff at 1 pm",
    desc: "No coffee/tea after 1 pm. Vela will compare your night sweats and sleep against the prior week.",
    duration: 7,
    icon: "Sparkle",
    targets: ["Hot flash", "Night sweats", "Poor sleep"],
    contextKey: "caffeine",
    contextExpect: false, // expect caffeine=false during the experiment
  },
  {
    id: "evening_walks",
    name: "Evening walks for 10 days",
    desc: "A 20-minute walk after dinner. We'll watch mood, sleep, and brain fog.",
    duration: 10,
    icon: "Footprints",
    targets: ["Brain fog", "Anxiety", "Poor sleep"],
    contextKey: "exercise",
    contextExpect: true,
  },
  {
    id: "no_alcohol",
    name: "No alcohol for 14 days",
    desc: "Two weeks dry. Vela tracks night sweats, sleep quality, and mood swings.",
    duration: 14,
    icon: "Drop",
    targets: ["Night sweats", "Hot flash", "Mood shifts"],
    contextKey: "alcohol",
    contextExpect: false,
  },
  {
    id: "consistent_bedtime",
    name: "Consistent bedtime window",
    desc: "Pick a 30-minute bedtime window and stick to it for 10 days. We'll watch sleep hours and morning mood.",
    duration: 10,
    icon: "MoonStars",
    targets: ["Poor sleep", "Fatigue"],
    contextKey: "sleepHours",
    contextExpect: "high",
  },
  {
    id: "magnesium",
    name: "Magnesium glycinate at bedtime",
    desc: "200-400 mg, 30 minutes before sleep. Vela compares sleep and night sweats vs the prior week. Check with your doctor first.",
    duration: 14,
    icon: "Sparkle",
    targets: ["Poor sleep", "Night sweats", "Restless legs"],
    contextKey: null,
    contextExpect: null,
  },
  {
    id: "morning_protein",
    name: "30g protein at breakfast",
    desc: "Two weeks of front-loaded protein. We'll watch fatigue and brain fog through the afternoon.",
    duration: 14,
    icon: "Heart",
    targets: ["Fatigue", "Brain fog"],
    contextKey: null,
    contextExpect: null,
  },
];

function compareExperiment(experiment, logs) {
  const start = new Date(experiment.startDate); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + experiment.duration);
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - experiment.duration);

  const inWindow = (l, a, b) => {
    const d = new Date(l.date); d.setHours(0, 0, 0, 0);
    return d >= a && d < b;
  };
  const during = logs.filter((l) => inWindow(l, start, end));
  const prior = logs.filter((l) => inWindow(l, prevStart, start));

  const tally = (set) => {
    const c = {};
    set.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { c[s] = (c[s] || 0) + 1; }));
    return c;
  };
  const dCounts = tally(during);
  const pCounts = tally(prior);

  // Deltas for the experiment's target symptoms
  const targets = (experiment.targets || []).map((sym) => {
    const d = dCounts[sym] || 0;
    const p = pCounts[sym] || 0;
    const delta = d - p;
    let summary;
    if (p === 0 && d === 0) summary = "no change — neither week showed it";
    else if (p === 0 && d > 0) summary = `appeared ${d}x — wasn't there the week before`;
    else if (d === 0 && p > 0) summary = `gone — appeared ${p}x the week before`;
    else summary = `${delta > 0 ? "+" : ""}${delta} (${d} vs ${p})`;
    return { symptom: sym, during: d, prior: p, delta, summary };
  });

  // Average mood delta
  const moodAvg = (set) => {
    const m = set.filter((l) => l.mood !== null && l.mood !== undefined);
    return m.length === 0 ? null : m.reduce((s, l) => s + l.mood, 0) / m.length;
  };
  const moodD = moodAvg(during);
  const moodP = moodAvg(prior);
  const moodDelta = (moodD !== null && moodP !== null) ? moodD - moodP : null;

  return {
    daysLogged: { during: during.length, prior: prior.length },
    targets,
    moodDelta,
    sampleOk: during.length >= Math.max(3, Math.floor(experiment.duration / 3)),
  };
}

// ─── Personalized experiment suggestions (Premium) ──────────────────────
// Reads detected correlations from analyzeCorrelations() and the user's
// top symptoms, then maps them to relevant experiments from
// EXPERIMENT_LIBRARY. Returns up to 3 suggestions, sorted by confidence.
//
// Each suggestion includes the *reason* — e.g. "Hot flash appeared 3x
// more on caffeine days" → suggest the caffeine cutoff. The reason
// becomes the headline so the user understands why it's there.
//
// Skips experiments that are already running or recently completed
// (within 30 days) to avoid suggesting the same thing twice.
function suggestExperiments(logs, experiments = []) {
  if (!logs || logs.length < 7) return [];

  const correlations = analyzeCorrelations(logs);
  const suggestions = [];

  // Track what's already in flight or recently tried, so we don't repeat
  const thirtyAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const blockedLibIds = new Set();
  experiments.forEach((e) => {
    if (e.status === "active") blockedLibIds.add(e.libraryId);
    if (e.status === "completed" && e.endedAt && new Date(e.endedAt).getTime() > thirtyAgo) {
      blockedLibIds.add(e.libraryId);
    }
  });

  const tryAdd = (libraryId, reason, confidence) => {
    if (blockedLibIds.has(libraryId)) return;
    if (suggestions.some((s) => s.library.id === libraryId)) return;
    const lib = EXPERIMENT_LIBRARY.find((l) => l.id === libraryId);
    if (!lib) return;
    suggestions.push({ library: lib, reason, confidence });
  };

  // ── Map correlation findings to experiments ──
  correlations.forEach((c) => {
    const text = c.text.toLowerCase();
    const conf = Math.min(3, Math.max(1, Math.round(c.score)));
    if (text.includes("caffeine")) {
      tryAdd("caffeine_cutoff", c.text, conf);
    }
    if (text.includes("alcohol")) {
      tryAdd("no_alcohol", c.text, conf);
    }
    if (text.includes("less than 6 hours") || text.includes("hours of sleep")) {
      tryAdd("consistent_bedtime", c.text, conf);
    }
    if (text.includes("exercise") && text.includes("less often")) {
      // Positive correlation: exercise days had fewer symptoms — reinforce
      tryAdd("evening_walks", c.text, conf);
    }
  });

  // ── Heuristic suggestions when correlations don't cover top symptoms ──
  // Tally the user's last-30-day symptom load and suggest experiments
  // that target what's actually showing up — even when we can't yet
  // attribute it to a specific trigger.
  const now = Date.now();
  const thirtyAgoTs = now - 30 * 24 * 60 * 60 * 1000;
  const recent = logs.filter((l) => new Date(l.date).getTime() >= thirtyAgoTs);
  const symFreq = {};
  recent.forEach((l) => {
    const seen = new Set();
    Object.keys(l.symptoms || {}).forEach((s) => seen.add(s));
    seen.forEach((s) => { symFreq[s] = (symFreq[s] || 0) + 1; });
  });
  const top = Object.entries(symFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s);

  if (top.includes("Poor sleep") || top.includes("Night sweats")) {
    tryAdd("magnesium", `${top.includes("Poor sleep") ? "Poor sleep" : "Night sweats"} has been your top symptom recently`, 1);
  }
  if (top.includes("Brain fog") || top.includes("Fatigue")) {
    tryAdd("morning_protein", `${top.includes("Brain fog") ? "Brain fog" : "Fatigue"} keeps showing up — protein at breakfast is a low-effort variable to test`, 1);
  }
  if (top.some((s) => ["Anxiety", "Mood shifts", "Mood swings"].includes(s))) {
    tryAdd("evening_walks", `Mood and anxiety days are frequent — evening walks are one of the most consistently-studied levers`, 1);
  }

  // Sort by confidence (correlation-driven outranks heuristic)
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

const REMINDER_MESSAGES = {
  morning: { title: "Good morning", body: "How are you feeling today? Take a moment to log with Vela" },
  evening: { title: "Evening check-in", body: "How was your day? A quick log helps Vela spot patterns for you" },
  weekly: { title: "Your weekly summary", body: "Your Vela insights are ready. See how your week went" },
};

async function getLocalNotifications() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return mod.LocalNotifications;
  } catch { return null; }
}

async function cancelAllReminders() {
  const LN = await getLocalNotifications();
  if (!LN) return;
  try { await LN.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] }); } catch {}
}

async function scheduleReminders(prefIndex, times) {
  const LN = await getLocalNotifications();
  if (!LN) return;
  const perm = await LN.requestPermissions();
  if (perm.display !== "granted") return;
  await cancelAllReminders();
  const t = times || { morning: "09:00", evening: "20:00", weekly: "10:00" };
  const notifications = [];
  const [mH, mM] = t.morning.split(":").map(Number);
  const [eH, eM] = t.evening.split(":").map(Number);
  const [wH, wM] = t.weekly.split(":").map(Number);

  if (prefIndex === 0) {
    // Daily check-ins: morning + evening
    notifications.push({ id: 1, title: REMINDER_MESSAGES.morning.title, body: REMINDER_MESSAGES.morning.body, schedule: { on: { hour: mH, minute: mM }, repeats: true } });
    notifications.push({ id: 2, title: REMINDER_MESSAGES.evening.title, body: REMINDER_MESSAGES.evening.body, schedule: { on: { hour: eH, minute: eM }, repeats: true } });
  } else if (prefIndex === 1) {
    // Weekly summaries: Sunday morning
    notifications.push({ id: 3, title: REMINDER_MESSAGES.weekly.title, body: REMINDER_MESSAGES.weekly.body, schedule: { on: { weekday: 1, hour: wH, minute: wM }, repeats: true } });
  } else if (prefIndex === 2) {
    // Only when I ask: nothing
    return;
  } else {
    // Let the app decide: evening only
    notifications.push({ id: 2, title: REMINDER_MESSAGES.evening.title, body: REMINDER_MESSAGES.evening.body, schedule: { on: { hour: eH, minute: eM }, repeats: true } });
  }
  try { await LN.schedule({ notifications }); } catch {}
}

function generateTalkingPoints(logs, profile) {
  if (logs.length < 3) return null;
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const recent = logs.filter((l) => new Date(l.date) >= thirtyAgo);
  if (recent.length === 0) return null;
  const points = [];
  const symCounts = {};
  recent.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { symCounts[s] = (symCounts[s] || 0) + 1; }));
  const top3 = Object.entries(symCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top3.length) points.push(`Most frequent symptoms (30 days): ${top3.map(([n, c]) => `${n} (${c}x)`).join(", ")}`);

  // Worsening trends
  const fifteenAgo = new Date(); fifteenAgo.setDate(fifteenAgo.getDate() - 15);
  const first = recent.filter((l) => new Date(l.date) < fifteenAgo);
  const second = recent.filter((l) => new Date(l.date) >= fifteenAgo);
  if (first.length > 0 && second.length > 0) {
    const cnt = (arr) => { const c = {}; arr.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { c[s] = (c[s] || 0) + 1; })); return c; };
    const f = cnt(first), s2 = cnt(second);
    const worsening = Object.keys(s2).filter((s) => (s2[s] || 0) > (f[s] || 0) * 1.5 && s2[s] >= 3).slice(0, 2);
    if (worsening.length) points.push(`Worsening recently: ${worsening.join(", ")}`);
  }

  // Mood trajectory
  const moods = recent.filter((l) => l.mood !== null && l.mood !== undefined).sort((a, b) => a.date.localeCompare(b.date));
  if (moods.length >= 4) {
    const half = Math.floor(moods.length / 2);
    const firstAvg = moods.slice(0, half).reduce((s, l) => s + l.mood, 0) / half;
    const secondAvg = moods.slice(half).reduce((s, l) => s + l.mood, 0) / (moods.length - half);
    const delta = secondAvg - firstAvg;
    points.push(`Mood trend: ${Math.abs(delta) > 0.3 ? (delta > 0 ? "improving" : "declining") : "stable"} over the past 30 days`);
  }

  // Suggested questions
  const questions = [];
  const topNames = top3.map(([n]) => n.toLowerCase());
  if (topNames.some((n) => n.includes("hot flash") || n.includes("night sweat"))) questions.push("Should I consider hormone therapy for vasomotor symptoms?");
  if (topNames.some((n) => n.includes("sleep") || n.includes("fatigue"))) questions.push("Could my sleep issues be related to hormonal changes?");
  if (topNames.some((n) => n.includes("anxiety") || n.includes("mood"))) questions.push("Are these mood changes hormonal, and when might they stabilize?");
  if (topNames.some((n) => n.includes("joint"))) questions.push("Could my joint pain be estrogen-related?");
  if (topNames.some((n) => n.includes("brain fog") || n.includes("memory"))) questions.push("Is cognitive change during menopause typically temporary?");
  if (questions.length === 0) questions.push("Based on my symptom patterns, what treatment options would you recommend?");
  const correlations = analyzeCorrelations(logs);
  if (correlations.length > 0) points.push(`Notable triggers: ${correlations.slice(0, 2).map((c) => c.text).join("; ")}`);
  return { points, questions: questions.slice(0, 3) };
}

// ─── AI Analysis Functions ───────────────────────────────────────────────────

function analyzeSymptomTrend(logs, symptomName) {
  const now = new Date();
  const recent = logs.filter((l) => {
    const d = new Date(l.date);
    return (now - d) / 86400000 <= 14;
  });
  const prev = logs.filter((l) => {
    const d = new Date(l.date);
    const days = (now - d) / 86400000;
    return days > 14 && days <= 28;
  });
  const hasSymptom = (l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptomName.toLowerCase()));
  const countIn = (arr) => arr.filter(hasSymptom).length;
  const sevIn = (arr) => {
    let total = 0, count = 0;
    arr.forEach((l) => {
      const match = Object.keys(l.symptoms || {}).find((s) => s.toLowerCase().includes(symptomName.toLowerCase()));
      if (match) { total += (l.severities?.[match] || 5); count++; }
    });
    return count > 0 ? total / count : 0;
  };
  const recentCount = countIn(recent);
  const prevCount = countIn(prev);
  const recentSev = sevIn(recent);
  const prevSev = sevIn(prev);
  const trend = recentCount > prevCount ? "increasing" : recentCount < prevCount ? "decreasing" : "stable";
  return { symptomName, recentCount, prevCount, recentSev: Math.round(recentSev * 10) / 10, prevSev: Math.round(prevSev * 10) / 10, trend, recentDays: recent.length, prevDays: prev.length };
}

function analyzeTriggerImpact(logs, triggerName) {
  const lower = triggerName.toLowerCase();
  const hasTrigger = (l) => {
    const ctx = l.context || {};
    if (lower === "caffeine" || lower === "alcohol" || lower === "smoking") return ctx.triggers && ctx.triggers[lower];
    if (lower === "exercise") return ctx.triggers?.exercise;
    if (lower === "poor sleep" || lower === "sleep") return ctx.sleep === "poor" || ctx.sleep === "terrible";
    if (lower === "stress") return ctx.stress === "high" || ctx.stress === "extreme";
    if (lower === "sugar" || lower === "spicy") return ctx.triggers?.[lower];
    return false;
  };
  const withTrigger = logs.filter(hasTrigger);
  const without = logs.filter((l) => !hasTrigger(l));
  const avgSymptoms = (arr) => arr.length === 0 ? 0 : arr.reduce((s, l) => s + Object.keys(l.symptoms || {}).length, 0) / arr.length;
  const avgMood = (arr) => { const m = arr.filter((l) => l.mood !== null && l.mood !== undefined); return m.length === 0 ? 0 : m.reduce((s, l) => s + l.mood, 0) / m.length; };
  const avgEnergy = (arr) => { const e = arr.filter((l) => l.energy !== null && l.energy !== undefined); return e.length === 0 ? null : Math.round(e.reduce((s, l) => s + l.energy, 0) / e.length * 10) / 10; };
  return {
    triggerName,
    daysWithTrigger: withTrigger.length,
    daysWithout: without.length,
    avgSymptomsWith: Math.round(avgSymptoms(withTrigger) * 10) / 10,
    avgSymptomsWithout: Math.round(avgSymptoms(without) * 10) / 10,
    avgMoodWith: Math.round(avgMood(withTrigger) * 10) / 10,
    avgMoodWithout: Math.round(avgMood(without) * 10) / 10,
    avgEnergyWith: avgEnergy(withTrigger),
    avgEnergyWithout: avgEnergy(without),
    impact: avgSymptoms(withTrigger) > avgSymptoms(without) ? "worsens" : avgSymptoms(withTrigger) < avgSymptoms(without) ? "helps" : "neutral"
  };
}

function analyzeOverallTrend(logs) {
  const now = new Date();
  const recent = logs.filter((l) => (now - new Date(l.date)) / 86400000 <= 14);
  const prev = logs.filter((l) => { const d = (now - new Date(l.date)) / 86400000; return d > 14 && d <= 28; });
  const avg = (arr, fn) => arr.length === 0 ? 0 : arr.reduce((s, l) => s + fn(l), 0) / arr.length;
  const recentSymptoms = avg(recent, (l) => Object.keys(l.symptoms || {}).length);
  const prevSymptoms = avg(prev, (l) => Object.keys(l.symptoms || {}).length);
  const recentMood = avg(recent.filter((l) => l.mood !== null && l.mood !== undefined), (l) => l.mood);
  const prevMood = avg(prev.filter((l) => l.mood !== null && l.mood !== undefined), (l) => l.mood);
  const recentEnergy = avg(recent.filter((l) => l.energy !== null && l.energy !== undefined), (l) => l.energy);
  const prevEnergy = avg(prev.filter((l) => l.energy !== null && l.energy !== undefined), (l) => l.energy);
  const direction = recentSymptoms < prevSymptoms && recentMood >= prevMood ? "improving" : recentSymptoms > prevSymptoms || recentMood < prevMood ? "worse" : "stable";
  return {
    recentSymptoms: Math.round(recentSymptoms * 10) / 10,
    prevSymptoms: Math.round(prevSymptoms * 10) / 10,
    recentMood: Math.round(recentMood * 10) / 10,
    prevMood: Math.round(prevMood * 10) / 10,
    recentEnergy: Math.round(recentEnergy * 10) / 10,
    prevEnergy: Math.round(prevEnergy * 10) / 10,
    direction,
    recentDays: recent.length,
    prevDays: prev.length
  };
}

function analyzeBestWorstDays(logs) {
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const buckets = DOW.map(() => ({ moods: [], symptoms: [], energies: [] }));
  logs.forEach((l) => {
    const day = new Date(l.date).getDay();
    if (l.mood !== null && l.mood !== undefined) buckets[day].moods.push(l.mood);
    if (l.energy !== null && l.energy !== undefined) buckets[day].energies.push(l.energy);
    buckets[day].symptoms.push(Object.keys(l.symptoms || {}).length);
  });
  const stats = DOW.map((name, i) => ({
    day: name,
    avgMood: buckets[i].moods.length > 0 ? Math.round(buckets[i].moods.reduce((a, b) => a + b, 0) / buckets[i].moods.length * 10) / 10 : null,
    avgSymptoms: buckets[i].symptoms.length > 0 ? Math.round(buckets[i].symptoms.reduce((a, b) => a + b, 0) / buckets[i].symptoms.length * 10) / 10 : null,
    avgEnergy: buckets[i].energies.length > 0 ? Math.round(buckets[i].energies.reduce((a, b) => a + b, 0) / buckets[i].energies.length * 10) / 10 : null,
    entries: buckets[i].symptoms.length
  })).filter((s) => s.entries > 0);
  const best = [...stats].sort((a, b) => (b.avgMood || 0) - (a.avgMood || 0))[0];
  const worst = [...stats].sort((a, b) => (a.avgMood || 0) - (b.avgMood || 0))[0];
  return { stats, best, worst };
}

function analyzeRecentPattern(logs) {
  const now = new Date();
  const week = logs.filter((l) => (now - new Date(l.date)) / 86400000 <= 7);
  if (week.length === 0) return null;
  const symptomCounts = {};
  const contextCounts = {};
  let moodSum = 0, moodCount = 0, energySum = 0, energyCount = 0, bestDay = null, worstDay = null;
  week.forEach((l) => {
    Object.keys(l.symptoms || {}).forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
    const ctx = l.context || {};
    if (ctx.sleep) contextCounts[`Sleep: ${ctx.sleep}`] = (contextCounts[`Sleep: ${ctx.sleep}`] || 0) + 1;
    if (ctx.stress) contextCounts[`Stress: ${ctx.stress}`] = (contextCounts[`Stress: ${ctx.stress}`] || 0) + 1;
    if (ctx.triggers) Object.keys(ctx.triggers).filter((k) => ctx.triggers[k]).forEach((t) => { contextCounts[t] = (contextCounts[t] || 0) + 1; });
    if (l.mood !== null && l.mood !== undefined) {
      moodSum += l.mood; moodCount++;
      if (!bestDay || l.mood > bestDay.mood) bestDay = { date: l.date, mood: l.mood };
      if (!worstDay || l.mood < worstDay.mood) worstDay = { date: l.date, mood: l.mood };
    }
    if (l.energy !== null && l.energy !== undefined) { energySum += l.energy; energyCount++; }
  });
  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
  const topContext = Object.entries(contextCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
  return { daysLogged: week.length, avgMood: moodCount > 0 ? Math.round(moodSum / moodCount * 10) / 10 : null, avgEnergy: energyCount > 0 ? Math.round(energySum / energyCount * 10) / 10 : null, topSymptoms, topContext, bestDay, worstDay };
}

function generateDoctorSummary(logs, profile) {
  const talkingPoints = generateTalkingPoints(logs, profile);
  const correlations = analyzeCorrelations(logs);
  const trend = analyzeOverallTrend(logs);
  const recent = analyzeRecentPattern(logs);
  return {
    ...talkingPoints,
    correlations: correlations.slice(0, 5),
    trend,
    recentSnapshot: recent,
    journeyStage: profile ? getJourneyLabel(profile[0]) : null
  };
}

// ─── AI Question Matching & Response Generation ──────────────────────────────

const AI_SYMPTOM_NAMES = [
  "hot flash", "night sweat", "poor sleep", "brain fog", "mood shift", "fatigue",
  "anxiety", "irritability", "depression", "panic attack", "memory lapse",
  "word-finding", "difficulty concentrating", "mood swing", "low motivation",
  "headache", "migraine", "joint pain", "muscle ache", "back pain", "palpitation",
  "chill", "dizziness", "tinnitus", "tingling", "numbness", "restless leg",
  "hair thinning", "hair loss", "dry skin", "breast tenderness", "weight change",
  "weight gain", "vaginal dryness", "vaginal irritation", "low libido", "libido",
  "urinary urgency", "incontinence", "bloating", "nausea", "acid reflux",
  "digestive", "shortness of breath", "dry mouth", "dry eye", "gum problem",
  "crawling skin", "insomnia", "heart palpitation", "memory"
];
const AI_TRIGGER_NAMES = ["caffeine", "alcohol", "exercise", "sleep", "stress", "sugar", "spicy", "smoking"];

// Conversational context for follow-ups (module-level, persists during session)
let _lastHandler = null;
let _lastParam = null;

// ─── Evidence-Based Knowledge Base ─────────────────────────────────────────
// Sources: NAMS (North American Menopause Society), NHS, Mayo Clinic,
// Cochrane reviews, Journal of Midlife Health, Menopause journal

const SYMPTOM_KNOWLEDGE = {
  "hot flash": {
    prevalence: "Up to 80% of women experience hot flashes, making them the most common menopause symptom.",
    science: "Hot flashes are caused by changes in the hypothalamus (your body's thermostat) as estrogen levels fluctuate. The brain briefly misreads your body temperature and triggers a cooling response.",
    strategies: ["Layered clothing and keeping a room cool (68°F/20°C) can reduce frequency.", "Deep slow breathing (6-8 breaths/min) at the onset has been shown to reduce hot flash intensity in clinical trials.", "CBT for hot flashes has strong evidence — it doesn't reduce frequency but significantly reduces how bothersome they feel.", "Regular aerobic exercise improves overall quality of life during menopause. Its direct effect on hot flash frequency is still debated, but many women report benefit."],
    stages: { perimenopause: "Hot flashes often peak in late perimenopause and the first 1-2 years after your final period.", postmenopause: "For most women, hot flashes gradually decrease over 2-5 years, though about 10% experience them for a decade or more.", surgical: "Surgical menopause often causes more sudden and intense hot flashes because estrogen drops rapidly rather than gradually." },
    whenToSeeDoc: "If hot flashes are disrupting sleep or daily life, ask your provider about hormone therapy (HT) — it's the most effective treatment, with clinical trials showing up to a 75% reduction in hot flash frequency."
  },
  "night sweat": {
    prevalence: "Night sweats affect up to 75% of menopausal women — they're essentially hot flashes that happen during sleep.",
    science: "Like hot flashes, they're driven by hormonal changes affecting your thermoregulatory center. They tend to be worse in the first half of the night.",
    strategies: ["Moisture-wicking sleepwear and breathable bedding (cotton, bamboo) make a measurable difference.", "Keep bedroom temperature at 65-68°F (18-20°C) — cooler than most people think.", "Avoiding alcohol and spicy foods within 3 hours of bed has been shown to reduce night sweats.", "A cooling pillow or bedside fan directed at the upper body can help."],
    stages: { perimenopause: "Night sweats often increase as you get deeper into perimenopause.", postmenopause: "They typically improve within 2-3 years post-menopause, but everyone's timeline is different.", surgical: "Night sweats may be more intense after surgical menopause and can benefit significantly from HT." },
    whenToSeeDoc: "If night sweats are causing chronic sleep disruption, this is worth discussing — poor sleep compounds nearly every other menopause symptom."
  },
  "brain fog": {
    prevalence: "About 60% of women report cognitive changes during the menopause transition — you're not imagining it.",
    science: "Estrogen plays a key role in the prefrontal cortex and hippocampus. As levels fluctuate, you may notice word-finding difficulty, forgetfulness, and trouble concentrating. Research shows this is typically temporary.",
    strategies: ["Prioritizing sleep quality has the strongest evidence for improving cognitive function during menopause.", "Regular aerobic exercise increases blood flow to the brain and has been shown to improve cognitive performance.", "Breaking tasks into smaller chunks and using lists/reminders isn't giving up — it's a smart adaptation.", "Omega-3 fatty acids and a Mediterranean-style diet are associated with better cognitive function in midlife women."],
    stages: { perimenopause: "Brain fog tends to be worst during perimenopause when hormones fluctuate most. The good news: research shows cognition typically recovers in postmenopause.", postmenopause: "Most women find cognitive function stabilizes and often improves in postmenopause as hormone levels settle.", surgical: "Cognitive changes after surgical menopause can be more pronounced — discuss HT timing with your provider." },
    whenToSeeDoc: "If cognitive changes are affecting your work or daily functioning, mention it to your provider. They can rule out other causes (thyroid, B12, sleep apnea) and discuss treatment options."
  },
  "fatigue": {
    prevalence: "Fatigue affects up to 85% of menopausal women — it's one of the most common but least discussed symptoms.",
    science: "Menopause-related fatigue is multifactorial: disrupted sleep, hormonal shifts affecting energy metabolism, and the cumulative toll of other symptoms like night sweats and anxiety.",
    strategies: ["Address sleep quality first — it's the #1 lever for energy. Even small improvements in sleep make a big difference.", "Regular moderate exercise paradoxically increases energy levels. Start with 15-20 minute walks if energy is very low.", "Iron and B12 levels are worth checking — deficiencies are common in midlife women and easily treated.", "Consistent wake times (even on weekends) help regulate your circadian rhythm and improve energy."],
    stages: { perimenopause: "Fluctuating hormones can cause unpredictable energy crashes. Tracking patterns (like you're doing) helps identify your best times of day.", postmenopause: "Energy often stabilizes in postmenopause. If fatigue persists, thyroid function is worth checking.", surgical: "Post-surgical fatigue can be significant — your body is recovering from both surgery and sudden hormone changes." },
    whenToSeeDoc: "If fatigue is severe or persistent, ask about thyroid function, iron/ferritin, B12, and vitamin D levels — these are common, treatable contributors."
  },
  "anxiety": {
    prevalence: "Up to 51% of women aged 40-55 experience increased anxiety during the menopause transition, even those with no prior history.",
    science: "Estrogen modulates serotonin and norepinephrine, while progesterone has a calming effect via GABA receptors. As both hormones fluctuate during the menopause transition, anxiety can spike — even in women with no prior history. This is a physiological response, not a personal failing.",
    strategies: ["Deep breathing exercises (4-7-8 technique: inhale 4s, hold 7s, exhale 8s) activate the parasympathetic nervous system.", "Regular exercise has strong evidence for reducing anxiety — as effective as medication for mild-moderate cases.", "CBT has been shown to be particularly effective for menopause-related anxiety.", "Limiting caffeine can help — sensitivity often increases during menopause."],
    stages: { perimenopause: "Anxiety often peaks during perimenopause when hormone fluctuations are greatest. It's one of the symptoms most likely to improve with time.", postmenopause: "Many women find anxiety decreases significantly in postmenopause as hormones stabilize.", surgical: "Anxiety after surgical menopause can be intense due to the sudden hormone drop — don't hesitate to seek support." },
    whenToSeeDoc: "If anxiety is interfering with daily life, relationships, or sleep, talk to your provider. Both HT and targeted medications can be very effective."
  },
  "joint pain": {
    prevalence: "Joint pain affects more than 50% of menopausal women — it's far more common than most people realize.",
    science: "Estrogen has anti-inflammatory properties and helps maintain joint cartilage and synovial fluid. As estrogen declines, joints can become stiffer and more painful, particularly in the hands, knees, and hips.",
    strategies: ["Regular movement — even gentle stretching and walking — helps maintain joint lubrication and flexibility.", "Anti-inflammatory foods (fatty fish, berries, leafy greens, turmeric) may help reduce joint inflammation.", "Strength training builds muscle around joints, providing better support and reducing pain.", "Maintaining a healthy weight reduces stress on weight-bearing joints."],
    stages: { perimenopause: "Joint pain often appears in perimenopause and can be one of the first noticeable symptoms.", postmenopause: "For some women, HT can significantly improve joint symptoms — it's worth discussing.", surgical: "Joint symptoms may be more sudden after surgical menopause due to rapid estrogen decline." },
    whenToSeeDoc: "If joint pain is new, persistent, or limiting your activity, see your provider. They can distinguish menopause-related joint changes from other conditions like inflammatory arthritis."
  },
  "poor sleep": {
    prevalence: "Up to 60% of menopausal women report sleep disturbances — it's one of the most impactful symptoms.",
    science: "Estrogen and progesterone both play roles in sleep regulation. Night sweats, anxiety, and changes in melatonin production all contribute to disrupted sleep during menopause.",
    strategies: ["Keep a consistent sleep schedule — your circadian rhythm becomes more sensitive during menopause.", "Avoid screens 1 hour before bed — blue light suppresses melatonin, which already decreases with age.", "Cool, dark, quiet bedroom environment. Temperature is especially important during menopause.", "Magnesium glycinate (200-400mg before bed) has evidence for improving sleep quality in midlife women."],
    stages: { perimenopause: "Sleep disruption often worsens as perimenopause progresses, particularly due to night sweats and anxiety.", postmenopause: "Sleep typically improves in later postmenopause, though it may not fully return to pre-menopausal patterns.", surgical: "Sleep disruption after surgical menopause can be significant — HT often helps substantially." },
    whenToSeeDoc: "If sleep issues persist despite good sleep hygiene, discuss with your provider. They can screen for sleep apnea (risk increases after menopause) and discuss treatment options."
  },
  "irritability": {
    prevalence: "Irritability and mood changes affect up to 70% of women during the menopause transition.",
    science: "Estrogen fluctuations affect serotonin, dopamine, and norepinephrine — all key mood regulators. Add sleep disruption and other symptoms on top, and irritability is a natural response.",
    strategies: ["Regular exercise is one of the most effective mood regulators — even a 20-minute walk can help.", "Mindfulness and stress-reduction techniques have strong evidence for mood management during menopause.", "Adequate sleep is crucial — irritability and sleep deprivation are closely linked.", "Communicate with family/friends about what you're experiencing. Understanding helps everyone."],
    stages: { perimenopause: "Mood fluctuations tend to be most intense during perimenopause, particularly in the 1-2 years before your final period.", postmenopause: "Most women find mood stabilizes in postmenopause as hormones settle.", surgical: "Mood changes after surgical menopause can be intense — HT may help significantly." },
    whenToSeeDoc: "If irritability is affecting your relationships or quality of life, talk to your provider. Both HT and certain antidepressants (SSRIs/SNRIs) can help."
  },
  "depression": {
    prevalence: "Women are 2-4 times more likely to experience depression during the menopause transition compared to premenopause.",
    science: "Estrogen modulates serotonin receptors and production. The hormonal instability of perimenopause can trigger depressive episodes even in women with no prior history. This is not 'just hormones' — it's a real neurochemical change.",
    strategies: ["Exercise has strong evidence for treating mild-moderate depression — aim for 150 minutes/week of moderate activity.", "Social connection is protective. Isolation worsens depression — lean into your support network.", "Sunlight exposure (especially morning light) helps regulate mood-related neurotransmitters.", "CBT and mindfulness-based therapies have strong evidence for menopause-related mood changes."],
    stages: { perimenopause: "Depression risk peaks during the menopause transition, particularly in late perimenopause.", postmenopause: "Depression risk typically decreases in later postmenopause.", surgical: "Risk of depression is elevated after surgical menopause — proactive treatment planning is important." },
    whenToSeeDoc: "Please reach out to your healthcare provider. Depression during menopause is highly treatable with therapy, medication, or HT — you don't have to push through this alone."
  },
  "palpitation": {
    prevalence: "Heart palpitations affect about 25-40% of menopausal women and are usually harmless, though they can be alarming.",
    science: "Estrogen helps regulate heart rhythm. As levels fluctuate, you may notice your heart racing, skipping beats, or pounding — often during or after a hot flash.",
    strategies: ["Deep breathing during an episode can help slow your heart rate.", "Reducing caffeine and alcohol can decrease palpitation frequency.", "Regular exercise strengthens your cardiovascular system and can reduce episodes.", "Staying hydrated is important — dehydration can trigger palpitations."],
    stages: { perimenopause: "Palpitations tend to be most common during perimenopause when hormones fluctuate most.", postmenopause: "They typically decrease as hormone levels stabilize.", surgical: "Palpitations may be more frequent immediately after surgical menopause." },
    whenToSeeDoc: "While menopause-related palpitations are usually benign, any new palpitations should be evaluated by your provider to rule out cardiac causes."
  },
  "headache": {
    prevalence: "About 30-40% of menopausal women experience increased headaches or migraines.",
    science: "Estrogen withdrawal can trigger headaches and migraines. Women who had menstrual migraines are particularly susceptible during perimenopause.",
    strategies: ["Staying hydrated — dehydration is a common and easily fixable headache trigger.", "Regular sleep schedule helps prevent hormone-related headaches.", "Magnesium supplementation (400mg/day) has evidence for migraine prevention.", "Identify your personal triggers through tracking — that's exactly what you're doing here."],
    stages: { perimenopause: "Headaches often worsen during perimenopause due to fluctuating estrogen.", postmenopause: "Many women — especially migraine sufferers — find significant improvement in postmenopause.", surgical: "Headache patterns can change after surgical menopause and may respond well to stable HT." },
    whenToSeeDoc: "If headaches are new, changing in pattern, or not responding to over-the-counter treatment, see your provider."
  },
  "weight change": {
    prevalence: "Women gain an average of 5-8 pounds during the menopause transition, with a shift toward abdominal fat storage.",
    science: "Declining estrogen changes how your body stores fat (more abdominally), reduces metabolic rate by about 50 calories/day, and can increase appetite through hormonal signals.",
    strategies: ["Strength training is especially important — it counteracts the muscle loss that slows metabolism.", "Protein intake (20-30g per meal) helps maintain muscle mass and promotes satiety.", "Focus on body composition rather than scale weight — muscle weighs more than fat.", "A Mediterranean-style eating pattern has the best evidence for midlife weight management."],
    stages: { perimenopause: "Weight shifts often begin in perimenopause as metabolic changes take effect.", postmenopause: "Metabolic rate continues to decrease, making strength training increasingly important.", surgical: "Rapid hormone changes can accelerate metabolic shifts — early intervention with exercise helps." },
    whenToSeeDoc: "If you're experiencing rapid or unexplained weight changes, check thyroid function and discuss metabolic health with your provider."
  },
  "low libido": {
    prevalence: "Up to 52% of women report decreased sexual desire during menopause — it's one of the most common but least discussed symptoms.",
    science: "Both estrogen and testosterone decline during menopause, affecting desire, arousal, and physical comfort. Vaginal dryness, fatigue, mood changes, and body image can also contribute.",
    strategies: ["Vaginal moisturizers (used regularly) and lubricants (during intimacy) can address physical discomfort.", "Open communication with your partner about changes reduces pressure and improves connection.", "Regular physical activity boosts body confidence and increases blood flow.", "Pelvic floor exercises can improve sexual function and sensation."],
    stages: { perimenopause: "Desire may fluctuate unpredictably along with hormones.", postmenopause: "Low estrogen and testosterone can reduce desire, but many women find satisfying solutions.", surgical: "Libido changes can be more abrupt after surgical menopause." },
    whenToSeeDoc: "If this is bothering you, discuss with your provider. Local estrogen therapy is very effective and safe for vaginal symptoms, and testosterone therapy may help with desire."
  },
  "vaginal dryness": {
    prevalence: "Up to 50% of postmenopausal women experience vaginal dryness, though many don't report it to their doctor.",
    science: "Estrogen maintains vaginal tissue elasticity, moisture, and pH. As estrogen declines, tissues can become thinner, drier, and more susceptible to irritation and infection.",
    strategies: ["Regular use of vaginal moisturizers (not just lubricants) helps maintain tissue health.", "Sexual activity (including solo) helps maintain blood flow and tissue elasticity.", "Avoid irritating products — scented soaps, douches, and some laundry detergents.", "Stay well hydrated — it helps all mucous membranes."],
    stages: { perimenopause: "Vaginal changes often begin in late perimenopause.", postmenopause: "Unlike hot flashes, vaginal symptoms typically don't improve on their own and may worsen without treatment.", surgical: "Changes can be more rapid after surgical menopause." },
    whenToSeeDoc: "Local vaginal estrogen therapy is considered safe and highly effective — even for women who can't take systemic HT. Ask your provider about it."
  },
  "bloating": {
    prevalence: "Bloating and digestive changes are reported by about 40% of menopausal women.",
    science: "Estrogen and progesterone influence gut motility, water retention, and the gut microbiome. Fluctuating hormones can cause bloating, gas, and changes in bowel habits.",
    strategies: ["Eat smaller, more frequent meals rather than large ones.", "Probiotics and fermented foods may help support your changing gut microbiome.", "Stay hydrated and increase fiber gradually — too much too fast worsens bloating.", "Regular physical activity helps maintain healthy gut motility."],
    stages: { perimenopause: "Bloating often fluctuates with hormonal cycles during perimenopause.", postmenopause: "Digestive symptoms usually stabilize in postmenopause.", surgical: "Digestive changes can occur as the body adjusts to new hormone levels." },
    whenToSeeDoc: "If bloating is persistent, severe, or accompanied by significant changes in bowel habits, see your provider to rule out other causes."
  }
};

// Lookup with fuzzy matching
function getSymptomKnowledge(symptomName) {
  const lower = symptomName.toLowerCase();
  // Direct match
  if (SYMPTOM_KNOWLEDGE[lower]) return SYMPTOM_KNOWLEDGE[lower];
  // Fuzzy match
  for (const [key, val] of Object.entries(SYMPTOM_KNOWLEDGE)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  // Alias matching
  const aliases = {
    "mood shift": "irritability", "mood swing": "irritability", "insomnia": "poor sleep",
    "memory lapse": "brain fog", "difficulty concentrating": "brain fog", "word-finding": "brain fog",
    "low motivation": "depression", "panic attack": "anxiety", "migraine": "headache",
    "muscle ache": "joint pain", "back pain": "joint pain", "hair thinning": "weight change",
    "dry skin": "weight change", "breast tenderness": "weight change", "weight gain": "weight change",
    "urinary urgency": "vaginal dryness", "incontinence": "vaginal dryness",
    "vaginal irritation": "vaginal dryness", "nausea": "bloating", "acid reflux": "bloating",
    "digestive change": "bloating", "heart palpitation": "palpitation",
    "restless leg": "poor sleep", "tinnitus": null, "tingling": null, "numbness": null,
    "chills": "hot flash", "dry mouth": null, "dry eye": null, "crawling skin": null,
    "shortness of breath": null, "gum problem": null
  };
  for (const [alias, target] of Object.entries(aliases)) {
    if (lower.includes(alias) && target) return SYMPTOM_KNOWLEDGE[target];
  }
  return null;
}

const TRIGGER_KNOWLEDGE = {
  caffeine: {
    science: "Caffeine is a central nervous system stimulant that can trigger hot flashes by dilating blood vessels. It also blocks adenosine (a sleep-promoting neurotransmitter), worsening sleep issues. Sensitivity to caffeine often increases during menopause.",
    tip: "Try reducing gradually rather than quitting cold turkey. Switching to half-caf or cutting off caffeine by noon may be enough.",
    nuance: "Some studies show caffeine doesn't significantly worsen menopause symptoms for everyone — your personal data is your best guide."
  },
  alcohol: {
    science: "Alcohol dilates blood vessels (triggering hot flashes), disrupts sleep architecture (you fall asleep faster but sleep quality is worse), and can worsen anxiety and mood instability. Even moderate intake can amplify symptoms.",
    tip: "If you enjoy alcohol, try tracking which types and amounts affect you most. Red wine tends to be more triggering for hot flashes than other types.",
    nuance: "The relationship is dose-dependent — one glass occasionally may be fine, while regular consumption may noticeably worsen symptoms."
  },
  exercise: {
    science: "Regular exercise is one of the strongest evidence-based strategies for managing menopause symptoms. It improves mood (via endorphins), strengthens bones, improves sleep, and helps manage weight. Its direct effect on hot flash frequency is debated, but it significantly improves overall quality of life. The evidence supports 150 minutes/week of moderate aerobic activity plus 2 sessions of strength training.",
    tip: "Consistency matters more than intensity. If you're not exercising regularly, even 10-minute walks are a great starting point.",
    nuance: "Intense exercise close to bedtime can temporarily worsen hot flashes and disrupt sleep. Morning or afternoon sessions tend to be better."
  },
  stress: {
    science: "Stress activates the HPA axis (your stress response system), which interacts with the same brain regions affected by declining estrogen. This can amplify hot flashes, worsen anxiety, disrupt sleep, and increase pain sensitivity. Stress is often the most impactful trigger.",
    tip: "Stress management has some of the strongest evidence for symptom relief: meditation, yoga, CBT, and even regular social connection all help.",
    nuance: "You can't eliminate stress, but your response to it can be modified. Women who practice mindfulness report fewer and less bothersome symptoms."
  },
  sleep: {
    science: "Sleep is a multiplier — poor sleep worsens nearly every other menopause symptom. It increases pain sensitivity, lowers mood, reduces cognitive function, and even makes hot flashes feel more intense. Prioritizing sleep quality is one of the highest-impact things you can do.",
    tip: "Sleep hygiene matters more during menopause: consistent schedule, cool room, no screens before bed, limit caffeine after noon.",
    nuance: "If you're doing everything right and still sleeping poorly, discuss with your provider. Sleep apnea risk increases after menopause and is often undiagnosed in women."
  }
};

// Stage-specific context generator
function getStageContext(stage, symptom) {
  const knowledge = getSymptomKnowledge(symptom);
  if (!knowledge || !knowledge.stages) return "";
  const stageKey = stage?.toLowerCase().includes("peri") ? "perimenopause" : stage?.toLowerCase().includes("post") ? "postmenopause" : stage?.toLowerCase().includes("surgical") ? "surgical" : null;
  if (!stageKey || !knowledge.stages[stageKey]) return "";
  return `\n\n📋 ${knowledge.stages[stageKey]}`;
}

function matchQuestion(input) {
  const lower = input.toLowerCase().trim();

  // ─── Follow-up detection ───
  if (/^(tell me more|more detail|explain|go on|what else|why|elaborate|and\?|more)$/i.test(lower) || /^(what about|how about) (that|this|it)/.test(lower)) {
    if (_lastHandler) return { handler: _lastHandler, param: _lastParam, followUp: true };
  }
  if (/^(compared to|vs|versus) last (month|week)/.test(lower) && _lastHandler) {
    return { handler: _lastHandler, param: _lastParam, timeRange: "month" };
  }

  // ─── Time range detection ───
  let timeRange = null;
  if (/this month|past month|last 30|30 days/.test(lower)) timeRange = "month";
  else if (/last month|previous month/.test(lower)) timeRange = "lastMonth";
  else if (/last week|past week/.test(lower)) timeRange = "week";

  // ─── Compound: "What triggers my [symptom]?" ───
  const triggerForSymptom = lower.match(/(?:trigger|cause|worsen|affect|impact|making).{0,20}(?:my |the )?([\w\s]+?)(?:\?|$)/);
  if (triggerForSymptom) {
    const possibleSymptom = triggerForSymptom[1].trim();
    const matched = AI_SYMPTOM_NAMES.find((s) => possibleSymptom.includes(s) || s.includes(possibleSymptom));
    if (matched && /trigger|cause|worsen|making/.test(lower)) {
      _lastHandler = "symptomTriggers";
      _lastParam = matched;
      return { handler: "symptomTriggers", param: matched, timeRange };
    }
  }

  // ─── Compound: "How does [trigger] affect my [symptom]?" ───
  let foundTrigger = null, foundSymptom = null;
  for (const t of AI_TRIGGER_NAMES) { if (lower.includes(t)) { foundTrigger = t; break; } }
  for (const s of AI_SYMPTOM_NAMES) { if (lower.includes(s)) { foundSymptom = s; break; } }
  if (foundTrigger && foundSymptom) {
    _lastHandler = "triggerSymptom";
    _lastParam = { trigger: foundTrigger, symptom: foundSymptom };
    return { handler: "triggerSymptom", param: { trigger: foundTrigger, symptom: foundSymptom }, timeRange };
  }

  // ─── Single symptom ───
  if (foundSymptom) {
    _lastHandler = "symptomTrend";
    _lastParam = foundSymptom;
    return { handler: "symptomTrend", param: foundSymptom, timeRange };
  }

  // ─── Single trigger ───
  if (foundTrigger) {
    _lastHandler = "triggerImpact";
    _lastParam = foundTrigger;
    return { handler: "triggerImpact", param: foundTrigger, timeRange };
  }

  // ─── Intent patterns ───
  if (/trigger|worst|cause|why|making.*worse|what.*causing/.test(lower)) {
    _lastHandler = "triggers";
    return { handler: "triggers", timeRange };
  }
  if (/better|worse|improv|progress|trend|getting|trajectory/.test(lower)) {
    _lastHandler = "trend";
    return { handler: "trend", timeRange };
  }
  if (/doctor|appointment|visit|tell.*doc|prepare|bring to/.test(lower)) {
    _lastHandler = "doctor";
    return { handler: "doctor" };
  }
  if (/best.*day|worst.*day|day.*week|monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(lower)) {
    _lastHandler = "bestWorstDays";
    return { handler: "bestWorstDays" };
  }
  if (/mood|how.*feel|emotion|happy|sad/.test(lower)) {
    _lastHandler = "mood";
    return { handler: "mood", timeRange };
  }
  if (/energy|tired|exhaust|depleted/.test(lower)) {
    _lastHandler = "energy";
    return { handler: "energy", timeRange };
  }
  if (/week|how.*doing|overview|summary|recap/.test(lower)) {
    _lastHandler = "recent";
    return { handler: "recent", timeRange };
  }
  if (/pattern|notice|see|insight|find|connection|correlat/.test(lower)) {
    _lastHandler = "patterns";
    return { handler: "patterns" };
  }
  if (/help|what can|what do you|how do you work|capable/.test(lower)) {
    return { handler: "help" };
  }
  if (/thank|thanks|great|awesome|helpful/.test(lower)) {
    return { handler: "thanks" };
  }

  // ─── Smarter fallback ───
  _lastHandler = "recent";
  return { handler: "recent", timeRange };
}

function generateResponse(handler, logs, profile) {
  const p = getPersonalization(profile);
  const stage = profile ? getJourneyLabel(profile[0]) : null;
  const concern = p?.topConcernNames?.[0];
  const stageNote = stage ? ` During ${stage.toLowerCase()}, this is quite common.` : "";
  const energyLogs = logs.filter((l) => l.energy !== null && l.energy !== undefined);
  const avgEnergy = energyLogs.length > 0 ? Math.round(energyLogs.slice(0, 14).reduce((s, l) => s + l.energy, 0) / Math.min(energyLogs.length, 14) * 10) / 10 : null;
  const energyNote = avgEnergy !== null ? (avgEnergy <= 1 ? " I also notice your energy has been quite low — that's worth mentioning to your provider." : avgEnergy >= 3 ? " Your energy levels have been looking good, which is a positive sign." : "") : "";

  // Helper: suggest a relevant follow-up question
  const suggestFollowUp = (handler, param) => {
    const followUps = {
      symptomTrend: [`What triggers my ${param}?`, "Am I getting better or worse?", "What should I tell my doctor?"],
      triggerImpact: ["What are my worst triggers?", "Am I getting better or worse?", `How does ${param} affect my mood?`],
      triggers: ["Which day of the week is best for me?", "Am I getting better or worse?", "What should I tell my doctor?"],
      trend: ["What are my worst triggers?", "What patterns do you see?", "What should I tell my doctor?"],
      doctor: ["Am I getting better or worse?", "What patterns do you see?"],
      bestWorstDays: ["What are my worst triggers?", "How am I doing this week?"],
      patterns: ["Am I getting better or worse?", "What should I tell my doctor?"],
      mood: ["What are my worst triggers?", "Am I getting better or worse?"],
      energy: ["How is my sleep affecting me?", "Am I getting better or worse?"],
      recent: ["What patterns do you see?", "Am I getting better or worse?", "What should I tell my doctor?"],
      symptomTriggers: ["Am I getting better or worse?", "What should I tell my doctor?"],
      triggerSymptom: [`How is my ${param?.symptom || "symptom"} trending?`, "What are my worst triggers?"],
    };
    const options = followUps[handler] || followUps.recent;
    return `\n\n💬 Try asking: "${options[Math.floor(Math.random() * options.length)]}"`;
  };

  // ─── NEW: Help handler ───
  if (handler.handler === "help") {
    return `I analyze your logged data to help you understand your patterns. Here's what I can help with:\n\n• Ask about any symptom — "How are my hot flashes?"\n• Trigger analysis — "How does caffeine affect me?"\n• Compound questions — "What triggers my brain fog?"\n• Trends — "Am I getting better or worse?"\n• Day analysis — "Which day is best for me?"\n• Doctor prep — "What should I tell my doctor?"\n• Weekly recap — "How am I doing this week?"\n\nThe more you log, the smarter my answers get!`;
  }

  // ─── NEW: Thanks handler ───
  if (handler.handler === "thanks") {
    const responses = ["You're welcome! I'm here whenever you need me. 💚", "Glad I could help! Remember, every log you make helps me give you better insights.", "Anytime! Your consistency in tracking is what makes these insights possible.", "Happy to help! Let me know if you want to dig deeper into anything."];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // ─── NEW: Compound — "What triggers my [symptom]?" ───
  if (handler.handler === "symptomTriggers") {
    const symptom = handler.param;
    const triggers = ["caffeine", "alcohol", "exercise", "poor sleep", "stress"];
    const results = [];
    triggers.forEach((t) => {
      const data = analyzeTriggerImpact(logs, t);
      if (data.daysWithTrigger < 2) return;
      // Check if this specific symptom appears more with this trigger
      const withT = logs.filter((l) => {
        const ctx = l.context || {};
        const lower = t.toLowerCase();
        if (lower === "caffeine" || lower === "alcohol" || lower === "smoking") return ctx.triggers && ctx.triggers[lower];
        if (lower === "exercise") return ctx.triggers?.exercise;
        if (lower === "poor sleep" || lower === "sleep") return ctx.sleep === "poor" || ctx.sleep === "terrible";
        if (lower === "stress") return ctx.stress === "high" || ctx.stress === "extreme";
        return false;
      });
      const withoutT = logs.filter((l) => !withT.includes(l));
      const rateWith = withT.length > 0 ? withT.filter((l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptom))).length / withT.length : 0;
      const rateWithout = withoutT.length > 0 ? withoutT.filter((l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptom))).length / withoutT.length : 0;
      if (rateWith > 0 || rateWithout > 0) results.push({ trigger: t, rateWith: Math.round(rateWith * 100), rateWithout: Math.round(rateWithout * 100), delta: rateWith - rateWithout });
    });

    if (results.length === 0) return `I need more trigger data to tell you what affects your ${symptom}. Keep logging your daily context (caffeine, sleep, stress, etc.) and I'll connect the dots!` + suggestFollowUp("symptomTriggers", symptom);

    const worseners = results.filter((r) => r.delta > 0.1).sort((a, b) => b.delta - a.delta);
    const helpers = results.filter((r) => r.delta < -0.1).sort((a, b) => a.delta - b.delta);
    let msg = `Here's what I found about your ${symptom}:\n\n`;
    if (worseners.length > 0) msg += `Possible triggers:\n${worseners.map((w) => `• ${w.trigger}: ${symptom} appears ${w.rateWith}% of the time (vs ${w.rateWithout}% without)`).join("\n")}\n\n`;
    if (helpers.length > 0) msg += `May help:\n${helpers.map((h) => `• ${h.trigger}: ${symptom} drops to ${h.rateWith}% (vs ${h.rateWithout}% without)`).join("\n")}\n\n`;
    if (worseners.length === 0 && helpers.length === 0) msg += `No strong trigger connections found yet. Your ${symptom} appears fairly consistently regardless of triggers.\n\n`;
    // Add research-backed context for this symptom
    const sKnowledge = getSymptomKnowledge(symptom);
    if (sKnowledge) {
      msg += `\n📚 ${sKnowledge.science}`;
      const strategy = sKnowledge.strategies[Math.floor(Math.random() * sKnowledge.strategies.length)];
      msg += `\n\n💡 Evidence-based tip: ${strategy}`;
    }
    const stageCtx = getStageContext(stage, symptom);
    if (stageCtx) msg += stageCtx;
    return msg + suggestFollowUp("symptomTriggers", symptom);
  }

  // ─── NEW: Compound — "How does [trigger] affect my [symptom]?" ───
  if (handler.handler === "triggerSymptom") {
    const { trigger, symptom } = handler.param;
    const withT = logs.filter((l) => {
      const ctx = l.context || {};
      const lower = trigger.toLowerCase();
      if (lower === "caffeine" || lower === "alcohol" || lower === "smoking") return ctx.triggers && ctx.triggers[lower];
      if (lower === "exercise") return ctx.triggers?.exercise;
      if (lower === "poor sleep" || lower === "sleep") return ctx.sleep === "poor" || ctx.sleep === "terrible";
      if (lower === "stress") return ctx.stress === "high" || ctx.stress === "extreme";
      return false;
    });
    const withoutT = logs.filter((l) => !withT.includes(l));
    if (withT.length < 2) return `I need more days with ${trigger} logged to analyze its effect on ${symptom}. Keep tracking!`;
    const rateWith = withT.filter((l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptom))).length / withT.length;
    const rateWithout = withoutT.length > 0 ? withoutT.filter((l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptom))).length / withoutT.length : 0;
    const pctWith = Math.round(rateWith * 100);
    const pctWithout = Math.round(rateWithout * 100);
    if (pctWith > pctWithout + 10) return `There may be a connection: ${symptom} appears ${pctWith}% of the time on ${trigger} days, vs ${pctWithout}% on non-${trigger} days. That's a ${pctWith - pctWithout} percentage point difference.${stageNote} Worth discussing with your provider.` + suggestFollowUp("triggerSymptom", handler.param);
    if (pctWith < pctWithout - 10) return `Interesting — ${symptom} actually appears less on ${trigger} days (${pctWith}% vs ${pctWithout}%). ${trigger} might be helping with this one!` + suggestFollowUp("triggerSymptom", handler.param);
    return `${trigger} doesn't seem to have a strong effect on your ${symptom} specifically. It appears about ${pctWith}% of the time either way. Other factors might be more relevant.` + suggestFollowUp("triggerSymptom", handler.param);
  }

  // ─── NEW: Mood-specific handler ───
  if (handler.handler === "mood") {
    const data = analyzeOverallTrend(logs);
    if (data.recentDays < 3) return "I need a few more days of mood data to give you a reliable picture. Keep logging!";
    const recentMoods = logs.filter((l) => (new Date() - new Date(l.date)) / 86400000 <= 14 && l.mood !== null && l.mood !== undefined);
    const moodLabels = ["😔 rough", "😕 low", "😐 okay", "🙂 good", "😊 great"];
    const moodDist = [0, 0, 0, 0, 0];
    recentMoods.forEach((l) => { if (l.mood >= 0 && l.mood <= 4) moodDist[l.mood]++; });
    const mostCommon = moodDist.indexOf(Math.max(...moodDist));
    let msg = `Your mood over the last 2 weeks:\n\n`;
    msg += `Average: ${data.recentMood}/4 ${moodLabels[Math.round(data.recentMood)] || ""}\n`;
    msg += `Most common mood: ${moodLabels[mostCommon]} (${moodDist[mostCommon]}/${recentMoods.length} days)\n`;
    if (data.prevDays >= 3) {
      const delta = data.recentMood - data.prevMood;
      msg += `Trend: ${Math.abs(delta) > 0.3 ? (delta > 0 ? "📈 Improving" : "📉 Dipping") : "➡️ Steady"} (was ${data.prevMood} → now ${data.recentMood})\n`;
    }
    if (avgEnergy !== null) msg += `Energy correlation: ${avgEnergy >= 2.5 ? "your energy and mood are both in a decent place" : "your energy has been low, which often pulls mood down too"}.\n`;
    // Research-backed mood context
    const moodKnowledge = data.recentMood < 2 ?
      `\n📚 Estrogen helps regulate serotonin — your brain's "feel good" neurotransmitter. As estrogen fluctuates, mood dips are a physiological response, not a character flaw. Research shows mood changes are most intense during the transition and typically improve afterward.` :
      `\n📚 Research shows that mood during menopause is influenced by hormonal changes, sleep quality, stress, and social support. The fact that you're tracking is itself a positive step — self-awareness is linked to better emotional regulation.`;
    msg += moodKnowledge;
    if (data.recentMood < 1.5) msg += `\n\n💡 If your mood has been consistently low, please consider talking to your healthcare provider. Depression during menopause is very common and highly treatable.`;
    else msg += `\n\n💡 Regular exercise (even 20 minutes) has evidence as strong as medication for mild-moderate mood changes during menopause.`;
    return msg + suggestFollowUp("mood");
  }

  // ─── NEW: Energy-specific handler ───
  if (handler.handler === "energy") {
    const recentE = logs.filter((l) => (new Date() - new Date(l.date)) / 86400000 <= 14 && l.energy !== null && l.energy !== undefined);
    if (recentE.length < 3) return "I need a few more days of energy data. Make sure you're logging your energy level each day!";
    const avg = Math.round(recentE.reduce((s, l) => s + l.energy, 0) / recentE.length * 10) / 10;
    const labels = ["Depleted", "Low", "Moderate", "Good", "Energized"];
    const prevE = logs.filter((l) => { const d = (new Date() - new Date(l.date)) / 86400000; return d > 14 && d <= 28 && l.energy !== null && l.energy !== undefined; });
    const prevAvg = prevE.length > 0 ? Math.round(prevE.reduce((s, l) => s + l.energy, 0) / prevE.length * 10) / 10 : null;
    let msg = `Your energy over the last 2 weeks:\n\nAverage: ${avg}/4 (${labels[Math.round(avg)] || "Moderate"})\n`;
    if (prevAvg !== null) {
      const delta = avg - prevAvg;
      msg += `Trend: ${Math.abs(delta) > 0.3 ? (delta > 0 ? "⬆️ Improving" : "⬇️ Declining") : "➡️ Steady"} (was ${prevAvg} → now ${avg})\n`;
    }
    // Check sleep correlation
    const poorSleepDays = recentE.filter((l) => l.context?.sleep === "poor" || l.context?.sleep === "terrible");
    const goodSleepDays = recentE.filter((l) => l.context?.sleep === "good" || l.context?.sleep === "great");
    if (poorSleepDays.length >= 2 && goodSleepDays.length >= 2) {
      const poorE = poorSleepDays.reduce((s, l) => s + l.energy, 0) / poorSleepDays.length;
      const goodE = goodSleepDays.reduce((s, l) => s + l.energy, 0) / goodSleepDays.length;
      if (goodE - poorE > 0.5) msg += `\n💡 Your data confirms it: energy averages ${labels[Math.round(goodE)] || "higher"} after good sleep vs ${labels[Math.round(poorE)] || "lower"} after poor sleep.`;
    }
    // Research-backed energy context
    msg += `\n\n📚 Menopause-related fatigue is multifactorial: disrupted sleep, hormonal shifts affecting energy metabolism, and the cumulative toll of other symptoms. Up to 85% of menopausal women report it.`;
    if (avg <= 1.5) msg += `\n\n💡 Your energy has been quite low. Checking iron, B12, thyroid, and vitamin D levels with your provider is a good idea — these are common, easily treatable contributors to fatigue in midlife women.`;
    else msg += `\n\n💡 Regular moderate exercise paradoxically increases energy. Consistent wake times — even on weekends — also help regulate your circadian rhythm.`;
    return msg + suggestFollowUp("energy");
  }

  if (handler.handler === "symptomTrend") {
    const data = analyzeSymptomTrend(logs, handler.param);
    const knowledge = getSymptomKnowledge(handler.param);
    if (data.recentCount === 0 && data.prevCount === 0) {
      let msg = `I haven't seen ${handler.param} in your recent logs. That's great!`;
      if (knowledge) msg += `\n\n📚 For context: ${knowledge.prevalence}`;
      return msg;
    }
    const trendWord = data.trend === "increasing" ? "more frequently" : data.trend === "decreasing" ? "less often — that's encouraging!" : "at about the same rate";
    let msg = `Looking at your ${handler.param} pattern: you've logged it ${data.recentCount} times in the last 2 weeks, compared to ${data.prevCount} the 2 weeks before. It's appearing ${trendWord}.`;
    // Severity info
    if (data.recentSev > 0 && data.prevSev > 0) {
      const sevDelta = data.recentSev - data.prevSev;
      if (Math.abs(sevDelta) > 0.5) msg += `\n\nSeverity: ${sevDelta > 0 ? "intensity has increased" : "intensity has decreased"} (${data.prevSev}/10 → ${data.recentSev}/10).`;
    } else if (data.recentSev > 0) {
      msg += ` Average severity: ${data.recentSev}/10.`;
    }
    // Research-backed context
    if (knowledge) {
      msg += `\n\n📚 ${knowledge.science}`;
      // Pick a relevant strategy based on trend
      const strategyIdx = data.trend === "increasing" ? 0 : Math.floor(Math.random() * knowledge.strategies.length);
      msg += `\n\n💡 What helps: ${knowledge.strategies[strategyIdx]}`;
      // Stage-specific insight
      const stageCtx = getStageContext(stage, handler.param);
      if (stageCtx) msg += stageCtx;
      // Severity-appropriate doctor nudge
      if (data.recentCount >= 7 || (data.recentSev > 0 && data.recentSev >= 7)) {
        msg += `\n\n⚕️ ${knowledge.whenToSeeDoc}`;
      }
    } else {
      msg += stageNote;
    }
    // Concern callout
    if (concern && handler.param.toLowerCase().includes(concern.toLowerCase().split(" ")[0])) {
      msg += `\n\n📌 This is one of the concerns you flagged during onboarding — I'm keeping a close eye on it.`;
    }
    return msg + suggestFollowUp("symptomTrend", handler.param);
  }

  if (handler.handler === "triggerImpact") {
    const data = analyzeTriggerImpact(logs, handler.param);
    const tKnowledge = TRIGGER_KNOWLEDGE[handler.param.toLowerCase()] || TRIGGER_KNOWLEDGE[handler.param.toLowerCase().replace("poor ", "")];
    if (data.daysWithTrigger === 0) {
      let msg = `I don't have enough data on ${handler.param} yet. Try logging it when it comes up, and I'll analyze the impact!`;
      if (tKnowledge) msg += `\n\n📚 What research says: ${tKnowledge.science}`;
      return msg;
    }
    let energyImpact = "";
    if (data.avgEnergyWith !== null && data.avgEnergyWithout !== null) {
      const eDelta = data.avgEnergyWith - data.avgEnergyWithout;
      if (Math.abs(eDelta) > 0.3) energyImpact = `\nEnergy: ${eDelta > 0 ? "higher" : "lower"} on ${handler.param} days (${data.avgEnergyWith} vs ${data.avgEnergyWithout}).`;
    }
    let msg = "";
    if (data.impact === "worsens") {
      msg = `Here's what your data shows: on days with ${handler.param}, you average ${data.avgSymptomsWith} symptoms compared to ${data.avgSymptomsWithout} without it. Your mood also tends to be ${data.avgMoodWith < data.avgMoodWithout ? "lower" : "about the same"} (${data.avgMoodWith} vs ${data.avgMoodWithout}).${energyImpact}`;
      if (tKnowledge) {
        msg += `\n\n📚 Why this happens: ${tKnowledge.science}`;
        msg += `\n\n💡 ${tKnowledge.tip}`;
      }
    } else if (data.impact === "helps") {
      msg = `Your data suggests ${handler.param} may be helping you! On those days, you average ${data.avgSymptomsWith} symptoms vs ${data.avgSymptomsWithout} without it, and your mood tends to be ${data.avgMoodWith > data.avgMoodWithout ? "better" : "similar"}.${energyImpact}`;
      if (tKnowledge) {
        msg += `\n\n📚 The science backs this up: ${tKnowledge.science}`;
        msg += `\n\n💡 ${tKnowledge.tip}`;
      }
    } else {
      msg = `${handler.param} doesn't show a strong correlation either way in your data. You average ${data.avgSymptomsWith} symptoms with it and ${data.avgSymptomsWithout} without.${energyImpact}`;
      if (tKnowledge) {
        msg += `\n\n📚 ${tKnowledge.nuance}`;
        msg += `\n\n💡 ${tKnowledge.tip}`;
      }
    }
    return msg + suggestFollowUp("triggerImpact", handler.param);
  }

  if (handler.handler === "triggers") {
    const triggers = ["caffeine", "alcohol", "exercise", "poor sleep", "stress"];
    const results = triggers.map((t) => analyzeTriggerImpact(logs, t)).filter((r) => r.daysWithTrigger >= 2);
    const worst = results.filter((r) => r.impact === "worsens").sort((a, b) => b.avgSymptomsWith - a.avgSymptomsWith);
    const best = results.filter((r) => r.impact === "helps");
    let msg = "";
    if (worst.length > 0) msg += `Based on your logs, these show a possible link to more symptoms: ${worst.map((w) => `${w.triggerName} (+${(w.avgSymptomsWith - w.avgSymptomsWithout).toFixed(1)} symptoms/day)`).join(", ")}. Note: individual patterns may differ from clinical evidence — share these findings with your provider. `;
    if (best.length > 0) msg += `Your data also suggests ${best.map((b) => b.triggerName).join(" and ")} may be associated with fewer symptoms. `;
    if (msg === "") msg = "I need a bit more trigger data to give you a clear picture. Keep logging what you eat, drink, and do — I'll spot the connections!";
    // Add research context for the worst trigger
    if (worst.length > 0) {
      const topTrigger = worst[0].triggerName.toLowerCase().replace("poor ", "");
      const tK = TRIGGER_KNOWLEDGE[topTrigger];
      if (tK) msg += `\n\n📚 About ${worst[0].triggerName}: ${tK.science}\n\n💡 ${tK.tip}`;
    } else if (best.length > 0) {
      const topHelper = best[0].triggerName.toLowerCase().replace("poor ", "");
      const tK = TRIGGER_KNOWLEDGE[topHelper];
      if (tK) msg += `\n\n📚 About ${best[0].triggerName}: ${tK.science}`;
    }
    return msg + suggestFollowUp("triggers");
  }

  if (handler.handler === "trend") {
    const data = analyzeOverallTrend(logs);
    if (data.recentDays < 3) return concern ? `I need a few more days of ${concern} data to spot a reliable trend. Keep logging!` : "I need a few more days of data to spot a reliable trend. Keep logging!";
    const energyTrend = data.recentEnergy > 0 && data.prevEnergy > 0 ? (data.recentEnergy > data.prevEnergy ? " Your energy is also trending up!" : data.recentEnergy < data.prevEnergy ? " I notice your energy has dipped a bit too." : "") : "";
    if (data.direction === "improving") {
      let msg = `Great news — you're trending better! Your symptoms have decreased from an average of ${data.prevSymptoms}/day to ${data.recentSymptoms}/day, and your mood has ${data.recentMood > data.prevMood ? `improved from ${data.prevMood} to ${data.recentMood}` : "held steady"}.${energyTrend} Whatever you're doing, it's working!`;
      msg += `\n\n📚 Research shows that the menopause transition is not a steady decline — many women experience periods of improvement. Consistent tracking helps you identify what's working so you can do more of it.`;
      return msg + suggestFollowUp("trend");
    }
    if (data.direction === "worse") {
      let msg = `I want to be honest with you: the last 2 weeks have been a bit tougher. Symptoms went from ${data.prevSymptoms}/day to ${data.recentSymptoms}/day${data.recentMood < data.prevMood ? `, and mood dipped from ${data.prevMood} to ${data.recentMood}` : ""}.${energyTrend}`;
      // Find their top symptom to give specific advice
      const recentLogs = logs.filter((l) => (new Date() - new Date(l.date)) / 86400000 <= 14);
      const symCounts = {};
      recentLogs.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { symCounts[s] = (symCounts[s] || 0) + 1; }));
      const topSym = Object.entries(symCounts).sort((a, b) => b[1] - a[1])[0];
      if (topSym) {
        const topKnowledge = getSymptomKnowledge(topSym[0]);
        if (topKnowledge) {
          msg += `\n\nYour most frequent symptom right now is ${topSym[0]} (${topSym[1]}x in 2 weeks). ${topKnowledge.prevalence}`;
          msg += `\n\n💡 ${topKnowledge.strategies[0]}`;
        }
      }
      msg += `\n\n📚 Symptom fluctuation is normal during the menopausal transition — research shows symptoms naturally wax and wane. This isn't a setback, it's part of the process.${energyNote}`;
      if (data.recentSymptoms > 4) msg += ` If this pattern continues, consider bringing your Vela data to your healthcare provider — they can help.`;
      return msg + suggestFollowUp("trend");
    }
    let stableMsg = `Things are holding steady — ${data.recentSymptoms} symptoms/day on average, mood around ${data.recentMood}.${energyTrend}`;
    stableMsg += `\n\n📚 Stability is actually a positive sign. Research shows that many women reach a "new baseline" during menopause where symptoms become predictable and manageable. You may be finding yours.`;
    return stableMsg + suggestFollowUp("trend");
  }

  if (handler.handler === "doctor") {
    const data = generateDoctorSummary(logs, profile);
    let msg = "Here's what I'd suggest bringing to your doctor:\n\n";
    if (data.points.length > 0) msg += data.points.map((pt) => `• ${pt}`).join("\n") + "\n\n";
    if (data.correlations.length > 0) msg += `Key patterns: ${data.correlations.slice(0, 2).map((c) => c.text).join("; ")}\n\n`;
    if (data.trend) msg += `Overall trend: ${data.trend.direction} (${data.trend.recentSymptoms} symptoms/day recently vs ${data.trend.prevSymptoms} before)\n\n`;
    if (data.questions.length > 0) msg += "Questions to ask:\n" + data.questions.map((q) => `• ${q}`).join("\n");
    // Add evidence-based context for top symptom
    const recent30 = logs.filter((l) => (new Date() - new Date(l.date)) / 86400000 <= 30);
    const symC = {};
    recent30.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { symC[s] = (symC[s] || 0) + 1; }));
    const topEntry = Object.entries(symC).sort((a, b) => b[1] - a[1])[0];
    if (topEntry) {
      const topK = getSymptomKnowledge(topEntry[0]);
      if (topK) msg += `\n\n📚 About your most frequent symptom (${topEntry[0]}): ${topK.whenToSeeDoc}`;
    }
    msg += "\n\n📋 Tip: Generate a full PDF report from the Doctor Prep section — providers respond well to structured data.";
    return msg;
  }

  if (handler.handler === "bestWorstDays") {
    const data = analyzeBestWorstDays(logs);
    if (data.stats.length < 3) return "I need data from more days of the week to give you a reliable breakdown. Keep logging!";
    let msg = "";
    if (data.best) {
      msg += `Your best day tends to be ${data.best.day} (avg mood: ${data.best.avgMood}, avg symptoms: ${data.best.avgSymptoms}`;
      if (data.best.avgEnergy !== null) msg += `, energy: ${data.best.avgEnergy}`;
      msg += `). `;
    }
    if (data.worst && data.worst.day !== data.best?.day) {
      msg += `${data.worst.day}s tend to be tougher (avg mood: ${data.worst.avgMood}, avg symptoms: ${data.worst.avgSymptoms}`;
      if (data.worst.avgEnergy !== null) msg += `, energy: ${data.worst.avgEnergy}`;
      msg += `). `;
    }
    msg += `\n\n💡 Research on chronobiology suggests that aligning demanding tasks with your best days and scheduling recovery time on harder days can significantly improve quality of life. Your data gives you this advantage — use it!`;
    if (data.best && data.worst && data.best.day !== data.worst?.day) {
      const moodGap = (data.best.avgMood || 0) - (data.worst.avgMood || 0);
      if (moodGap > 1) msg += `\n\n📊 The mood gap between your best and worst days is significant (${moodGap.toFixed(1)} points). Look at what's different about your ${data.worst.day} routine — sleep the night before, schedule, stress levels.`;
    }
    return msg + suggestFollowUp("bestWorstDays");
  }

  if (handler.handler === "patterns") {
    const patterns = analyzePatterns(logs);
    const correlations = analyzeCorrelations(logs);
    if (patterns.length === 0 && correlations.length === 0) return "I haven't spotted strong patterns yet. The more consistently you log, the faster I can find connections. Even quick logs on good days help!";
    let msg = "Here's what I've noticed:\n\n";
    if (patterns.length > 0) msg += patterns.slice(0, 3).map((pt) => `• ${pt}`).join("\n");
    if (correlations.length > 0 && patterns.length < 3) {
      const extra = correlations.slice(0, 3 - patterns.length).filter((c) => !patterns.some((pt) => pt.includes(c.text)));
      if (extra.length > 0) msg += "\n" + extra.map((c) => `• ${c.icon} ${c.text}`).join("\n");
    }
    msg += `\n\nThese patterns are based on your personal data — everyone's experience is unique.${stageNote}`;
    return msg + suggestFollowUp("patterns");
  }

  // recent / fallback
  const data = analyzeRecentPattern(logs);
  if (!data) return concern ? `I don't have any data from this week yet. Log how your ${concern} is today and I'll start building your picture!` : "I don't have any data from this week yet. Log how you're feeling today and I'll start building your picture!";
  let msg = `Here's your week so far (${data.daysLogged} days logged):\n\n`;
  if (data.avgMood !== null) msg += `Mood: ${data.avgMood}/4 average (${data.avgMood >= 3.5 ? "great" : data.avgMood >= 2.5 ? "good" : data.avgMood >= 1.5 ? "okay" : "tough"})\n`;
  if (data.avgEnergy !== null) msg += `Energy: ${["Depleted", "Low", "Moderate", "Good", "Energized"][Math.round(data.avgEnergy)] || "Moderate"} average\n`;
  if (data.topSymptoms.length > 0) {
    msg += `Top symptoms: ${data.topSymptoms.map((s) => `${s.name} (${s.count}x)`).join(", ")}\n`;
    if (concern && data.topSymptoms.some((s) => s.name.toLowerCase().includes(concern.toLowerCase()))) {
      msg += `\n📌 Your ${concern} appeared ${data.topSymptoms.find((s) => s.name.toLowerCase().includes(concern.toLowerCase())).count} times this week.\n`;
    }
  }
  if (data.topContext && data.topContext.length > 0) {
    const filtered = data.topContext.filter((t) => !t.name.startsWith("Stress:") && !t.name.startsWith("Sleep:"));
    if (filtered.length > 0) msg += `Context: ${filtered.map((t) => `${t.name} (${t.count}x)`).join(", ")}\n`;
  }
  if (data.bestDay) msg += `\nBest day: ${new Date(data.bestDay.date).toLocaleDateString("en-US", { weekday: "long" })} ${["😞","😕","😐","🙂","😊"][data.bestDay.mood] || ""}`;
  msg += stageNote + energyNote;
  return msg + suggestFollowUp("recent");
}

const BADGES = [
  // Streak badges
  { id: "streak-3", icon: "🌱", name: "Seedling", desc: "3-day logging streak", check: (s) => s.streak >= 3 },
  { id: "streak-7", icon: "🌿", name: "Sprouting", desc: "7-day logging streak", check: (s) => s.streak >= 7 },
  { id: "streak-14", icon: "🌳", name: "Taking Root", desc: "14-day logging streak", check: (s) => s.streak >= 14 },
  { id: "streak-30", icon: "🌲", name: "Deeply Rooted", desc: "30-day logging streak", check: (s) => s.streak >= 30 },
  { id: "streak-60", icon: "🏔️", name: "Mountain Strong", desc: "60-day logging streak", check: (s) => s.streak >= 60 },
  // Logging milestones
  { id: "logs-1", icon: "✨", name: "First Step", desc: "Log your first entry", check: (s) => s.totalLogs >= 1 },
  { id: "logs-10", icon: "📝", name: "Getting Started", desc: "Log 10 entries", check: (s) => s.totalLogs >= 10 },
  { id: "logs-50", icon: "📊", name: "Data Builder", desc: "Log 50 entries", check: (s) => s.totalLogs >= 50 },
  { id: "logs-100", icon: "🏆", name: "Century Club", desc: "Log 100 entries", check: (s) => s.totalLogs >= 100 },
  { id: "logs-365", icon: "👑", name: "Year of Wisdom", desc: "Log 365 entries", check: (s) => s.totalLogs >= 365 },
  // Feature discovery
  { id: "mood-first", icon: "😊", name: "Mood Tracker", desc: "Log your first mood", check: (s) => s.moodLogs >= 1 },
  { id: "notes-first", icon: "📓", name: "Journaler", desc: "Add your first note", check: (s) => s.notesCount >= 1 },
  { id: "context-first", icon: "🔍", name: "Context Seeker", desc: "Log sleep, stress, or a trigger", check: (s) => s.contextLogs >= 1 },
  { id: "symptoms-5", icon: "🩺", name: "Body Listener", desc: "Track 5 different symptoms", check: (s) => s.uniqueSymptoms >= 5 },
  { id: "symptoms-10", icon: "🧬", name: "Full Spectrum", desc: "Track 10 different symptoms", check: (s) => s.uniqueSymptoms >= 10 },
  // Community
  { id: "community-post", icon: "💬", name: "Voice Found", desc: "Write your first community post", check: (s) => s.communityPosts >= 1 },
  { id: "community-5", icon: "🤝", name: "Supporter", desc: "Write 5 community posts", check: (s) => s.communityPosts >= 5 },
  // Insights
  { id: "insight-first", icon: "💡", name: "Pattern Spotter", desc: "View your first weekly insight", check: (s) => s.uniqueDays >= 7 },
  { id: "ai-chat", icon: "🤖", name: "Vela Whisperer", desc: "Ask Vela your first question", check: (s) => s.aiChats >= 1 },
  // Special
  { id: "weekend-warrior", icon: "🦸", name: "Weekend Warrior", desc: "Log on both Saturday and Sunday", check: (s) => s.weekendLogs >= 2 },
  { id: "night-owl", icon: "🦉", name: "Night Owl", desc: "Log after 10pm", check: (s) => s.nightLogs >= 1 },
  { id: "early-bird", icon: "🐦", name: "Early Bird", desc: "Log before 7am", check: (s) => s.earlyLogs >= 1 },
  { id: "period-tracker", icon: "🩸", name: "Cycle Aware", desc: "Log period data for the first time", check: (s) => s.periodLogs >= 1 },
];

const LEVELS = [
  { level: 1, name: "Beginning your journey", xpNeeded: 0, unlock: null },
  { level: 2, name: "Building awareness", xpNeeded: 50, unlock: "Your first patterns are emerging" },
  { level: 3, name: "Finding your rhythm", xpNeeded: 150, unlock: "Your data is telling a story" },
  { level: 4, name: "Seeing connections", xpNeeded: 350, unlock: "Vela is learning what affects you" },
  { level: 5, name: "Understanding your body", xpNeeded: 600, unlock: "Deep patterns are taking shape" },
  { level: 6, name: "Taking control", xpNeeded: 1000, unlock: "You know your triggers" },
  { level: 7, name: "Empowered", xpNeeded: 1500, unlock: "Your journey is inspiring others" },
  { level: 8, name: "Advocate", xpNeeded: 2200, unlock: "You're helping others feel less alone" },
  { level: 9, name: "Mentor", xpNeeded: 3000, unlock: "Your wisdom is guiding this community" },
  { level: 10, name: "Vela companion", xpNeeded: 4000, unlock: "You've built a complete picture of your health" },
];

function computeGamificationStats(logs) {
  const streak = getStreak(logs);
  const totalLogs = logs.length;
  const uniqueSymptoms = new Set(logs.flatMap((l) => Object.keys(l.symptoms || {}))).size;
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const moodLogs = logs.filter((l) => l.mood !== null && l.mood !== undefined).length;
  const notesCount = logs.filter((l) => l.notes && l.notes.trim()).length;
  const contextLogs = logs.filter((l) => l.context && Object.values(l.context).some((v) => v !== null)).length;
  const communityPosts = (() => { try { return JSON.parse(localStorage.getItem("vela_community_posts") || "[]").length; } catch { return 0; } })();
  const aiChats = (() => { try { return JSON.parse(localStorage.getItem("vela_chat_messages") || "[]").filter((m) => m.role === "user").length; } catch { return 0; } })();
  const weekendLogs = new Set(logs.filter((l) => { const d = new Date(l.date).getDay(); return d === 0 || d === 6; }).map((l) => new Date(l.date).getDay())).size;
  const nightLogs = logs.filter((l) => new Date(l.date).getHours() >= 22).length;
  const earlyLogs = logs.filter((l) => new Date(l.date).getHours() < 7).length;
  const periodLogs = logs.filter((l) => l.context?.period && l.context.period !== "none").length;
  return { streak, totalLogs, uniqueSymptoms, uniqueDays, moodLogs, notesCount, contextLogs, communityPosts, aiChats, weekendLogs, nightLogs, earlyLogs, periodLogs };
}

function getStreakMultiplier(streak) {
  if (streak >= 30) return 3;
  if (streak >= 14) return 2;
  if (streak >= 7) return 1.5;
  return 1;
}

function computeXP(logs) {
  let xp = 0;
  const streak = getStreak(logs);
  const multiplier = getStreakMultiplier(streak);
  xp += logs.length * 10; // 10 XP per log
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  xp += uniqueDays * 5; // 5 XP bonus per unique day
  xp += Math.min(streak, 60) * 3; // 3 XP per streak day (cap at 60)
  // Streak multiplier bonus: extra XP for sustained streaks
  if (streak >= 7) xp += Math.floor(streak * (multiplier - 1) * 2);
  const moodLogs = logs.filter((l) => l.mood !== null && l.mood !== undefined).length;
  xp += moodLogs * 2; // 2 XP per mood log
  const contextLogs = logs.filter((l) => l.context && Object.values(l.context).some((v) => v !== null)).length;
  xp += contextLogs * 3; // 3 XP per context log
  const notesCount = logs.filter((l) => l.notes && l.notes.trim()).length;
  xp += notesCount * 5; // 5 XP per note
  const stats = computeGamificationStats(logs);
  const earned = BADGES.filter((b) => b.check(stats));
  xp += earned.length * 25; // 25 XP per badge
  // Lesson XP: 10 XP per completed daily lesson
  try {
    const completedLessons = JSON.parse(localStorage.getItem("vela_completed_lessons") || "[]");
    xp += completedLessons.length * 10;
  } catch {}
  // Completed experiment XP
  try {
    const completedExps = JSON.parse(localStorage.getItem("vela_completed_experiments") || "[]");
    completedExps.forEach((id) => {
      const exp = EXPERIMENTS.find((e) => e.id === id);
      if (exp) xp += exp.xpReward;
    });
  } catch {}
  // Completed CBT program XP
  try {
    const completedCBT = JSON.parse(localStorage.getItem("vela_completed_cbt") || "[]");
    completedCBT.forEach((id) => {
      const prog = CBT_PROGRAMS.find((p) => p.id === id);
      if (prog) xp += prog.xpReward;
    });
  } catch {}
  return xp;
}

function getLevel(xp) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpNeeded) current = lvl;
    else break;
  }
  const nextLevel = LEVELS.find((l) => l.xpNeeded > xp);
  const xpToNext = nextLevel ? nextLevel.xpNeeded - xp : 0;
  const xpInLevel = nextLevel ? xp - current.xpNeeded : 0;
  const xpLevelRange = nextLevel ? nextLevel.xpNeeded - current.xpNeeded : 1;
  const pct = nextLevel ? Math.round((xpInLevel / xpLevelRange) * 100) : 100;
  return { ...current, xp, xpToNext, pct, isMax: !nextLevel };
}

// ─── Self-Experiments / Challenges ───────────────────────────────────────────

const EXPERIMENTS = [
  { id: "no-caffeine-7", title: "Caffeine-free week", desc: "Skip caffeine for 7 days and see how your symptoms respond", duration: 7, track: "caffeine", trackValue: false, icon: "☕", category: "triggers", xpReward: 50 },
  { id: "exercise-7", title: "Move every day", desc: "Log any exercise for 7 consecutive days", duration: 7, track: "exercise", trackValue: true, icon: "🏃", category: "activity", xpReward: 50 },
  { id: "sleep-hygiene-7", title: "Sleep before 10pm", desc: "Aim for 7+ hours of sleep for 7 nights", duration: 7, track: "sleepHours", trackValue: 7, icon: "🛏️", category: "sleep", xpReward: 50 },
  { id: "mood-journal-7", title: "Daily mood check", desc: "Log your mood every day for a full week", duration: 7, track: "mood", trackValue: true, icon: "📓", category: "tracking", xpReward: 40 },
  { id: "no-alcohol-14", title: "14-day alcohol reset", desc: "Skip alcohol for 2 weeks and compare your symptom patterns", duration: 14, track: "alcohol", trackValue: false, icon: "🍷", category: "triggers", xpReward: 75 },
  { id: "stress-mgmt-7", title: "Low-stress week", desc: "Practice stress management — aim for stress level ≤3 for 7 days", duration: 7, track: "stress", trackValue: 3, icon: "🧘", category: "wellness", xpReward: 60 },
  { id: "hydration-7", title: "Hydration challenge", desc: "Note your water intake daily for 7 days. Stay hydrated!", duration: 7, track: "notes", trackValue: "water", icon: "💧", category: "wellness", xpReward: 40 },
  { id: "full-log-7", title: "Complete tracker", desc: "Log mood, symptoms, AND context every day for a week", duration: 7, track: "complete", trackValue: true, icon: "✅", category: "tracking", xpReward: 75 },
  { id: "morning-light-7", title: "Morning light exposure", desc: "Get outside within 30 minutes of waking for 7 days", duration: 7, track: "notes", trackValue: "morning light", icon: "🌅", category: "wellness", xpReward: 50 },
  { id: "no-screens-7", title: "Screen-free evenings", desc: "No screens 1 hour before bed for 7 nights", duration: 7, track: "notes", trackValue: "no screens", icon: "📵", category: "sleep", xpReward: 50 },
  { id: "protein-7", title: "Protein at every meal", desc: "Include protein at breakfast, lunch, and dinner for 7 days", duration: 7, track: "notes", trackValue: "protein", icon: "🥩", category: "nutrition", xpReward: 50 },
  { id: "breathing-7", title: "Paced breathing practice", desc: "Practice 5 minutes of slow breathing daily for 7 days", duration: 7, track: "notes", trackValue: "breathing", icon: "🫁", category: "wellness", xpReward: 50 },
  { id: "sugar-free-14", title: "14-day sugar reset", desc: "Reduce added sugars for 2 weeks and track symptom changes", duration: 14, track: "notes", trackValue: "low sugar", icon: "🍬", category: "triggers", xpReward: 75 },
  { id: "strength-7", title: "Strength training week", desc: "Do 3+ resistance training sessions this week", duration: 7, track: "exercise", trackValue: true, icon: "💪", category: "activity", xpReward: 60 },
  { id: "gratitude-7", title: "Gratitude journal", desc: "Write one thing you're grateful for in your notes each day", duration: 7, track: "notes", trackValue: "grateful", icon: "🙏", category: "wellness", xpReward: 40 },
  { id: "cool-bedroom-7", title: "Cool bedroom challenge", desc: "Keep your bedroom at 65-68°F for 7 nights and track sleep quality", duration: 7, track: "notes", trackValue: "cool room", icon: "❄️", category: "sleep", xpReward: 50 },
];

const CBT_PROGRAMS = [
  {
    id: "cbt-hot-flashes",
    title: "Managing Hot Flashes",
    subtitle: "4-week CBT-based program",
    icon: "🌡",
    weeks: 4,
    desc: "Cognitive-behavioral therapy has Level I evidence for reducing the impact of hot flashes. This program teaches you practical techniques week by week.",
    modules: [
      { week: 1, title: "Understanding your triggers", lessons: [
        { day: 1, title: "What actually happens during a hot flash", content: "Hot flashes occur when your hypothalamus — the brain's thermostat — becomes more sensitive to small changes in body temperature. Understanding the mechanism helps you respond calmly rather than reactively." },
        { day: 2, title: "Identifying your personal triggers", content: "Common triggers include warm environments, spicy food, alcohol, caffeine, and stress — but triggers are individual. Review your Vela logs today. Which days had hot flashes, and what context did you log?" },
        { day: 3, title: "The stress-hot flash connection", content: "Stress activates your sympathetic nervous system, which can trigger or intensify hot flashes. This week, notice: do hot flashes happen more during stressful moments?" },
        { day: 5, title: "Your trigger map", content: "By now you may see patterns. Write down your top 3 suspected triggers. Over the next weeks, we'll test these hypotheses with your tracking data." },
        { day: 7, title: "Week 1 reflection", content: "Review your logs from this week. How many hot flashes did you have? Any patterns with time of day, stress, or context? This is your baseline." },
      ]},
      { week: 2, title: "Paced breathing & relaxation", lessons: [
        { day: 1, title: "Introduction to paced breathing", content: "Slow, diaphragmatic breathing at 5-7 breaths per minute has been shown to reduce hot flash frequency in some studies. Try it: breathe in for 5 counts, out for 5 counts, for 5 minutes." },
        { day: 2, title: "Using paced breathing in the moment", content: "When you feel a hot flash beginning, start paced breathing immediately. The goal isn't to stop it — it's to reduce the distress and duration. Practice during a calm moment first." },
        { day: 3, title: "Progressive muscle relaxation", content: "Tense each muscle group for 5 seconds, then release. Start from your toes and work up. This activates the parasympathetic nervous system, counteracting the stress response." },
        { day: 5, title: "Building a relaxation routine", content: "Choose one technique — paced breathing or progressive relaxation — and practice it twice daily this week. Consistency matters more than duration. Even 3 minutes counts." },
        { day: 7, title: "Week 2 check-in", content: "Compare this week's hot flash count to last week. Even if the number hasn't changed, has your experience of them shifted? Reduced distress is a real and measurable outcome." },
      ]},
      { week: 3, title: "Cognitive restructuring", lessons: [
        { day: 1, title: "Thoughts about hot flashes matter", content: "Research shows that catastrophic thoughts ('Everyone can see me sweating,' 'I can't handle this') intensify the hot flash experience. Today, notice your automatic thoughts when a hot flash occurs." },
        { day: 2, title: "Challenging unhelpful thoughts", content: "When you notice a negative thought, ask: Is this definitely true? What would I say to a friend? A hot flash is uncomfortable but temporary — it typically peaks in 3-5 minutes." },
        { day: 3, title: "Replacing with balanced thoughts", content: "Instead of 'This is unbearable,' try 'This is uncomfortable, and it will pass in a few minutes.' Instead of 'Everyone notices,' try 'Most people are focused on themselves.'" },
        { day: 5, title: "The acceptance approach", content: "Paradoxically, accepting hot flashes rather than fighting them often reduces their impact. 'I'm having a hot flash. It's temporary. My body is adjusting.' This isn't giving up — it's a proven strategy." },
        { day: 7, title: "Week 3 reflection", content: "Which cognitive technique felt most natural? Write it down. Having a go-to thought pattern ready is the key to making CBT automatic rather than effortful." },
      ]},
      { week: 4, title: "Lifestyle integration", lessons: [
        { day: 1, title: "Your complete toolkit", content: "You now have: trigger awareness, paced breathing, relaxation techniques, and cognitive restructuring. This week, we combine them into a personalized action plan." },
        { day: 2, title: "Environmental strategies", content: "Layer clothing, keep cold water nearby, use a fan. These aren't treatments — they're practical comfort strategies that pair with your CBT techniques." },
        { day: 3, title: "Sleep and hot flashes", content: "Night sweats disrupt sleep, and poor sleep worsens daytime symptoms. Use your relaxation technique before bed. Keep your bedroom cool. Have a change of clothes ready." },
        { day: 5, title: "Your personal action plan", content: "Write your plan: 'When I feel a hot flash coming, I will [your chosen technique]. My thought will be [your balanced thought]. My environmental strategy is [your approach].'" },
        { day: 7, title: "Program complete", content: "Compare your week 4 logs to week 1. Most women see improvement in hot flash distress, even if frequency hasn't changed. Reduced distress IS success. Continue using your techniques — they get easier with practice." },
      ]},
    ],
    xpReward: 200,
  },
  {
    id: "cbt-sleep",
    title: "Better Sleep",
    subtitle: "3-week CBT-I program",
    icon: "🌙",
    weeks: 3,
    desc: "CBT for insomnia (CBT-I) is the gold-standard first-line treatment recommended by NAMS. This program teaches core CBT-I techniques adapted for menopausal sleep issues.",
    modules: [
      { week: 1, title: "Sleep foundations", lessons: [
        { day: 1, title: "How menopause affects sleep", content: "Declining estrogen and progesterone directly affect sleep architecture. Night sweats, anxiety, and bladder urgency add further disruption. Understanding the causes helps you target solutions." },
        { day: 2, title: "Sleep hygiene basics", content: "Consistent wake time (even weekends), cool bedroom (65-68°F), dark room, no screens 30 min before bed. These aren't enough alone but form the foundation." },
        { day: 3, title: "The sleep window", content: "If you're in bed 9 hours but sleeping 6, your brain associates bed with being awake. Counterintuitively, spending less time in bed can improve sleep quality. Track your actual sleep hours this week." },
        { day: 5, title: "Stimulus control", content: "Rule: bed is only for sleep (and intimacy). If you're awake for 20+ minutes, get up and do something boring in dim light. Return when drowsy. This re-trains your brain's bed-sleep association." },
        { day: 7, title: "Week 1 review", content: "Check your Vela logs: what's your average sleep this week? What time did you go to bed vs fall asleep? This data helps you set a realistic sleep window for next week." },
      ]},
      { week: 2, title: "Cognitive techniques for sleep", lessons: [
        { day: 1, title: "Racing thoughts at bedtime", content: "Write worries in a 'worry journal' before bed — not in bed. Literally tell your brain: 'I've noted this. I'll address it tomorrow.' The act of writing externalizes the thought." },
        { day: 2, title: "Clock-watching worsens insomnia", content: "Turn your clock away. Checking the time triggers anxiety ('It's 2am and I'm still awake!'), which triggers adrenaline, which prevents sleep. The time doesn't matter — only sleepiness does." },
        { day: 3, title: "Managing night sweats", content: "If night sweats wake you: have a cool damp cloth ready, change clothes if needed, use your paced breathing. Don't check the time. Focus on returning to sleep, not the disruption." },
        { day: 5, title: "Daytime habits that affect sleep", content: "No caffeine after noon. Regular exercise (but not within 3 hours of bedtime). Brief morning sunlight exposure helps set your circadian rhythm. Small changes compound." },
        { day: 7, title: "Week 2 check-in", content: "Compare your sleep hours this week to last week. Are you falling asleep faster? Waking less? Even small improvements indicate your brain is re-learning healthy sleep patterns." },
      ]},
      { week: 3, title: "Sustaining good sleep", lessons: [
        { day: 1, title: "Relaxation for sleep", content: "Try progressive muscle relaxation or a body scan meditation before bed. These activate the parasympathetic nervous system. The key is consistency — same technique, same time, every night." },
        { day: 2, title: "When to talk to your doctor", content: "If sleep issues persist despite CBT-I techniques, discuss with your healthcare provider. They may evaluate for sleep apnea (more common post-menopause) or discuss short-term medication options." },
        { day: 3, title: "Building your sleep routine", content: "Your ideal routine: dim lights 1 hour before bed → worry journal → relaxation technique → bed (only when drowsy). This routine becomes a sleep signal for your brain." },
        { day: 5, title: "Handling setbacks", content: "Bad nights will happen — that's normal. Don't compensate by sleeping in or napping long. Stick to your wake time. One bad night doesn't erase your progress." },
        { day: 7, title: "Program complete", content: "Review your 3 weeks of sleep data. CBT-I shows cumulative benefit — your best improvements may come in the weeks after completing this program. Keep using your techniques." },
      ]},
    ],
    xpReward: 150,
  },
  {
    id: "cbt-anxiety",
    title: "Anxiety & Mood",
    subtitle: "4-week CBT program",
    icon: "🧠",
    weeks: 4,
    desc: "Anxiety and mood changes are among the most common perimenopause symptoms. This evidence-based program builds skills for managing both hormonal and situational mood shifts.",
    modules: [
      { week: 1, title: "Understanding mood changes", lessons: [
        { day: 1, title: "Why menopause affects mood", content: "Estrogen modulates serotonin, dopamine, and norepinephrine. When estrogen fluctuates unpredictably during perimenopause, so do these mood-regulating neurotransmitters. This is biology, not weakness." },
        { day: 2, title: "Anxiety vs worry", content: "Worry is about specific things. Anxiety is a general state of unease, often with physical symptoms (racing heart, tension, dread). During perimenopause, anxiety often appears without a clear cause." },
        { day: 3, title: "Tracking mood patterns", content: "Use your Vela mood and energy logs to spot patterns. Is anxiety worse at certain times? On certain days? After poor sleep? Data removes guesswork." },
        { day: 5, title: "The thought-feeling-behavior cycle", content: "Thoughts ('Something bad will happen') create feelings (anxiety) which drive behaviors (avoidance). CBT breaks this cycle by targeting thoughts. You'll learn how this week." },
        { day: 7, title: "Week 1 baseline", content: "Review your mood logs from this week. What was your average mood score? How many days did you log anxiety? This is your starting point." },
      ]},
      { week: 2, title: "Challenging anxious thoughts", lessons: [
        { day: 1, title: "Catching automatic thoughts", content: "When you feel anxious, pause and ask: 'What am I thinking right now?' Write the thought down. Often, awareness alone reduces its power. Common ones: catastrophizing, mind-reading, fortune-telling." },
        { day: 2, title: "Evidence for and against", content: "For each anxious thought, list evidence supporting it AND evidence against it. Usually the 'against' column is longer. This isn't positive thinking — it's balanced thinking." },
        { day: 3, title: "Decatastrophizing", content: "Ask: 'What's the worst that could happen? How would I cope? What's most likely to happen?' Most catastrophic predictions never materialize, and you're more resilient than anxiety tells you." },
        { day: 5, title: "Behavioral experiments", content: "Test your anxious predictions. If you think 'I'll fall apart if I go to that event,' go and observe what actually happens. Real-world evidence is the strongest antidote to anxiety." },
        { day: 7, title: "Week 2 reflection", content: "Which challenging technique worked best for you? There's no wrong answer. The technique that feels most natural is the one you'll actually use." },
      ]},
      { week: 3, title: "Building resilience", lessons: [
        { day: 1, title: "The role of exercise", content: "Exercise has strong Level I evidence for improving mood during menopause. Even 30 minutes of brisk walking produces mood benefits. It's not about fitness — it's about neurochemistry." },
        { day: 2, title: "Social connection matters", content: "Isolation worsens anxiety. Schedule one social interaction this week, even brief. The Vela community counts — connecting with others who understand your experience has measurable benefits." },
        { day: 3, title: "Grounding techniques", content: "When anxiety spikes, try 5-4-3-2-1: Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. This redirects your brain from threat mode to sensory mode." },
        { day: 5, title: "Self-compassion", content: "Talk to yourself like you'd talk to a friend going through this. 'This is hard, and it's okay to struggle. Many women experience this, and it does get better.' Self-compassion reduces cortisol." },
        { day: 7, title: "Week 3 check-in", content: "Compare your mood scores to week 1. Are you seeing improvement? Remember: CBT is a skill — like any skill, it improves with practice." },
      ]},
      { week: 4, title: "Your maintenance plan", lessons: [
        { day: 1, title: "Recognizing warning signs", content: "What are YOUR early signs of mood dipping? Changes in sleep, appetite, motivation, or social withdrawal? Catching it early means intervening early." },
        { day: 2, title: "Your wellness toolkit", content: "List your top 3 strategies from this program. Maybe it's challenging thoughts, exercise, and grounding. Write them where you'll see them. Simplicity is key." },
        { day: 3, title: "When to seek more help", content: "CBT self-help is effective for mild-moderate anxiety. If symptoms are severe, persistent, or interfering with daily life, talk to your healthcare provider. Therapy and/or medication may be appropriate." },
        { day: 5, title: "Hormones aren't everything", content: "Menopause coincides with major life changes: aging parents, empty nest, career shifts, relationship changes. Address ALL contributors to mood, not just hormonal ones." },
        { day: 7, title: "Program complete", content: "You've built real skills. Mood changes during menopause typically improve over time, especially with the tools you now have. Continue tracking — your data shows your progress." },
      ]},
    ],
    xpReward: 200,
  },
];

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
    --glass-cream:        rgba(250, 246, 241, 0.72);   /* warm cream glass — primary floating surfaces */
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

    /* Liquid Glass tokens (dark) — warm dark glass keeps the calm, never reads as gray */
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

  /* Sticky glass header on Today */
  .vela-header {
    position: sticky; top: 0; z-index: 10;
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

  /* Section label (single source — overrides earlier .section-label) */
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

  /* Reveal card — sage glass with radial gradient overlay */
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

  /* Mood row — square aspect tiles with custom SVG faces */
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

  /* Energy row — 5 tiles with custom SVG bar glyph */
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

  /* Symptom grid — 3 columns, severity strip below name */
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

  /* Context cards — 2-col grid */
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
  .suggest-card .suggest-cta { display: inline-flex; align-items: center; gap: 6px; background: var(--sage); color: #fff; border: none; border-radius: 999px; padding: 8px 14px 8px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; margin-left: 38px; }

  /* Experiment promo CTA — when no experiments exist */
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

  /* Shelf — horizontal scroll cards */
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
  .ask-vela-fab { position: fixed; right: 14px; bottom: calc(env(safe-area-inset-bottom, 0px) + 84px); background: var(--glass-cream-strong); -webkit-backdrop-filter: var(--glass-blur-strong); backdrop-filter: var(--glass-blur-strong); border: 1px solid var(--border); box-shadow: inset 0 1px 0 var(--glass-edge), 0 10px 24px rgba(140, 78, 50, 0.18), 0 2px 6px rgba(140, 78, 50, 0.10); border-radius: 999px; padding: 6px 12px 6px 6px; display: inline-flex; align-items: center; gap: 7px; z-index: 25; cursor: pointer; font-family: var(--font-sans); transition: transform 100ms ease; }
  .ask-vela-fab:active { transform: scale(0.97); }
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

  .cir-first-welcome { margin: 4px 0 18px; padding: 18px 18px 16px; border-radius: 18px; background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,242,234,0.78)); border: 1px solid rgba(94,80,62,0.10); }
  .cir-first-eye { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; color: var(--sage-dark); margin-bottom: 10px; }
  .cir-first-welcome h3 { margin: 0 0 8px; font-family: var(--font-serif); font-weight: 400; font-size: 22px; line-height: 1.18; color: var(--ink); }
  .cir-first-welcome h3 em { font-style: italic; color: var(--clay); }
  .cir-first-welcome p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.55; color: var(--ink-mid); }
  .cir-first-rules { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 11.5px; color: var(--ink-light); }
  .cir-first-rules span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 999px; background: rgba(94,80,62,0.05); border: 1px solid rgba(94,80,62,0.08); }

  /* ── SCREENS ── */
  /* padding-bottom leaves room for the fixed bottom bar (52px + safe-area + breathing room) */
  .screen { display: none; flex-direction: column; padding-bottom: 96px; animation: fadeIn 0.3s ease; }
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

// ─── Onboarding Screen ────────────────────────────────────────────────────────

function OnboardingScreen({ onComplete }) {
  // Restore mid-flow progress so closing/reopening doesn't reset onboarding
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("vela_onboarding_progress") || "null"); }
    catch { return null; }
  })();
  // step = 0 (welcome) | 1..4 (questions) | 5 (summary)
  const initialStep = Math.min(saved?.qIndex ?? 0, 5);
  const initialAnswers = saved?.answers && typeof saved.answers === "object" ? saved.answers : {};

  const [step, setStep] = useState(initialStep);
  const [answers, setAnswers] = useState(initialAnswers);
  const [transitioning, setTransitioning] = useState(false);

  // Persist progress on every change so close-and-reopen resumes mid-flow
  useEffect(() => {
    try {
      localStorage.setItem("vela_onboarding_progress", JSON.stringify({ qIndex: step, answers }));
    } catch { /* private mode — fine */ }
  }, [step, answers]);

  const total = QUESTIONS.length;

  function setAnswer(qIdx, value) { setAnswers((a) => ({ ...a, [qIdx]: value })); }
  function toggleConcernIdx(qIdx, optIdx, max) {
    setAnswers((a) => {
      const cur = Array.isArray(a[qIdx]) ? a[qIdx] : [];
      if (cur.includes(optIdx)) return { ...a, [qIdx]: cur.filter((x) => x !== optIdx) };
      if (max && cur.length >= max) return a;
      return { ...a, [qIdx]: [...cur, optIdx] };
    });
  }

  function handleStart() {
    try { localStorage.removeItem("vela_onboarding_progress"); } catch { /* ignore */ }
    onComplete(answers);
  }

  function go(nextStep) {
    if (transitioning) return;
    haptic("Light");
    setTransitioning(true);
    setTimeout(() => { setStep(nextStep); setTransitioning(false); }, 180);
  }

  // ─── Step 0: Welcome ─────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="screen active onb-app">
        <div className="onb-welcome">
          <div className="top">
            <div>
              <div className="mark">Ve<em>la</em></div>
              <div className="tag" style={{ marginTop: 18 }}>For the change, by the changing</div>
            </div>
            <h1>A quiet place for the <em>noisy years.</em></h1>
            <p className="blurb">
              Vela learns the rhythm of your body — hot flashes, sleep, mood, the
              rest — and shows you what's actually going on. No coaching, no fixes.
              Just your data, kept private and made plain.
            </p>
            <div className="pillars">
              <div className="pillar">
                <div className="ico"><UIIcon name="Lock" size={18} /></div>
                <span>On-device</span>
              </div>
              <div className="pillar">
                <div className="ico"><UIIcon name="ChartBar" size={18} /></div>
                <span>Patterns</span>
              </div>
              <div className="pillar">
                <div className="ico"><UIIcon name="FileText" size={18} /></div>
                <span>For your MD</span>
              </div>
            </div>
          </div>
          <div className="bottom">
            <button className="onb-next" onClick={() => go(1)}>
              Begin <UIIcon name="ArrowRight" size={16} />
            </button>
            <span className="privacy">
              <UIIcon name="Lock" size={11} /> Takes about 90 seconds
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 5: Summary ─────────────────────────────────────────────────────
  if (step === 5) {
    const stageOpt = QUESTIONS[0].opts[answers[0]];
    const stageLabel = stageOpt?.label || "your stage";
    // Stage labels read like "Periods are irregular (perimenopause)" — for
    // sentence usage ("Track signals that matter for X", "X, focused on Y")
    // we prefer the parenthetical short form when present, falling back to
    // the full label so the copy stays readable.
    const stageShort = (() => {
      const m = stageLabel.match(/\(([^)]+)\)/);
      if (m) return m[1].toLowerCase();
      // Strip any trailing parenthetical or comma clause for cleanliness
      return stageLabel.toLowerCase().replace(/\s*\([^)]*\)\s*/g, "").trim();
    })();
    const concernIdxs = Array.isArray(answers[1]) ? answers[1] : [];
    const concernLabels = concernIdxs.map((i) => QUESTIONS[1].opts[i]?.label).filter(Boolean);
    const goalIdxs = Array.isArray(answers[2]) ? answers[2] : (answers[2] != null ? [answers[2]] : []);
    const primaryGoal = goalIdxs[0];
    const guidanceIdx = answers[3];

    const items = [];
    items.push({
      title: `Track signals that matter for ${stageShort}`,
      detail: concernLabels.length
        ? `Starting with ${concernLabels.slice(0, 2).join(" and ").toLowerCase()}${concernLabels.length > 2 ? ` +${concernLabels.length - 2} more` : ""}.`
        : "We'll surface the most relevant symptoms as you log.",
    });
    items.push({
      title: "Find your patterns after seven days",
      detail: "Once we have a baseline, Vela connects sleep, stress, cycle, and symptoms.",
    });
    if (primaryGoal === 1) {
      items.push({ title: "Build a doctor-ready report", detail: "Your data, summarized for a 15-minute appointment." });
    } else if (primaryGoal === 2) {
      items.push({ title: "Run small experiments", detail: "Test one change at a time. See what actually helps." });
    } else if (primaryGoal === 3) {
      items.push({ title: "Open the Circle", detail: "An anonymous prompt each day. Read, react, or just listen." });
    } else {
      items.push({ title: "Make sense of your data", detail: "Plain-language insights, never advice." });
    }
    if (guidanceIdx === 0) items.push({ title: "Two gentle nudges a day", detail: "Morning and evening — turn them off any time." });
    else if (guidanceIdx === 1) items.push({ title: "Sunday summaries", detail: "One quiet email each week, nothing more." });
    else if (guidanceIdx === 2) items.push({ title: "No notifications", detail: "You'll come to Vela on your own time." });

    return (
      <div className="screen active onb-app">
        <div className="onb-summary">
          <div className="body">
            <div className="onb-progress" style={{ paddingTop: 0 }}>
              <button className="back invisible" aria-hidden="true">
                <UIIcon name="ArrowRight" size={14} />
              </button>
              <div className="track"><div className="fill" style={{ width: "100%" }} /></div>
              <span className="step">Done</span>
            </div>
            <h1>Here's what <em>Vela will do</em> for you.</h1>
            <p className="lede">Built from your answers. You can change any of this in Settings later.</p>

            <div className="onb-summary-card">
              <span className="eye"><UIIcon name="Sparkle" size={11} /> Your starting point</span>
              <h2>
                {stageOpt
                  ? <>{stageShort}, focused on <em>{concernLabels[0]?.toLowerCase() || "feeling like yourself"}</em></>
                  : <>Getting started</>}
              </h2>
              <p>
                {primaryGoal === 1
                  ? "We'll build toward your next appointment. Two weeks of consistent logging is usually enough for a clear story."
                  : primaryGoal === 2
                  ? "Track for seven days, then we'll suggest one small experiment based on what we see."
                  : primaryGoal === 3
                  ? "Today's prompt is waiting in the Circle. No name, no thread — just shared moments."
                  : "Log when you can. After a week, the patterns start to surface on their own."}
              </p>
            </div>

            <div className="onb-summary-list">
              {items.map((it, i) => (
                <div key={i} className="onb-summary-row">
                  <span className="num">{i + 1}</span>
                  <div className="text">
                    <strong>{it.title}</strong>
                    <small>{it.detail}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="onb-summary-edits">
              <UIIcon name="Sparkle" size={13} />
              <span>Want to change something? <button type="button" onClick={() => go(1)} style={{ background: "none", border: "none", padding: 0, color: "var(--clay-dark)", fontWeight: 600, textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Review your answers</button>.</span>
            </div>
          </div>
          <div className="onb-footer">
            <button className="onb-next" onClick={handleStart}>
              Enter Vela <UIIcon name="ArrowRight" size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Steps 1-4: Questions ────────────────────────────────────────────────
  const qIdx = step - 1;
  const q = QUESTIONS[qIdx];
  const isMulti = !!q.multi;
  const value = answers[qIdx];
  const canNext = isMulti ? Array.isArray(value) && value.length > 0 : value !== undefined && value !== null;
  const max = q.max || 5;
  const ctLabel = isMulti && Array.isArray(value)
    ? (value.length === 0 ? "Pick at least one to continue." : `${value.length} of ${max} selected`)
    : null;

  return (
    <div className="screen active onb-app">
      <div className="onb-scroll">
        <div className="onb-progress">
          <button
            className={`back${step === 1 ? " invisible" : ""}`}
            onClick={() => go(step - 1)}
            aria-label="Back"
          >
            <UIIcon name="ArrowRight" size={14} style={{ transform: "rotate(180deg)" }} />
          </button>
          <div className="track"><div className="fill" style={{ width: `${(step / total) * 100}%` }} /></div>
          <span className="step">{step} / {total}</span>
        </div>
        <div className={`onb-question ${transitioning ? "" : ""}`}>
          <span className="eyebrow"><UIIcon name="Sparkle" size={11} /> {q.eyebrow}</span>
          <h1>{q.headline}</h1>
          <p className="subhead">{q.sub}</p>

          {isMulti ? (
            <div className="onb-chip-grid">
              {q.opts.map((opt, i) => {
                const sel = Array.isArray(value) && value.includes(i);
                const idx = Array.isArray(value) ? value.indexOf(i) : -1;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`onb-chip${sel ? " selected" : ""}`}
                    onClick={() => toggleConcernIdx(qIdx, i, max)}
                  >
                    <span className="glyph"><UIIcon name={opt.icon} size={16} /></span>
                    <span className="label">{opt.label}</span>
                    {sel && <span className="pin">{idx + 1}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="onb-options">
              {q.opts.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  className={`onb-option${value === i ? " selected" : ""}`}
                  onClick={() => setAnswer(qIdx, i)}
                >
                  <span className="glyph"><UIIcon name={opt.icon} size={18} /></span>
                  <span className="body">
                    <span className="label">{opt.label}</span>
                    {opt.hint && <span className="hint">{opt.hint}</span>}
                  </span>
                  <span className="check"><UIIcon name="CheckCircle" size={12} /></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="onb-footer">
        {ctLabel && <p className="helper">{ctLabel}</p>}
        <button
          className="onb-next"
          disabled={!canNext}
          onClick={() => go(step === total ? 5 : step + 1)}
        >
          {step === total ? "See your plan" : "Continue"} <UIIcon name="ArrowRight" size={16} />
        </button>
      </div>
    </div>
  );
}

function TrackerScreen({ onLog, logs, profile, isPremium, onNavigate, onShowPaywall }) {
  const [mood, setMood] = useState(null);
  const [activeSymptoms, setActiveSymptoms] = useState({});
  const [severities, setSeverities] = useState({});
  const [notes, setNotes] = useState("");
  const personalization = getPersonalization(profile);
  const [symptomCat, setSymptomCat] = useState(personalization?.defaultSymptomCat || "common");
  const [sleepHours, setSleepHours] = useState(null);
  const [stress, setStress] = useState(null);
  const [caffeine, setCaffeine] = useState(null);
  const [alcohol, setAlcohol] = useState(null);
  const [exercise, setExercise] = useState(null);
  // customSymptoms persisted; the inline-add-modal UI is gone in the redesign
  // but existing user-defined symptoms continue to render in the grid.
  const [customSymptoms] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_custom_symptoms")) || []; } catch { return []; }
  });
  const [periodLogged, setPeriodLogged] = useState(null);
  const [periodFlow, setPeriodFlow] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [showCelebration, setShowCelebration] = useState(null);
  // HealthKit auto-fill — pulls yesterday's sleep when permission's been
  // granted. Sets a flag so the UI can show "Synced from Apple Health"
  // and the user can override by tapping the +/- buttons.
  const [hkSyncedSleep, setHkSyncedSleep] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isHealthKitEnabled()) return;
      const hours = await fetchYesterdaySleep();
      if (cancelled || hours == null) return;
      setSleepHours((current) => current == null ? hours : current);
      setHkSyncedSleep(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const allSymptoms = [...SYMPTOMS, ...customSymptoms];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const streak = getStreak(logs);
  const journeyStage = profile ? getJourneyLabel(profile[0]) : null;

  function toggleSymptom(name) {
    setActiveSymptoms((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = true;
      return next;
    });
  }

  const canLog = mood !== null || Object.keys(activeSymptoms).length > 0;

  function handleLog() {
    if (!canLog) return;
    haptic("Medium");

    // Capture celebration data before clearing state
    const entrySymptoms = Object.keys(activeSymptoms);
    const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size + (logs.some((l) => l.date.slice(0, 10) === localDateStr(new Date())) ? 0 : 1);
    const currentStreak = getStreak(logs);
    const stats = computeEarlyStats(logs);
    const daysLeft = Math.max(0, 7 - uniqueDays);
    const p = getPersonalization(profile);
    const concern = p?.topConcernNames?.[0];

    let celebTitle = "Entry logged!";
    let celebText = "";
    let celebIcon = "✓";

    if (uniqueDays === 1) {
      celebTitle = "Your journey begins!";
      celebText = "6 more days until your first pattern report.";
      celebIcon = "🌱";
    } else if (uniqueDays === 2) {
      celebTitle = "Day 2 — building your baseline";
      celebText = concern
        ? `Vela is now watching your ${concern} patterns. 5 more days to insights.`
        : "Building your baseline. 5 more days to insights.";
      celebIcon = "📊";
    } else if (uniqueDays === 3) {
      celebTitle = "Early patterns forming";
      celebText = stats?.topSymptom
        ? `Your most logged symptom so far: ${stats.topSymptom[0]}. 4 more days for deeper analysis.`
        : "Your data is starting to tell a story. 4 more days to go.";
      celebIcon = "🔍";
    } else if (uniqueDays >= 4 && uniqueDays < 7) {
      celebTitle = `${daysLeft} day${daysLeft !== 1 ? "s" : ""} to insights`;
      celebText = concern
        ? `Almost there! Vela will reveal what triggers your ${concern}.`
        : "Almost there! Your personalized patterns are taking shape.";
      celebIcon = "🌟";
    } else if (uniqueDays === 7) {
      celebTitle = "Insights unlocked!";
      celebText = "Your first week is complete. Head to Insights to see your patterns.";
      celebIcon = "✨";
    } else {
      // Streak milestone celebrations
      if (currentStreak === 30) {
        celebTitle = "30-day streak!";
        celebText = "A full month of tracking. You now have powerful data about your body's patterns. This is the kind of consistency that changes how you manage your health.";
        celebIcon = "👑";
      } else if (currentStreak === 21) {
        celebTitle = "21-day streak!";
        celebText = "Three weeks strong. Research shows it takes 21 days to form a habit — tracking is now part of your routine.";
        celebIcon = "🏆";
      } else if (currentStreak === 14) {
        celebTitle = "14-day streak!";
        celebText = "Two solid weeks! Vela can now compare week-over-week trends and spot patterns that shorter tracking misses.";
        celebIcon = "⭐";
      } else if (currentStreak >= 3) {
        celebTitle = `${currentStreak}-day streak!`;
        celebIcon = "🔥";
      }
      if (![14, 21, 30].includes(currentStreak)) {
        celebText = entrySymptoms.length > 0
          ? `Logged ${entrySymptoms.length} symptom${entrySymptoms.length !== 1 ? "s" : ""}. Your pattern clarity keeps improving.`
          : "Every entry sharpens your insights.";
      }
    }

    setShowCelebration({
      title: celebTitle,
      text: celebText,
      icon: celebIcon,
      streak: currentStreak,
      uniqueDays,
      symptomCount: entrySymptoms.length,
      moodEmoji: mood !== null ? MOODS[mood] : null,
    });

    onLog({ mood, energy, symptoms: activeSymptoms, severities, notes, context: { sleepHours, stress, caffeine, alcohol, exercise, period: periodLogged, periodFlow } });
    setMood(null);
    setEnergy(null);
    setActiveSymptoms({});
    setSeverities({});
    setNotes("");
    setSleepHours(null);
    setStress(null);
    setCaffeine(null);
    setAlcohol(null);
    setExercise(null);
    setPeriodLogged(null);
    setPeriodFlow(null);

    setTimeout(() => setShowCelebration(null), 4500);
  }

  // ─── Reveal card content derived from real user data state ─────────────────
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const dataState = uniqueDays === 0 ? "empty" : uniqueDays < 7 ? "building" : "rich";
  const correlations = dataState === "rich" ? analyzeCorrelations(logs) : [];
  const topCorr = correlations[0];
  const reveal = (() => {
    if (dataState === "empty") {
      return {
        eyebrow: "Day 1 · Welcome",
        headline: <>This is where your <em>patterns</em> will live.</>,
        body: "Log today below — even a quick mood check counts. After seven days, Vela starts surfacing the rhythms in your symptoms.",
        chartType: "none",
        foot: "Up to 80% of women experience hot flashes during the menopausal transition.",
        link: null,
      };
    }
    if (dataState === "building") {
      const left = 7 - uniqueDays;
      return {
        eyebrow: `Day ${uniqueDays} · Building your baseline`,
        headline: <>Patterns will emerge in <em>{left} more day{left !== 1 ? "s" : ""}.</em></>,
        body: "Keep logging daily — even a quick mood check counts. Your first weekly pattern report unlocks at seven days.",
        chartType: "build",
        foot: `${uniqueDays} of 7 days logged so far.`,
        link: null,
      };
    }
    // rich
    if (topCorr) {
      return {
        eyebrow: "Yesterday's pattern",
        headline: <>{topCorr.text}</>,
        body: "A consistent signal worth showing your provider. Tap below to see the full pattern report.",
        chartType: "rich",
        foot: `${uniqueDays} days tracked · ${logs.length} entries`,
        link: "Open Insights",
      };
    }
    return {
      eyebrow: "Your baseline",
      headline: <>{uniqueDays} days of data, <em>still listening.</em></>,
      body: "Vela is watching for cross-symptom triggers. Stronger patterns appear with more consistent logging.",
      chartType: "rich",
      foot: `${uniqueDays} days tracked · ${logs.length} entries`,
      link: "Open Insights",
    };
  })();

  // Mood face mapping (data 0-4 → expressive face)
  const MOOD_FACES = ["rough", "low", "okay", "good", "great"];
  const MOOD_LABELS = ["Rough", "Low", "Okay", "Good", "Great"];

  // Energy labels (data 1-5 → 5 ascending tiles)
  const ENERGY_LABELS = ["Depleted", "Low", "Steady", "Good", "Bright"];

  function bumpSev(name, e) {
    e.stopPropagation();
    if (!activeSymptoms[name]) {
      setActiveSymptoms({ ...activeSymptoms, [name]: true });
      setSeverities({ ...severities, [name]: 1 });
      return;
    }
    const cur = severities[name] || 1;
    const next = cur >= 3 ? 1 : cur + 1;
    setSeverities({ ...severities, [name]: next });
  }

  const symptomCount = Object.keys(activeSymptoms).length;
  const symptomCats = [
    { key: "common", label: "Most common" },
    { key: "mood", label: "Mood" },
    { key: "physical", label: "Physical" },
    { key: "intimate", label: "Intimate" },
    { key: "digestive", label: "Digestive" },
    { key: "other", label: "Other" },
  ];
  const symptomsForCat = allSymptoms.filter((s) => s.cat === symptomCat);

  const summary = (() => {
    const parts = [];
    if (mood !== null) parts.push(MOOD_LABELS[mood]);
    if (symptomCount > 0) parts.push(`${symptomCount} symptom${symptomCount !== 1 ? "s" : ""}`);
    if (energy !== null) parts.push(`${ENERGY_LABELS[energy - 1]?.toLowerCase()} energy`);
    if (sleepHours !== null) parts.push(`${sleepHours}h sleep`);
    return parts;
  })();

  return (
    <div className="screen active vela-app">
      {/* Sticky glass header */}
      <header className="vela-header">
        <div className="vela-header-row">
          <span className="vela-wordmark">Ve<em>la</em></span>
          {streak > 0 && (
            <span className="vela-header-streak">
              <UIIcon name="Sparkle" size={12} /> {streak}-day streak
            </span>
          )}
        </div>
      </header>

      {/* Greeting */}
      <section className="vela-greeting">
        <h1>{getGreeting()}.</h1>
        <p className="meta">{today}{journeyStage ? <> <span className="dot">·</span> {journeyStage}</> : null}</p>
      </section>

      {/* Reveal card — content morphs by data state */}
      <section
        className="reveal-card-v2"
        onClick={reveal.link ? () => onNavigate && onNavigate("insights") : undefined}
        style={reveal.link ? { cursor: "pointer" } : undefined}
      >
        <div className="reveal-eyebrow">
          <UIIcon name="Sparkle" size={11} /> {reveal.eyebrow}
        </div>
        <h2 className="reveal-headline-v2">{reveal.headline}</h2>
        <p className="reveal-body-v2">{reveal.body}</p>
        <RevealChart kind={reveal.chartType} />
        <div className="reveal-foot">
          <span>{reveal.foot}</span>
          {reveal.link && (
            <span className="reveal-link">
              {reveal.link} <UIIcon name="ArrowRight" size={12} />
            </span>
          )}
        </div>
      </section>

      {/* Mood */}
      <div className="today-section-label">
        <span>How are you, today?</span>
        {mood !== null && <span className="hint">{MOOD_LABELS[mood]}</span>}
      </div>
      <div className="mood-row">
        {MOOD_FACES.map((face, i) => (
          <button
            key={face}
            type="button"
            className={`mood-tile${mood === i ? " active" : ""}`}
            onClick={() => { haptic("Light"); setMood(mood === i ? null : i); }}
            aria-label={MOOD_LABELS[i]}
            aria-pressed={mood === i}
          >
            <MoodFace kind={face} size={30} />
            {mood === i && <span className="label">{MOOD_LABELS[i]}</span>}
          </button>
        ))}
      </div>

      {/* Energy */}
      <div className="today-section-label"><span>Energy</span></div>
      <div className="energy-row-v2">
        {ENERGY_LABELS.map((label, i) => {
          const level = i + 1;
          return (
            <button
              key={label}
              type="button"
              className={`energy-tile${energy === level ? " active" : ""}`}
              onClick={() => { haptic("Light"); setEnergy(energy === level ? null : level); }}
              aria-pressed={energy === level}
            >
              <EnergyGlyph level={level} size={30} />
              <span className="label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Symptoms */}
      <div className="today-section-label">
        <span>Symptoms</span>
        {symptomCount > 0 && <span className="hint">{symptomCount} logged · tap dots for severity</span>}
      </div>
      <div className="seg" role="tablist">
        {symptomCats.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={symptomCat === c.key}
            className={symptomCat === c.key ? "active" : ""}
            onClick={() => { haptic("Light"); setSymptomCat(c.key); }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="symptom-grid-v2">
        {symptomsForCat.map((s) => {
          const isActive = !!activeSymptoms[s.name];
          const sev = severities[s.name] || 0;
          return (
            <button
              key={s.cat + s.name}
              type="button"
              className={`symptom-tile-v2${isActive ? " active" : ""}`}
              onClick={() => { haptic("Light"); toggleSymptom(s.name); }}
            >
              <SymptomIcon name={s.icon} size={26} />
              <span className="name">{s.name}</span>
              <div className="severity-strip" onClick={(e) => bumpSev(s.name, e)} aria-label="Tap to set severity">
                <span className={`sev-dot${sev >= 1 ? " on" : ""}`} />
                <span className={`sev-dot${sev >= 2 ? " on" : ""}`} />
                <span className={`sev-dot${sev >= 3 ? " on" : ""}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Context */}
      <div className="today-section-label"><span>Context</span><span className="hint">Optional</span></div>
      <div className="context-grid">
        {/* Sleep — stepper. Auto-fills from Apple Health when enabled. */}
        <div className="context-card">
          <div className="label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><UIIcon name="Bed" size={13} /> Sleep</span>
            {hkSyncedSleep && (
              <span className="hk-pill" title="Pulled from Apple Health — tap +/− to override">
                <UIIcon name="Heart" size={10} weight="fill" /> Health
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span className="value">
              {sleepHours !== null ? sleepHours : "—"}
              {sleepHours !== null && <span className="unit">hrs</span>}
            </span>
            <div className="context-stepper">
              <button type="button" onClick={() => { setSleepHours(Math.max(0, (sleepHours ?? 7) - 0.5)); setHkSyncedSleep(false); }} aria-label="Decrease sleep">−</button>
              <button type="button" onClick={() => { setSleepHours(Math.min(14, (sleepHours ?? 6.5) + 0.5)); setHkSyncedSleep(false); }} aria-label="Increase sleep">+</button>
            </div>
          </div>
        </div>

        {/* Stress — 1-5 dots */}
        <div className="context-card">
          <div className="label"><UIIcon name="CloudLightning" size={13} /> Stress</div>
          <div>
            <div className="value" style={{ fontSize: 16 }}>
              {stress !== null ? ["Calm", "Mild", "Moderate", "High", "Acute"][stress - 1] : "—"}
            </div>
            <div className="context-dots">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={stress === n ? "on" : ""}
                  onClick={() => { haptic("Light"); setStress(stress === n ? null : n); }}
                  aria-label={`Stress level ${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Period — chips, full width */}
        <div className="context-card" style={{ gridColumn: "1 / -1" }}>
          <div className="label"><UIIcon name="Drop" size={13} /> Period today</div>
          <div className="period-chips">
            {[
              { key: "none", label: "None" },
              { key: "spotting", label: "Spotting" },
              { key: "light", label: "Light" },
              { key: "medium", label: "Medium" },
              { key: "heavy", label: "Heavy" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={periodLogged === key ? "on" : ""}
                onClick={() => {
                  haptic("Light");
                  setPeriodLogged(periodLogged === key ? null : key);
                  setPeriodFlow(key === "none" ? null : key);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Triggers — caffeine / alcohol / exercise (full width).
            Critical for analyzeCorrelations() — kept as toggle chips. */}
        <div className="context-card" style={{ gridColumn: "1 / -1" }}>
          <div className="label"><UIIcon name="Sparkle" size={13} /> Today's triggers</div>
          <div className="period-chips">
            {[
              { key: "caffeine", label: "Caffeine", state: caffeine, setter: setCaffeine },
              { key: "alcohol", label: "Alcohol", state: alcohol, setter: setAlcohol },
              { key: "exercise", label: "Exercise", state: exercise, setter: setExercise },
            ].map(({ key, label, state, setter }) => (
              <button
                key={key}
                type="button"
                className={state === true ? "on" : ""}
                onClick={() => { haptic("Light"); setter(state === true ? null : true); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="today-section-label">
        <span>Note to yourself</span>
        <span className="hint">{notes.length}/500</span>
      </div>
      <div className="notes-card-v2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          placeholder="A line or two on what shaped today — a meeting, a meal, a moment that helped."
        />
      </div>

      {/* Privacy footer */}
      <div className="privacy-footer">
        <UIIcon name="Lock" size={12} />
        <span>Your data stays on this device.</span>
      </div>

      {/* Sticky glass save bar */}
      <div className="save-bar">
        <div className="inner">
          <div className="save-summary">
            {summary.length === 0 ? (
              <em>Tap a mood or symptom to begin.</em>
            ) : (
              <><strong>Today:</strong> {summary.join(" · ")}</>
            )}
          </div>
          <button
            type="button"
            className="save-btn"
            disabled={!canLog}
            onClick={handleLog}
          >
            Save entry
          </button>
        </div>
      </div>


      {showCelebration && (
        <div className="post-log-celebration" onClick={() => setShowCelebration(null)}>
          <div className="celebration-card">
            <div className="celebration-icon">{showCelebration.icon}</div>
            <div className="celebration-title">{showCelebration.title}</div>
            {showCelebration.moodEmoji && (
              <div className="celebration-mood">{showCelebration.moodEmoji}</div>
            )}
            <div className="celebration-text">{showCelebration.text}</div>
            {showCelebration.streak > 1 && (
              <div className="celebration-streak">🔥 {showCelebration.streak}-day streak</div>
            )}
            {showCelebration.uniqueDays < 7 && (
              <div className="celebration-progress">
                <div className="milestone-bar-bg">
                  <div className="milestone-bar" style={{ width: `${(showCelebration.uniqueDays / 7) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Screen ──────────────────────────────────────────────────────────

function HistoryScreen({ logs, isPremium, onShowPaywall, onNavigate }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [filter, setFilter] = useState(null);
  const [openDay, setOpenDay] = useState(null);
  // Entries feed cap — show recent N days by default. The calendar above
  // already gives the spatial overview, so the textual feed can be tighter.
  // Filter implies a search across all data, so it disables the cap.
  const FEED_CAP_DAYS = 14;
  const [showAllEntries, setShowAllEntries] = useState(false);

  const TODAY = new Date();
  // MoodFace replaces system emoji here (same reason as Today/Insights —
  // emoji yellow smileys read childish for the 45-55 audience).
  const MOOD_KIND_HX = ["rough", "low", "okay", "good", "great"];
  const MOOD_LABEL_HX = ["Rough", "Low", "Okay", "Good", "Great"];

  // ─── Build a normalized entries array from real logs ────────────────────
  // Each log groups by day and merges into one entry per day.
  const dailyEntries = (() => {
    const byDay = {};
    logs.forEach((l) => {
      const dayIso = l.date.slice(0, 10);
      const date = new Date(dayIso + "T12:00:00");
      if (!byDay[dayIso]) {
        byDay[dayIso] = {
          d: dayIso,
          date,
          mood: null,
          symptoms: [],
          severities: {},
          sleep: null,
          stress: null,
          period: null,
          notes: null,
          time: null,
        };
      }
      const e = byDay[dayIso];
      // Track latest log time
      const t = new Date(l.date);
      if (!e.time || t > e.time) e.time = t;
      if (l.mood !== null && l.mood !== undefined) e.mood = l.mood;
      Object.keys(l.symptoms || {}).forEach((name) => {
        if (!e.symptoms.find((s) => s.n === name)) {
          const def = SYMPTOMS.find((s) => s.name === name);
          e.symptoms.push({ n: name, icon: def?.icon || "Sparkle" });
        }
        if (l.severities?.[name]) e.severities[name] = l.severities[name];
      });
      if (l.context?.sleepHours != null) e.sleep = l.context.sleepHours;
      if (l.context?.stress != null) e.stress = l.context.stress;
      if (l.context?.period && l.context.period !== "none") {
        e.period = l.context.period.charAt(0).toUpperCase() + l.context.period.slice(1);
      }
      if (l.notes && (!e.notes || l.notes.length > e.notes.length)) e.notes = l.notes;
    });
    return Object.values(byDay).sort((a, b) => a.date - b.date);
  })();

  if (dailyEntries.length === 0) {
    return (
      <div className="screen active">
        <section className="history-greeting">
          <h1>Your <em>journal.</em></h1>
          <p className="meta">Begin your record</p>
        </section>
        <section className="empty-card">
          <div className="glyph"><UIIcon name="FileText" size={26} /></div>
          <h3>Your story <em>starts today.</em></h3>
          <p>Each entry builds a picture of your patterns. After seven days, Vela starts connecting the dots — until then, this is your private journal.</p>
          <button className="cta" type="button" onClick={() => onNavigate && onNavigate("tracker")}>
            <UIIcon name="Sparkle" size={14} /> Log your first entry
          </button>
        </section>
      </div>
    );
  }

  // Apply filter
  const filteredEntries = filter
    ? dailyEntries.filter((e) => e.symptoms.some((s) => s.n === filter))
    : dailyEntries;

  // Reverse for newest-first display
  const allVisibleEntries = [...filteredEntries].reverse();
  // Cap to the most recent N days unless filtering or user expanded.
  // Older entries remain accessible via the calendar above (which always
  // shows the full month) and via the "Show older" button at the feed's end.
  const cappedFeed = !filter && !showAllEntries && allVisibleEntries.length > FEED_CAP_DAYS;
  const visibleEntries = cappedFeed ? allVisibleEntries.slice(0, FEED_CAP_DAYS) : allVisibleEntries;
  const hiddenOlderCount = allVisibleEntries.length - visibleEntries.length;

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalEntries = dailyEntries.length;
  const stats = computeGamificationStats(logs);
  const currentStreak = stats.streak;
  const longestStreak = (() => {
    if (dailyEntries.length === 0) return 0;
    let cur = 1, best = 1;
    for (let i = 1; i < dailyEntries.length; i++) {
      const prev = dailyEntries[i - 1].date;
      const curD = dailyEntries[i].date;
      const diffDays = Math.round((curD - prev) / 86400000);
      if (diffDays === 1) { cur++; best = Math.max(best, cur); } else { cur = 1; }
    }
    return best;
  })();

  // ─── Top symptoms for filter chips ────────────────────────────────────────
  const symFreq = {};
  dailyEntries.forEach((e) => e.symptoms.forEach((s) => { symFreq[s.n] = (symFreq[s.n] || 0) + 1; }));
  const topSymptoms = Object.entries(symFreq).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // ─── Calendar setup ──────────────────────────────────────────────────────
  const base = new Date(TODAY); base.setDate(1); base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear(); const month = base.getMonth();
  const monthLong = base.toLocaleDateString("en-US", { month: "long" });
  const yearStr = String(year);
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function dateIso(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  const lockedBefore = !isPremium ? (() => { const d = new Date(TODAY); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); return d; })() : null;

  function loadClass(entry) {
    if (!entry) return "";
    const c = entry.symptoms?.length || 0;
    if (c === 0) return "has-entry";
    if (c <= 1) return "has-entry";
    if (c <= 2) return "h2";
    if (c <= 3) return "h3";
    return "h4";
  }

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push({ empty: true, key: `e-${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayIso = dateIso(date);
    const entry = dailyEntries.find((e) => e.d === dayIso);
    const isFuture = date > TODAY;
    const isToday = dayIso === dateIso(TODAY);
    const locked = lockedBefore && date < lockedBefore && !isFuture;
    cells.push({ key: dayIso, day: d, entry, isFuture, isToday, locked, dayIso });
  }

  const lockedCount = lockedBefore ? dailyEntries.filter((e) => e.date < lockedBefore).length : 0;

  // Group visible entries by day for the feed
  const grouped = (() => {
    const map = new Map();
    visibleEntries.forEach((e) => {
      if (!map.has(e.d)) map.set(e.d, []);
      map.get(e.d).push(e);
    });
    return Array.from(map.entries());
  })();

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const openEntry = openDay ? dailyEntries.find((e) => e.d === openDay) : null;

  return (
    <div className="screen active">
      <section className="history-greeting">
        <h1>Your <em>journal.</em></h1>
        <p className="meta">
          {!isPremium ? `Last 7 days${lockedCount > 0 ? ` · ${lockedCount} more locked` : ""}` : `${totalEntries} entries`}
          <span className="dot">·</span>{today}
        </p>
      </section>

      {/* Stats strip */}
      <div className="streak-strip">
        <div className="stat-cell">
          <div className="v">{currentStreak}<small>days</small></div>
          <div className="l">Current streak</div>
        </div>
        <div className="stat-cell">
          <div className="v">{longestStreak}<small>days</small></div>
          <div className="l">Longest run</div>
        </div>
        <div className="stat-cell">
          <div className="v">{totalEntries}</div>
          <div className="l">Total entries</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="today-section-label"><span>Calendar</span></div>
      <section className="cal-card">
        <div className="cal-head">
          <div className="cal-month">{monthLong} <em>{yearStr}</em></div>
          <div className="cal-nav">
            <button type="button" onClick={() => setMonthOffset(monthOffset - 1)} aria-label="Previous month">‹</button>
            <button type="button" onClick={() => setMonthOffset(Math.min(0, monthOffset + 1))} disabled={monthOffset >= 0} aria-label="Next month">›</button>
          </div>
        </div>
        <div className="cal-dows">
          {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="cal-grid">
          {cells.map((c) => {
            if (c.empty) return <div key={c.key} className="cal-cell empty" />;
            const cls = ["cal-cell", c.isFuture ? "future" : "", c.isToday ? "today" : "", c.locked ? "locked" : loadClass(c.entry)].filter(Boolean).join(" ");
            return (
              <button key={c.key} className={cls} onClick={() => !c.isFuture && !c.locked && c.entry && setOpenDay(c.dayIso)}>
                <span>{c.day}</span>
                {c.entry?.period && <span className="period" />}
              </button>
            );
          })}
        </div>
        <div className="cal-legend">
          <span className="row">Symptom load
            <span className="scale">
              <i style={{ background: "rgba(201,123,92,0.18)" }} />
              <i style={{ background: "rgba(201,123,92,0.32)" }} />
              <i style={{ background: "rgba(201,123,92,0.50)" }} />
              <i style={{ background: "var(--clay)" }} />
            </span>
          </span>
          <span className="row" style={{ marginLeft: "auto" }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: "var(--sage-dark)", display: "inline-block" }} /> Period
          </span>
        </div>
      </section>

      {/* Filter chips */}
      {topSymptoms.length > 0 && (
        <>
          <div className="today-section-label">
            <span>Filter</span>
            {filter && <span className="hint">showing "{filter}"</span>}
          </div>
          <div className="filter-row">
            <button className={`filter-chip${filter === null ? " on" : ""}`} onClick={() => setFilter(null)}>All</button>
            {topSymptoms.map(([name, ct]) => (
              <button
                key={name}
                className={`filter-chip${filter === name ? " on" : ""}`}
                onClick={() => setFilter(filter === name ? null : name)}
              >
                {name} <span className="ct">{ct}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Entries feed */}
      <div className="today-section-label">
        <span>Entries</span>
        <span className="hint">
          {cappedFeed
            ? `Recent ${visibleEntries.length} of ${allVisibleEntries.length} · newest first`
            : `${visibleEntries.length} shown · newest first`}
        </span>
      </div>

      {grouped.map(([dayIso, items]) => {
        const date = items[0].date;
        const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
        const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const diffDays = Math.round((TODAY.setHours(0,0,0,0) - new Date(date).setHours(0,0,0,0)) / 86400000);
        const relative = diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
        const [mon, dnum] = monthDay.split(" ");
        return (
          <div key={dayIso} className="day-group">
            <div className="day-label">
              <span className="num">{mon} <em>{dnum}</em></span>
              <span className="day">{dayName}</span>
              <span className="relative">{relative}</span>
            </div>
            {items.map((entry, i) => {
              const standout = entry.symptoms.length === 0 && entry.mood >= 3;
              const timeStr = entry.time
                ? entry.time.toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", "").toLowerCase()
                : "";
              return (
                <button
                  key={i}
                  type="button"
                  className={`entry-card${standout ? " standout" : ""}`}
                  onClick={() => setOpenDay(entry.d)}
                >
                  <div className="top-row">
                    <span className="e-mood" style={{ color: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {entry.mood !== null ? <MoodFace kind={MOOD_KIND_HX[entry.mood]} size={26} /> : "·"}
                    </span>
                    <div className="e-meta">
                      <strong>{entry.mood !== null ? MOOD_LABEL_HX[entry.mood] : "Logged"}</strong>
                      {entry.symptoms.length > 0 && <> · {entry.symptoms.length} symptom{entry.symptoms.length !== 1 ? "s" : ""}</>}
                      {entry.symptoms.length === 0 && entry.mood !== null && " · clear day"}
                    </div>
                    <span className="e-time">{timeStr}</span>
                  </div>
                  {entry.symptoms.length > 0 && (
                    <div className="e-pills">
                      {entry.symptoms.slice(0, 4).map((s) => (
                        <span key={s.n} className="pill">
                          <SymptomIcon name={s.icon} size={11} />
                          {s.n}
                        </span>
                      ))}
                      {entry.period && <span className="pill sage"><UIIcon name="Drop" size={11} />{entry.period}</span>}
                    </div>
                  )}
                  {entry.notes && <div className="e-note">"{entry.notes}"</div>}
                  {(entry.sleep != null || entry.stress != null) && (
                    <div className="e-context">
                      {entry.sleep != null && <span><UIIcon name="Bed" size={12} /> <strong>{entry.sleep}h</strong> sleep</span>}
                      {entry.stress != null && <span><UIIcon name="CloudLightning" size={12} /> stress <strong>{entry.stress}/5</strong></span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Show-older affordance — when feed is capped */}
      {cappedFeed && (
        <button
          type="button"
          className="filter-chip"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            margin: "16px auto 4px", padding: "10px 18px", background: "var(--card-bg)",
            border: "1px solid var(--border)", borderRadius: 14,
            color: "var(--clay-dark)", fontWeight: 600, fontSize: 13,
            width: "auto", maxWidth: 280,
          }}
          onClick={() => setShowAllEntries(true)}
        >
          <UIIcon name="ArrowUp" size={12} style={{ transform: "rotate(180deg)" }} />
          Show {hiddenOlderCount} older {hiddenOlderCount === 1 ? "entry" : "entries"}
        </button>
      )}
      {!cappedFeed && allVisibleEntries.length > FEED_CAP_DAYS && !filter && (
        <button
          type="button"
          className="filter-chip"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            margin: "16px auto 4px", padding: "10px 18px", background: "transparent",
            border: "1px solid var(--border)", borderRadius: 14,
            color: "var(--ink-light)", fontWeight: 500, fontSize: 12,
            width: "auto", maxWidth: 280,
          }}
          onClick={() => setShowAllEntries(false)}
        >
          Collapse to recent {FEED_CAP_DAYS} days
        </button>
      )}

      {/* Locked banner for non-premium users */}
      {!isPremium && lockedCount > 0 && (
        <div className="lock-banner">
          <div className="ico"><UIIcon name="Lock" size={20} /></div>
          <h4>{lockedCount} more days of <em>your story</em></h4>
          <p>Free tier shows your last 7 days. Vela Premium unlocks your full history, exports, and pattern tracking across cycles.</p>
          <button type="button" onClick={onShowPaywall}>Unlock with Premium</button>
        </div>
      )}

      <div className="privacy-footer">
        <UIIcon name="Lock" size={12} />
        <span>Your journal stays on this device.</span>
      </div>

      {/* Day detail bottom sheet */}
      <div className={`dd-scrim${openDay ? " show" : ""}`} onClick={() => setOpenDay(null)} />
      <aside className={`dd-sheet${openDay ? " show" : ""}`} role="dialog" aria-modal="true">
        <div className="dd-handle" />
        {openEntry && (
          <>
            <div className="dd-head">
              <div className="num">
                {openEntry.date.toLocaleDateString("en-US", { month: "short" })} <em>{openEntry.date.getDate()}</em>
              </div>
              <div className="day">{openEntry.date.toLocaleDateString("en-US", { weekday: "long" })}</div>
            </div>

            {openEntry.mood !== null && (
              <div className="dd-section">
                <div className="dd-label">Mood</div>
                <div className="dd-mood-row">
                  <span className="em" style={{ color: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <MoodFace kind={MOOD_KIND_HX[openEntry.mood]} size={36} />
                  </span>
                  <div className="lbl">
                    {MOOD_LABEL_HX[openEntry.mood]}
                    {openEntry.time && <small>logged at {openEntry.time.toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", "").toLowerCase()}</small>}
                  </div>
                </div>
              </div>
            )}

            {openEntry.symptoms.length > 0 && (
              <div className="dd-section">
                <div className="dd-label">Symptoms</div>
                <div className="dd-pills">
                  {openEntry.symptoms.map((s) => (
                    <span key={s.n} className="dd-pill">
                      <SymptomIcon name={s.icon} size={12} />
                      {s.n}
                      {openEntry.severities[s.n] && <span className="sev">{openEntry.severities[s.n]}/3</span>}
                    </span>
                  ))}
                  {openEntry.period && (
                    <span className="dd-pill" style={{ background: "var(--sage-light)", color: "var(--sage-dark)" }}>
                      <UIIcon name="Drop" size={12} />
                      {openEntry.period}
                    </span>
                  )}
                </div>
              </div>
            )}

            {(openEntry.sleep != null || openEntry.stress != null) && (
              <div className="dd-section">
                <div className="dd-label">Context</div>
                <div className="dd-context-grid">
                  {openEntry.sleep != null && (
                    <div className="dd-context-cell">
                      <div className="lab"><UIIcon name="Bed" size={12} /> Sleep</div>
                      <div className="v">{openEntry.sleep}<small>hrs</small></div>
                    </div>
                  )}
                  {openEntry.stress != null && (
                    <div className="dd-context-cell">
                      <div className="lab"><UIIcon name="CloudLightning" size={12} /> Stress</div>
                      <div className="v">{openEntry.stress}<small>/5</small></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {openEntry.notes && (
              <div className="dd-section">
                <div className="dd-label">Note</div>
                <div className="dd-note">"{openEntry.notes}"</div>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function InsightsScreen({ logs, profile, isPremium, onShowPaywall }) {
  // ─── Persistent Ask-Vela chat (kept from previous implementation) ──────────
  const [chatMessages, setChatMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_chat_messages")) || []; } catch { return []; }
  });
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [revealDismissed, setRevealDismissed] = useState(() => !!localStorage.getItem("vela_insights_revealed"));
  // Monthly soft-cap UI state (the real cap is enforced server-side per
  // 24h; this is the friendly counter we show in the sheet).
  const [monthlyAsked, setMonthlyAsked] = useState(() => getMonthlyCount());
  const [remainingToday, setRemainingToday] = useState(null);

  useEffect(() => {
    if (chatMessages.length > 0) localStorage.setItem("vela_chat_messages", JSON.stringify(chatMessages.slice(-20)));
  }, [chatMessages]);

  const handleQuestion = async (text) => {
    if (!text.trim() || isTyping) return;
    track("ask_vela_used", { logCount: logs.length, gatedByDataMin: logs.length < 7 });
    const userMsg = { role: "user", text: text.trim(), time: new Date().toISOString() };
    setChatMessages([...chatMessages, userMsg]);
    setChatInput("");
    setIsTyping(true);
    haptic("Light");

    // Pre-flight: too little data for a meaningful answer
    if (logs.length < 7) {
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: `I need at least 7 days of entries to spot meaningful patterns. You're on day ${logs.length} — keep going.`,
        time: new Date().toISOString(),
      }]);
      setIsTyping(false);
      haptic("Light");
      return;
    }

    // Pre-flight: client-side soft cap (20 questions/month). Server-side
    // rate limit is the real defense; this is just a friendly heads-up
    // that prevents us from making round-trips we know will fail.
    const monthCap = checkAndUpdateMonthlyCap();
    if (!monthCap.ok) {
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: `You've asked your monthly limit of ${ASK_VELA_MONTHLY_CAP} questions. The cap resets ${monthCap.resetsOn}. Until then, the existing answers in this thread stay available.`,
        time: new Date().toISOString(),
      }]);
      setIsTyping(false);
      return;
    }

    try {
      const summary = buildAskVelaSummary(logs);
      // profile is the raw onboarding answers object: { 0: stageIdx, 1: [concernIdxs], 2: goalIdx-or-array, 3: guidanceIdx }
      const stageIdx = profile?.[0];
      const goalAns = profile?.[2];
      const goalIdx = Array.isArray(goalAns) ? goalAns[0] : goalAns;
      const profilePayload = {
        stage: stageIdx != null ? QUESTIONS[0].opts[stageIdx]?.label : null,
        goal: goalIdx != null ? QUESTIONS[2].opts[goalIdx]?.label : null,
      };
      const appUserId = await getAppUserId();
      // Try the real API first; fall back to the canned response engine
      // if the function returns 5xx (key missing, model unreachable, etc.)
      const r = await fetch("/api/ask-vela", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text.trim(), summary, profile: profilePayload, appUserId }),
      });
      let answer;
      let serverRemaining = null;
      if (r.ok) {
        const data = await r.json();
        answer = data.answer;
        if (typeof data.remainingToday === "number") serverRemaining = data.remainingToday;
      } else if (r.status === 429) {
        // Rate-limited by server (per-user or per-IP cap hit). Skip the
        // canned fallback — the user needs to know they hit the limit.
        const data = await r.json().catch(() => ({}));
        answer = data.detail || "You've hit today's question limit. Try again later.";
        // Sync our local counter to the server's view so the UI reflects truth
        bumpMonthlyCapTo(ASK_VELA_MONTHLY_CAP);
      } else if (r.status === 503) {
        const data = await r.json().catch(() => ({}));
        answer = data.detail || "Ask Vela is taking a break. Try again later.";
      } else if (r.status === 401 || r.status === 403) {
        const data = await r.json().catch(() => ({}));
        answer = data.detail || "Couldn't verify your subscription. Try restoring your purchase from Settings.";
      } else {
        // Other failure — graceful degradation to canned response so the
        // user always gets *something*
        answer = generateResponse(matchQuestion(text), logs, profile);
      }
      setChatMessages((prev) => [...prev, { role: "assistant", text: answer, time: new Date().toISOString() }]);
      if (serverRemaining != null) setRemainingToday(serverRemaining);
    } catch (err) {
      const answer = generateResponse(matchQuestion(text), logs, profile);
      setChatMessages((prev) => [...prev, { role: "assistant", text: answer, time: new Date().toISOString() }]);
    } finally {
      setIsTyping(false);
      haptic("Light");
      // Always refresh the local monthly count after a real attempt
      setMonthlyAsked(getMonthlyCount());
    }
  };

  // ─── Data-state derivation ────────────────────────────────────────────────
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const dataState =
    uniqueDays === 0 || uniqueDays < 7 ? "locked"
    : uniqueDays === 7 && !revealDismissed ? "unlocked"
    : "rich";
  const isLocked = dataState === "locked";

  function dismissReveal() {
    localStorage.setItem("vela_insights_revealed", "1");
    setRevealDismissed(true);
    haptic("Medium");
  }

  // ─── Last 7 days analytics ────────────────────────────────────────────────
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
  const now = new Date();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayLogs = logs.filter((l) => l.date.slice(0, 10) === dayStr);
    const symptomNames = new Set();
    let moodSum = 0, moodCount = 0;
    let hasPeriod = false;
    dayLogs.forEach((l) => {
      Object.keys(l.symptoms || {}).forEach((s) => symptomNames.add(s));
      if (l.mood !== null && l.mood !== undefined) { moodSum += l.mood; moodCount++; }
      if (l.context?.period && l.context.period !== "none") hasPeriod = true;
    });
    week.push({
      day: DAY_LETTERS[d.getDay()],
      count: symptomNames.size,
      mood: moodCount > 0 ? Math.round(moodSum / moodCount) : null,
      hasPeriod,
    });
  }
  const maxBar = Math.max(...week.map((w) => w.count), 1);

  // Top symptom across last 7 days
  const symFreq = {};
  week.forEach((w, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toISOString().slice(0, 10);
    const dayLogs = logs.filter((l) => l.date.slice(0, 10) === dayStr);
    const seen = new Set();
    dayLogs.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => seen.add(s)));
    seen.forEach((s) => { symFreq[s] = (symFreq[s] || 0) + 1; });
  });
  const topSymptomEntry = Object.entries(symFreq).sort((a, b) => b[1] - a[1])[0];
  const topSymptomName = topSymptomEntry?.[0];
  const topSymptomDef = SYMPTOMS.find((s) => s.name === topSymptomName);

  // Avg mood label for week
  const moodSamples = week.filter((w) => w.mood !== null);
  const avgMoodIdx = moodSamples.length > 0
    ? Math.round(moodSamples.reduce((s, w) => s + w.mood, 0) / moodSamples.length)
    : null;
  // MoodFace replaces system emoji here — 45-55 audience finds emoji-yellow
  // smileys childish for a menopause app. MoodFace follows currentColor and
  // matches the rest of the duotone-Phosphor / earth-palette system.
  const MOOD_KIND = ["rough", "low", "okay", "good", "great"];
  const MOOD_LABEL = ["Rough", "Low", "Okay", "Good", "Great"];

  // Pull real correlations
  const correlations = analyzeCorrelations(logs);
  const patternFindings = correlations.slice(0, 4).map((c, i) => ({
    icon: i % 2 === 0 ? "Bed" : "Wind",
    text: c.text,
    confidence: Math.min(3, Math.max(1, Math.round(c.score))),
    basis: `${uniqueDays} days of data`,
  }));

  // Cycle prediction (Premium-gated render below)
  const cyclePrediction = predictNextCycle(logs);

  // Experiments (Premium-gated render below). State is local so start/end
  // actions re-render without a full app round-trip; persistence is via
  // the safeStorage helper.
  const [experiments, setExperiments] = useState(() => safeReadJSON("vela_experiments", []));
  useEffect(() => {
    try { localStorage.setItem("vela_experiments", JSON.stringify(experiments)); } catch { /* private mode */ }
  }, [experiments]);
  const activeExperiments = experiments.filter((e) => e.status === "active");
  const completedExperiments = experiments.filter((e) => e.status === "completed");
  const [experimentBrowserOpen, setExperimentBrowserOpen] = useState(false);
  const [weekSheetOpen, setWeekSheetOpen] = useState(false);

  // Personalized experiment suggestions — premium-gated, derived from
  // detected correlations + top symptoms in the last 30 days.
  const experimentSuggestions = suggestExperiments(logs, experiments);

  // Weekly summary — computed live from logs. Card highlights on Sundays.
  const weeklySummary = buildWeeklySummary(logs);
  const isSunday = new Date().getDay() === 0;

  function startExperiment(library) {
    if (!isPremium) { onShowPaywall(); return; }
    const newExp = {
      id: `${library.id}_${Date.now()}`,
      libraryId: library.id,
      name: library.name,
      desc: library.desc,
      icon: library.icon,
      duration: library.duration,
      targets: library.targets,
      startDate: new Date().toISOString().slice(0, 10),
      status: "active",
    };
    setExperiments((prev) => [...prev, newExp]);
    setExperimentBrowserOpen(false);
    haptic("Medium");
    track("experiment_started", { libraryId: library.id, duration: library.duration });
  }

  function endExperiment(id) {
    setExperiments((prev) => prev.map((e) => e.id === id ? { ...e, status: "completed", endedAt: new Date().toISOString() } : e));
    haptic("Light");
  }

  function abandonExperiment(id) {
    setExperiments((prev) => prev.filter((e) => e.id !== id));
    haptic("Light");
  }

  // The legacy "Try this week" CBT shelf was removed when real
  // Experiments shipped — the EXPERIMENT_LIBRARY constant + the
  // Experiment browser sheet replaced it.

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const suggestedQs = [
    { text: <>What triggers my <em>hot flashes</em>?</> },
    { text: <>How does <em>sleep</em> shape my mood?</> },
    { text: <>Are my symptoms tied to my <em>cycle</em>?</> },
    { text: <>What's changed since I started <em>tracking</em>?</> },
    { text: <>Best questions to bring to my <em>doctor</em>?</> },
  ];

  return (
    <div className="screen active vela-app">
      {/* Slim header (Insights uses the global slim top header from App;
          we don't add a sticky vela-header here) */}

      {/* Greeting */}
      <section className="insights-greeting">
        <h1>Your <em>patterns.</em></h1>
        <p className="meta">
          {isLocked ? "Building baseline" : `Last 7 days · ${week.reduce((s, w) => s + (w.count > 0 ? 1 : 0), 0)} entries`}
          <span className="dot">·</span>{today}
        </p>
      </section>

      {/* LOCKED — single state, no other modules */}
      {isLocked && (
        <section className="locked-card">
          <div className="lock-glyph"><UIIcon name="Lock" size={22} /></div>
          <h3>Patterns unlock at <em>day 7</em></h3>
          <p>
            You're {7 - uniqueDays} {7 - uniqueDays === 1 ? "day" : "days"} away. Vela needs a week of entries to
            spot rhythms in your symptoms — anything sooner would be guessing.
          </p>
          <div className="locked-progress" aria-label={`${uniqueDays} of 7 days logged`}>
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className={`pip${i < uniqueDays ? " on" : ""}`} />
            ))}
          </div>
          <div className="locked-foot">{uniqueDays} of 7 days</div>
        </section>
      )}

      {/* UNLOCKED — Day 7 reveal hero */}
      {!isLocked && dataState === "unlocked" && (
        <section className="unlock-card">
          <div className="unlock-eyebrow">
            <UIIcon name="Sparkle" size={11} /> First pattern · Day 7
          </div>
          <h2 className="unlock-headline">
            {topSymptomDef ? (
              <>Your <em>{topSymptomName.toLowerCase()}</em> appeared {topSymptomEntry[1]} of 7 days this week.</>
            ) : (
              <>Your <em>first week</em> is complete. Patterns are forming.</>
            )}
          </h2>
          <p className="unlock-body">
            A starting signal. Your patterns sharpen with every week of logging — keep going.
          </p>
          <div className="unlock-row">
            <button className="unlock-btn-primary" type="button" onClick={dismissReveal}>See the week</button>
            <button className="unlock-btn-secondary" type="button" onClick={dismissReveal}>Skip</button>
          </div>
        </section>
      )}

      {/* Established modules */}
      {!isLocked && dataState !== "unlocked" && (
        <>
          <section className="week-hero">
            <div className="week-eyebrow"><UIIcon name="Sparkle" size={11} /> This week</div>
            <p className="quote">
              {topSymptomDef
                ? <>Your top symptom this week: <em>{topSymptomName.toLowerCase()}</em>.</>
                : <>A <em>steady week</em> of logging — keep going.</>}
            </p>
            <div className="week-stats">
              <div className="stat">
                <div className="v">{week.reduce((s, w) => s + (w.count > 0 ? 1 : 0), 0)}<span className="delta">/7</span></div>
                <div className="l">Days logged</div>
              </div>
              <div className="stat">
                <div className="v">{Object.keys(symFreq).length}</div>
                <div className="l">Symptoms</div>
              </div>
              <div className="stat">
                <div className="v" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--clay)", minHeight: 30 }}>
                  {avgMoodIdx !== null ? <MoodFace kind={MOOD_KIND[avgMoodIdx]} size={30} /> : "—"}
                </div>
                <div className="l">Avg mood</div>
              </div>
            </div>
          </section>

          {topSymptomDef && (
            <>
              <div className="today-section-label">
                <span>Top symptom</span>
                <span className="hint">7 days</span>
              </div>
              <section className="callout">
                <div className="callout-row">
                  <div className="callout-icon"><SymptomIcon name={topSymptomDef.icon} size={22} /></div>
                  <div className="callout-body">
                    <div className="callout-name">{topSymptomName}</div>
                    <div className="callout-meta">{topSymptomEntry[1]} of 7 days · most logged this week</div>
                  </div>
                  <span className="callout-trend up">↑ Top</span>
                </div>
              </section>
            </>
          )}

          <div className="today-section-label"><span>This week</span></div>
          <section className="bars-card">
            <div className="bars-head">
              <span className="bars-title">Symptom load · last 7 days</span>
              <span className="bars-sub">Daily count</span>
            </div>
            <div className="bars-grid">
              {week.map((w, i) => {
                const h = (w.count / maxBar) * 100;
                return (
                  <div key={i} className={`bar-col${w.count === 0 ? " dim" : ""}`}>
                    <div className="bar" style={{ height: `${Math.max(h, 6)}%` }} />
                    <span className="day">{w.day}</span>
                    {w.hasPeriod && <span className="period-dot" title="Period day" />}
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span><span className="swatch" style={{ background: "var(--clay)" }} /> Symptom count</span>
              <span><span className="swatch" style={{ background: "var(--sage)" }} /> Period day</span>
            </div>
          </section>

          <div className="today-section-label"><span>Mood</span></div>
          <section className="mood-row-card">
            <div className="bars-head" style={{ marginBottom: 4 }}>
              <span className="bars-title">Mood · last 7 days</span>
              <span className="bars-sub" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {avgMoodIdx !== null
                  ? <>Avg <span style={{ color: "var(--clay)", display: "inline-flex" }}><MoodFace kind={MOOD_KIND[avgMoodIdx]} size={16} /></span> {MOOD_LABEL[avgMoodIdx]}</>
                  : "Log to see"}
              </span>
            </div>
            <div className="mood-week">
              {week.map((w, i) => (
                <div key={i} className="mood-day">
                  <span className="em" style={{ color: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    {w.mood !== null ? <MoodFace kind={MOOD_KIND[w.mood]} size={22} /> : "·"}
                  </span>
                  <span className="dot" style={{ background: w.mood !== null ? "var(--clay)" : undefined }} />
                  <span className="lab">{w.day}</span>
                </div>
              ))}
            </div>
            {moodSamples.length > 1 && (
              <p className="mood-summary">
                {moodSamples.length} of 7 days logged. Keep going to see week-over-week trends.
              </p>
            )}
          </section>

          {/* Sunday weekly summary — promoted on Sundays, present every
              other day as a quieter card. Premium-gated content; free
              tier sees the headline only and gets nudged to upgrade. */}
          {weeklySummary && (
            <button
              type="button"
              className={`week-summary-card${isSunday ? " sunday" : ""}${!isPremium ? " locked" : ""}`}
              onClick={() => isPremium ? setWeekSheetOpen(true) : onShowPaywall()}
            >
              <div className="ws-eyebrow">
                <UIIcon name="Sparkle" size={11} />
                {isSunday ? "Your week" : "Last 7 days"}
                {!isPremium && <span className="ws-tag">Premium</span>}
              </div>
              <p className="ws-summary">
                {isPremium ? weeklySummary.summary : `${weeklySummary.daysLogged} of 7 days logged. Premium opens the full week-over-week comparison — sleep, mood, top symptoms, and what shifted.`}
              </p>
              <div className="ws-foot">
                <span>{weeklySummary.daysLogged}/7 days</span>
                {weeklySummary.mood && <span>· mood {weeklySummary.mood.label}</span>}
                {weeklySummary.sleep && <span>· sleep {weeklySummary.sleep.avg.toFixed(1)}h</span>}
                <span className="ws-arrow"><UIIcon name="ArrowRight" size={13} /></span>
              </div>
            </button>
          )}

          {/* Cycle prediction (Premium) — only render when there's enough
              signal OR when free user, to surface the upsell */}
          {cyclePrediction && (
            <>
              <div className="today-section-label">
                <span>Cycle</span>
                {isPremium && cyclePrediction.cyclesLogged >= 2 && (
                  <span className="hint">
                    {cyclePrediction.confidence === "high" ? "High confidence" :
                     cyclePrediction.confidence === "medium" ? "Building confidence" : "Early signal"}
                  </span>
                )}
                {!isPremium && <span className="hint" style={{ color: "var(--gold)" }}>Premium</span>}
              </div>
              <section className={`cycle-card${!isPremium ? " locked" : ""}`}>
                {!isPremium ? (
                  <>
                    <div className="cycle-head">
                      <span className="ico"><UIIcon name="Sparkle" size={16} /></span>
                      <strong>Predict your next period</strong>
                    </div>
                    <p className="cycle-body">
                      Vela learns your rhythm — even when cycles get irregular — and gives you a
                      window for what's likely next. Helpful for planning, travel, and naming
                      what your body's doing.
                    </p>
                    <button type="button" className="cycle-cta" onClick={onShowPaywall}>
                      <UIIcon name="Star" size={13} weight="fill" /> Unlock with Premium
                    </button>
                  </>
                ) : cyclePrediction.cyclesLogged < 2 ? (
                  <>
                    <div className="cycle-head">
                      <span className="ico"><UIIcon name="Calendar" size={16} /></span>
                      <strong>Building your baseline</strong>
                    </div>
                    <p className="cycle-body">{cyclePrediction.reason}</p>
                  </>
                ) : (
                  <>
                    <div className="cycle-head">
                      <span className="ico"><UIIcon name="Calendar" size={16} /></span>
                      <strong>
                        {cyclePrediction.daysUntil < 0
                          ? "Overdue window"
                          : cyclePrediction.daysUntil === 0
                          ? "Likely today"
                          : `In about ${cyclePrediction.daysUntil} day${cyclePrediction.daysUntil === 1 ? "" : "s"}`}
                      </strong>
                    </div>
                    <p className="cycle-window">
                      {new Date(cyclePrediction.windowStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" – "}
                      {new Date(cyclePrediction.windowEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <p className="cycle-meta">
                      Based on {cyclePrediction.cyclesLogged} cycles · avg length {cyclePrediction.cycleLengthMean} days
                      {cyclePrediction.cycleLengthStddev > 0 && <> · ± {cyclePrediction.cycleLengthStddev}</>}
                    </p>
                  </>
                )}
              </section>
            </>
          )}

          {/* Active experiments (Premium) — shows running experiments with
              live progress + comparison snapshot. Browser sheet for adding
              new ones is below. */}
          {(activeExperiments.length > 0 || completedExperiments.length > 0) && (
            <>
              <div className="today-section-label">
                <span>Experiments</span>
                <button
                  type="button"
                  className="hint hint-btn"
                  onClick={() => isPremium ? setExperimentBrowserOpen(true) : onShowPaywall()}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "var(--clay-dark)", fontWeight: 600 }}
                >
                  + New
                </button>
              </div>
              {activeExperiments.map((exp) => {
                const startDate = new Date(exp.startDate + "T00:00:00");
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const elapsed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
                const remaining = Math.max(0, exp.duration - elapsed);
                const pct = Math.min(100, Math.max(0, (elapsed / exp.duration) * 100));
                const comp = compareExperiment(exp, logs);
                return (
                  <article key={exp.id} className="exp-card active">
                    <div className="exp-head">
                      <span className="ico"><UIIcon name={exp.icon || "Sparkle"} size={16} /></span>
                      <div className="ttl">
                        <strong>{exp.name}</strong>
                        <small>Day {Math.min(elapsed + 1, exp.duration)} of {exp.duration} · {remaining > 0 ? `${remaining} day${remaining === 1 ? "" : "s"} left` : "ready to wrap up"}</small>
                      </div>
                    </div>
                    <div className="exp-progress"><div className="fill" style={{ width: `${pct}%` }} /></div>
                    {comp.sampleOk && comp.targets.length > 0 && (
                      <div className="exp-deltas">
                        {comp.targets.slice(0, 2).map((t) => (
                          <div key={t.symptom} className="exp-delta">
                            <span className="sym">{t.symptom}</span>
                            <span className={`val${t.delta < 0 ? " good" : t.delta > 0 ? " bad" : ""}`}>
                              {t.delta < 0 ? "↓ " : t.delta > 0 ? "↑ " : "— "}
                              {t.summary}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {remaining === 0 && (
                      <div className="exp-actions">
                        <button type="button" className="exp-btn primary" onClick={() => endExperiment(exp.id)}>See results</button>
                      </div>
                    )}
                    {remaining > 0 && (
                      <div className="exp-actions">
                        <button type="button" className="exp-btn secondary" onClick={() => abandonExperiment(exp.id)}>Stop</button>
                      </div>
                    )}
                  </article>
                );
              })}
              {completedExperiments.slice(-2).reverse().map((exp) => {
                const comp = compareExperiment(exp, logs);
                return (
                  <article key={exp.id} className="exp-card completed">
                    <div className="exp-head">
                      <span className="ico"><UIIcon name={exp.icon || "Sparkle"} size={16} /></span>
                      <div className="ttl">
                        <strong>{exp.name}</strong>
                        <small>Completed · {exp.duration} days</small>
                      </div>
                      <span className="exp-badge">Done</span>
                    </div>
                    {comp.targets.length > 0 && (
                      <div className="exp-deltas">
                        {comp.targets.map((t) => (
                          <div key={t.symptom} className="exp-delta">
                            <span className="sym">{t.symptom}</span>
                            <span className={`val${t.delta < 0 ? " good" : t.delta > 0 ? " bad" : ""}`}>
                              {t.delta < 0 ? "↓ " : t.delta > 0 ? "↑ " : "— "}
                              {t.summary}
                            </span>
                          </div>
                        ))}
                        {comp.moodDelta !== null && Math.abs(comp.moodDelta) >= 0.3 && (
                          <div className="exp-delta">
                            <span className="sym">Mood</span>
                            <span className={`val${comp.moodDelta > 0 ? " good" : " bad"}`}>
                              {comp.moodDelta > 0 ? "↑ " : "↓ "}
                              {Math.abs(comp.moodDelta).toFixed(1)} pts
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </>
          )}

          {patternFindings.length > 0 && (
            <>
              <div className="today-section-label">
                <span>Patterns Vela has noticed</span>
                <span className="hint">{patternFindings.length} {patternFindings.length === 1 ? "finding" : "findings"}</span>
              </div>
              <div className="pattern-list">
                {patternFindings.map((p, i) => (
                  <article className="pattern-card" key={i}>
                    <div className="ico"><UIIcon name={p.icon} size={16} /></div>
                    <div className="body">
                      <div className="head">{p.text}</div>
                      <div className="conf">
                        <span className="conf-dots">
                          <span className={p.confidence >= 1 ? "on" : ""} />
                          <span className={p.confidence >= 2 ? "on" : ""} />
                          <span className={p.confidence >= 3 ? "on" : ""} />
                        </span>
                        <span>
                          {p.confidence === 3 ? "Strong signal" : p.confidence === 2 ? "Steady signal" : "Early signal"}
                          {" · "}{p.basis}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* Personalized experiment suggestions — Premium. Maps the
              patterns above to one-tap experiments tied to what we've
              actually seen in the user's data, with the reason
              surfaced as the headline so it's never random. */}
          {experimentSuggestions.length > 0 && (
            <>
              <div className="today-section-label">
                <span>Vela suggests</span>
                <span className="hint">{!isPremium ? <span style={{ color: "var(--gold)" }}>Premium</span> : "Based on your data"}</span>
              </div>
              <div className="suggest-list">
                {experimentSuggestions.map((sug) => (
                  <article key={sug.library.id} className="suggest-card">
                    <div className="suggest-head">
                      <span className="ico"><UIIcon name={sug.library.icon} size={16} /></span>
                      <p className="reason">{sug.reason}</p>
                    </div>
                    <div className="suggest-body">
                      <strong>{sug.library.name}</strong>
                      <small>{sug.library.duration} days · watching {sug.library.targets.join(" · ")}</small>
                    </div>
                    <button
                      type="button"
                      className="suggest-cta"
                      onClick={() => isPremium ? startExperiment(sug.library) : onShowPaywall()}
                    >
                      {isPremium ? "Start" : <><UIIcon name="Star" size={11} weight="fill" /> Unlock</>}
                      <UIIcon name="ArrowRight" size={12} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}

          {uniqueDays < 21 && (
            <div className="weak-banner">
              <UIIcon name="Calendar" size={14} />
              Most patterns become reliable around week three. Keep logging.
            </div>
          )}

          <div className="today-section-label"><span>For your provider</span></div>
          <button
            type="button"
            className="export-cta"
            onClick={() => {
              if (!isPremium) { onShowPaywall(); return; }
              generateDoctorReport(logs, profile);
            }}
          >
            <div className="ico"><UIIcon name="FileText" size={20} /></div>
            <div className="body">
              <h4>Doctor-ready summary</h4>
              <p>{uniqueDays} {uniqueDays === 1 ? "day" : "days"} · printable PDF · stays on your device</p>
            </div>
            <div className="arrow"><UIIcon name="ArrowRight" size={16} /></div>
          </button>

          {/* Experiments entry — only show "Try one" CTA if no active
              experiments and no completed history yet (otherwise the
              section above already exposes "+ New") */}
          {activeExperiments.length === 0 && completedExperiments.length === 0 && (
            <>
              <div className="today-section-label">
                <span>Try an experiment</span>
                <span className="hint">{isPremium ? "From your patterns" : <span style={{ color: "var(--gold)" }}>Premium</span>}</span>
              </div>
              <button
                type="button"
                className="exp-promo"
                onClick={() => isPremium ? setExperimentBrowserOpen(true) : onShowPaywall()}
              >
                <div className="ico"><UIIcon name="Flask" size={18} /></div>
                <div className="body">
                  <h4>Run a small experiment</h4>
                  <p>Pick one change for 7-14 days. Vela compares the symptom days against the week before — no guessing.</p>
                </div>
                <div className="arrow"><UIIcon name="ArrowRight" size={16} /></div>
              </button>
            </>
          )}
        </>
      )}

      <div className="privacy-footer">
        <UIIcon name="Lock" size={12} />
        <span>Patterns are computed on this device.</span>
      </div>

      {/* Ask Vela floating button — hidden on locked state */}
      {!isLocked && (
        <button
          type="button"
          className={`ask-vela-fab${!isPremium ? " locked" : ""}`}
          onClick={() => {
            if (!isPremium) { onShowPaywall(); return; }
            setAskOpen(true);
            haptic("Light");
          }}
        >
          <span className="av">V</span>
          <span className="lbl">
            Ask Vela
            <span className="sub">{!isPremium ? "Premium · 7 questions" : "Try a question"}</span>
          </span>
        </button>
      )}

      {/* Ask Vela glass sheet (only opens for premium users) */}
      <div className={`av-scrim${askOpen ? " show" : ""}`} onClick={() => setAskOpen(false)} />
      <aside className={`av-sheet${askOpen ? " show" : ""}`} role="dialog" aria-modal="true" aria-label="Ask Vela">
        <div className="av-handle" />
        <div className="av-head">
          <div className="av-avatar">V</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="av-name">Ask Vela</div>
            <div className="av-sub">
              <UIIcon name="Lock" size={10} /> Anonymized · grounded in your data
              {monthlyAsked > 0 && (
                <> · <strong>{Math.max(0, ASK_VELA_MONTHLY_CAP - monthlyAsked)}</strong> of {ASK_VELA_MONTHLY_CAP} left this month</>
              )}
              {remainingToday != null && remainingToday <= 5 && (
                <> · {remainingToday} left today</>
              )}
            </div>
          </div>
        </div>
        {chatMessages.length === 0 ? (
          <div className="av-q-list">
            {suggestedQs.map((q, i) => (
              <button
                key={i}
                type="button"
                className="av-q"
                onClick={() => {
                  // Plain-text version of the question for the chat
                  const plain = ["What triggers my hot flashes?", "How does sleep shape my mood?", "Are my symptoms tied to my cycle?", "What's changed since I started tracking?", "Best questions to bring to my doctor?"][i];
                  handleQuestion(plain);
                }}
              >
                <span>{q.text}</span>
                <span className="arr"><UIIcon name="ArrowRight" size={14} /></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="av-q-list">
            {chatMessages.slice(-10).map((m, i) => (
              <div key={i} style={{
                background: m.role === "user" ? "var(--clay-light)" : "rgba(255,255,255,0.55)",
                border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px",
                fontSize: 13, color: "var(--ink)", lineHeight: 1.45,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
              }}>{m.text}</div>
            ))}
            {isTyping && <div style={{ fontSize: 12, color: "var(--ink-light)", padding: "4px 14px" }}>Vela is thinking…</div>}
          </div>
        )}
        <div className="av-input">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleQuestion(chatInput); }}
            placeholder="Ask anything about your patterns…"
          />
          <button type="button" aria-label="Send" onClick={() => handleQuestion(chatInput)}>
            <UIIcon name="ArrowRight" size={16} />
          </button>
        </div>
      </aside>

      {/* Experiment browser sheet */}
      <div className={`av-scrim${experimentBrowserOpen ? " show" : ""}`} onClick={() => setExperimentBrowserOpen(false)} />
      <aside className={`av-sheet${experimentBrowserOpen ? " show" : ""}`} role="dialog" aria-modal="true" aria-label="Choose an experiment" style={{ maxHeight: "82vh" }}>
        <div className="av-handle" />
        <div className="av-head" style={{ marginBottom: 8 }}>
          <div className="av-avatar" style={{ background: "var(--sage)" }}><UIIcon name="Flask" size={18} /></div>
          <div>
            <div className="av-name">Pick an experiment</div>
            <div className="av-sub">One change at a time. Vela does the comparison for you.</div>
          </div>
        </div>
        <div className="exp-library">
          {EXPERIMENT_LIBRARY.map((lib) => {
            const alreadyActive = activeExperiments.some((e) => e.libraryId === lib.id);
            return (
              <button
                key={lib.id}
                type="button"
                className="exp-lib-card"
                disabled={alreadyActive}
                onClick={() => startExperiment(lib)}
              >
                <div className="exp-lib-head">
                  <span className="ico"><UIIcon name={lib.icon} size={16} /></span>
                  <strong>{lib.name}</strong>
                  <span className="dur">{lib.duration} days</span>
                </div>
                <p className="exp-lib-desc">{lib.desc}</p>
                <div className="exp-lib-targets">
                  Watching: {lib.targets.join(" · ")}
                </div>
                {alreadyActive && <span className="exp-lib-status">Already running</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Weekly summary sheet */}
      <div className={`av-scrim${weekSheetOpen ? " show" : ""}`} onClick={() => setWeekSheetOpen(false)} />
      <aside className={`av-sheet${weekSheetOpen ? " show" : ""}`} role="dialog" aria-modal="true" aria-label="Your week" style={{ maxHeight: "85vh" }}>
        <div className="av-handle" />
        {weeklySummary && (
          <div className="ws-sheet-body">
            <div className="ws-sheet-head">
              <span className="eye"><UIIcon name="Sparkle" size={11} /> Your week</span>
              <h2>
                {new Date(weeklySummary.windowStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" – "}
                {new Date(weeklySummary.windowEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </h2>
              <p className="ws-sheet-summary">{weeklySummary.summary}</p>
            </div>

            <div className="ws-stat-row">
              <div className="ws-stat">
                <div className="v">{weeklySummary.daysLogged}<small>/7</small></div>
                <div className="l">Days logged</div>
              </div>
              {weeklySummary.mood && (
                <div className="ws-stat">
                  <div className="v" style={{ color: "var(--clay)", display: "inline-flex", justifyContent: "center" }}>
                    <MoodFace kind={["rough", "low", "okay", "good", "great"][Math.round(weeklySummary.mood.avg)]} size={28} />
                  </div>
                  <div className="l">Avg mood{weeklySummary.mood.delta != null && Math.abs(weeklySummary.mood.delta) >= 0.4 && (
                    <span className={`delta ${weeklySummary.mood.delta > 0 ? "up" : "down"}`}>
                      {weeklySummary.mood.delta > 0 ? " ↑" : " ↓"}
                    </span>
                  )}</div>
                </div>
              )}
              {weeklySummary.sleep && (
                <div className="ws-stat">
                  <div className="v">{weeklySummary.sleep.avg.toFixed(1)}<small>h</small></div>
                  <div className="l">Avg sleep{weeklySummary.sleep.delta != null && Math.abs(weeklySummary.sleep.delta) >= 0.4 && (
                    <span className={`delta ${weeklySummary.sleep.delta > 0 ? "up" : "down"}`}>
                      {weeklySummary.sleep.delta > 0 ? " ↑" : " ↓"}
                    </span>
                  )}</div>
                </div>
              )}
            </div>

            {weeklySummary.topSymptoms.length > 0 && (
              <div className="ws-section">
                <div className="ws-section-label">Top symptoms vs prior week</div>
                {weeklySummary.topSymptoms.map((s) => (
                  <div key={s.sym} className="ws-symptom-row">
                    <span className="ico"><SymptomIcon name={s.icon} size={14} /></span>
                    <span className="sym">{s.sym}</span>
                    <span className="counts">
                      {s.count} <small>(was {s.prior})</small>
                    </span>
                    <span className={`delta ${s.delta < 0 ? "good" : s.delta > 0 ? "bad" : "flat"}`}>
                      {s.delta < 0 ? `↓ ${Math.abs(s.delta)}` : s.delta > 0 ? `↑ ${s.delta}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {weeklySummary.periodDays > 0 && (
              <div className="ws-pill-row">
                <UIIcon name="Drop" size={12} />
                {weeklySummary.periodDays} period day{weeklySummary.periodDays === 1 ? "" : "s"} this week
              </div>
            )}

            {weeklySummary.stress && weeklySummary.stress.delta != null && Math.abs(weeklySummary.stress.delta) >= 0.4 && (
              <div className="ws-pill-row">
                <UIIcon name="CloudLightning" size={12} />
                Stress {weeklySummary.stress.delta > 0 ? "up" : "down"} {Math.abs(weeklySummary.stress.delta).toFixed(1)} from the week before
              </div>
            )}

            <button
              type="button"
              className="ws-pdf-btn"
              onClick={() => { generateDoctorReport(logs, profile); setWeekSheetOpen(false); }}
            >
              <UIIcon name="FileText" size={14} />
              Save this week to PDF
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}


function PaywallScreen({ onClose, onSubscribe, onRestore }) {
  const [plan, setPlan] = useState("annual");

  // Pillar copy must match what actually ships. Each pillar below maps to
  // a real feature with shipping code:
  //   Ask Vela              → /api/ask-vela Netlify function (Claude-backed)
  //   Personalized suggestions → suggestExperiments + Insights "Vela suggests"
  //   doctor-ready report   → generateDoctorReport (jsPDF)
  //   experiments           → EXPERIMENT_LIBRARY + compareExperiment
  //   cycle prediction      → predictNextCycle on Insights
  //   weekly summary        → buildWeeklySummary + sheet
  //   Apple Health sync     → src/healthkit.js wrapper
  //   pattern history       → History screen unlock past 7 days
  // Don't add a pillar without a wired feature behind it.
  //
  // Order matters: Ask Vela + personalized suggestions lead because
  // they're the differentiation tier vs Caria/Balance/Flo. Doctor PDF
  // (the original hero) sits at #3 — still the most concrete benefit
  // for the doctor-prep persona, but no longer carries the whole pitch.
  const pillars = [
    {
      icon: "ChatCircle",
      tone: "sage",
      title: "Ask Vela",
      body: "Real AI grounded in your data — not generic web advice. Ask anything about your symptoms, sleep, cycle, or what to bring to your next appointment.",
    },
    {
      icon: "Sparkle",
      tone: "gold",
      title: "Personalized suggestions",
      body: "Vela watches your patterns and suggests experiments tied to what's actually showing up in your data — not a generic to-do list.",
    },
    {
      icon: "FileText",
      tone: "clay",
      title: "Doctor-ready report",
      body: "A printable PDF your provider will actually read. Charts, dates, what's been working — built from months of your real entries.",
    },
    {
      icon: "Flask",
      tone: "sage",
      title: "Run experiments",
      body: "Pick one change for 7-14 days — caffeine cutoff, evening walks, magnesium. Vela compares the symptom days against the week before.",
    },
    {
      icon: "Calendar",
      tone: "gold",
      title: "Cycle prediction",
      body: "Even when cycles are irregular, Vela learns your rhythm and gives you a window for what's likely next.",
    },
    {
      icon: "Sparkle",
      tone: "clay",
      title: "Weekly summary",
      body: "Every Sunday: a quiet read on your week — top symptoms, sleep, mood, what shifted. One scroll, no work.",
    },
    {
      icon: "Heart",
      tone: "sage",
      title: "Apple Health sync",
      body: "Pull sleep and HRV from your watch automatically, so you don't retype what your wrist already knows.",
    },
    {
      icon: "ChartBar",
      tone: "gold",
      title: "Full pattern history",
      body: "Look back across months — see how this autumn compares to last spring. Free shows the last 7 days.",
    },
  ];

  const ctaPrice = plan === "annual" ? "$69.99/yr" : "$8.99/mo";

  return (
    <div className="pw-app">
      <button className="pw-close" onClick={onClose} aria-label="Close">×</button>

      <div className="pw-scroll">
        <span className="pw-eyebrow">
          <span className="crest"><UIIcon name="Star" size={11} weight="fill" /></span>
          Vela Premium
        </span>

        <h1 className="pw-headline">
          Make sense of it. <em>Out loud.</em>
        </h1>
        <p className="pw-sub">
          Real AI grounded in your data, personalized experiments from your patterns, and a doctor-ready report. Built for the years between.
        </p>

        {/* Hero — doctor report preview */}
        <div className="pw-hero">
          <div className="pw-hero-row">
            <span className="badge"><UIIcon name="FileText" size={18} /></span>
            <div className="title">
              Your <em>doctor report</em>
              <small>Last 12 weeks · printable PDF</small>
            </div>
          </div>
          <div className="pw-pdf">
            <div className="pdf-head">
              <span className="name">Vela Symptom Report</span>
              <span className="meta">PDF · 1 page</span>
            </div>
            <div className="pdf-line" />
            <div className="pdf-line short" />
            <div className="pdf-line shorter" />
            <div className="pdf-mini-chart">
              {[0.4, 0.6, 0.5, 0.8, 0.7, 0.9, 0.65, 0.55, 0.75, 0.85, 0.6, 0.7].map((h, i) => (
                <span key={i} style={{ height: `${h * 100}%` }} />
              ))}
            </div>
            <div className="pdf-foot">Hot flashes per week · trending down</div>
          </div>
        </div>

        {/* Pillars */}
        <div className="pw-pillars">
          {pillars.map((p) => (
            <div key={p.title} className={`pw-pillar ${p.tone}`}>
              <span className="ico"><UIIcon name={p.icon} size={18} /></span>
              <div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quote — kept generic, not a fabricated testimonial */}
        <div className="pw-quote">
          <p className="body">
            "Walk into your appointment armed with data, not vibes."
          </p>
          <div className="who"><strong>Why Vela exists</strong> · Built for the years between</div>
        </div>

        {/* Plans */}
        <div className="pw-plans">
          <button
            type="button"
            className={`pw-plan ${plan === "annual" ? "on" : ""}`}
            onClick={() => setPlan("annual")}
          >
            <span className="save-badge">Save 35%</span>
            <div className="term">Annual</div>
            <div className="price">$69.99<small>/yr</small></div>
            <div className="note">$5.83/mo · billed yearly</div>
          </button>
          <button
            type="button"
            className={`pw-plan ${plan === "monthly" ? "on" : ""}`}
            onClick={() => setPlan("monthly")}
          >
            <div className="term">Monthly</div>
            <div className="price">$8.99<small>/mo</small></div>
            <div className="note">Cancel anytime</div>
          </button>
        </div>
      </div>

      <div className="pw-cta-bar">
        <button type="button" className="pw-cta" onClick={() => onSubscribe(plan)}>
          Try free for 14 days · then {ctaPrice}
        </button>
        <div className="pw-cta-fine">
          Cancel anytime ·{" "}
          <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a> ·{" "}
          <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
        </div>
        <div className="pw-restore">
          Already a member? <button type="button" onClick={onRestore}>Restore purchase</button>
        </div>
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
  doc.text("Generated by Vela — velahealth.health", margin, y);
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
    const concernLabels = ["Hot flashes & night sweats", "Sleep problems", "Mood changes & anxiety", "Brain fog & fatigue", "Joint pain & body aches", "Weight changes & bloating", "Low libido & dryness", "Heart palpitations"];
    const selectedConcerns = Array.isArray(profile[1]) ? profile[1].map((i) => concernLabels[i]).join(", ") : concernLabels[profile[1]] || "Not specified";
    doc.text(`Primary concerns: ${selectedConcerns}`, margin, y);
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

  // Lifestyle context summary
  const contextLogs = recentLogs.filter((l) => l.context && Object.values(l.context).some((v) => v !== null));
  if (contextLogs.length > 0) {
    checkPage(20);
    doc.setFontSize(14);
    doc.setTextColor(44, 31, 23);
    doc.text("Lifestyle Context Summary", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const sleepDays = contextLogs.filter((l) => l.context.sleepHours !== null);
    if (sleepDays.length > 0) {
      const avgSleep = (sleepDays.reduce((s, l) => s + l.context.sleepHours, 0) / sleepDays.length).toFixed(1);
      doc.text(`Average sleep: ${avgSleep} hours (${sleepDays.length} days reported)`, margin, y); y += 5;
    }
    const stressDays = contextLogs.filter((l) => l.context.stress !== null);
    if (stressDays.length > 0) {
      const avgStress = (stressDays.reduce((s, l) => s + l.context.stress, 0) / stressDays.length).toFixed(1);
      doc.text(`Average stress: ${avgStress}/5 (${stressDays.length} days reported)`, margin, y); y += 5;
    }
    ["caffeine", "alcohol", "exercise"].forEach((trigger) => {
      const tDays = contextLogs.filter((l) => l.context[trigger] === true);
      if (tDays.length > 0) {
        doc.text(`${trigger.charAt(0).toUpperCase() + trigger.slice(1)}: reported on ${tDays.length} of ${contextLogs.length} days`, margin, y); y += 5;
      }
    });
    const corr = analyzeCorrelations(recentLogs);
    if (corr.length > 0) {
      y += 3; doc.text("Detected correlations:", margin, y); y += 5;
      corr.forEach((c) => { checkPage(5); doc.text(`  \u2022 ${c.text}`, margin, y); y += 5; });
    }
    y += 6;
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

    if (log.context) {
      const parts = [];
      if (log.context.sleepHours !== null && log.context.sleepHours !== undefined) parts.push(`Sleep: ${log.context.sleepHours}h`);
      if (log.context.stress !== null && log.context.stress !== undefined) parts.push(`Stress: ${log.context.stress}/5`);
      if (log.context.caffeine) parts.push("Caffeine");
      if (log.context.alcohol) parts.push("Alcohol");
      if (log.context.exercise) parts.push("Exercise");
      if (parts.length > 0) {
        doc.setTextColor(110, 110, 110);
        checkPage(5);
        doc.text(`Context: ${parts.join(", ")}`, margin, y);
        y += 5;
      }
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
  const header = "Date,Time,Mood,Symptoms,Severities,Notes,Sleep Hours,Stress,Caffeine,Alcohol,Exercise";
  const moodLabels = ["Very low", "Low", "Neutral", "Good", "Very good"];
  const rows = logs.map((log) => {
    const d = new Date(log.date);
    const date = d.toLocaleDateString("en-US");
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const mood = log.mood !== null && log.mood !== undefined ? moodLabels[log.mood] : "";
    const symptoms = Object.keys(log.symptoms || {}).join("; ");
    const sevs = Object.entries(log.severities || {}).map(([s, v]) => `${s}:${v}/3`).join("; ");
    const notes = (log.notes || "").replace(/"/g, '""');
    const ctx = log.context || {};
    const sleep = ctx.sleepHours !== null && ctx.sleepHours !== undefined ? ctx.sleepHours : "";
    const stressVal = ctx.stress !== null && ctx.stress !== undefined ? ctx.stress : "";
    const caff = ctx.caffeine === true ? "Yes" : "";
    const alc = ctx.alcohol === true ? "Yes" : "";
    const exer = ctx.exercise === true ? "Yes" : "";
    return `${date},${time},${mood},"${symptoms}","${sevs}","${notes}",${sleep},${stressVal},${caff},${alc},${exer}`;
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
  const isMulti = !!q.multi;
  const [selected, setSelected] = useState(profile ? profile[questionIndex] : (isMulti ? [] : null));
  const [multiSelected, setMultiSelected] = useState(isMulti && profile ? (profile[questionIndex] ?? []) : []);

  function handleSelect(i) {
    if (isMulti) {
      setMultiSelected((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
    } else {
      setSelected(i);
    }
  }

  function handleSave() {
    onSave(questionIndex, isMulti ? multiSelected : selected);
  }

  const canSave = isMulti ? multiSelected.length > 0 : selected !== null;

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
        {isMulti && <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8, fontStyle: "italic" }}>Select all that apply</div>}
        <div className="q-options">
          {q.opts.map((opt, i) => (
            <button
              key={i}
              className={`q-opt${isMulti ? (multiSelected.includes(i) ? " selected" : "") : (selected === i ? " selected" : "")}`}
              onClick={() => handleSelect(i)}
            >
              {typeof opt === "string" ? opt : opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="onboard-btn"
        onClick={handleSave}
        disabled={!canSave}
      >
        Save
      </button>
    </div>
  );
}

// ─── Milestones Card (collapsible) ────────────────────────────────────────────

function SettingsScreen({ profile, logs, isPremium, onShowPaywall, onEditQuestion, onClearData, remindersEnabled, onToggleReminders, reminderTimes, onUpdateReminderTime, onNavigate }) {
  const [themePref, setThemePref] = useState(() => getThemePref());
  const [hkOn, setHkOn] = useState(() => isHealthKitEnabled());
  const [hkStatus, setHkStatus] = useState("checking");
  const [hkBusy, setHkBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getHealthKitStatus().then((s) => { if (!cancelled) setHkStatus(s); });
    return () => { cancelled = true; };
  }, []);

  async function toggleHealthKit() {
    if (!isPremium) { onShowPaywall(); return; }
    if (hkStatus !== "available") return;
    setHkBusy(true);
    try {
      if (hkOn) {
        await disableHealthKit();
        setHkOn(false);
      } else {
        const r = await enableHealthKit();
        if (r.ok) setHkOn(true);
      }
    } finally {
      setHkBusy(false);
    }
  }

  const journeyStage = profile ? getJourneyLabel(profile[0]) : "Not set";
  const guidanceLabels = ["Daily check-ins", "Weekly summaries", "Only when I ask", "Let Vela decide"];
  const guidancePref = profile && profile[3] !== undefined && profile[3] !== null ? profile[3] : 3;
  const goalLabels = ["Understand my body", "Track for my doctor", "Find relief strategies", "Connect with others"];
  const goalArr = profile ? (Array.isArray(profile[2]) ? profile[2].map((i) => goalLabels[i]) : [goalLabels[profile[2]]]) : [];
  const goal = goalArr.length === 0 ? "Not set" : goalArr.length === 1 ? goalArr[0] : `${goalArr[0]} +${goalArr.length - 1} more`;
  const concernCount = profile && Array.isArray(profile[1]) ? profile[1].length : (profile?.[1] != null ? 1 : 0);

  const stats = computeGamificationStats(logs);
  const days = stats.uniqueDays;
  const streak = stats.streak;
  const entries = logs.length;

  // First log date for "Tracking since"
  const trackingSince = (() => {
    if (logs.length === 0) return "today";
    const earliest = logs.map((l) => l.date).sort()[0];
    const d = new Date(earliest);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  })();

  // Position the marker on a 5-stage arc (Regular cycles → Perimenopause → Postmenopause → Surgical)
  const stagePosition = profile && profile[0] !== undefined ? [0.10, 0.45, 0.85, 0.65][profile[0]] || 0.45 : 0.45;

  // Recent quote — pull from the strongest correlation if we have one
  const correlations = analyzeCorrelations(logs);
  const journeyQuote = correlations[0]?.text
    || (days > 0 ? `${days} days of data, still listening for the patterns that matter to you.` : "Your journey starts the day you begin to log.");

  return (
    <div className="screen active">
      <div className="set-greeting" style={{ padding: "0 0 18px" }}>
        <h1>Settings <em>&amp; you.</em></h1>
        <p className="meta">Profile, preferences, and exports.</p>
      </div>

      {/* Journey card — replaces the old XP/level/badges grid */}
      <section className="journey-card">
        <span className="eye"><UIIcon name="Sparkle" size={11} /> Your record</span>
        <h2 className="name">
          {days < 7 ? <>Just <em>getting started.</em></>
            : days < 30 ? <>Building the <em>baseline.</em></>
            : <>{Math.floor(days/30)} {days < 60 ? "month" : "months"} in, <em>finding the rhythm.</em></>}
        </h2>
        <p className="since">Tracking since {trackingSince}</p>

        <div className="journey-grid">
          <div className="journey-cell">
            <div className="v">{days}<small>days</small></div>
            <div className="l">Tracked</div>
          </div>
          <div className="journey-cell">
            <div className="v">{streak}<small>days</small></div>
            <div className="l">Current streak</div>
          </div>
          <div className="journey-cell">
            <div className="v">{entries}</div>
            <div className="l">Entries</div>
          </div>
        </div>

        <div className="journey-arc" aria-label="Stage marker">
          <span className="marker" style={{ left: `${stagePosition * 100}%` }} />
        </div>

        <p className="quote">"{journeyQuote}"</p>
      </section>

      {/* Profile */}
      <div className="set-section-label"><span>Profile</span></div>
      <div className="set-card">
        <button className="set-row" onClick={() => onEditQuestion(0)}>
          <span className="glyph"><UIIcon name="Flower" size={16} /></span>
          <span className="body"><span className="label">Hormonal stage</span></span>
          <span className="value">{journeyStage || "Not set"}</span>
          <span className="arrow">›</span>
        </button>
        <button className="set-row" onClick={() => onEditQuestion(2)}>
          <span className="glyph"><UIIcon name="Target" size={16} /></span>
          <span className="body"><span className="label">Primary goal</span></span>
          <span className="value">{goal}</span>
          <span className="arrow">›</span>
        </button>
        <button className="set-row" onClick={() => onEditQuestion(1)}>
          <span className="glyph"><UIIcon name="MagnifyingGlass" size={16} /></span>
          <span className="body"><span className="label">Tracked concerns</span></span>
          <span className="value">{concernCount > 0 ? `${concernCount} chosen` : "Not set"}</span>
          <span className="arrow">›</span>
        </button>
      </div>

      {/* Subscription */}
      <div className="set-section-label"><span>Subscription</span></div>
      {isPremium ? (
        <div className="set-card">
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="glyph" style={{ background: "var(--sage-light)", color: "var(--sage-dark)" }}><UIIcon name="CheckCircle" size={16} /></span>
            <span className="body">
              <span className="label">Vela Premium</span>
              <span className="sub">All features unlocked</span>
            </span>
            <span className="value sage">Active</span>
          </div>
        </div>
      ) : (
        <button className="set-premium-row" onClick={onShowPaywall}>
          <span className="crest"><UIIcon name="Star" size={20} /></span>
          <span className="body">
            <strong>Upgrade to Vela Premium</strong>
            <small>Ask Vela AI, doctor reports, cycle prediction, experiments</small>
          </span>
          <span className="cta">From $5.83/mo</span>
        </button>
      )}

      {/* Reminders */}
      <div className="set-section-label">
        <span>Reminders</span>
        {!remindersEnabled && <span style={{ fontSize: 11, color: "var(--ink-light)", textTransform: "none", letterSpacing: 0 }}>Off</span>}
      </div>
      <div className="set-card">
        <div className="set-row" style={{ cursor: "default" }}>
          <span className="glyph"><UIIcon name="Bell" size={16} /></span>
          <span className="body">
            <span className="label">Notifications</span>
            <span className="sub">{remindersEnabled ? "On" : "Off — you'll come to us"}</span>
          </span>
          <span
            className={`set-toggle${remindersEnabled ? " on" : ""}`}
            onClick={(e) => { e.stopPropagation(); onToggleReminders(!remindersEnabled); haptic("Light"); }}
            role="switch"
            aria-checked={remindersEnabled}
          >
            <span className="thumb" />
          </span>
        </div>
        <button className="set-row" onClick={() => onEditQuestion(3)}>
          <span className="glyph"><UIIcon name="ListChecks" size={16} /></span>
          <span className="body"><span className="label">Cadence</span></span>
          <span className="value">{guidanceLabels[guidancePref]}</span>
          <span className="arrow">›</span>
        </button>
        {remindersEnabled && guidancePref === 0 && (
          <>
            <div className="set-row" style={{ cursor: "default" }}>
              <span className="glyph"><UIIcon name="SunHorizon" size={16} /></span>
              <span className="body"><span className="label">Morning nudge</span></span>
              <input type="time" className="set-time" value={reminderTimes.morning} onChange={(e) => onUpdateReminderTime("morning", e.target.value)} />
            </div>
            <div className="set-row" style={{ cursor: "default" }}>
              <span className="glyph"><UIIcon name="Moon" size={16} /></span>
              <span className="body"><span className="label">Evening check-in</span></span>
              <input type="time" className="set-time" value={reminderTimes.evening} onChange={(e) => onUpdateReminderTime("evening", e.target.value)} />
            </div>
          </>
        )}
        {remindersEnabled && guidancePref === 1 && (
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="glyph"><UIIcon name="Calendar" size={16} /></span>
            <span className="body"><span className="label">Sunday summary</span></span>
            <input type="time" className="set-time" value={reminderTimes.weekly} onChange={(e) => onUpdateReminderTime("weekly", e.target.value)} />
          </div>
        )}
        {(!remindersEnabled || guidancePref === 2) && (
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="glyph"><UIIcon name="Smiley" size={16} /></span>
            <span className="body">
              <span className="label">{remindersEnabled ? "Quiet by design" : "We won't reach out"}</span>
              <span className="sub">Open Vela whenever you'd like</span>
            </span>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="set-section-label"><span>Appearance</span></div>
      <div className="set-card">
        <div className="set-row" style={{ cursor: "default", borderBottom: "none" }}>
          <span className="glyph"><UIIcon name="Palette" size={16} /></span>
          <span className="body">
            <span className="label">Theme</span>
            <span className="sub">Candle mode is gentle on tired eyes</span>
          </span>
        </div>
        <div className="set-seg" role="radiogroup" aria-label="Theme">
          {[
            { id: "light", label: "Light", icon: "Sun" },
            { id: "system", label: "System", icon: "DeviceMobile" },
            { id: "dark", label: "Candle", icon: "Moon" },
          ].map((opt) => (
            <button
              key={opt.id}
              className={themePref === opt.id ? "on" : ""}
              onClick={() => { setTheme(opt.id); setThemePref(opt.id); haptic("Light"); }}
              role="radio"
              aria-checked={themePref === opt.id}
            >
              <UIIcon name={opt.icon} size={13} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Connected health */}
      <div className="set-section-label"><span>Connected health</span></div>
      <div className="set-card">
        <button
          className="set-row"
          onClick={toggleHealthKit}
          disabled={hkBusy || (hkStatus !== "available" && isPremium)}
          style={{ opacity: (hkStatus !== "available" && isPremium) ? 0.55 : 1 }}
        >
          <span className="glyph" style={{ background: hkOn ? "var(--sage-light)" : undefined, color: hkOn ? "var(--sage-dark)" : undefined }}>
            <UIIcon name="Heart" size={16} weight={hkOn ? "fill" : "duotone"} />
          </span>
          <span className="body">
            <span className="label">Apple Health</span>
            <span className="sub">
              {!isPremium ? "Auto-fill sleep + HRV from your watch" :
                hkStatus === "no-native" ? "Available on iOS only" :
                hkStatus === "no-plugin" ? "Update Vela to enable Apple Health" :
                hkOn ? "Pulling sleep on every Today open" :
                "Tap to grant permission"}
            </span>
          </span>
          <span className={`value${!isPremium ? " gold" : hkOn ? " sage" : ""}`}>
            {!isPremium ? "Premium" : hkOn ? "On" : (hkStatus === "available" ? "Off" : "—")}
          </span>
        </button>
      </div>

      {/* Privacy & Data */}
      <div className="set-section-label"><span>Privacy &amp; Data</span></div>
      <div className="set-card">
        <button className="set-row" onClick={() => window.open("/privacy.html", "_blank")}>
          <span className="glyph"><UIIcon name="Lock" size={16} /></span>
          <span className="body"><span className="label">Privacy policy</span></span>
          <span className="arrow">›</span>
        </button>
        <button className="set-row" onClick={() => window.open("/terms.html", "_blank")}>
          <span className="glyph"><UIIcon name="FileText" size={16} /></span>
          <span className="body"><span className="label">Terms of service</span></span>
          <span className="arrow">›</span>
        </button>
        <div className="set-row" style={{ cursor: "default" }}>
          <span className="glyph"><UIIcon name="DeviceMobile" size={16} /></span>
          <span className="body">
            <span className="label">Data storage</span>
            <span className="sub">Encrypted, on this device only</span>
          </span>
          <span className="value">On-device</span>
        </div>
      </div>

      {/* Export */}
      <div className="set-section-label"><span>Export</span></div>
      <div className="set-card">
        <button
          className="set-row"
          onClick={() => {
            if (!isPremium) { onShowPaywall(); return; }
            generateDoctorReport(logs, profile);
          }}
        >
          <span className="glyph"><UIIcon name="FileText" size={16} /></span>
          <span className="body">
            <span className="label">Doctor report</span>
            <span className="sub">A printable PDF for your next appointment</span>
          </span>
          <span className={`value${isPremium ? "" : " gold"}`}>{isPremium ? "PDF" : "Premium"}</span>
        </button>
        <button
          className="set-row"
          onClick={() => exportCSV(logs)}
        >
          <span className="glyph"><UIIcon name="ChartBar" size={16} /></span>
          <span className="body">
            <span className="label">Export data</span>
            <span className="sub">CSV — for your records</span>
          </span>
          <span className="arrow">›</span>
        </button>
      </div>

      <button className="set-danger" onClick={onClearData}>Reset all data</button>

      <div className="set-footer">
        <div className="v">Vela 1.0.0</div>
        <div style={{ marginTop: 6 }}>Made for the years between.</div>
        <div style={{ marginTop: 6 }}>
          Questions? <a href="mailto:support@velahealth.health">support@velahealth.health</a>
        </div>
        <div style={{ marginTop: 12, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
          Vela is not medical advice. Please consult your healthcare provider.
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => {
              const count = parseInt(sessionStorage.getItem("_debug_taps") || "0") + 1;
              sessionStorage.setItem("_debug_taps", String(count));
              if (count >= 5) { sessionStorage.removeItem("_debug_taps"); onNavigate && onNavigate("debug"); }
            }}
            style={{ background: "transparent", border: "none", color: "var(--ink-light)", fontSize: 11, cursor: "default", userSelect: "none", padding: 4 }}
          >
            tap 5×
          </button>
        </div>
      </div>
    </div>
  );
}

function CommunityScreen() {
  // Renamed conceptually to "Circle" in the redesign — anonymous daily-prompt
  // model. Kept function name CommunityScreen so App.jsx wiring is unchanged.
  // Real backend integration is still gated by LIVE_COMMUNITY (community.js);
  // this is the visual shell that lights up once we flip the flag.

  const [reactions, setReactions] = useState({ 0: true });
  const [saved, setSaved] = useState({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const isFirst = JSON.parse(localStorage.getItem("vela_circle_first_visit") || "true");
  const [showFirst, setShowFirst] = useState(isFirst);

  function dismissFirst() {
    localStorage.setItem("vela_circle_first_visit", "false");
    setShowFirst(false);
  }

  const toggle = (i) => setReactions((r) => ({ ...r, [i]: !r[i] }));
  const toggleSave = (i) => setSaved((s) => ({ ...s, [i]: !s[i] }));

  // Hardcoded sample data — real prompt + replies come from the Firebase
  // backend (community.js) once LIVE_COMMUNITY is enabled.
  const promptToday = {
    date: "Apr 30",
    text: <>What's one thing you've stopped <em>apologizing for</em> since perimenopause began?</>,
    plain: "What's one thing you've stopped apologizing for since perimenopause began?",
    answered: 247,
    reading: 12,
  };

  const replies = [
    {
      avatar: "M", tone: "a", who: "Anonymous", age: "52 · post-meno", when: "2h",
      body: "What helped most was naming it out loud at work. Not as an apology — just \"I'm in a hot flash, give me 30 seconds.\" The first time felt impossible. The fifth time felt like nothing.",
      hearts: 47, echoed: 12, featured: true,
    },
    {
      avatar: "R", tone: "b", who: "Anonymous", age: "48 · perimeno", when: "4h",
      body: "Honestly? Letting go of the version of me who could push through anything on four hours of sleep. She was great. She's also retired now.",
      hearts: 31, echoed: 8,
    },
    {
      avatar: "J", tone: "c", who: "Anonymous", age: "46 · perimeno", when: "6h",
      body: "Magnesium glycinate at bedtime. Walked into my doctor's office with three months of Vela data and got an actual conversation instead of a shrug. Both helped.",
      hearts: 28, echoed: 5,
    },
    {
      avatar: "K", tone: "d", who: "Anonymous", age: "51 · post-meno", when: "Yesterday",
      body: "I stopped fighting the brain fog and started working with it. Heavy thinking before noon, admin in the afternoon, walks at 4. I'm more productive now than I was at 40, just on a different rhythm.",
      hearts: 22, echoed: 4,
    },
  ];

  const past = [
    { d: "29", m: "Apr", q: "What's something you've grieved that surprised you?", replies: 142 },
    { d: "28", m: "Apr", q: "When did you first realize this was perimenopause and not stress?", replies: 98 },
    { d: "27", m: "Apr", q: "What does your partner / family understand now that they didn't a year ago?", replies: 67 },
  ];

  return (
    <div className="screen active">
      <section className="cir-greeting">
        <h1>The <em>circle.</em></h1>
        <p className="meta">Anonymous, no DMs, no follower counts. Just the question and the answers.</p>
      </section>

      {showFirst && (
        <section className="cir-first-welcome">
          <div className="cir-first-eye"><UIIcon name="Sparkle" size={12} /> First time here</div>
          <h3>You don't have to <em>say anything yet.</em></h3>
          <p>Most people read for a week before they answer. That's fine. The prompt below is today's — there will be a new one tomorrow.</p>
          <div className="cir-first-rules">
            <span><UIIcon name="Eye" size={12} /> Anonymous by default</span>
            <span><UIIcon name="Lock" size={12} /> No replies, no DMs</span>
            <span><UIIcon name="CheckCircle" size={12} /> Delete anytime</span>
          </div>
          <button
            type="button"
            onClick={dismissFirst}
            style={{ marginTop: 12, background: "transparent", border: "none", color: "var(--clay-dark)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 4, textDecoration: "underline" }}
          >
            Got it — show me the prompt
          </button>
        </section>
      )}

      {/* Today's prompt */}
      <section className="cir-prompt" aria-label="Today's prompt">
        <span className="eye"><span className="dot" /> Today's prompt · {promptToday.date}</span>
        <h2>{promptToday.text}</h2>
        <div className="cir-prompt-meta">
          <span><strong style={{ color: "var(--ink)", fontWeight: 600 }}>{promptToday.answered}</strong> have answered</span>
          <span className="dot">·</span>
          <span className="live"><span className="pulse" /> {promptToday.reading} reading now</span>
        </div>
        <button type="button" className="cir-share-btn" onClick={() => setComposeOpen(true)}>
          <UIIcon name="Sparkle" size={14} />
          Share your answer
          <span className="anon">· anonymous</span>
        </button>
      </section>

      {/* Replies */}
      <div className="cir-section-label">
        <span>Answers</span>
        <span className="filter-chip">
          <UIIcon name="ArrowUp" size={11} /> Most echoed
        </span>
      </div>

      {replies.map((r, i) => (
        <article key={i} className={`cir-reply${r.featured ? " featured" : ""}`}>
          <div className="cir-reply-head">
            <span className={`cir-avatar ${r.tone}`}>{r.avatar}</span>
            <span className="who">{r.who}</span>
            <span className="age">· {r.age}</span>
            <span className="when">{r.when}</span>
          </div>
          <p className="cir-reply-body">{r.body}</p>
          <div className="cir-reply-foot">
            <button
              type="button"
              className={`react${reactions[i] ? " on" : ""}`}
              onClick={() => toggle(i)}
              aria-pressed={!!reactions[i]}
            >
              <UIIcon name="Heart" size={12} weight={reactions[i] ? "fill" : "duotone"} />
              <span>{r.hearts + (reactions[i] ? 1 : 0)}</span>
            </button>
            <span style={{ color: "var(--ink-light)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <UIIcon name="ChatCircle" size={12} /> {r.echoed} echoed
            </span>
            <button
              type="button"
              className={`save${saved[i] ? " on" : ""}`}
              onClick={() => toggleSave(i)}
              aria-pressed={!!saved[i]}
            >
              <UIIcon name="Star" size={13} weight={saved[i] ? "fill" : "duotone"} />
            </button>
          </div>
        </article>
      ))}

      {/* Past prompts */}
      <div className="cir-section-label"><span>Past prompts</span></div>
      <div className="cir-past">
        {past.map((p) => (
          <button key={p.d} type="button" className="cir-past-row">
            <div className="day">
              <div className="num">{p.d}</div>
              <div className="mo">{p.m}</div>
            </div>
            <div className="body">
              <div className="q">{p.q}</div>
              <div className="stats">{p.replies} answers</div>
            </div>
            <span className="arrow">›</span>
          </button>
        ))}
      </div>

      {/* Privacy footer */}
      <div className="cir-privacy">
        <span className="ico"><UIIcon name="Lock" size={14} /></span>
        <div className="body">
          <strong>Always anonymous</strong>
          No usernames, no profiles, no photos. We strip metadata before posting. You can delete your answer anytime.
        </div>
      </div>

      {/* Compose sheet */}
      {composeOpen && (
        <>
          <div className="dd-scrim show" onClick={() => setComposeOpen(false)} />
          <aside className="dd-sheet show" role="dialog" aria-modal="true" aria-label="Compose answer">
            <div className="dd-handle" />
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink)", margin: "0 0 12px", lineHeight: 1.3 }}>
              {promptToday.text}
            </p>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Take your time. There's no word count."
              style={{ width: "100%", minHeight: 110, border: "1px solid var(--border)", borderRadius: 14, padding: 12, fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink)", resize: "none", outline: "none", lineHeight: 1.5, background: "var(--card-bg)" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--sage-dark)", fontWeight: 500 }}>
                <UIIcon name="Lock" size={12} /> Posting anonymously
              </span>
              <button
                type="button"
                disabled={draft.trim().length < 8}
                onClick={() => { setDraft(""); setComposeOpen(false); }}
                style={{ padding: "11px 18px", borderRadius: 12, background: "var(--clay)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: draft.trim().length < 8 ? "not-allowed" : "pointer", opacity: draft.trim().length < 8 ? 0.4 : 1, fontFamily: "inherit" }}
              >
                Share
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

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

  // Initialize analytics + RevenueCat, then sync subscription status on launch
  useEffect(() => {
    initAnalytics();
    (async () => {
      await initPurchases();
      const { isPremium: livePremium } = await checkSubscription();
      if (livePremium) setIsPremium(true);
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
    const logEntry = { ...entry, date: new Date().toISOString() };
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
    let msg = "Entry logged! Keep it up. 🌿";
    if (uniqueDays === 1) msg = concern ? `First entry logged! Vela is now learning your ${concern} patterns. 🌱` : "First entry logged! You're on your way. 🌱";
    else if (uniqueDays === 3) msg = concern ? `3 days in! I'm starting to see your ${concern} rhythm. 📊` : "3 days logged! Patterns are starting to form. 📊";
    else if (uniqueDays === 7) msg = concern ? `7 days! Your ${concern} insights are ready — tap Insights. ✨` : "7 days! Tap Insights to see your first patterns. ✨";
    else if (uniqueDays === 14) msg = "2 weeks of data! Your insights are getting powerful. 🔬";
    else if (streak >= 7 && streak % 7 === 0) msg = `${streak}-day streak! You're building a powerful health picture. 🔥`;
    else if (symptoms.length >= 3) {
      const matched = concern && symptoms.some((s) => s.toLowerCase().includes(concern.toLowerCase()));
      msg = matched ? `Tracking your ${concern} + ${symptoms.length - 1} more — great detail! 💡` : "Detailed entry logged! More data = better insights. 💡";
    }
    else if (entry.notes && entry.notes.length > 20) msg = "Great notes! These details help spot patterns. 📝";
    else if (entry.energy !== null && entry.energy !== undefined && entry.mood !== null && entry.mood !== undefined) msg = "Mood + energy logged — building your full picture. 🌟";
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
      localStorage.removeItem("vela_logs");
      localStorage.removeItem("vela_profile");
      localStorage.removeItem("vela_onboarded");
      localStorage.removeItem("vela_reminders_enabled");
      localStorage.removeItem("vela_reminder_times");
      localStorage.removeItem("vela_community_votes");
      localStorage.removeItem("vela_community_likes");
      localStorage.removeItem("vela_community_bookmarks");
      localStorage.removeItem("vela_community_reactions");
      localStorage.removeItem("vela_community_posts");
      localStorage.removeItem("vela_community_guidelines_seen");
      localStorage.removeItem("vela_community_user_topics");
      localStorage.removeItem("vela_community_replies");
      localStorage.removeItem("vela_chat_messages");
      localStorage.removeItem("vela_last_digest_date");
      localStorage.removeItem("vela_custom_symptoms");
      localStorage.removeItem("vela_completed_lessons");
      localStorage.removeItem("vela_active_experiment");
      localStorage.removeItem("vela_completed_experiments");
      localStorage.removeItem("vela_streak_freezes");
      localStorage.removeItem("vela_streak_freeze_count");
      localStorage.removeItem("vela_active_cbt");
      localStorage.removeItem("vela_completed_cbt");
      localStorage.removeItem("vela_insights_nudge_dismissed");
      localStorage.removeItem("vela_doctor_nudge_dismissed");
      localStorage.removeItem("vela_community_nudge_dismissed");
      localStorage.removeItem("vela_relief_nudge_dismissed");
      localStorage.removeItem("vela_insights_revealed");
      cancelAllReminders();
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
      const notes = day === 5 ? "Bad night — woke up drenched around 3am after the late espresso." : (day === 12 ? "Felt great today. Slept 8 hours and walked 5k." : "");
      demoLogs.unshift({
        date: d.toISOString(),
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
      {onboarded && screen === "tracker" && <TrackerScreen onLog={handleLog} logs={logs} profile={profile} isPremium={isPremium} onNavigate={setScreen} onShowPaywall={() => openPaywall("tracker")} />}
      {onboarded && screen === "history" && <HistoryScreen logs={logs} isPremium={isPremium} onShowPaywall={() => openPaywall("history")} onNavigate={setScreen} />}
      {onboarded && screen === "insights" && (
        <InsightsScreen
          logs={logs}
          profile={profile}
          isPremium={isPremium}
          onShowPaywall={() => openPaywall("insights")}
        />
      )}
      {onboarded && screen === "community" && <CommunityScreen />}
      {onboarded && screen === "settings" && (
        <SettingsScreen
          profile={profile}
          logs={logs}
          isPremium={isPremium}
          onShowPaywall={() => openPaywall("settings")}
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
                  { label: "Day 7", msg: "7 days! Your hot flashes insights are ready — tap Insights. ✨ +20 XP" },
                  { label: "With streak 1.5x", msg: "Entry logged! Keep it up. 🌿 +23 XP (1.5x streak bonus!)" },
                  { label: "With streak 3x", msg: "Entry logged! Keep it up. 🌿 +45 XP (3x streak bonus!)" },
                  { label: "Detailed entry", msg: "Tracking your hot flashes + 2 more — great detail! 💡 +25 XP" },
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

      {/* Bottom nav — hidden during onboarding */}
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
        {toastMsg || "Entry logged! Keep it up. 🌿"}
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
            <div className="levelup-sparkle">🌿</div>
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

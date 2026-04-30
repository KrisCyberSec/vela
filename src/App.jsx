import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import * as communityMod from "./community";
import { initAnalytics, track } from "./analytics";
import { initPurchases, checkSubscription, purchasePlan, restorePurchases } from "./subscription";
import { readJSON as safeReadJSON } from "./safeStorage";
import { getThemePref, setTheme } from "./theme";

function haptic(style = "Light") {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle[style] }).catch(() => {});
  }
}

const SYMPTOM_CATEGORIES = [
  { key: "common", label: "Most common" },
  { key: "mood", label: "Mood & cognitive" },
  { key: "physical", label: "Physical" },
  { key: "intimate", label: "Intimate" },
  { key: "digestive", label: "Digestive" },
  { key: "other", label: "Other" },
];

const SYMPTOMS = [
  // Most common (shown first)
  { icon: "🌡", name: "Hot flash", cat: "common" },
  { icon: "🌙", name: "Night sweats", cat: "common" },
  { icon: "😴", name: "Poor sleep", cat: "common" },
  { icon: "🧠", name: "Brain fog", cat: "common" },
  { icon: "💔", name: "Mood shifts", cat: "common" },
  { icon: "⚡", name: "Fatigue", cat: "common" },
  { icon: "😰", name: "Anxiety", cat: "common" },
  { icon: "🔥", name: "Irritability", cat: "common" },
  // Mood & cognitive
  { icon: "😢", name: "Depression", cat: "mood" },
  { icon: "😱", name: "Panic attacks", cat: "mood" },
  { icon: "💭", name: "Memory lapse", cat: "mood" },
  { icon: "🗣️", name: "Word-finding difficulty", cat: "mood" },
  { icon: "🎯", name: "Difficulty concentrating", cat: "mood" },
  { icon: "😤", name: "Mood swings", cat: "mood" },
  { icon: "😶", name: "Low motivation", cat: "mood" },
  // Physical
  { icon: "💊", name: "Headache", cat: "physical" },
  { icon: "🤕", name: "Migraine", cat: "physical" },
  { icon: "🦴", name: "Joint pain", cat: "physical" },
  { icon: "💪", name: "Muscle aches", cat: "physical" },
  { icon: "🔙", name: "Back pain", cat: "physical" },
  { icon: "💓", name: "Palpitations", cat: "physical" },
  { icon: "🧊", name: "Chills", cat: "physical" },
  { icon: "🌀", name: "Dizziness", cat: "physical" },
  { icon: "👂", name: "Tinnitus", cat: "physical" },
  { icon: "✋", name: "Tingling/numbness", cat: "physical" },
  { icon: "🦵", name: "Restless legs", cat: "physical" },
  { icon: "💇", name: "Hair thinning", cat: "physical" },
  { icon: "🧴", name: "Dry skin", cat: "physical" },
  { icon: "🌊", name: "Breast tenderness", cat: "physical" },
  { icon: "⚖️", name: "Weight change", cat: "physical" },
  // Intimate health
  { icon: "💧", name: "Vaginal dryness", cat: "intimate" },
  { icon: "🔥", name: "Vaginal irritation", cat: "intimate" },
  { icon: "❤️", name: "Low libido", cat: "intimate" },
  { icon: "🚽", name: "Urinary urgency", cat: "intimate" },
  { icon: "💦", name: "Incontinence", cat: "intimate" },
  // Digestive
  { icon: "🫧", name: "Bloating", cat: "digestive" },
  { icon: "🤢", name: "Nausea", cat: "digestive" },
  { icon: "🔥", name: "Acid reflux", cat: "digestive" },
  { icon: "😣", name: "Digestive changes", cat: "digestive" },
  // Other
  { icon: "🫁", name: "Shortness of breath", cat: "other" },
  { icon: "👄", name: "Dry mouth", cat: "other" },
  { icon: "👁️", name: "Dry eyes", cat: "other" },
  { icon: "🦷", name: "Gum problems", cat: "other" },
  { icon: "🐛", name: "Crawling skin", cat: "other" },
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
    text: "Which symptoms bother you most?",
    multi: true,
    opts: [
      "Hot flashes & night sweats",
      "Sleep problems",
      "Mood changes & anxiety",
      "Brain fog & fatigue",
      "Joint pain & body aches",
      "Weight changes & bloating",
      "Low libido & dryness",
      "Heart palpitations",
    ],
  },
  {
    text: "What's your main goal with Vela?",
    multi: true,
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

function applyStreakFreeze() {
  const today = localDateStr(new Date());
  const freezes = (() => { try { return JSON.parse(localStorage.getItem("vela_streak_freezes") || "[]"); } catch { return []; } })();
  if (freezes.includes(today)) return false; // already frozen today
  const available = (() => { try { return JSON.parse(localStorage.getItem("vela_streak_freeze_count") || "0"); } catch { return 0; } })();
  if (available <= 0) return false;
  freezes.push(today);
  localStorage.setItem("vela_streak_freezes", JSON.stringify(freezes.slice(-30)));
  localStorage.setItem("vela_streak_freeze_count", JSON.stringify(available - 1));
  return true;
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

function predictSymptoms(logs) {
  if (logs.length < 14) return { predictions: [], moodForecast: null, tip: null };
  const today = new Date();
  const todayDow = today.getDay();
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byDate = {};
  logs.forEach((l) => {
    const d = l.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  });
  const dates = Object.keys(byDate).sort();
  const weekdaySymptoms = {};
  let weekdayDayCount = 0;
  let moodSum = 0, moodCount = 0;
  dates.forEach((d) => {
    if (new Date(d + "T12:00:00").getDay() !== todayDow) return;
    weekdayDayCount++;
    const syms = [...new Set(byDate[d].flatMap((l) => Object.keys(l.symptoms || {})))];
    syms.forEach((s) => { weekdaySymptoms[s] = (weekdaySymptoms[s] || 0) + 1; });
    byDate[d].forEach((l) => { if (l.mood !== null && l.mood !== undefined) { moodSum += l.mood; moodCount++; } });
  });
  if (weekdayDayCount < 2) return { predictions: [], moodForecast: null, tip: null };

  const predictions = Object.entries(weekdaySymptoms)
    .filter(([, c]) => c / weekdayDayCount >= 0.4 && c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => {
      const pct = Math.round((count / weekdayDayCount) * 100);
      // Check recent trend (last 3 occurrences of this weekday vs earlier)
      const recentDates = dates.filter((d) => new Date(d + "T12:00:00").getDay() === todayDow);
      const recent3 = recentDates.slice(-3);
      const earlier3 = recentDates.slice(-6, -3);
      const recentRate = recent3.length > 0 ? recent3.filter((d) => byDate[d].some((l) => Object.keys(l.symptoms || {}).includes(name))).length / recent3.length : 0;
      const earlyRate = earlier3.length > 0 ? earlier3.filter((d) => byDate[d].some((l) => Object.keys(l.symptoms || {}).includes(name))).length / earlier3.length : 0;
      const trend = recentRate > earlyRate + 0.15 ? "up" : recentRate < earlyRate - 0.15 ? "down" : "stable";
      return { name, pct, trend };
    });

  const moodForecast = moodCount >= 2 ? Math.round(moodSum / moodCount * 10) / 10 : null;
  const dayName = DOW[todayDow];

  // Generate a contextual tip
  let tip = null;
  if (predictions.length > 0 && predictions[0].pct >= 70) {
    tip = `${predictions[0].name} has appeared on ${predictions[0].pct}% of ${dayName}s. Consider planning accordingly.`;
  } else if (moodForecast !== null && moodForecast <= 2) {
    tip = `${dayName}s tend to be harder for you. Be gentle with yourself and consider lighter commitments.`;
  } else if (predictions.length === 0) {
    tip = `${dayName}s have been relatively symptom-free for you. Enjoy your day!`;
  }

  return { predictions, moodForecast, tip };
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

function getBestInsight(logs, profile) {
  const patterns = analyzePatterns(logs);
  if (patterns.length > 0) return { type: "pattern", text: patterns[0], icon: "💡" };
  const correlations = analyzeCorrelations(logs);
  if (correlations.length > 0) return { type: "correlation", text: correlations[0].text, icon: correlations[0].icon };
  const stats = computeEarlyStats(logs);
  if (stats && stats.topSymptom) {
    const [name, count] = stats.topSymptom;
    const p = getPersonalization(profile);
    const concern = p?.topConcernNames?.[0];
    if (concern && name.toLowerCase().includes(concern.toLowerCase().split(" ")[0])) {
      return { type: "stat", text: `${name} appeared in ${count} of your entries — it's your most frequent symptom, and the one you told us concerned you most.`, icon: "🎯" };
    }
    return { type: "stat", text: `${name} appeared in ${count} of your entries — your most frequent symptom this week.`, icon: "📊" };
  }
  return { type: "generic", text: "You've built a solid foundation of data. Your patterns will sharpen with each day you log.", icon: "🌱" };
}

// ─── Smart Reminders ─────────────────────────────────────────────────────────

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

function monthlyComparison(logs) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const thisML = logs.filter((l) => { const d = new Date(l.date); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; });
  const lastML = logs.filter((l) => { const d = new Date(l.date); return d.getMonth() === lastMonth && d.getFullYear() === lastYear; });
  if (lastML.length === 0) return null;
  const avgMood = (arr) => { const m = arr.filter((l) => l.mood !== null && l.mood !== undefined); return m.length ? m.reduce((s, l) => s + l.mood, 0) / m.length : null; };
  const symCounts = (arr) => { const c = {}; arr.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { c[s] = (c[s] || 0) + 1; })); return c; };
  const thisMood = avgMood(thisML), lastMood = avgMood(lastML);
  const thisSym = symCounts(thisML), lastSym = symCounts(lastML);
  let mostImproved = null, mostWorsened = null, bestDelta = 0, worstDelta = 0;
  [...new Set([...Object.keys(thisSym), ...Object.keys(lastSym)])].forEach((s) => {
    const delta = (thisSym[s] || 0) - (lastSym[s] || 0);
    if (delta < bestDelta) { bestDelta = delta; mostImproved = s; }
    if (delta > worstDelta) { worstDelta = delta; mostWorsened = s; }
  });
  return {
    thisEntries: thisML.length, lastEntries: lastML.length,
    moodDelta: thisMood !== null && lastMood !== null ? thisMood - lastMood : null,
    mostImproved, mostWorsened,
    newSymptoms: Object.keys(thisSym).filter((s) => !lastSym[s]),
  };
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

const SUGGESTED_QUESTIONS = [
  "How am I doing this week?",
  "What are my worst triggers?",
  "Am I getting better or worse?",
  "Which day of the week is best for me?",
  "What should I tell my doctor?",
  "How is my sleep affecting me?",
  "What patterns do you see?",
  "How does stress affect my symptoms?",
  "What's my most common symptom?",
  "How does exercise help me?",
  "Am I sleeping better or worse?",
  "What triggers my hot flashes?",
];

const PERSONALIZED_TIPS = [
  { match: (d) => d.triggerReport?.some((t) => t.impact === "worsens" && t.triggerName.includes("caffeine")), tip: "Your data shows a possible link between caffeine and more symptoms. While clinical evidence on trigger avoidance is limited, your personal patterns are worth discussing with your provider." },
  { match: (d) => d.triggerReport?.some((t) => t.impact === "worsens" && t.triggerName.includes("alcohol")), tip: "Your data suggests more symptoms on days with alcohol. Individual responses vary — consider discussing what you're seeing in your logs with your healthcare provider." },
  { match: (d) => d.triggerReport?.some((t) => t.impact === "helps" && t.triggerName.includes("exercise")), tip: "Your data shows fewer symptoms on active days. Exercise has strong evidence for improving mood during menopause, and your logs suggest it may be helping you too!" },
  { match: (d) => d.trend?.direction === "improving", tip: "You're trending in a positive direction! Whatever changes you've made recently are working. Keep up your current routine." },
  { match: (d) => d.trend?.direction === "worse", tip: "Your symptoms have been a bit more intense lately. This is normal — menopause isn't linear. Consider tracking what changed recently and discussing with your healthcare provider." },
  { match: (d) => d.bestDay?.avgMood >= 7, tip: `Your best days tend to be ${d => d.bestDay?.day}s. Try scheduling important tasks or self-care activities on those days when you tend to feel your best.` },
  { match: (d) => d.avgMood < 5, tip: "Your mood has been lower than usual. Remember: hormonal changes directly affect neurotransmitters. Be gentle with yourself, and consider talking to your healthcare provider if it persists." },
  { match: (d) => d.triggerReport?.some((t) => t.impact === "helps" && t.triggerName.includes("sleep")), tip: "Better sleep nights = fewer symptoms in your data. Sleep quality is one of the strongest levers for managing menopause symptoms. Prioritize those bedtime routines." },
  { match: (d) => d.trend?.avgSymptoms > 3, tip: "You're logging more symptoms than average lately. Consider what's changed — stress, diet, sleep? Small adjustments often have outsized effects." },
  { match: (d) => d.weekInReview?.daysLogged >= 6, tip: "You logged almost every day this week — that consistency is what makes Vela's analysis powerful. Your patterns are sharper than most users' at this stage." },
  { match: (d) => d.weekInReview?.daysLogged <= 3, tip: "You logged fewer days this week. Even a 30-second entry on busy days helps. Gaps in data make patterns harder to spot." },
  { match: (d) => d.symptomTrends?.some((s) => s.direction === "down"), tip: "At least one of your symptoms is trending down. That's real progress. Keep doing what you're doing and watch if the trend continues." },
  { match: (d) => d.bestDay?.symptoms === 0, tip: "You had a symptom-free day this week! Look at what was different — sleep, activity, stress level — and see if you can recreate those conditions." },
  { match: () => true, tip: "Consistency in tracking helps spot patterns faster. Even on good days, a quick log helps Vela understand your full picture." }
];

// All 44 symptom names from SYMPTOMS array, plus common aliases
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

function generateWeeklyDigest(logs, profile) {
  const now = new Date();
  const thisWeek = logs.filter((l) => (now - new Date(l.date)) / 86400000 <= 7);
  const lastWeek = logs.filter((l) => { const d = (now - new Date(l.date)) / 86400000; return d > 7 && d <= 14; });
  if (thisWeek.length < 2) return null;

  const avgMood = (arr) => { const m = arr.filter((l) => l.mood !== null && l.mood !== undefined); return m.length === 0 ? null : Math.round(m.reduce((s, l) => s + l.mood, 0) / m.length * 10) / 10; };
  const avgEnergy = (arr) => { const e = arr.filter((l) => l.energy !== null && l.energy !== undefined); return e.length === 0 ? null : Math.round(e.reduce((s, l) => s + l.energy, 0) / e.length * 10) / 10; };
  const thisMood = avgMood(thisWeek);
  const lastMood = avgMood(lastWeek);
  const moodDelta = thisMood !== null && lastMood !== null ? Math.round((thisMood - lastMood) * 10) / 10 : null;
  const thisEnergy = avgEnergy(thisWeek);
  const lastEnergy = avgEnergy(lastWeek);
  const energyDelta = thisEnergy !== null && lastEnergy !== null ? Math.round((thisEnergy - lastEnergy) * 10) / 10 : null;

  const correlations = analyzeCorrelations(logs);
  const spotlight = correlations.length > 0 ? correlations[0] : null;

  const symptomCounts = {};
  thisWeek.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; }));
  const prevSymptomCounts = {};
  lastWeek.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { prevSymptomCounts[s] = (prevSymptomCounts[s] || 0) + 1; }));
  const symptomTrends = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => {
      const prev = prevSymptomCounts[name] || 0;
      const arrow = count > prev ? "↑" : count < prev ? "↓" : "→";
      return { name, count, arrow };
    });

  const triggers = ["caffeine", "alcohol", "exercise", "poor sleep", "stress"];
  const triggerReport = triggers.map((t) => analyzeTriggerImpact(logs, t)).filter((r) => r.daysWithTrigger >= 1);

  let bestDayEntry = null;
  thisWeek.forEach((l) => {
    const mood = l.mood !== null && l.mood !== undefined ? l.mood : 5;
    const score = mood - Object.keys(l.symptoms || {}).length * 0.5;
    if (!bestDayEntry || score > bestDayEntry.score) bestDayEntry = { date: l.date, mood: l.mood, symptoms: Object.keys(l.symptoms || {}).length, score };
  });

  const digestData = { thisMood, moodDelta, triggerReport, trend: analyzeOverallTrend(logs), bestDay: analyzeBestWorstDays(logs).best, avgMood: thisMood };
  let tip = PERSONALIZED_TIPS.find((t) => {
    try { return t.match(digestData); } catch { return false; }
  });

  // XP summary for the week
  const currentXP = computeXP(logs);
  const currentLevel = getLevel(currentXP);
  const streak = getStreak(logs);
  const streakMult = getStreakMultiplier(streak);

  return {
    daysLogged: thisWeek.length,
    avgMood: thisMood,
    moodDelta,
    avgEnergy: thisEnergy,
    energyDelta,
    spotlight,
    symptomTrends,
    triggerReport: triggerReport.filter((t) => t.daysWithTrigger >= 2),
    bestDay: bestDayEntry,
    tip: tip ? tip.tip : PERSONALIZED_TIPS[PERSONALIZED_TIPS.length - 1].tip,
    xp: currentXP,
    level: currentLevel.level,
    levelName: currentLevel.name,
    xpToNext: currentLevel.xpToNext,
    streak,
    streakMult,
  };
}

// ─── Gamification Engine ─────────────────────────────────────────────────────

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

const DAILY_LESSONS = [
  { id: "dl-1", title: "What happens during perimenopause?", text: "Perimenopause typically begins in your 40s and lasts 4-8 years. Estrogen fluctuates unpredictably — it doesn't just decline linearly. This is why symptoms can come and go.", xp: 10 },
  { id: "dl-2", title: "Why tracking matters", text: "Research shows that women who consistently track symptoms have more productive doctor visits and receive more targeted treatment. Your data is your best advocate.", xp: 10 },
  { id: "dl-3", title: "The brain-hormone connection", text: "Estrogen receptors exist throughout the brain. Fluctuating levels affect serotonin, dopamine, and norepinephrine — which is why mood, sleep, and cognition are all impacted.", xp: 10 },
  { id: "dl-4", title: "Hot flashes: what's really happening", text: "Hot flashes result from changes in your hypothalamus (your body's thermostat). Narrowing of the thermoneutral zone means even small temperature changes trigger a heat-dissipation response.", xp: 10 },
  { id: "dl-5", title: "Exercise and menopause", text: "Exercise has strong evidence for improving mood and cardiovascular health during menopause. While it may not reduce hot flashes directly, it improves overall quality of life significantly.", xp: 10 },
  { id: "dl-6", title: "Sleep during menopause", text: "Up to 60% of menopausal women report sleep issues. CBT for insomnia (CBT-I) has strong evidence and is recommended as a first-line treatment by most guidelines.", xp: 10 },
  { id: "dl-7", title: "Understanding your treatment options", text: "Menopause treatments range from lifestyle changes to hormone therapy. No single approach works for everyone — which is why tracking your individual response is so valuable.", xp: 10 },
  { id: "dl-8", title: "Bone health after menopause", text: "Estrogen protects bone density. After menopause, bone loss accelerates — up to 20% in the first 5-7 years. Weight-bearing exercise and adequate calcium/vitamin D are key preventive strategies.", xp: 10 },
  { id: "dl-9", title: "Cardiovascular health", text: "Heart disease risk increases after menopause as estrogen's protective effect on blood vessels diminishes. Regular exercise, healthy diet, and blood pressure monitoring become even more important.", xp: 10 },
  { id: "dl-10", title: "The power of community", text: "Studies show that peer support reduces menopause-related distress. Knowing you're not alone in your experience has measurable psychological benefits. Connect with others who understand.", xp: 10 },
  { id: "dl-11", title: "Cognitive changes are temporary", text: "Research from the SWAN study shows that cognitive difficulties during perimenopause typically resolve in postmenopause. Your brain is adapting, not declining.", xp: 10 },
  { id: "dl-12", title: "Preparing for your doctor visit", text: "Bring data, not just feelings. Doctors respond to patterns: 'I've had hot flashes 4 out of 7 days, worse after caffeine' is more actionable than 'I've been having hot flashes.'", xp: 10 },
  { id: "dl-13", title: "Menopause is not a disease", text: "Menopause is a natural biological transition. While symptoms can be challenging, framing it as a health transition rather than a medical condition supports better self-advocacy.", xp: 10 },
  { id: "dl-14", title: "Your data tells a story", text: "After just 2 weeks of tracking, patterns emerge that would be invisible otherwise. Day-of-week effects, trigger correlations, and symptom clusters all become clear with consistent data.", xp: 10 },
  { id: "dl-15", title: "Stress and your symptoms", text: "Cortisol and estrogen share metabolic pathways. When stress rises, it can amplify hot flashes, disrupt sleep, and worsen brain fog. Stress management isn't just nice to have — it's a symptom strategy.", xp: 10 },
  { id: "dl-16", title: "The gut-hormone axis", text: "Your gut microbiome contains the 'estrobolome' — bacteria that metabolize estrogen. Gut health directly influences hormone levels. A diverse, fiber-rich diet supports both digestion and hormonal balance.", xp: 10 },
  { id: "dl-17", title: "Why symptoms cluster", text: "Hot flashes, night sweats, and poor sleep often appear together because they share a root cause: hypothalamic sensitivity to estrogen changes. Treating one often improves the others.", xp: 10 },
  { id: "dl-18", title: "Magnesium: the unsung hero", text: "Magnesium supports 300+ enzymatic reactions including sleep regulation, mood stability, and muscle relaxation. Many women in midlife are deficient. Foods like dark leafy greens, nuts, and seeds are excellent sources.", xp: 10 },
  { id: "dl-19", title: "The anxiety-hormone link", text: "Progesterone has a calming effect via GABA receptors. As progesterone drops in perimenopause, anxiety often increases — even in women with no prior history. This is biochemical, not 'just stress.'", xp: 10 },
  { id: "dl-20", title: "Weight changes in midlife", text: "Shifting estrogen levels promote fat redistribution toward the abdomen. This isn't about willpower — it's hormonal. Resistance training is the most evidence-backed strategy for maintaining metabolic health.", xp: 10 },
  { id: "dl-21", title: "Your thyroid matters too", text: "Thyroid disorders become more common in midlife and share symptoms with menopause: fatigue, weight gain, brain fog, mood changes. If symptoms persist despite treatment, ask your doctor to check your thyroid.", xp: 10 },
  { id: "dl-22", title: "Night sweats vs. hot flashes", text: "Night sweats are hot flashes that happen during sleep, but they're uniquely disruptive because they fragment sleep cycles. Cooling bedding, breathable fabrics, and a cool bedroom (65-68°F) can make a real difference.", xp: 10 },
  { id: "dl-23", title: "Alcohol and menopause", text: "Even moderate alcohol intake can trigger hot flashes, disrupt sleep architecture, and worsen anxiety. Many women find that reducing alcohol is one of the most impactful lifestyle changes they can make.", xp: 10 },
  { id: "dl-24", title: "Caffeine: friend or foe?", text: "Caffeine can worsen hot flashes and anxiety in some women, while others tolerate it well. The key is tracking YOUR response. Try noting caffeine intake alongside symptoms for two weeks to see your pattern.", xp: 10 },
  { id: "dl-25", title: "Brain fog is real", text: "fMRI studies show measurable changes in brain activity patterns during perimenopause. Working memory and verbal fluency are most affected. The good news: these changes typically reverse in postmenopause.", xp: 10 },
  { id: "dl-26", title: "The pelvic floor connection", text: "Declining estrogen affects pelvic floor muscles, contributing to urinary urgency, incontinence, and sexual discomfort. Pelvic floor physiotherapy has strong evidence and is available without a referral in many areas.", xp: 10 },
  { id: "dl-27", title: "Vitamin D and menopause", text: "Vitamin D supports bone health, immune function, and mood regulation. Post-menopause, adequate vitamin D becomes critical. Most guidelines recommend 600-1000 IU daily, though many experts suggest higher doses.", xp: 10 },
  { id: "dl-28", title: "Meditation and vasomotor symptoms", text: "Mindfulness meditation has been shown to reduce the perceived severity of hot flashes by 22% in clinical trials. It may not reduce frequency, but it changes your brain's response to the discomfort.", xp: 10 },
  { id: "dl-29", title: "Hormone therapy: myths vs. evidence", text: "Modern hormone therapy is considered safe for most women under 60 or within 10 years of menopause. The 2002 WHI study created widespread fear, but re-analysis shows the risks were overstated for younger women.", xp: 10 },
  { id: "dl-30", title: "Joint pain and estrogen", text: "Estrogen has anti-inflammatory properties. As levels drop, joint pain, stiffness, and even frozen shoulder become more common. This is often misattributed to aging rather than recognized as a menopause symptom.", xp: 10 },
  { id: "dl-31", title: "The power of routine", text: "Consistent daily rhythms — sleep, meals, exercise — help stabilize your circadian clock, which is disrupted by hormonal changes. Regularity doesn't have to be rigid, but predictability helps your body adapt.", xp: 10 },
  { id: "dl-32", title: "Sexual health in menopause", text: "Vaginal dryness affects up to 50% of postmenopausal women, but only 25% seek treatment. Local estrogen therapy is effective and carries minimal systemic risk. Don't suffer in silence — this is treatable.", xp: 10 },
  { id: "dl-33", title: "Iron and energy", text: "If you're still having periods in perimenopause, heavy or irregular bleeding can deplete iron stores. Low ferritin (even in 'normal' range) causes fatigue, brain fog, and restless legs. Ask your doctor to test ferritin specifically.", xp: 10 },
  { id: "dl-34", title: "Your heart rate and hormones", text: "Heart palpitations during menopause are common and usually benign — caused by estrogen fluctuations affecting the electrical system of the heart. However, always report new palpitations to your doctor to rule out other causes.", xp: 10 },
  { id: "dl-35", title: "Protein needs increase", text: "After 40, muscle mass declines ~1% per year without intervention. Increasing protein intake to 1.2-1.6g per kg of body weight, combined with resistance training, helps maintain muscle, bone density, and metabolic rate.", xp: 10 },
  { id: "dl-36", title: "The social brain", text: "Social connection isn't just nice — it's medicine. Loneliness activates the same stress pathways as physical pain. Women with strong social networks report fewer menopause symptoms and better overall wellbeing.", xp: 10 },
  { id: "dl-37", title: "Skin changes in menopause", text: "Collagen declines ~30% in the first 5 years after menopause. Skin becomes thinner, drier, and less elastic. Sunscreen, moisturizers with hyaluronic acid, and retinoids can help. Estrogen therapy also supports skin health.", xp: 10 },
  { id: "dl-38", title: "Why mornings matter", text: "Morning light exposure within 30 minutes of waking helps regulate melatonin and cortisol rhythms. This single habit can improve sleep quality, mood, and energy — three common menopause complaints — simultaneously.", xp: 10 },
  { id: "dl-39", title: "Perimenopause can start early", text: "While average onset is 47, perimenopause can begin in the late 30s. Early symptoms are often dismissed as 'just stress.' If you're under 45 with cycle changes, mood shifts, or new symptoms, it's worth discussing with your doctor.", xp: 10 },
  { id: "dl-40", title: "Hair changes and hormones", text: "Thinning hair is reported by up to 50% of women during menopause. The shift in estrogen-to-androgen ratio affects hair follicles. Iron, biotin, and managing stress can help. Significant hair loss warrants medical evaluation.", xp: 10 },
  { id: "dl-41", title: "Omega-3 fatty acids", text: "Omega-3s (EPA and DHA) have anti-inflammatory effects that may reduce joint pain, support cardiovascular health, and improve mood. Fatty fish, walnuts, and flaxseed are good sources. Consider supplementation if intake is low.", xp: 10 },
  { id: "dl-42", title: "The second spring", text: "In Traditional Chinese Medicine, post-menopause is called the 'Second Spring' — a time of renewed energy and wisdom. Many women report feeling more confident, focused, and authentic after the transition completes.", xp: 10 },
  { id: "dl-43", title: "Blood sugar and symptoms", text: "Blood sugar instability worsens hot flashes, mood swings, and energy crashes. Pairing carbs with protein, eating regular meals, and reducing refined sugars can stabilize glucose — and often reduces symptom severity.", xp: 10 },
  { id: "dl-44", title: "Strength training is essential", text: "Resistance training is the single most important exercise modality in midlife. It preserves bone density, maintains muscle mass, boosts metabolism, improves insulin sensitivity, and supports mood. Aim for 2-3 sessions per week.", xp: 10 },
  { id: "dl-45", title: "Dry eyes and mouth", text: "Estrogen maintains moisture in mucous membranes throughout the body. Dry eyes, dry mouth, and even dry skin are common but often overlooked menopause symptoms. Lubricating drops and staying hydrated help.", xp: 10 },
  { id: "dl-46", title: "Cognitive strategies that help", text: "For brain fog: write things down immediately, use timers and reminders, batch similar tasks, and give yourself grace. These aren't crutches — they're smart adaptations while your brain adjusts to new hormone levels.", xp: 10 },
  { id: "dl-47", title: "The rage is real", text: "Intense irritability or sudden rage episodes can occur in perimenopause due to estrogen-serotonin interactions. This doesn't mean something is wrong with you — it means your neurochemistry is shifting. Name it, don't shame it.", xp: 10 },
  { id: "dl-48", title: "Breathing techniques for hot flashes", text: "Paced breathing (slow, deep breaths at 6-8 per minute) can reduce hot flash intensity by up to 50% in studies. Practice when you're calm so it becomes automatic when a flash hits. Inhale 5 seconds, exhale 7 seconds.", xp: 10 },
  { id: "dl-49", title: "Phytoestrogens: do they work?", text: "Plant estrogens from soy, flaxseed, and red clover have modest evidence for reducing hot flashes. They're most effective in women who produce equol (a gut metabolite). Results vary significantly between individuals.", xp: 10 },
  { id: "dl-50", title: "Sleep hygiene essentials", text: "Keep your bedroom cool (65-68°F), dark, and quiet. Avoid screens 1 hour before bed. Maintain consistent sleep/wake times. Limit caffeine after noon. These basics work better than any supplement for most women.", xp: 10 },
  { id: "dl-51", title: "When to see a specialist", text: "If your symptoms significantly impact daily life, consider a menopause specialist or NAMS-certified provider. General practitioners receive an average of zero hours of menopause training in medical school.", xp: 10 },
  { id: "dl-52", title: "Tinnitus and menopause", text: "Ringing in the ears can be triggered by estrogen fluctuations affecting the inner ear. It's more common in perimenopause than many realize. Stress reduction, adequate sleep, and limiting caffeine may help.", xp: 10 },
  { id: "dl-53", title: "Your libido is not broken", text: "Changes in desire are common and multifactorial: hormonal shifts, vaginal dryness, fatigue, body image changes, and relationship dynamics all play roles. This is treatable and worth discussing with your healthcare provider.", xp: 10 },
  { id: "dl-54", title: "The inflammation connection", text: "Estrogen is anti-inflammatory. As it declines, systemic inflammation increases — contributing to joint pain, fatigue, brain fog, and cardiovascular risk. Anti-inflammatory foods (berries, leafy greens, fatty fish) can help.", xp: 10 },
  { id: "dl-55", title: "Progesterone and sleep", text: "Progesterone promotes sleep via GABA receptors. Its decline in perimenopause often precedes estrogen decline, which is why sleep problems can be the first symptom women notice — sometimes years before hot flashes.", xp: 10 },
  { id: "dl-56", title: "You're not imagining things", text: "Gaslighting in healthcare is real. If a doctor dismisses your symptoms as 'just aging' or 'just stress,' seek another opinion. Your symptoms have physiological explanations and evidence-based treatments exist.", xp: 10 },
  { id: "dl-57", title: "Restless legs and iron", text: "Restless leg syndrome increases during menopause. Low iron/ferritin is a common trigger. Magnesium before bed and regular exercise also help. If it's disrupting sleep, it's worth treating.", xp: 10 },
  { id: "dl-58", title: "Dental health and hormones", text: "Declining estrogen affects gum tissue and saliva production, increasing risk of gum disease and tooth decay. Regular dental visits and good oral hygiene become even more important during and after menopause.", xp: 10 },
  { id: "dl-59", title: "The 30-day effect", text: "Most lifestyle interventions take 2-4 weeks to show measurable results. If you've started a new habit, give it a full month before judging its impact. Your tracking data will show you the truth.", xp: 10 },
  { id: "dl-60", title: "You are the expert on you", text: "No study, app, or doctor knows your body better than you do. Track your experience, trust your observations, bring your data to appointments, and advocate for yourself. You deserve care that takes you seriously.", xp: 10 },
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
    --card-bg:    #FFFFFF;

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
  .energy-icon { font-size: 20px; }
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
  .sr-icon { font-size: 18px; }
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
  const initialQIndex = Math.min(saved?.qIndex ?? 0, QUESTIONS.length - 1);
  const initialAnswers = saved?.answers && typeof saved.answers === "object" ? saved.answers : {};
  const initialQ = QUESTIONS[initialQIndex];

  const [qIndex, setQIndex] = useState(initialQIndex);
  const [answers, setAnswers] = useState(initialAnswers);
  const [selected, setSelected] = useState(initialQ?.multi ? null : (initialAnswers[initialQIndex] ?? null));
  const [multiSelected, setMultiSelected] = useState(initialQ?.multi ? (initialAnswers[initialQIndex] ?? []) : []);
  const [transitioning, setTransitioning] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const q = QUESTIONS[qIndex];
  const progress = showComplete ? 100 : ((qIndex + 1) / QUESTIONS.length) * 100;
  const isLast = qIndex === QUESTIONS.length - 1;
  const isMulti = !!q.multi;

  // Persist progress on every change so close-and-reopen resumes mid-flow
  useEffect(() => {
    try {
      localStorage.setItem("vela_onboarding_progress", JSON.stringify({ qIndex, answers }));
    } catch { /* private mode or quota — fine, just don't persist */ }
  }, [qIndex, answers]);

  function handleSelect(i) {
    if (isMulti) {
      setMultiSelected((prev) => {
        const next = prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i];
        setAnswers((a) => ({ ...a, [qIndex]: next }));
        return next;
      });
    } else {
      setSelected(i);
      setAnswers((prev) => ({ ...prev, [qIndex]: i }));
    }
  }

  function handleNext() {
    if (isLast) {
      setShowComplete(true);
      haptic("Medium");
    } else {
      setTransitioning(true);
      setTimeout(() => {
        setQIndex((i) => i + 1);
        const nextQ = QUESTIONS[qIndex + 1];
        if (nextQ.multi) {
          setMultiSelected(answers[qIndex + 1] ?? []);
          setSelected(null);
        } else {
          setSelected(answers[qIndex + 1] ?? null);
          setMultiSelected([]);
        }
        setTransitioning(false);
      }, 200);
    }
  }

  function handleBack() {
    if (qIndex === 0 || transitioning) return;
    haptic("Light");
    setTransitioning(true);
    setTimeout(() => {
      const prevIdx = qIndex - 1;
      const prevQ = QUESTIONS[prevIdx];
      setQIndex(prevIdx);
      if (prevQ.multi) {
        setMultiSelected(Array.isArray(answers[prevIdx]) ? answers[prevIdx] : []);
        setSelected(null);
      } else {
        setSelected(answers[prevIdx] ?? null);
        setMultiSelected([]);
      }
      setTransitioning(false);
    }, 200);
  }

  function handleStart() {
    try { localStorage.removeItem("vela_onboarding_progress"); } catch { /* ignore */ }
    onComplete(answers);
  }

  const canContinue = isMulti ? multiSelected.length > 0 : selected !== null;

  // Personalized completion screen
  if (showComplete) {
    const journeyLabels = ["regular cycles", "perimenopause", "postmenopause", "surgical menopause"];
    const stage = journeyLabels[answers[0]] || "your journey";
    const concernNames = ["hot flashes", "sleep", "mood", "brain fog", "joint pain", "weight", "intimate health", "heart health"];
    const topConcerns = (answers[1] || []).slice(0, 2).map((i) => concernNames[i]).filter(Boolean);

    return (
      <div className="screen active">
        <div className="onboard-complete">
          <div className="onboard-complete-icon">✨</div>
          <h2 className="onboard-complete-title">You're all set</h2>
          <p className="onboard-complete-text">
            Vela is personalized for {stage}
            {topConcerns.length > 0 ? `, with a focus on ${topConcerns.join(" and ")}` : ""}.
          </p>

          <div className="onboard-plan">
            <div className="onboard-plan-title">Your first week</div>
            <div className="onboard-plan-step">
              <span className="onboard-plan-day">Days 1-3</span>
              <span className="onboard-plan-desc">Build your baseline — log how you feel daily</span>
            </div>
            <div className="onboard-plan-step">
              <span className="onboard-plan-day">Days 4-6</span>
              <span className="onboard-plan-desc">Patterns start forming — early stats appear</span>
            </div>
            <div className="onboard-plan-step">
              <span className="onboard-plan-day">Day 7</span>
              <span className="onboard-plan-desc">Your personal insights are revealed</span>
            </div>
          </div>

          <p className="onboard-complete-sub">Each entry takes under 30 seconds.</p>

          <button className="onboard-btn" onClick={handleStart}>
            Log my first entry →
          </button>
        </div>
      </div>
    );
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

      <div className={`q-card${transitioning ? " q-fade-out" : " q-fade-in"}`}>
        {qIndex > 0 && (
          <button
            type="button"
            onClick={handleBack}
            disabled={transitioning}
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-light)",
              cursor: transitioning ? "default" : "pointer",
              padding: "4px 0",
              marginBottom: 8,
              fontSize: 14,
              fontFamily: "inherit",
            }}
            aria-label="Go back to previous question"
          >
            ← Back
          </button>
        )}
        <div className="q-step">
          Question {qIndex + 1} of {QUESTIONS.length}
          {isMulti && <span style={{ marginLeft: 8, fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>select all that apply</span>}
        </div>
        <div className="q-text">{q.text}</div>
        <div className="q-options">
          {q.opts.map((opt, i) => {
            const isSelected = isMulti ? multiSelected.includes(i) : selected === i;
            return (
              <button
                key={i}
                className={`q-opt${isSelected ? " selected" : ""}`}
                onClick={() => handleSelect(i)}
              >
                {isMulti && <span style={{ marginRight: 8 }}>{isSelected ? "✓" : "○"}</span>}
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <button
        className="onboard-btn"
        onClick={handleNext}
        disabled={!canContinue}
      >
        {isLast ? "Start my journey →" : "Continue"}
      </button>
    </div>
  );
}

// ─── Tracker Screen ───────────────────────────────────────────────────────────

function TrackerScreen({ onLog, logs, profile, isPremium, onNavigate, onShowPaywall }) {
  const [mood, setMood] = useState(null);
  const [activeSymptoms, setActiveSymptoms] = useState({});
  const [severities, setSeverities] = useState({});
  const [notes, setNotes] = useState("");
  const [symptomFilter, setSymptomFilter] = useState("");
  const personalization = getPersonalization(profile);
  const [symptomCat, setSymptomCat] = useState(personalization?.defaultSymptomCat || "common");
  const [sleepHours, setSleepHours] = useState(null);
  const [stress, setStress] = useState(null);
  const [caffeine, setCaffeine] = useState(null);
  const [alcohol, setAlcohol] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [customSymptoms, setCustomSymptoms] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_custom_symptoms")) || []; } catch { return []; }
  });
  const [showAddSymptom, setShowAddSymptom] = useState(false);
  const [newSymptomName, setNewSymptomName] = useState("");
  const [periodLogged, setPeriodLogged] = useState(null);
  const [periodFlow, setPeriodFlow] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [lessonDone, setLessonDone] = useState(false);
  const [xpTick, setXpTick] = useState(0);
  const [showCelebration, setShowCelebration] = useState(null);

  const allSymptoms = [...SYMPTOMS, ...customSymptoms];

  function addCustomSymptom() {
    const name = newSymptomName.trim();
    if (!name || allSymptoms.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    const updated = [...customSymptoms, { icon: "✦", name, custom: true, cat: "other" }];
    setCustomSymptoms(updated);
    localStorage.setItem("vela_custom_symptoms", JSON.stringify(updated));
    setNewSymptomName("");
    setShowAddSymptom(false);
    haptic("Medium");
  }

  function removeCustomSymptom(name) {
    const updated = customSymptoms.filter((s) => s.name !== name);
    setCustomSymptoms(updated);
    localStorage.setItem("vela_custom_symptoms", JSON.stringify(updated));
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const streak = getStreak(logs);
  const journeyStage = profile ? getJourneyLabel(profile[0]) : null;

  // Rotating evidence-based tips based on onboarding symptom concerns (multi-select)
  const tipSets = {
    0: [
      "Hot flashes and night sweats affect up to 80% of women during the menopausal transition. Tracking frequency and severity helps your doctor tailor treatment.",
      "Some women notice hot flashes worsen with certain foods or drinks. Your logs can help you and your doctor spot personal patterns.",
      "Hot flashes typically peak 1-2 years after your last period and gradually ease. Tracking duration helps monitor progress.",
      "Cognitive-behavioral therapy (CBT) has Level I evidence for reducing the impact of hot flashes. Ask your doctor about evidence-based options.",
      "Layered clothing and cooling strategies are commonly used by women managing hot flashes. Track what helps you — individual responses vary.",
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
      "Regular exercise has strong evidence for improving mood and reducing depressive symptoms during perimenopause, though its effect on hot flashes specifically is less clear.",
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
    4: [
      "Joint pain affects up to 50% of women during menopause. Tracking severity helps identify what aggravates or relieves it.",
      "Estrogen has anti-inflammatory properties — declining levels can increase joint stiffness and pain during perimenopause.",
      "Low-impact exercise like swimming and yoga can reduce menopausal joint pain. Log activity alongside symptoms to see what helps.",
      "Omega-3 fatty acids from fish, walnuts, and flaxseed have anti-inflammatory properties that may help with joint discomfort.",
      "Morning stiffness that improves with movement is characteristic of menopause-related joint pain. Gentle stretching on waking can help.",
    ],
    5: [
      "Hormonal shifts can slow metabolism and increase abdominal bloating. Tracking helps distinguish patterns from daily variation.",
      "Many women gain 5-8 lbs during the menopausal transition. Strength training helps maintain muscle mass and metabolism.",
      "Bloating often correlates with dietary triggers. Note what you ate to identify connections in your logs.",
      "Increasing protein to 1.2-1.6g per kg of body weight supports muscle preservation and metabolic health during menopause.",
      "Blood sugar stability matters: pairing carbs with protein or healthy fats reduces energy crashes and may reduce cravings.",
    ],
    6: [
      "Vaginal dryness affects over 50% of postmenopausal women. Tracking helps you discuss treatment options with your doctor.",
      "Declining estrogen affects libido through both physical and neurological pathways. Your logs capture the full picture.",
      "Many effective treatments exist for menopausal intimate symptoms. Consistent tracking strengthens conversations with your provider.",
      "Local estrogen therapy (creams, rings, tablets) is effective for vaginal dryness with minimal systemic absorption. Ask your provider.",
      "Pelvic floor physiotherapy can help with urinary symptoms and sexual discomfort. It's available without referral in many areas.",
    ],
    7: [
      "Heart palpitations during perimenopause can be related to hormonal fluctuations. Always discuss new or worsening palpitations with your doctor to rule out cardiac causes.",
      "Palpitations often coincide with hot flashes or anxiety. Your combined logs help your doctor evaluate the pattern.",
      "If palpitations are frequent, prolonged, or accompanied by dizziness or chest pain, seek medical evaluation promptly. Your log data helps your provider assess the pattern.",
      "Caffeine, alcohol, and stress can worsen palpitations. Tracking these alongside heart symptoms helps identify your personal triggers.",
      "Deep, slow breathing when palpitations occur can activate your vagus nerve and help restore a normal heart rhythm.",
    ],
  };
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  // Gather all tips from user's selected concerns (profile[1] is now an array)
  const concerns = profile ? (Array.isArray(profile[1]) ? profile[1] : [profile[1]]) : [];
  const allTips = concerns.length > 0
    ? concerns.flatMap((c) => tipSets[c] || [])
    : tipSets[0];
  const tipText = allTips.length > 0 ? allTips[dayOfYear % allTips.length] : null;

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

  return (
    <div className="screen active">
      <div className="tracker-header">
        <h2>{getGreeting()}</h2>
        <p>{today}{journeyStage ? ` · ${journeyStage}` : ""}</p>
        {logs.length === 0 && personalization && (
          <div className="personalized-welcome">{personalization.stageMessage}</div>
        )}
        {(() => {
          void xpTick;
          const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
          const patternCount = logs.length >= 7 ? analyzePatterns(logs).length : 0;
          const parts = [];
          if (uniqueDays > 0) parts.push(`Day ${uniqueDays}`);
          if (patternCount > 0) parts.push(`${patternCount} pattern${patternCount !== 1 ? "s" : ""} found`);
          if (streak > 1) parts.push(`${streak}-day streak`);
          return parts.length > 0 ? (
            <div className="journey-bar">
              <span className="journey-text">{parts.join(" · ")}</span>
              {streak > 1 && <span className="journey-streak">🔥</span>}
            </div>
          ) : null;
        })()}
      </div>

      {(() => {
        const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
        if (uniqueDays >= 7) return null;
        const concernHint = personalization?.topConcernNames?.length > 0
          ? personalization.topConcernNames[0]
          : "symptom";
        const stats = uniqueDays >= 1 ? computeEarlyStats(logs) : null;
        const topName = stats?.topSymptom?.[0];
        const topCount = stats?.topSymptom?.[1];
        const avgMoodEmoji = stats?.avgMood !== null && stats?.avgMood !== undefined
          ? MOODS[Math.round(stats.avgMood)] : null;

        let title, text, icon;
        if (uniqueDays === 0) {
          title = "Welcome to Vela";
          text = `Log your first entry below — start with how you're feeling and any ${concernHint} you notice today.`;
          icon = "🌱";
        } else if (uniqueDays === 1) {
          title = "Day 1 complete!";
          text = topName
            ? `You logged ${topName}. Come back tomorrow — consistent tracking reveals what triggers it.`
            : `Great start! Come back tomorrow — tracking ${concernHint} consistently is the fastest way to spot what helps.`;
          icon = "✨";
        } else if (uniqueDays === 2) {
          title = "2 days tracked";
          const parts = [];
          if (topName) parts.push(`${topName} logged ${topCount}x`);
          if (avgMoodEmoji) parts.push(`average mood ${avgMoodEmoji}`);
          text = parts.length > 0
            ? `So far: ${parts.join(", ")}. Vela is learning your rhythm.`
            : `You're building momentum. Vela is already learning your ${concernHint} patterns.`;
          icon = "📊";
        } else if (uniqueDays === 3) {
          title = "3 days in!";
          text = topName
            ? `You've logged ${topName} ${topCount} time${topCount !== 1 ? "s" : ""}. 4 more days and I'll tell you what triggers it.`
            : "Halfway to your first weekly insight. Your data is starting to tell a story — keep going!";
          icon = "🌿";
        } else if (uniqueDays === 4) {
          title = "4 days strong";
          text = topName
            ? `${stats.uniqueSymptomCount > 1 ? `${stats.uniqueSymptomCount} symptoms tracked. ` : ""}Vela is finding connections. 3 more days reveals what triggers your ${topName.toLowerCase()}.`
            : `Vela is finding connections in your data. A few more days reveals what triggers your ${concernHint}.`;
          icon = "🔍";
        } else if (uniqueDays === 5) {
          title = "5 days tracked";
          text = avgMoodEmoji
            ? `Your average mood so far: ${avgMoodEmoji}. Two more days and Vela generates your first personalized insights.`
            : "Almost there! Two more days and Vela generates your first personalized insights.";
          icon = "🌟";
        } else {
          title = "6 days — so close!";
          text = topName
            ? `Tomorrow unlocks pattern analysis for your ${topName.toLowerCase()}, trend charts, and your full weekly summary!`
            : "One more day unlocks your full weekly summary, trend charts, and pattern analysis!";
          icon = "🎯";
        }

        return (
          <div className="milestone-card">
            <div className="milestone-icon">{icon}</div>
            <div className="milestone-content">
              <div className="milestone-title">{title}</div>
              <div className="milestone-text">{text}</div>
              {uniqueDays >= 2 && stats && (
                <div className="early-stats">
                  {stats.avgMood !== null && (
                    <div className="early-stat">
                      <span className="early-stat-icon">{MOODS[Math.round(stats.avgMood)]}</span>
                      <span className="early-stat-text">Avg mood: {["Rough", "Low", "Okay", "Good", "Great"][Math.round(stats.avgMood)]}</span>
                    </div>
                  )}
                  {stats.topSymptom && (
                    <div className="early-stat">
                      <span className="early-stat-icon">📋</span>
                      <span className="early-stat-text">Most logged: {stats.topSymptom[0]} ({stats.topSymptom[1]}x)</span>
                    </div>
                  )}
                  {stats.uniqueSymptomCount > 1 && (
                    <div className="early-stat">
                      <span className="early-stat-icon">📊</span>
                      <span className="early-stat-text">{stats.uniqueSymptomCount} different symptoms tracked</span>
                    </div>
                  )}
                  {stats.avgEnergy !== null && (
                    <div className="early-stat">
                      <span className="early-stat-icon">⚡</span>
                      <span className="early-stat-text">Avg energy: {["Depleted", "Low", "Moderate", "Good", "Energized"][Math.round(stats.avgEnergy)]}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="milestone-progress">
                <div className="milestone-bar-bg">
                  <div className="milestone-bar" style={{ width: `${(uniqueDays / 7) * 100}%` }} />
                </div>
                <div className="milestone-label">{uniqueDays}/7 days to first insights</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* "Last week, this day" reflection */}
      {(() => {
        const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
        if (uniqueDays < 8) return null;
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        const lastWeekStr = localDateStr(lastWeek);
        const lastWeekLogs = logs.filter((l) => l.date.slice(0, 10) === lastWeekStr);
        if (lastWeekLogs.length === 0) return null;
        const lwMood = lastWeekLogs.find((l) => l.mood !== null && l.mood !== undefined);
        const lwSymptoms = [...new Set(lastWeekLogs.flatMap((l) => Object.keys(l.symptoms || {})))];
        const lwDayName = lastWeek.toLocaleDateString("en-US", { weekday: "long" });
        return (
          <div className="reflection-card">
            <div className="reflection-label">Last {lwDayName}</div>
            <div className="reflection-content">
              {lwMood && <span className="reflection-mood">{MOODS[lwMood.mood]}</span>}
              {lwSymptoms.length > 0
                ? <span className="reflection-text">{lwSymptoms.length} symptom{lwSymptoms.length !== 1 ? "s" : ""}: {lwSymptoms.slice(0, 3).join(", ")}{lwSymptoms.length > 3 ? ` +${lwSymptoms.length - 3}` : ""}</span>
                : <span className="reflection-text">No symptoms logged</span>
              }
            </div>
            {lwMood && mood !== null && mood !== undefined && (
              <div className="reflection-compare">
                {mood > lwMood.mood ? "Feeling better today" : mood < lwMood.mood ? "Tougher day today" : "Similar to last week"}
              </div>
            )}
          </div>
        );
      })()}

      {/* Ongoing journey guidance (day 7+) */}
      {(() => {
        const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
        if (uniqueDays < 7) return null;
        const dismissed = localStorage.getItem("vela_insights_nudge_dismissed");
        const hasExperiment = !!localStorage.getItem("vela_active_experiment");
        const hasCBT = !!localStorage.getItem("vela_active_cbt");
        const streak = getStreak(logs);
        const concern = personalization?.topConcernNames?.[0];

        // Priority-ordered guidance — show the most relevant one
        if (uniqueDays >= 7 && uniqueDays <= 14 && !dismissed) {
          return (
            <div className="nudge-card" onClick={() => onNavigate && onNavigate("insights")}>
              <div className="nudge-icon">✨</div>
              <div className="nudge-content">
                <div className="nudge-title">Your patterns are ready!</div>
                <div className="nudge-text">{concern ? `See how your ${concern} correlates with sleep, stress, and more.` : `You have ${uniqueDays} days of data — tap to explore your insights and trends.`}</div>
              </div>
              <div className="nudge-dismiss" onClick={(e) => { e.stopPropagation(); localStorage.setItem("vela_insights_nudge_dismissed", "1"); haptic("Light"); }}>×</div>
            </div>
          );
        }
        if (uniqueDays >= 14 && uniqueDays <= 21 && !hasExperiment && !hasCBT && !localStorage.getItem("vela_experiment_nudge_dismissed")) {
          return (
            <div className="nudge-card">
              <div className="nudge-icon">🧪</div>
              <div className="nudge-content">
                <div className="nudge-title">Ready to experiment?</div>
                <div className="nudge-text">{concern ? `Try an experiment targeting your ${concern} — head to Insights to browse options.` : "Try a self-experiment — head to Insights to browse structured challenges."}</div>
              </div>
              <div className="nudge-dismiss" onClick={(e) => { e.stopPropagation(); localStorage.setItem("vela_experiment_nudge_dismissed", "1"); setXpTick((t) => t + 1); }}>×</div>
            </div>
          );
        }
        if (streak >= 7 && streak <= 10 && !localStorage.getItem("vela_streak_celebrated")) {
          return (
            <div className="nudge-card">
              <div className="nudge-icon">🔥</div>
              <div className="nudge-content">
                <div className="nudge-title">{streak}-day streak!</div>
                <div className="nudge-text">Your consistency is building a clearer picture of your patterns. Keep it going!</div>
              </div>
              <div className="nudge-dismiss" onClick={(e) => { e.stopPropagation(); localStorage.setItem("vela_streak_celebrated", "1"); setXpTick((t) => t + 1); }}>×</div>
            </div>
          );
        }
        if (uniqueDays >= 28 && !localStorage.getItem("vela_month_nudge_dismissed")) {
          return (
            <div className="nudge-card" onClick={() => onNavigate && onNavigate("insights")}>
              <div className="nudge-icon">🏆</div>
              <div className="nudge-content">
                <div className="nudge-title">One month of data!</div>
                <div className="nudge-text">Your monthly comparison is now available in Insights. See how your patterns evolved over time.</div>
              </div>
              <div className="nudge-dismiss" onClick={(e) => { e.stopPropagation(); localStorage.setItem("vela_month_nudge_dismissed", "1"); setXpTick((t) => t + 1); }}>×</div>
            </div>
          );
        }
        return null;
      })()}

      {/* Goal-based nudges */}
      {(() => {
        if (!personalization || logs.length < 3) return null;
        const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
        const nudges = [];

        // Doctor-track users: nudge to check doctor prep after 14 days
        if (personalization.wantsDoctor && uniqueDays >= 14 && !localStorage.getItem("vela_doctor_nudge_dismissed")) {
          nudges.push(
            <div key="doctor" className="nudge-card" onClick={() => onNavigate && onNavigate("insights")} style={{ borderColor: "var(--clay)" }}>
              <div className="nudge-icon">🩺</div>
              <div className="nudge-content">
                <div className="nudge-title">Ready for your doctor?</div>
                <div className="nudge-text">You have {uniqueDays} days of data. Vela can generate a report with talking points for your next visit.</div>
              </div>
              <div className="nudge-dismiss" onClick={(e) => { e.stopPropagation(); localStorage.setItem("vela_doctor_nudge_dismissed", "1"); setXpTick((t) => t + 1); }}>×</div>
            </div>
          );
        }

        // Community-oriented users: nudge to explore community after 3 logs
        if (personalization.wantsCommunity && logs.length >= 3 && logs.length <= 10 && !localStorage.getItem("vela_community_nudge_dismissed")) {
          nudges.push(
            <div key="community" className="nudge-card" onClick={() => onNavigate && onNavigate("community")} style={{ borderColor: "var(--sage)" }}>
              <div className="nudge-icon">💬</div>
              <div className="nudge-content">
                <div className="nudge-title">You're not alone in this</div>
                <div className="nudge-text">Connect with others navigating the same journey. Share experiences, ask questions.</div>
              </div>
              <div className="nudge-dismiss" onClick={(e) => { e.stopPropagation(); localStorage.setItem("vela_community_nudge_dismissed", "1"); setXpTick((t) => t + 1); }}>×</div>
            </div>
          );
        }

        // Relief-seekers: nudge to try CBT or experiments after 5 logs
        if (personalization.wantsRelief && uniqueDays >= 5 && uniqueDays <= 12 && !localStorage.getItem("vela_relief_nudge_dismissed")) {
          const hasExperiment = localStorage.getItem("vela_active_experiment");
          const hasCBT = localStorage.getItem("vela_active_cbt");
          if (!hasExperiment && !hasCBT) {
            nudges.push(
              <div key="relief" className="nudge-card" style={{ borderColor: "var(--sage)" }}>
                <div className="nudge-icon">🧪</div>
                <div className="nudge-content">
                  <div className="nudge-title">Ready to try something?</div>
                  <div className="nudge-text">Based on your {personalization.topConcernNames.length > 0 ? personalization.topConcernNames[0] : "symptom"} concerns, check out experiments and CBT programs in your Insights tab.</div>
                </div>
                <div className="nudge-dismiss" onClick={(e) => { e.stopPropagation(); localStorage.setItem("vela_relief_nudge_dismissed", "1"); setXpTick((t) => t + 1); }}>×</div>
              </div>
            );
          }
        }

        return nudges.length > 0 ? nudges[0] : null; // Show one nudge at a time
      })()}

      {tipText && (
        <div className="tip-card">
          <div className="tip-label">Evidence-based tip</div>
          <div className="tip-text">{tipText}</div>
        </div>
      )}

      {/* Daily Micro-Lesson */}
      {(() => {
        const completedLessons = JSON.parse(localStorage.getItem("vela_completed_lessons") || "[]");
        const dayIndex = Math.floor((new Date() - new Date(2025, 0, 1)) / 86400000) % DAILY_LESSONS.length;
        const todayLesson = DAILY_LESSONS[dayIndex];
        const completedToday = lessonDone || completedLessons.includes(localDateStr(new Date()));
        if (lessonDone) {
          return (
            <div className="lesson-card completed" style={{ animation: "cardSlideIn 0.3s ease" }}>
              <div className="lesson-header">
                <div className="lesson-label">Daily insight</div>
                <div className="lesson-xp" style={{ color: "var(--sage)" }}>✓ Done</div>
              </div>
              <div className="lesson-title">{todayLesson.title}</div>
            </div>
          );
        }
        return (
          <div className={`lesson-card${completedToday ? " completed" : ""}`}>
            <div className="lesson-header">
              <div className="lesson-label">Daily insight</div>
              <div className="lesson-xp">{completedToday ? "✓ Done" : "Today"}</div>
            </div>
            <div className="lesson-title">{todayLesson.title}</div>
            {!completedToday ? (
              <>
                <div className="lesson-text">{todayLesson.text}</div>
                <button className="lesson-btn" onClick={() => {
                  const updated = [...completedLessons, localDateStr(new Date())];
                  localStorage.setItem("vela_completed_lessons", JSON.stringify(updated.slice(-30)));
                  haptic("Medium");
                  setLessonDone(true);
                  setXpTick((t) => t + 1); // triggers XP bar re-render
                }}>Got it!</button>
              </>
            ) : (
              <div className="lesson-text" style={{ opacity: 0.6 }}>{todayLesson.text}</div>
            )}
          </div>
        );
      })()}


      {(() => {
        const forecast = predictSymptoms(logs);
        if (forecast.predictions.length === 0 && forecast.moodForecast === null) return null;
        const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
        if (isPremium) return (
          <div className="prediction-card">
            <div className="pred-header">
              <div className="pred-label">Today's forecast</div>
              <div className="pred-day">{dayName}</div>
            </div>
            {forecast.predictions.length > 0 && (
              <div className="pred-items">
                {forecast.predictions.map((p, i) => (
                  <div key={i} className="pred-item">
                    <div className="pred-item-name">{p.name}</div>
                    <div className="pred-item-bar-bg">
                      <div className="pred-item-bar" style={{ width: `${p.pct}%` }} />
                    </div>
                    <div className="pred-item-pct">{p.pct}%</div>
                    <div className={`pred-item-trend ${p.trend}`}>
                      {p.trend === "up" ? "↑" : p.trend === "down" ? "↓" : "→"}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {forecast.moodForecast !== null && (
              <div className="pred-mood">
                Typical mood: {MOODS[Math.round(forecast.moodForecast)]} ({forecast.moodForecast}/4)
              </div>
            )}
            {forecast.tip && <div className="pred-tip">{forecast.tip}</div>}
          </div>
        );
        // Free user teaser
        return (
          <div className="prediction-card pred-teaser" onClick={onShowPaywall}>
            <div className="pred-header">
              <div className="pred-label">Today's forecast</div>
              <div className="pred-day">{dayName}</div>
            </div>
            <div className="pred-teaser-body">
              <div className="pred-teaser-icon">🔮</div>
              <div className="pred-teaser-text">
                Vela found {forecast.predictions.length} symptom prediction{forecast.predictions.length !== 1 ? "s" : ""} for today
              </div>
              <div className="pred-teaser-unlock">
                <span className="pred-teaser-lock">🔒</span> Unlock forecasts
              </div>
            </div>
          </div>
        );
      })()}

      <div className="wellbeing-card">
        <div className="wb-label">How are you feeling overall?</div>
        <div className="wb-faces">
          {MOODS.map((emoji, i) => (
            <div
              key={i}
              className={`wb-face${mood === i ? " selected" : ""}`}
              onClick={() => { haptic("Light"); setMood(i); }}
            >
              {emoji}
            </div>
          ))}
        </div>
      </div>

      <div className="energy-section">
        <div className="section-label">Energy level</div>
        <div className="energy-row">
          {[
            { level: 1, label: "Depleted", icon: "🪫" },
            { level: 2, label: "Low", icon: "😮‍💨" },
            { level: 3, label: "Moderate", icon: "⚡" },
            { level: 4, label: "Good", icon: "💪" },
            { level: 5, label: "Energized", icon: "🔋" },
          ].map(({ level, label, icon }) => (
            <div
              key={level}
              className={`energy-chip${energy === level ? " active" : ""}`}
              onClick={() => { haptic("Light"); setEnergy(energy === level ? null : level); }}
            >
              <span className="energy-icon">{icon}</span>
              <span className="energy-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="symptoms-section">
        <div className="section-label">Symptoms today</div>
        {/* Active symptoms summary */}
        {Object.keys(activeSymptoms).length > 0 && (
          <div className="active-symptoms-summary">
            {Object.keys(activeSymptoms).map((name) => {
              const s = allSymptoms.find((sym) => sym.name === name);
              return (
                <span key={name} className="active-symptom-chip" onClick={() => { haptic("Light"); toggleSymptom(name); }}>
                  {s ? s.icon : "✦"} {name} ×
                </span>
              );
            })}
          </div>
        )}
        {/* Search */}
        <input
          className="symptom-filter"
          placeholder="Search symptoms..."
          value={symptomFilter}
          onChange={(e) => setSymptomFilter(e.target.value)}
        />
        {/* Category tabs */}
        {!symptomFilter && (
          <div className="symptom-cat-tabs">
            {SYMPTOM_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                className={`symptom-cat-tab${symptomCat === cat.key ? " active" : ""}`}
                onClick={() => { haptic("Light"); setSymptomCat(cat.key); }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
        <div className="symptom-grid">
          {allSymptoms
            .filter((s) => {
              if (symptomFilter) return s.name.toLowerCase().includes(symptomFilter.toLowerCase());
              return s.cat === symptomCat || (!s.cat && symptomCat === "other");
            })
            .map((s) => {
            const isActive = !!activeSymptoms[s.name];
            const sev = severities[s.name] || 0;
            return (
              <div
                key={s.name}
                className={`symptom-tile${isActive ? " active" : ""}${s.custom ? " custom" : ""}`}
                onClick={() => { haptic("Light"); toggleSymptom(s.name); }}
              >
                {s.custom && (
                  <div className="custom-remove" onClick={(e) => { e.stopPropagation(); removeCustomSymptom(s.name); }}>×</div>
                )}
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
          {/* Show add custom tile only when on "other" category or searching */}
          {(symptomCat === "other" || symptomFilter) && (
            <div className="symptom-tile add-symptom" onClick={() => { haptic("Light"); setShowAddSymptom(true); }}>
              <div className="s-icon">+</div>
              <span className="s-name">Add custom</span>
            </div>
          )}
        </div>
        {showAddSymptom && (
          <div className="add-symptom-overlay" onClick={() => setShowAddSymptom(false)}>
            <div className="add-symptom-card" onClick={(e) => e.stopPropagation()}>
              <div className="add-symptom-title">Add custom symptom</div>
              <input
                className="add-symptom-input"
                placeholder="e.g. Tinnitus, Burning mouth..."
                value={newSymptomName}
                onChange={(e) => setNewSymptomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustomSymptom(); }}
                autoFocus
                maxLength={30}
              />
              <div className="add-symptom-actions">
                <button className="add-symptom-cancel" onClick={() => setShowAddSymptom(false)}>Cancel</button>
                <button className="add-symptom-confirm" onClick={addCustomSymptom} disabled={!newSymptomName.trim()}>Add symptom</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="context-section">
        <div className="section-label">Today's context</div>
        <div className="ctx-row">
          <span className="ctx-label">🛏️ Sleep</span>
          <div className="ctx-stepper">
            <div className="ctx-step-btn" onClick={() => setSleepHours((h) => h === null ? 6.5 : Math.max(0, h - 0.5))}>−</div>
            <span className={`ctx-value${sleepHours === null ? " unset" : ""}`} onClick={() => { if (sleepHours === null) setSleepHours(7); }}>
              {sleepHours === null ? "Tap to set" : `${sleepHours} hrs`}
            </span>
            <div className="ctx-step-btn" onClick={() => setSleepHours((h) => h === null ? 7.5 : Math.min(12, h + 0.5))}>+</div>
          </div>
        </div>
        <div className="ctx-row">
          <span className="ctx-label">😤 Stress</span>
          <div className="ctx-dots">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`ctx-dot${stress === level ? " active" : ""}`}
                onClick={() => { haptic("Light"); setStress(stress === level ? null : level); }}
              >{level}</div>
            ))}
          </div>
        </div>
        <div className="ctx-pills">
          {[
            { key: "caffeine", icon: "☕", label: "Caffeine", state: caffeine, set: setCaffeine },
            { key: "alcohol", icon: "🍷", label: "Alcohol", state: alcohol, set: setAlcohol },
            { key: "exercise", icon: "🏃", label: "Exercise", state: exercise, set: setExercise },
          ].map(({ key, icon, label, state, set }) => (
            <div
              key={key}
              className={`ctx-pill${state === true ? " on" : ""}`}
              onClick={() => { haptic("Light"); set((prev) => prev === true ? null : true); }}
            >
              {icon} {label}
            </div>
          ))}
        </div>

        {profile && (profile[0] === 0 || profile[0] === 1) && (
          <div className="ctx-period">
            <span className="ctx-label">🩸 Period</span>
            <div className="ctx-pills" style={{ marginTop: 6 }}>
              {[
                { key: "none", label: "No period" },
                { key: "spotting", label: "Spotting" },
                { key: "light", label: "Light" },
                { key: "medium", label: "Medium" },
                { key: "heavy", label: "Heavy" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className={`ctx-pill${periodLogged === key ? " on" : ""}`}
                  onClick={() => { haptic("Light"); setPeriodLogged(periodLogged === key ? null : key); setPeriodFlow(key === "none" ? null : key); }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="notes-area">
        <div className="section-label" style={{ padding: "0 0 6px" }}>Quick tags</div>
        <div className="note-chips">
          {["Bad night", "Stressful day", "Skipped meds", "Felt great", "Period started"].map((chip) => (
            <div key={chip} className={`note-chip${notes.includes(chip) ? " on" : ""}`} onClick={() => {
              haptic("Light");
              setNotes((prev) => prev.includes(chip) ? prev.replace(chip, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim() : (prev ? prev + ", " + chip : chip));
            }}>{chip}</div>
          ))}
        </div>
        <textarea
          className="notes-input"
          placeholder="Any notes or observations..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button className="log-btn" onClick={handleLog} disabled={!canLog} style={!canLog ? { opacity: 0.5, cursor: "default" } : {}}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        {canLog ? "Log today's entry" : "Select mood or symptoms to log"}
      </button>

      <div className="disclaimer">Vela is not medical advice. Always consult your healthcare provider.</div>
      <div className="disclaimer" style={{ marginTop: 4 }}>🔒 Your data stays on your device. Always.</div>

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
  if (logs.length === 0) {
    return (
      <div className="screen active">
        <div className="history-header">
          <h2>History</h2>
          <p>Your logged entries</p>
        </div>
        <div className="history-empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>Your story starts today</div>
          <div style={{ marginBottom: 16 }}>Each entry builds a picture of your patterns. After 7 days, Vela starts connecting the dots.</div>
          <button className="history-empty-cta" onClick={() => onNavigate("tracker")}>Log your first entry</button>
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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = localDateStr(sevenDaysAgo);
  const visibleDays = isPremium ? sortedDays : sortedDays.filter((d) => d >= cutoff);
  const lockedDays = isPremium ? [] : sortedDays.filter((d) => d < cutoff);

  return (
    <div className="screen active">
      <div className="history-header">
        <h2>History</h2>
        <p>{logs.length} entr{logs.length === 1 ? "y" : "ies"} total</p>
      </div>

      {visibleDays.map((dayStr) => {
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

      {lockedDays.length > 0 && (
        <div className="history-locked">
          <div className="history-locked-icon">🔒</div>
          <div className="history-locked-text">
            {lockedDays.length} more day{lockedDays.length !== 1 ? "s" : ""} of history
          </div>
          <button className="unlock-btn" onClick={onShowPaywall}>
            Unlock full history
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SVG Chart Components ────────────────────────────────────────────────────

function MoodLineChart({ logs }) {
  const [range, setRange] = useState(7);
  const MOODS_EMOJI = ["😔", "😕", "😐", "🙂", "😊"];
  const now = new Date();

  // Build mood data for range
  const data = [];
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = localDateStr(d);
    const dayMoods = logs
      .filter((l) => l.date.slice(0, 10) === dayStr && l.mood !== null && l.mood !== undefined)
      .map((l) => l.mood);
    const avg = dayMoods.length > 0 ? dayMoods.reduce((a, b) => a + b, 0) / dayMoods.length : null;
    const label = range <= 7 ? ["S","M","T","W","T","F","S"][d.getDay()] : d.getDate().toString();
    const hasPeriod = logs.some((l) => l.date.slice(0, 10) === dayStr && l.context?.period && l.context.period !== "none");
    data.push({ mood: avg, label, hasPeriod });
  }

  const W = 340, H = 140, PL = 28, PR = 10, PT = 10, PB = 24;
  const chartW = W - PL - PR, chartH = H - PT - PB;
  const points = data.map((d, i) => ({
    x: PL + (i / (data.length - 1 || 1)) * chartW,
    y: d.mood !== null ? PT + chartH - (d.mood / 4) * chartH : null,
    mood: d.mood,
    label: d.label,
  }));

  // Build path from non-null points
  const valid = points.filter((p) => p.y !== null);
  let pathD = "";
  if (valid.length >= 2) {
    pathD = `M${valid[0].x},${valid[0].y}`;
    for (let i = 1; i < valid.length; i++) {
      const cx = (valid[i - 1].x + valid[i].x) / 2;
      pathD += ` C${cx},${valid[i - 1].y} ${cx},${valid[i].y} ${valid[i].x},${valid[i].y}`;
    }
  }

  // Area path (fill below line)
  let areaD = "";
  if (valid.length >= 2) {
    areaD = pathD + ` L${valid[valid.length - 1].x},${PT + chartH} L${valid[0].x},${PT + chartH} Z`;
  }

  return (
    <div className="chart-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="trend-title" style={{ margin: 0, padding: 0 }}>Mood trend</div>
        <div className="chart-toggle">
          <button className={`chart-toggle-btn${range === 7 ? " active" : ""}`} onClick={() => setRange(7)}>7d</button>
          <button className={`chart-toggle-btn${range === 30 ? " active" : ""}`} onClick={() => setRange(30)}>30d</button>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <defs>
          <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C97B5C" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#C97B5C" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid lines + emoji labels */}
        {[0, 1, 2, 3, 4].map((level) => {
          const y = PT + chartH - (level / 4) * chartH;
          return (
            <g key={level}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#EDE0D8" strokeWidth="0.5" />
              <text x={PL - 6} y={y + 5} textAnchor="end" fontSize="11">{MOODS_EMOJI[level]}</text>
            </g>
          );
        })}
        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#moodGrad)" />}
        {/* Line */}
        {pathD && <path d={pathD} fill="none" stroke="#C97B5C" strokeWidth="2.5" strokeLinecap="round" />}
        {/* Dots */}
        {valid.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#C97B5C" stroke="white" strokeWidth="2" />
        ))}
        {/* X-axis labels */}
        {points.filter((_, i) => range <= 7 || i % 5 === 0 || i === points.length - 1).map((p, i) => (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="10" fill="#A89080">{p.label}</text>
        ))}
        {/* Period markers */}
        {data.map((d, i) => d.hasPeriod ? (
          <circle key={`p-${i}`} cx={points[i].x} cy={H - 14} r="3" fill="#E07070" opacity="0.8" />
        ) : null)}
      </svg>
      {data.some((d) => d.hasPeriod) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, justifyContent: "flex-end" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E07070" }} />
          <span style={{ fontSize: 10, color: "var(--ink-light)" }}>Period day</span>
        </div>
      )}
    </div>
  );
}

function SymptomHeatmap({ logs }) {
  const now = new Date();
  const days = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = localDateStr(d);
    const dayLogs = logs.filter((l) => l.date.slice(0, 10) === dayStr);
    const count = dayLogs.reduce((sum, l) => sum + Object.keys(l.symptoms || {}).length, 0);
    days.push({ date: d, count, dow: d.getDay() });
  }
  const maxC = Math.max(...days.map((d) => d.count), 1);

  // Arrange into weeks (columns)
  const weeks = [];
  let week = new Array(7).fill(null);
  days.forEach((d, i) => {
    week[d.dow] = d;
    if (d.dow === 6 || i === days.length - 1) {
      weeks.push(week);
      week = new Array(7).fill(null);
    }
  });

  const cellSize = 28, gap = 4, labelW = 20;
  const W = labelW + weeks.length * (cellSize + gap);
  const H = 7 * (cellSize + gap) + 30;
  const DOW = ["S", "M", "T", "W", "T", "F", "S"];

  function getOpacity(count) {
    if (count === 0) return 0.1;
    const ratio = count / maxC;
    if (ratio <= 0.25) return 0.3;
    if (ratio <= 0.5) return 0.5;
    if (ratio <= 0.75) return 0.75;
    return 1;
  }

  return (
    <div className="chart-container">
      <div className="trend-title" style={{ margin: "0 0 10px", padding: 0 }}>Symptom activity (4 weeks)</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {/* DOW labels */}
        {DOW.map((d, i) => (
          <text key={i} x={labelW - 6} y={i * (cellSize + gap) + cellSize / 2 + 4} textAnchor="end" fontSize="10" fill="#A89080">{d}</text>
        ))}
        {/* Cells */}
        {weeks.map((w, wi) =>
          w.map((d, di) => {
            if (!d) return null;
            return (
              <rect
                key={`${wi}-${di}`}
                x={labelW + wi * (cellSize + gap)}
                y={di * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={4}
                fill="#C97B5C"
                opacity={getOpacity(d.count)}
              />
            );
          })
        )}
      </svg>
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Less</span>
        {[0.1, 0.3, 0.5, 0.75, 1].map((op, i) => (
          <div key={i} className="heatmap-legend-box" style={{ background: `rgba(201,123,92,${op})` }} />
        ))}
        <span className="heatmap-legend-label">More</span>
      </div>
    </div>
  );
}

function SleepSymptomScatter({ logs }) {
  // Group by date, get sleep + symptom count per day
  const byDate = {};
  logs.forEach((l) => {
    const d = l.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = { sleep: null, symptoms: 0 };
    if (l.context && l.context.sleepHours !== null && l.context.sleepHours !== undefined) {
      byDate[d].sleep = l.context.sleepHours;
    }
    byDate[d].symptoms += Object.keys(l.symptoms || {}).length;
  });
  const points = Object.values(byDate).filter((d) => d.sleep !== null);
  if (points.length < 5) return null;

  const minSleep = Math.floor(Math.min(...points.map((p) => p.sleep)));
  const maxSleep = Math.ceil(Math.max(...points.map((p) => p.sleep)));
  const maxSym = Math.max(...points.map((p) => p.symptoms), 1);

  const W = 320, H = 200, PL = 32, PR = 10, PT = 10, PB = 30;
  const chartW = W - PL - PR, chartH = H - PT - PB;
  const sleepRange = Math.max(maxSleep - minSleep, 1);

  // Simple linear regression
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.sleep, 0);
  const sumY = points.reduce((s, p) => s + p.symptoms, 0);
  const sumXY = points.reduce((s, p) => s + p.sleep * p.symptoms, 0);
  const sumX2 = points.reduce((s, p) => s + p.sleep * p.sleep, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const trendY1 = slope * minSleep + intercept;
  const trendY2 = slope * maxSleep + intercept;

  function toX(sleep) { return PL + ((sleep - minSleep) / sleepRange) * chartW; }
  function toY(sym) { return PT + chartH - (sym / maxSym) * chartH; }

  return (
    <div className="chart-container">
      <div className="trend-title" style={{ margin: "0 0 10px", padding: 0 }}>Sleep vs. symptoms</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = PT + chartH * (1 - r);
          return <line key={i} x1={PL} y1={y} x2={W - PR} y2={y} stroke="#EDE0D8" strokeWidth="0.5" />;
        })}
        {/* Trend line */}
        <line
          x1={toX(minSleep)} y1={toY(Math.max(trendY1, 0))}
          x2={toX(maxSleep)} y2={toY(Math.max(trendY2, 0))}
          stroke="#7A9E87" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7"
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={toX(p.sleep)} cy={toY(p.symptoms)} r="5" fill="#C97B5C" opacity="0.7" stroke="white" strokeWidth="1.5" />
        ))}
        {/* X-axis labels */}
        {Array.from({ length: Math.min(sleepRange + 1, 8) }, (_, i) => {
          const v = minSleep + i * (sleepRange / Math.min(sleepRange, 7));
          return <text key={i} x={toX(v)} y={H - 6} textAnchor="middle" fontSize="10" fill="#A89080">{v.toFixed(0)}h</text>;
        })}
        {/* Y-axis labels */}
        {[0, Math.round(maxSym / 2), maxSym].map((v, i) => (
          <text key={i} x={PL - 6} y={toY(v) + 4} textAnchor="end" fontSize="10" fill="#A89080">{v}</text>
        ))}
        {/* Axis titles */}
        <text x={W / 2} y={H} textAnchor="middle" fontSize="10" fill="#6B5347">Sleep (hrs)</text>
        <text x={6} y={H / 2} textAnchor="middle" fontSize="10" fill="#6B5347" transform={`rotate(-90, 6, ${H / 2})`}>Symptoms</text>
      </svg>
    </div>
  );
}

// ─── Insight Library (browse past daily insights) ────────────────────────────

function InsightLibrary() {
  const [expanded, setExpanded] = useState(false);
  const completedLessons = JSON.parse(localStorage.getItem("vela_completed_lessons") || "[]");
  const dayIndex = Math.floor((new Date() - new Date(2025, 0, 1)) / 86400000) % DAILY_LESSONS.length;

  // Show the last 5 insights (by cycling backwards from today's index)
  const recentInsights = [];
  for (let i = 1; i <= 5; i++) {
    const idx = ((dayIndex - i) + DAILY_LESSONS.length) % DAILY_LESSONS.length;
    recentInsights.push(DAILY_LESSONS[idx]);
  }

  if (completedLessons.length === 0) return null; // Don't show until they've read at least one

  return (
    <div className="insight-library">
      <div className="insight-library-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <div className="insight-library-title">💡 Daily Insights</div>
          <div className="insight-library-sub">{DAILY_LESSONS.length} evidence-based lessons</div>
        </div>
        <span className="insight-library-toggle">{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && (
        <div className="insight-library-list">
          {recentInsights.map((lesson, i) => (
            <details key={lesson.id} className="insight-library-item">
              <summary>{lesson.title}</summary>
              <p>{lesson.text}</p>
            </details>
          ))}
          <div className="insight-library-more">
            Insights refresh daily — check back tomorrow for more
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Insights Screen ──────────────────────────────────────────────────────────

function InsightsReveal({ logs, profile, moodData, topSymptoms, recentLogs, revealStep, onNext, onSkip, onShowPaywall }) {
  const insight = getBestInsight(logs, profile);
  const p = getPersonalization(profile);

  const byDate = {};
  recentLogs.forEach((l) => {
    const d = l.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = { symptoms: 0, mood: null, date: d };
    byDate[d].symptoms += Object.keys(l.symptoms || {}).length;
    if (l.mood !== null && l.mood !== undefined) byDate[d].mood = l.mood;
  });
  const days = Object.values(byDate);
  const bestDay = days.sort((a, b) => {
    const scoreA = (a.mood ?? 2) - a.symptoms * 0.5;
    const scoreB = (b.mood ?? 2) - b.symptoms * 0.5;
    return scoreB - scoreA;
  })[0];

  const steps = [
    <div className="reveal-card reveal-intro" key="intro">
      <div className="reveal-icon">✨</div>
      <h3 className="reveal-heading">Here's what Vela found</h3>
      <p className="reveal-body">
        You logged for 7 days{p?.topConcernNames?.length > 0
          ? ` — and Vela has been analyzing your ${p.topConcernNames.join(" and ")} patterns behind the scenes.`
          : ` — and Vela has been finding patterns in your data behind the scenes.`}
      </p>
      <p className="reveal-body-light">Tap to see your personal insights.</p>
    </div>,

    <div className="reveal-card reveal-pattern" key="pattern">
      <div className="reveal-label">Your #1 pattern</div>
      <div className="reveal-insight-icon">{insight.icon}</div>
      <p className="reveal-insight-text">{insight.text}</p>
      {insight.type === "pattern" && (
        <p className="reveal-body-light">This is the strongest signal Vela found in your first week.</p>
      )}
    </div>,

    <div className="reveal-card reveal-summary" key="summary">
      <div className="reveal-label">Your week at a glance</div>
      <div className="reveal-mood-row">
        {moodData.map((d, i) => (
          <div key={i} className="reveal-mood-day">
            <div className="reveal-mood-emoji">{d.mood !== null ? MOODS[d.mood] : "·"}</div>
            <div className="reveal-mood-label">{d.day}</div>
          </div>
        ))}
      </div>
      {topSymptoms.length > 0 && (
        <div className="reveal-top-symptoms">
          <span className="reveal-mini-label">Most frequent:</span>
          {topSymptoms.slice(0, 3).map((s, i) => (
            <span key={i} className="reveal-symptom-chip">{s.name} ({s.days}d)</span>
          ))}
        </div>
      )}
      {bestDay && (
        <div className="reveal-best-day">
          <span className="reveal-mini-label">Best day: </span>
          <span>{new Date(bestDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}</span>
          {bestDay.mood !== null && <span> {MOODS[bestDay.mood]}</span>}
        </div>
      )}
    </div>,

    <div className="reveal-card reveal-premium" key="premium">
      <div className="reveal-label">This is just the beginning</div>
      <h3 className="reveal-heading" style={{ fontSize: 18 }}>Imagine knowing why</h3>
      <p className="reveal-body" style={{ color: "rgba(240,232,226,0.7)" }}>
        You've seen what 7 days reveals. Premium goes deeper — triggers, predictions, and a personal health companion.
      </p>
      <div className="reveal-premium-features">
        <div className="reveal-pf">🔮 <span>Deeper patterns — what triggers your worst days</span></div>
        <div className="reveal-pf">🤖 <span>Ask Vela — your personal health companion</span></div>
        <div className="reveal-pf">📄 <span>Doctor reports — walk in prepared, get taken seriously</span></div>
        <div className="reveal-pf">📊 <span>Weekly digest — what happened, what helped, what to watch</span></div>
      </div>
      <button className="reveal-cta" onClick={(e) => { e.stopPropagation(); onShowPaywall(); }}>
        Try free for 7 days
      </button>
      <button
        type="button"
        className="reveal-skip-premium"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
      >
        Continue to my insights →
      </button>
    </div>,
  ];

  return (
    <div className="reveal-container" onClick={revealStep < 3 ? onNext : undefined}>
      {steps[revealStep]}
      <div className="reveal-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`reveal-dot${i === revealStep ? " active" : ""}`} />
        ))}
      </div>
      {/* Always visible escape hatch — goes TO patterns rather than away from them.
          Hidden on the last step because that step has its own dedicated button. */}
      {revealStep < 3 && (
        <button
          type="button"
          className="reveal-skip"
          onClick={(e) => { e.stopPropagation(); onSkip(); }}
        >
          Show all my patterns →
        </button>
      )}
    </div>
  );
}

function InsightsScreen({ logs, profile, isPremium, onShowPaywall }) {
  const [revealStep, setRevealStep] = useState(0);
  const [showReveal, setShowReveal] = useState(() => {
    if (localStorage.getItem("vela_insights_revealed")) return false;
    const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
    return uniqueDays >= 7;
  });

  function completeReveal() {
    localStorage.setItem("vela_insights_revealed", "1");
    setShowReveal(false);
    haptic("Medium");
  }

  const [showCompanion, setShowCompanion] = useState(false);
  const [chatMessages, setChatMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_chat_messages")) || []; } catch { return []; }
  });
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatMessages.length > 0) localStorage.setItem("vela_chat_messages", JSON.stringify(chatMessages.slice(-20)));
  }, [chatMessages]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, showCompanion]);

  const [isTyping, setIsTyping] = useState(false);
  const [activeCBT, setActiveCBT] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_active_cbt")); } catch { return null; }
  });
  const [showCBTList, setShowCBTList] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [showExpList, setShowExpList] = useState(false);
  const [activeExp, setActiveExp] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_active_experiment")); } catch { return null; }
  });

  const handleQuestion = (text) => {
    if (!text.trim() || isTyping) return;
    track("ask_vela_used", { logCount: logs.length, gatedByDataMin: logs.length < 7 });
    const userMsg = { role: "user", text: text.trim(), time: new Date().toISOString() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setIsTyping(true);
    haptic("Light");

    setTimeout(() => {
      let responseText;
      if (logs.length < 7) {
        responseText = "Keep logging! I need at least 7 days of data to spot meaningful patterns. You're on day " + logs.length + " — almost there!";
      } else {
        const matched = matchQuestion(text);
        responseText = generateResponse(matched, logs, profile);
      }
      const velaMsg = { role: "assistant", text: responseText, time: new Date().toISOString() };
      setChatMessages((prev) => [...prev, velaMsg]);
      setIsTyping(false);
      haptic("Light");
    }, 600 + Math.random() * 400);
  };

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
    const dayStr = localDateStr(d);
    const dayLogs = recentLogs.filter(
      (l) => l.date.slice(0, 10) === dayStr
    );
    const count = dayLogs.reduce(
      (sum, l) => sum + Object.keys(l.symptoms || {}).length,
      0
    );
    const hasPeriod = dayLogs.some((l) => l.context?.period && l.context.period !== "none");
    weekData.push({ day: DAY_NAMES[d.getDay()], count, hasPeriod });
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

  // Previous week symptom days for trend arrows
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const prevWeekLogs = logs.filter((l) => { const d = new Date(l.date); return d >= twoWeeksAgo && d < weekAgo; });
  const prevSymptomDays = {};
  const prevSeenDays = {};
  prevWeekLogs.forEach((l) => {
    const dayStr = l.date.slice(0, 10);
    Object.keys(l.symptoms || {}).forEach((name) => {
      const key = `${name}_${dayStr}`;
      if (!prevSeenDays[key]) { prevSeenDays[key] = true; prevSymptomDays[name] = (prevSymptomDays[name] || 0) + 1; }
    });
  });

  // Find most common symptom for the insight callout
  const topSymptom = topSymptoms[0];

  // Mood trend for the last 7 days
  const moodData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = localDateStr(d);
    const dayMoods = recentLogs
      .filter((l) => l.date.slice(0, 10) === dayStr && l.mood !== null && l.mood !== undefined)
      .map((l) => l.mood);
    const avg = dayMoods.length > 0 ? Math.round(dayMoods.reduce((a, b) => a + b, 0) / dayMoods.length) : null;
    moodData.push({ day: DAY_NAMES[d.getDay()], mood: avg });
  }

  return (
    <div className="screen active">
      <div className="insights-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2>Your patterns</h2>
            <p>
              Last 7 days · {recentLogs.length} entr{recentLogs.length === 1 ? "y" : "ies"} logged
            </p>
          </div>
          {isPremium ? (
            <button className="ask-vela-btn" onClick={() => setShowCompanion(!showCompanion)}>
              <span className="ask-vela-avatar">V</span>
              {showCompanion ? "Back" : "Ask Vela"}
            </button>
          ) : (
            <button className="ask-vela-btn locked" onClick={onShowPaywall}>
              Ask Vela
              <span className="ask-vela-premium-tag">Premium</span>
            </button>
          )}
        </div>
      </div>

      {showReveal ? (
        <InsightsReveal
          logs={logs}
          profile={profile}
          moodData={moodData}
          topSymptoms={topSymptoms}
          recentLogs={recentLogs}
          revealStep={revealStep}
          onNext={() => { if (revealStep < 3) { setRevealStep(revealStep + 1); haptic("Light"); } else completeReveal(); }}
          onSkip={completeReveal}
          onShowPaywall={onShowPaywall}
        />
      ) : showCompanion && isPremium ? (
        <div className="companion-container">
          <div className="companion-header">
            <div className="chat-avatar"><span>V</span></div>
            <div>
              <div className="companion-name">Vela AI Companion</div>
              <div className="companion-sub">On-device · Your data never leaves your phone</div>
            </div>
          </div>
          <div className="chat-messages">
            {chatMessages.length === 0 && (
              <>
                <div className="chat-bubble assistant">
                  <div className="chat-avatar"><span>V</span></div>
                  <div className="chat-text">{(() => {
                    const p = getPersonalization(profile);
                    if (p?.topConcernNames?.length > 0) {
                      return `Hi! I'm Vela, your health companion. ${p.companionGreeting} I'll help you spot what triggers your ${p.topConcernNames[0]}, find your best and worst days, and prepare for doctor visits. Tap a question below or ask your own.`;
                    }
                    return "Hi! I'm Vela, your health companion. I analyze your logged data to find patterns and insights. Ask me anything about your symptoms, triggers, or trends — or tap a question below to get started.";
                  })()}</div>
                </div>
                <div className="chat-disclaimer">Vela analyzes your personal data to find patterns. This is not medical advice — always consult your healthcare provider for treatment decisions.</div>
              </>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                {msg.role === "assistant" && <div className="chat-avatar"><span>V</span></div>}
                <div className="chat-text" style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
              </div>
            ))}
            {isTyping && (
              <div className="chat-bubble assistant chat-typing">
                <div className="chat-avatar"><span>V</span></div>
                <div className="chat-text">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-chips">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button key={i} className="chat-chip" onClick={() => handleQuestion(q)}>{q}</button>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Ask about your health patterns..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuestion(chatInput); }}
            />
            <button className="chat-send" onClick={() => handleQuestion(chatInput)} disabled={!chatInput.trim()}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      ) : recentLogs.length === 0 ? (
        <div className="insight-callout">
          <div className="ic-label">Getting started</div>
          <div className="ic-text">
            {(() => {
              const p = getPersonalization(profile);
              if (p?.topConcernNames?.length > 0) {
                return <>Log your first entry on the <strong>Today</strong> tab. After 7 days, Vela will analyze your <strong>{p.topConcernNames.join(" and ")}</strong> patterns and show you what your data reveals.</>;
              }
              return <>Log your first entry on the <strong>Today</strong> tab to start seeing patterns here. After 7 days, Vela will surface personalized insights about your symptoms.</>;
            })()}
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

          {/* Smart Weekly Digest */}
          {isPremium && (() => {
            const digest = generateWeeklyDigest(logs, profile);
            if (!digest) return null;
            return (
              <div className="digest-card">
                <div className="digest-header">
                  <div className="digest-title">Weekly digest</div>
                  <div className="digest-subtitle">Powered by Vela AI</div>
                </div>

                <div className="digest-section">
                  <div className="digest-section-label">Week in review</div>
                  <div className="digest-section-text">
                    {digest.daysLogged} days logged · Avg mood: {digest.avgMood || "—"}
                    {digest.moodDelta !== null && (
                      <span className={`digest-delta ${digest.moodDelta >= 0 ? "up" : "down"}`}>
                        {" "}{digest.moodDelta >= 0 ? "↑" : "↓"} {Math.abs(digest.moodDelta)} vs last week
                      </span>
                    )}
                  </div>
                </div>

                {digest.spotlight && (
                  <div className="digest-section digest-spotlight">
                    <div className="digest-section-label">Pattern spotlight</div>
                    <div className="digest-section-text">{digest.spotlight.icon} {digest.spotlight.text}</div>
                  </div>
                )}

                {digest.symptomTrends.length > 0 && (
                  <div className="digest-section">
                    <div className="digest-section-label">Symptom trends</div>
                    {digest.symptomTrends.map((s, i) => (
                      <div key={i} className="digest-section-text">
                        {s.arrow} <strong>{s.name}</strong> — {s.count}x this week
                      </div>
                    ))}
                  </div>
                )}

                {digest.triggerReport.length > 0 && (
                  <div className="digest-section">
                    <div className="digest-section-label">Trigger report</div>
                    {digest.triggerReport.map((t, i) => (
                      <div key={i} className="digest-section-text">
                        {t.impact === "worsens" ? "⚠️" : t.impact === "helps" ? "✅" : "➖"} {t.triggerName}: {t.avgSymptomsWith} symptoms/day (vs {t.avgSymptomsWithout} without)
                      </div>
                    ))}
                  </div>
                )}

                {digest.bestDay && (
                  <div className="digest-section">
                    <div className="digest-section-label">Your best day</div>
                    <div className="digest-section-text">
                      {new Date(digest.bestDay.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                      {digest.bestDay.mood !== null && digest.bestDay.mood !== undefined && ` · Mood: ${["😞","😕","😐","🙂","😊"][digest.bestDay.mood] || digest.bestDay.mood}`}
                      {` · ${digest.bestDay.symptoms} symptom${digest.bestDay.symptoms !== 1 ? "s" : ""}`}
                    </div>
                  </div>
                )}

                {digest.streak > 1 && (
                  <div className="digest-section">
                    <div className="digest-section-label">Consistency</div>
                    <div className="digest-section-text">🔥 {digest.streak}-day streak — your data gets more insightful every day you log.</div>
                  </div>
                )}

                {digest.avgEnergy !== null && (
                  <div className="digest-section">
                    <div className="digest-section-label">Energy</div>
                    <div className="digest-section-text">
                      Avg: {["Depleted", "Low", "Moderate", "Good", "Energized"][Math.round(digest.avgEnergy)] || digest.avgEnergy}
                      {digest.energyDelta !== null && (
                        <span className={`digest-delta ${digest.energyDelta >= 0 ? "up" : "down"}`}>
                          {" "}{digest.energyDelta >= 0 ? "↑" : "↓"} {Math.abs(digest.energyDelta)} vs last week
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="digest-section digest-tip">
                  <div className="digest-section-label">Personalized tip</div>
                  <div className="digest-section-text">{digest.tip}</div>
                </div>
                <div className="chat-disclaimer" style={{ marginTop: 8, paddingBottom: 0 }}>Based on your personal data. Not medical advice.</div>
              </div>
            );
          })()}

          {!isPremium && logs.length >= 7 && (
            <div className="digest-card digest-teaser" onClick={onShowPaywall}>
              <div className="digest-header">
                <div className="digest-title">Weekly digest</div>
                <span className="digest-lock">🔒 Premium</span>
              </div>
              <div className="digest-section-text" style={{ opacity: 0.6 }}>
                Get AI-powered weekly insights, trigger reports, and personalized tips based on your data.
              </div>
            </div>
          )}

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
            isPremium ? (
              <MoodLineChart logs={logs} />
            ) : (
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
            )
          )}

          {isPremium ? (
            <>
              <div className="trend-card">
                <div className="trend-title">Symptom intensity this week</div>
                <div className="chart-bars">
                  {weekData.map(({ day, count, hasPeriod }, i) => {
                    const height = Math.round((count / maxCount) * 100);
                    return (
                      <div key={i} className="bar-wrap">
                        <div
                          className={`bar${height >= 70 ? " high" : ""}`}
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                        <div className="bar-day">{day}</div>
                        {hasPeriod && <div className="bar-period-dot" />}
                      </div>
                    );
                  })}
                </div>
                {weekData.some((d) => d.hasPeriod) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E07070" }} />
                    <span style={{ fontSize: 10, color: "var(--ink-light)" }}>Period day</span>
                  </div>
                )}
              </div>

              {topSymptoms.length > 0 && (
                <div className="symptom-list">
                  <div className="section-label" style={{ padding: "12px 0 2px" }}>
                    Top symptoms
                  </div>
                  {topSymptoms.map((s, i) => {
                    const prev = prevSymptomDays[s.name] || 0;
                    const trend = s.days > prev ? "up" : s.days < prev ? "down" : "same";
                    return (
                      <div key={i} className="sym-row">
                        <div className="sym-rank">{i + 1}</div>
                        <div className="sym-info">
                          <div className="sym-info-name">
                            {s.name}
                            {prev > 0 && <span className={`sym-trend ${trend}`}>{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>}
                          </div>
                          <div className="sym-info-days">{s.days} of 7 days</div>
                        </div>
                        <div style={{ width: 80 }}>
                          <div className="sym-mini-bar" style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <SymptomHeatmap logs={logs} />
              <SleepSymptomScatter logs={logs} />

              {(() => {
                const patterns = analyzePatterns(logs);
                if (patterns.length === 0) return null;
                return (
                  <div className="patterns-card">
                    <div className="patterns-title">Your patterns</div>
                    <div className="patterns-subtitle">Based on your tracking history</div>
                    {patterns.map((p, i) => (
                      <div key={i} className="pattern-item">
                        <span className="pattern-icon">💡</span>
                        <span className="pattern-text">{p}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {(() => {
                const correlations = analyzeCorrelations(logs);
                if (correlations.length === 0) return null;
                return (
                  <div className="patterns-card">
                    <div className="patterns-title">Triggers & correlations</div>
                    <div className="patterns-subtitle">How your context affects symptoms</div>
                    {correlations.map((c, i) => (
                      <div key={i} className="pattern-item">
                        <span className="pattern-icon">{c.icon}</span>
                        <span className="pattern-text">{c.text}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {(() => {
                const comp = monthlyComparison(logs);
                if (!comp) return null;
                const monthName = new Date().toLocaleDateString("en-US", { month: "long" });
                const lastDate = new Date(); lastDate.setMonth(lastDate.getMonth() - 1);
                const lastMonthName = lastDate.toLocaleDateString("en-US", { month: "long" });
                return (
                  <div className="comparison-card">
                    <div className="comp-title">{monthName} vs {lastMonthName}</div>
                    <div className="comp-grid">
                      <div className="comp-stat">
                        <div className="comp-value">{comp.thisEntries}</div>
                        <div className="comp-label">entries</div>
                        <div className={`comp-delta ${comp.thisEntries >= comp.lastEntries ? "up" : "down"}`}>
                          {comp.thisEntries >= comp.lastEntries ? "↑" : "↓"} vs {comp.lastEntries}
                        </div>
                      </div>
                      {comp.moodDelta !== null && (
                        <div className="comp-stat">
                          <div className="comp-value">{comp.moodDelta > 0 ? "↑" : comp.moodDelta < 0 ? "↓" : "→"}</div>
                          <div className="comp-label">mood</div>
                          <div className={`comp-delta ${comp.moodDelta >= 0 ? "up" : "down"}`}>
                            {comp.moodDelta >= 0 ? "Improving" : "Lower"}
                          </div>
                        </div>
                      )}
                    </div>
                    {comp.mostImproved && (
                      <div className="comp-row">
                        <span className="comp-row-icon">📉</span>
                        <span><strong>{comp.mostImproved}</strong> improved this month</span>
                      </div>
                    )}
                    {comp.mostWorsened && (
                      <div className="comp-row">
                        <span className="comp-row-icon">📈</span>
                        <span><strong>{comp.mostWorsened}</strong> increased this month</span>
                      </div>
                    )}
                    {comp.newSymptoms.length > 0 && (
                      <div className="comp-row">
                        <span className="comp-row-icon">🆕</span>
                        <span>New: {comp.newSymptoms.join(", ")}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
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

      {/* ─── CBT Programs Section ─── */}
      {!showReveal && !showCompanion && (
        <div className="cbt-section">
          {activeCBT ? (() => {
            const program = CBT_PROGRAMS.find((p) => p.id === activeCBT.programId);
            if (!program) return null;
            const completedLessons = activeCBT.completed || [];
            // Advance week when all lessons in current week are done
            let currentWeek = 0;
            for (let w = 0; w < program.modules.length - 1; w++) {
              const weekLessonKeys = program.modules[w].lessons.map((l) => `w${w}-d${l.day}`);
              if (weekLessonKeys.every((k) => completedLessons.includes(k))) currentWeek = w + 1;
              else break;
            }
            const currentModule = program.modules[currentWeek];
            const allLessons = program.modules.flatMap((m, wi) => m.lessons.map((l) => ({ ...l, weekIndex: wi })));
            const totalLessons = allLessons.length;
            const completedCount = completedLessons.length;
            const progressPct = Math.round((completedCount / totalLessons) * 100);
            const isComplete = completedCount >= totalLessons;

            return (
              <div className="cbt-card">
                <div className="cbt-card-header">
                  <span className="cbt-card-icon">{program.icon}</span>
                  <div>
                    <div className="cbt-card-title">{program.title}</div>
                    <div className="cbt-card-sub">Week {currentWeek + 1} of {program.weeks} · {currentModule?.title}</div>
                  </div>
                </div>
                <div className="cbt-progress-row">
                  <div className="cbt-progress-bg">
                    <div className="cbt-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="cbt-progress-label">{completedCount}/{totalLessons} lessons</span>
                </div>
                {isComplete ? (
                  <div>
                    <div className="cbt-complete-msg">🎉 You finished the program — well done!</div>
                    <button className="cbt-btn" onClick={() => {
                      const completed = JSON.parse(localStorage.getItem("vela_completed_cbt") || "[]");
                      if (!completed.includes(activeCBT.programId)) completed.push(activeCBT.programId);
                      localStorage.setItem("vela_completed_cbt", JSON.stringify(completed));
                      localStorage.removeItem("vela_active_cbt");
                      setActiveCBT(null);
                      haptic("Medium");
                    }}>Finish program</button>
                  </div>
                ) : (
                  <>
                    <div className="cbt-lessons">
                      {currentModule?.lessons.map((lesson) => {
                        const lessonKey = `w${currentWeek}-d${lesson.day}`;
                        const isDone = completedLessons.includes(lessonKey);
                        const isExpanded = expandedLesson === lessonKey;
                        return (
                          <div key={lessonKey} className={`cbt-lesson${isDone ? " done" : ""}`}>
                            <div className="cbt-lesson-header" onClick={() => setExpandedLesson(isExpanded ? null : lessonKey)}>
                              <span className="cbt-lesson-check">{isDone ? "✓" : "○"}</span>
                              <span className="cbt-lesson-title">{lesson.title}</span>
                              <span className="cbt-lesson-arrow">{isExpanded ? "▾" : "▸"}</span>
                            </div>
                            {isExpanded && (
                              <div className="cbt-lesson-content">
                                <p>{lesson.content}</p>
                                {!isDone && (
                                  <button className="cbt-lesson-done-btn" onClick={() => {
                                    const updated = { ...activeCBT, completed: [...completedLessons, lessonKey] };
                                    setActiveCBT(updated);
                                    localStorage.setItem("vela_active_cbt", JSON.stringify(updated));
                                    haptic("Medium");
                                  }}>Mark complete</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {currentWeek < program.modules.length - 1 && (() => {
                      const weekKeys = currentModule.lessons.map((l) => `w${currentWeek}-d${l.day}`);
                      const doneCount = weekKeys.filter((k) => completedLessons.includes(k)).length;
                      const remaining = weekKeys.length - doneCount;
                      return remaining > 0 ? (
                        <div className="cbt-next-week-hint">{remaining} lesson{remaining !== 1 ? "s" : ""} left to unlock Week {currentWeek + 2}</div>
                      ) : null;
                    })()}
                    {currentWeek > 0 && (
                      <details className="cbt-prev-weeks">
                        <summary>Previous weeks</summary>
                        {program.modules.slice(0, currentWeek).map((mod, wi) => (
                          <div key={wi} className="cbt-prev-week">
                            <div className="cbt-prev-week-title">Week {wi + 1}: {mod.title}</div>
                            {mod.lessons.map((lesson) => {
                              const lk = `w${wi}-d${lesson.day}`;
                              return (
                                <div key={lk} className="cbt-prev-lesson">
                                  <span>{completedLessons.includes(lk) ? "✓" : "○"}</span> {lesson.title}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </details>
                    )}
                    <button className="cbt-btn cbt-abandon" onClick={() => {
                      if (window.confirm("End this program early? Your progress will be lost.")) {
                        localStorage.removeItem("vela_active_cbt");
                        setActiveCBT(null);
                      }
                    }}>Leave program</button>
                  </>
                )}
              </div>
            );
          })() : (
            <div className="cbt-card">
              <div className="cbt-card-header">
                <span className="cbt-card-icon">🧠</span>
                <div>
                  <div className="cbt-card-title">CBT Programs</div>
                  <div className="cbt-card-sub">Evidence-based programs to build coping skills</div>
                </div>
              </div>
              {!showCBTList ? (
                <button className="cbt-btn" onClick={() => setShowCBTList(true)}>Browse programs</button>
              ) : (
                <div className="cbt-program-list">
                  {(() => {
                    const p = getPersonalization(profile);
                    const completed = JSON.parse(localStorage.getItem("vela_completed_cbt") || "[]");
                    let programs = [...CBT_PROGRAMS];
                    // Sort: recommended first, then uncompleted before completed
                    programs.sort((a, b) => {
                      const aComp = completed.includes(a.id) ? 1 : 0;
                      const bComp = completed.includes(b.id) ? 1 : 0;
                      if (aComp !== bComp) return aComp - bComp;
                      if (p?.recommendedCBT?.length > 0) {
                        const aRec = p.recommendedCBT.includes(a.id) ? 0 : 1;
                        const bRec = p.recommendedCBT.includes(b.id) ? 0 : 1;
                        return aRec - bRec;
                      }
                      return 0;
                    });
                    return programs.map((program) => {
                      const isRecommended = p?.recommendedCBT?.includes(program.id);
                      const isDone = completed.includes(program.id);
                      return (
                        <div key={program.id} className={`cbt-program-item${isRecommended && !isDone ? " recommended" : ""}${isDone ? " completed" : ""}`} onClick={() => {
                          const cbt = { programId: program.id, startDate: new Date().toISOString(), completed: [] };
                          setActiveCBT(cbt);
                          localStorage.setItem("vela_active_cbt", JSON.stringify(cbt));
                          setShowCBTList(false);
                          haptic("Medium");
                        }}>
                          <div className="cbt-program-icon">{program.icon}</div>
                          <div className="cbt-program-info">
                            {isDone && <div className="cbt-completed-badge">✓ Completed — tap to revisit</div>}
                            {isRecommended && !isDone && <div className="cbt-recommended-badge">Recommended for you</div>}
                            <div className="cbt-program-name">{program.title}</div>
                            <div className="cbt-program-meta">{program.subtitle}</div>
                            <div className="cbt-program-desc">{program.desc}</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <button className="cbt-btn cbt-abandon" onClick={() => setShowCBTList(false)}>Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Experiments Section ─── */}
      {!showReveal && !showCompanion && (() => {
        const personalization = getPersonalization(profile);
        const completedIds = JSON.parse(localStorage.getItem("vela_completed_experiments") || "[]");

        if (activeExp) {
          const daysSinceStart = Math.floor((new Date() - new Date(activeExp.startDate)) / 86400000);
          const progress = Math.min(daysSinceStart, activeExp.duration);
          const pct = Math.round((progress / activeExp.duration) * 100);
          const isComplete = progress >= activeExp.duration;

          // Build results summary from logs during experiment
          const expStart = new Date(activeExp.startDate);
          const expLogs = logs.filter((l) => new Date(l.date) >= expStart);
          const priorLogs = logs.filter((l) => new Date(l.date) < expStart).slice(-14);
          let resultText = null;
          if (isComplete && expLogs.length >= 3 && priorLogs.length >= 3) {
            const avgMood = (arr) => {
              const valid = arr.filter((l) => l.mood !== null && l.mood !== undefined);
              return valid.length > 0 ? valid.reduce((s, l) => s + l.mood, 0) / valid.length : null;
            };
            const avgSymptoms = (arr) => {
              const valid = arr.filter((l) => l.symptoms && Object.keys(l.symptoms).length > 0);
              return valid.length > 0 ? valid.reduce((s, l) => s + Object.keys(l.symptoms).length, 0) / valid.length : null;
            };
            const moodBefore = avgMood(priorLogs);
            const moodDuring = avgMood(expLogs);
            const symBefore = avgSymptoms(priorLogs);
            const symDuring = avgSymptoms(expLogs);
            const parts = [];
            if (moodBefore !== null && moodDuring !== null) {
              const diff = moodDuring - moodBefore;
              if (diff > 0.3) parts.push("Your mood improved during this experiment");
              else if (diff < -0.3) parts.push("Your mood dipped slightly during this period");
              else parts.push("Your mood stayed steady");
            }
            if (symBefore !== null && symDuring !== null) {
              const diff = symDuring - symBefore;
              if (diff < -0.3) parts.push("you reported fewer symptoms");
              else if (diff > 0.3) parts.push("symptom count increased slightly");
              else parts.push("symptom frequency was about the same");
            }
            if (parts.length > 0) resultText = parts[0] + (parts[1] ? " — " + parts[1] + "." : ".");
          }

          return (
            <div className="cbt-section">
              <div className={`exp-card${isComplete ? " exp-complete" : ""}`}>
                <div className="exp-header">
                  <span className="exp-icon">{activeExp.icon}</span>
                  <span className="exp-title">{activeExp.title}</span>
                  {isComplete && <span className="exp-badge">Complete!</span>}
                </div>
                <div className="exp-desc">{activeExp.desc}</div>
                <div className="exp-progress-row">
                  <div className="exp-progress-bg">
                    <div className="exp-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="exp-progress-label">Day {progress}/{activeExp.duration}</span>
                </div>
                {isComplete ? (
                  <div>
                    {resultText && <div className="exp-result">{resultText}</div>}
                    <button className="exp-btn" onClick={() => {
                      const updated = [...completedIds, activeExp.id];
                      localStorage.setItem("vela_completed_experiments", JSON.stringify(updated));
                      localStorage.removeItem("vela_active_experiment");
                      setActiveExp(null);
                      haptic("Medium");
                    }}>Finish experiment</button>
                  </div>
                ) : (
                  <button className="exp-btn exp-abandon" onClick={() => {
                    if (window.confirm("End this experiment early?")) {
                      localStorage.removeItem("vela_active_experiment");
                      setActiveExp(null);
                    }
                  }}>End experiment</button>
                )}
              </div>
            </div>
          );
        }

        // No active experiment — show browse
        return (
          <div className="cbt-section">
            <div className="cbt-card">
              <div className="cbt-card-header">
                <span className="cbt-card-icon">🧪</span>
                <div>
                  <div className="cbt-card-title">Self-Experiments</div>
                  <div className="cbt-card-sub">Try a structured challenge and see how it affects your symptoms</div>
                </div>
              </div>
              {!showExpList ? (
                <button className="cbt-btn" onClick={() => setShowExpList(true)}>Browse experiments</button>
              ) : (
                <div className="cbt-program-list">
                  {(() => {
                    let experiments = [...EXPERIMENTS];
                    if (personalization?.expPriority?.length > 0) {
                      experiments.sort((a, b) => {
                        const aComp = completedIds.includes(a.id) ? 1 : 0;
                        const bComp = completedIds.includes(b.id) ? 1 : 0;
                        if (aComp !== bComp) return aComp - bComp;
                        const aIdx = personalization.expPriority.indexOf(a.id);
                        const bIdx = personalization.expPriority.indexOf(b.id);
                        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                      });
                    } else {
                      experiments.sort((a, b) => (completedIds.includes(a.id) ? 1 : 0) - (completedIds.includes(b.id) ? 1 : 0));
                    }
                    return experiments.map((exp) => {
                      const isDone = completedIds.includes(exp.id);
                      const isRecommended = !isDone && personalization?.expPriority?.includes(exp.id);
                      return (
                        <div key={exp.id} className={`cbt-program-item${isRecommended ? " recommended" : ""}${isDone ? " completed" : ""}`} onClick={() => {
                          const newExp = { ...exp, startDate: new Date().toISOString(), daysCompleted: 0 };
                          localStorage.setItem("vela_active_experiment", JSON.stringify(newExp));
                          setActiveExp(newExp);
                          setShowExpList(false);
                          haptic("Medium");
                        }}>
                          <div className="cbt-program-icon">{exp.icon}</div>
                          <div className="cbt-program-info">
                            {isDone && <div className="cbt-completed-badge">✓ Completed — tap to try again</div>}
                            {isRecommended && <div className="cbt-recommended-badge">Recommended for you</div>}
                            <div className="cbt-program-name">{exp.title}</div>
                            <div className="cbt-program-meta">{exp.duration} days</div>
                            <div className="cbt-program-desc">{exp.desc}</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <button className="cbt-btn cbt-abandon" onClick={() => setShowExpList(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {!showReveal && !showCompanion && (isPremium ? (
        <div className="doctor-prep">
          <div className="dp-title">Doctor visit prep</div>
          {(() => {
            const tp = generateTalkingPoints(logs, profile);
            if (!tp) return <div className="dp-empty">Log a few more entries to generate talking points.</div>;
            return (
              <>
                <div className="dp-section-label">Key talking points</div>
                {tp.points.map((p, i) => (
                  <div key={i} className="dp-point">
                    <span className="dp-bullet">•</span>
                    <span>{p}</span>
                  </div>
                ))}
                <div className="dp-section-label" style={{ marginTop: 12 }}>Questions to ask your provider</div>
                {tp.questions.map((q, i) => (
                  <div key={i} className="dp-point question">
                    <span className="dp-bullet">?</span>
                    <span>{q}</span>
                  </div>
                ))}
              </>
            );
          })()}
          <button
            className="log-btn"
            onClick={() => generateDoctorReport(logs, profile)}
            style={{ margin: "14px 0 0" }}
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
        <>
        <InsightLibrary />
        <div className="unlock-card">
          <div className="unlock-tag">Premium</div>
          <div className="unlock-title">Understand why, not just what</div>
          <div className="unlock-body">
            See patterns in your symptoms, prep for doctor visits with a shareable PDF report, and get personalized guidance.
          </div>
          <button className="unlock-btn" onClick={onShowPaywall}>Try free for 7 days</button>
        </div>
        </>
      ))}
    </div>
  );
}

// ─── Paywall Screen ──────────────────────────────────────────────────────────

function PaywallScreen({ onClose, onSubscribe, onRestore }) {
  const [plan, setPlan] = useState("annual");
  const features = [
    { icon: "🔮", title: "Pattern detection", desc: "Discover what triggers your symptoms — sleep, stress, caffeine, cycle phase" },
    { icon: "📊", title: "Trends & comparisons", desc: "See how this month compares to last with visual charts" },
    { icon: "🤖", title: "Vela AI Companion", desc: "Ask questions about your patterns and get personalized guidance" },
    { icon: "📰", title: "Smart Weekly Digest", desc: "A weekly summary of what happened, what helped, and what to watch" },
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
          <h2>Track for free. Understand with Premium.</h2>
          <p>
            See why your symptoms happen, spot patterns you'd miss,
            and walk into your next doctor's appointment prepared.
          </p>
        </div>

        <div className="paywall-lead">
          <div className="pw-lead-icon">📋</div>
          <div className="pw-lead-text">
            <strong>Walk in prepared</strong>
            <span>Generate a doctor-ready PDF with your symptom history, patterns, and talking points — so you're taken seriously.</span>
          </div>
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

        <div className="paywall-plans">
          <button
            className={`paywall-plan${plan === "annual" ? " selected" : ""}`}
            onClick={() => setPlan("annual")}
          >
            <div className="plan-save">Save 31%</div>
            <div className="plan-period">Annual</div>
            <div className="plan-price">$49.99<span>/year</span></div>
            <div className="plan-monthly">$4.17/mo</div>
          </button>
          <button
            className={`paywall-plan${plan === "monthly" ? " selected" : ""}`}
            onClick={() => setPlan("monthly")}
          >
            <div className="plan-period">Monthly</div>
            <div className="plan-price">$5.99<span>/mo</span></div>
            <div className="plan-monthly">&nbsp;</div>
          </button>
        </div>

        <button className="paywall-cta" onClick={() => onSubscribe(plan)}>
          {plan === "annual" ? "Try free for 7 days — $49.99/year" : "Try free for 7 days — $5.99/month"}
        </button>
        <div className="paywall-price">Cancel anytime during your trial. Your data stays on your device — always.</div>
        <button className="paywall-restore" onClick={onRestore}>
          Restore previous purchase
        </button>
        <div style={{ marginTop: 16, fontSize: 11, color: "var(--ink-light)", textAlign: "center" }}>
          <a href="/terms.html" target="_blank" style={{ color: "var(--ink-light)" }}>Terms</a>
          {" · "}
          <a href="/privacy.html" target="_blank" style={{ color: "var(--ink-light)" }}>Privacy</a>
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
              {opt}
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

function MilestonesCard({ earned, locked, totalCount }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_COUNT = 3;
  const visibleLocked = expanded ? locked : locked.slice(0, PREVIEW_COUNT);
  const hiddenCount = locked.length - PREVIEW_COUNT;

  return (
    <div className="settings-card" style={{ marginTop: 8 }}>
      <div className="gam-badges-title">Milestones ({earned.length}/{totalCount})</div>
      <div className="gam-badges-grid">
        {earned.map((b) => (
          <div key={b.id} className="gam-badge earned">
            <div className="gam-badge-icon">{b.icon}</div>
            <div className="gam-badge-name">{b.name}</div>
            <div className="gam-badge-desc">{b.desc}</div>
          </div>
        ))}
        {visibleLocked.map((b) => (
          <div key={b.id} className="gam-badge locked">
            <div className="gam-badge-icon">🔒</div>
            <div className="gam-badge-name">{b.name}</div>
            <div className="gam-badge-desc">{b.desc}</div>
          </div>
        ))}
      </div>
      {!expanded && hiddenCount > 0 && (
        <button className="milestones-expand" onClick={() => setExpanded(true)}>
          Show {hiddenCount} more milestones
        </button>
      )}
      {expanded && locked.length > PREVIEW_COUNT && (
        <button className="milestones-expand" onClick={() => setExpanded(false)}>
          Show less
        </button>
      )}
    </div>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

function SettingsScreen({ profile, logs, isPremium, onShowPaywall, onEditQuestion, onClearData, remindersEnabled, onToggleReminders, reminderTimes, onUpdateReminderTime, onNavigate }) {
  const [themePref, setThemePref] = useState(() => getThemePref());
  const journeyStage = profile ? getJourneyLabel(profile[0]) : "Not set";
  const guidanceLabels = ["Daily check-ins & reminders", "Weekly summaries", "Only when I ask", "Let the app decide"];
  const guidancePref = profile && profile[3] !== undefined && profile[3] !== null ? profile[3] : 3;
  const goalLabels = [
    "Understand my body",
    "Track for my doctor",
    "Find relief strategies",
    "Connect with others",
  ];
  const goalArr = profile ? (Array.isArray(profile[2]) ? profile[2].map((i) => goalLabels[i]) : [goalLabels[profile[2]]]) : [];
  const goal = goalArr.length === 0 ? "Not set" : goalArr.length === 1 ? goalArr[0] : `${goalArr[0]} +${goalArr.length - 1} more`;

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

      {(() => {
        const stats = computeGamificationStats(logs);
        const xp = computeXP(logs);
        const lvl = getLevel(xp);
        const earned = BADGES.filter((b) => b.check(stats));
        const locked = BADGES.filter((b) => !b.check(stats));
        return (
          <div className="settings-section">
            <div className="settings-section-label">Your journey</div>
            <div className="settings-card">
              <div className="gam-profile">
                <div className="gam-profile-level">
                  <div className="gam-big-name">{lvl.name}</div>
                </div>
                <div className="gam-profile-stats">
                  <div className="gam-ps"><div className="gam-ps-val">{stats.uniqueDays}</div><div className="gam-ps-label">days tracked</div></div>
                  <div className="gam-ps"><div className="gam-ps-val">{earned.length}</div><div className="gam-ps-label">milestones</div></div>
                  <div className="gam-ps"><div className="gam-ps-val">{stats.streak}</div><div className="gam-ps-label">streak</div></div>
                </div>
                {isPremium && (
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>🛡️ Streak freezes</div>
                      <div style={{ fontSize: 11, color: "var(--ink-light)" }}>Protect your streak on off days</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: "var(--sage)" }}>{JSON.parse(localStorage.getItem("vela_streak_freeze_count") || "2")}</span>
                      <button style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--sage)", background: "transparent", color: "var(--sage)", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
                        onClick={() => {
                          if (applyStreakFreeze()) { haptic("Medium"); window.location.reload(); }
                          else alert("No freezes available or already used today.");
                        }}>Use today</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <MilestonesCard earned={earned} locked={locked} totalCount={BADGES.length} />
          </div>
        );
      })()}

      {(() => {
        const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
        const p = getPersonalization(profile);
        const hasExperiment = !!localStorage.getItem("vela_active_experiment");
        const hasCBT = !!localStorage.getItem("vela_active_cbt");
        const completedLessons = JSON.parse(localStorage.getItem("vela_completed_lessons") || "[]").length;
        const steps = [];
        if (uniqueDays < 7) steps.push({ icon: "📊", text: `Log ${7 - uniqueDays} more day${7 - uniqueDays > 1 ? "s" : ""} to unlock your first insights`, action: "today" });
        if (uniqueDays >= 7 && uniqueDays < 14) steps.push({ icon: "🔬", text: "Check your Insights tab — your patterns are ready!", action: "insights" });
        if (!hasExperiment && uniqueDays >= 3) steps.push({ icon: "🧪", text: p?.topConcernNames?.[0] ? `Try an experiment for your ${p.topConcernNames[0]}` : "Start a self-experiment to test what helps", action: "insights" });
        if (!hasCBT && uniqueDays >= 5 && p?.recommendedCBT?.length > 0) steps.push({ icon: "🧠", text: "Start a recommended CBT program", action: "insights" });
        if (completedLessons < 3) steps.push({ icon: "💡", text: "Read today's daily insight", action: "today" });
        if (p?.wantsDoctor && uniqueDays >= 14) steps.push({ icon: "👩‍⚕️", text: "Generate your doctor report from your 2 weeks of data", action: "export" });
        if (p?.wantsCommunity) steps.push({ icon: "💬", text: "Join the community — you're not alone in this", action: "community" });
        if (steps.length === 0) return null;
        return (
          <div className="settings-section">
            <div className="settings-section-label">Suggested next steps</div>
            <div className="settings-card">
              {steps.slice(0, 3).map((s, i) => (
                <div key={i} className="settings-row" style={{ cursor: "default" }}>
                  <div className="sr-left">
                    <span className="sr-icon">{s.icon}</span>
                    <span className="sr-label">{s.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="settings-section">
        <div className="settings-section-label">Appearance</div>
        <div className="settings-card">
          <div className="settings-row" style={{ borderBottom: "none", cursor: "default" }}>
            <div className="sr-left">
              <span className="sr-icon">🎨</span>
              <span className="sr-label">Theme</span>
            </div>
          </div>
          <div className="seg-control" role="radiogroup" aria-label="Theme preference">
            {[
              { id: "light", label: "Light", icon: "☀️" },
              { id: "system", label: "System", icon: "⚙" },
              { id: "dark", label: "Dark", icon: "🌙" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={themePref === opt.id}
                className={`seg-control-btn${themePref === opt.id ? " active" : ""}`}
                onClick={() => { setTheme(opt.id); setThemePref(opt.id); haptic("Light"); }}
              >
                <span aria-hidden="true">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Reminders</div>
        <div className="settings-card">
          <div className="settings-row">
            <div className="sr-left">
              <span className="sr-icon">🔔</span>
              <span className="sr-label">Reminders</span>
            </div>
            <div className="toggle-wrap" onClick={() => onToggleReminders(!remindersEnabled)}>
              <div className={`toggle-track${remindersEnabled ? " on" : ""}`} />
              <div className={`toggle-thumb${remindersEnabled ? " on" : ""}`} />
            </div>
          </div>
          <div className="settings-row" onClick={() => onEditQuestion(3)}>
            <div className="sr-left">
              <span className="sr-icon">📋</span>
              <span className="sr-label">Frequency</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="sr-value">{guidanceLabels[guidancePref]}</span>
              <span className="sr-arrow">›</span>
            </div>
          </div>
          {remindersEnabled && guidancePref !== 2 && (
            <>
              {(guidancePref === 0) && (
                <div className="settings-row">
                  <div className="sr-left">
                    <span className="sr-icon">🌅</span>
                    <span className="sr-label">Morning</span>
                  </div>
                  <input type="time" className="reminder-time-input" value={reminderTimes.morning} onChange={(e) => onUpdateReminderTime("morning", e.target.value)} />
                </div>
              )}
              {(guidancePref === 0 || guidancePref === 3) && (
                <div className="settings-row">
                  <div className="sr-left">
                    <span className="sr-icon">🌙</span>
                    <span className="sr-label">Evening</span>
                  </div>
                  <input type="time" className="reminder-time-input" value={reminderTimes.evening} onChange={(e) => onUpdateReminderTime("evening", e.target.value)} />
                </div>
              )}
              {guidancePref === 1 && (
                <div className="settings-row">
                  <div className="sr-left">
                    <span className="sr-icon">📅</span>
                    <span className="sr-label">Sunday</span>
                  </div>
                  <input type="time" className="reminder-time-input" value={reminderTimes.weekly} onChange={(e) => onUpdateReminderTime("weekly", e.target.value)} />
                </div>
              )}
            </>
          )}
          {remindersEnabled && guidancePref === 2 && (
            <div className="settings-row">
              <div className="sr-left">
                <span className="sr-icon">😌</span>
                <span className="sr-label" style={{ color: "var(--ink-light)" }}>No reminders scheduled</span>
              </div>
            </div>
          )}
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
          <div className="settings-row" onClick={() => window.open("/terms.html", "_blank")}>
            <div className="sr-left">
              <span className="sr-icon">📄</span>
              <span className="sr-label">Terms of service</span>
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
        <p onClick={() => {
          const count = parseInt(sessionStorage.getItem("_debug_taps") || "0") + 1;
          sessionStorage.setItem("_debug_taps", String(count));
          if (count >= 5) { sessionStorage.removeItem("_debug_taps"); onNavigate && onNavigate("debug"); }
        }} style={{ cursor: "default", userSelect: "none" }}>Vela v1.0.0</p>
        <p style={{ marginTop: 4 }}>
          Questions? <a href="mailto:support@velahealth.health">support@velahealth.health</a>
        </p>
        <p style={{ marginTop: 8, fontSize: 11 }}>
          Vela is not medical advice. Always consult your healthcare provider.
        </p>
      </div>
    </div>
  );
}

// ─── Community Screen ─────────────────────────────────────────────────────────

const COMMUNITY_REACTIONS = [
  { type: "hug", emoji: "\u{1F917}", label: "Hug" },
  { type: "strength", emoji: "\u{1F4AA}", label: "Strength" },
  { type: "thanks", emoji: "\u{1F64F}", label: "Thanks" },
];
const COMMUNITY_POST_MAX_CHARS = 500;
const TOPIC_EMOJI_OPTIONS = ["\u{1F4AA}","\u{1F9D8}","\u2764\uFE0F","\u{1F338}","\u{1F375}","\u{1F48A}","\u{1F3C3}","\u{1F634}","\u{1F9E0}","\u{1F33F}","\u2600\uFE0F","\u{1FAC2}","\u{1FA7A}","\u{1F4DD}","\u{1F3AF}"];
const TOPIC_TAG_OPTIONS = ["Support", "Tips", "Questions", "Venting", "Wins"];
const TOPIC_TITLE_MAX = 60;
const TOPIC_DESC_MAX = 120;

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getPostTime(post) {
  const d = new Date(post.time);
  return isNaN(d.getTime()) ? Date.now() - 86400000 : d.getTime();
}

function getScore(post, votes) {
  const base = post.upvotes ?? post.likes ?? 0;
  const v = votes[post.id];
  return base + (v === "up" ? 1 : v === "down" ? -1 : 0);
}

function hotScore(post, votes) {
  const score = getScore(post, votes);
  const ageHours = (Date.now() - getPostTime(post)) / 3600000;
  return score / Math.pow(ageHours + 2, 1.5);
}

function sortPosts(posts, mode, votes) {
  const sorted = [...posts];
  switch (mode) {
    case "hot": return sorted.sort((a, b) => hotScore(b, votes) - hotScore(a, votes));
    case "new": return sorted.sort((a, b) => getPostTime(b) - getPostTime(a));
    case "top": return sorted.sort((a, b) => getScore(b, votes) - getScore(a, votes));
    default: return sorted;
  }
}

const COMMUNITY_TOPICS = [
  {
    id: "hot-flashes",
    icon: "\u{1F321}",
    title: "Hot flashes & night sweats",
    description: "Sharing experiences and what's helped us",
    resources: [
      { label: "Evidence-based treatment options for VMS", type: "article" },
      { label: "When to talk to your doctor about treatment", type: "article" },
    ],
    posts: [
      { id: "hf-1", author: "Anonymous", time: "2h ago", text: "Keeping a small fan on my nightstand helps me cope. Everyone's different though — tracking what works for you is key.", likes: 24 },
      { id: "hf-2", author: "Anonymous", time: "5h ago", text: "I noticed a pattern in my Vela logs — certain days are worse than others. Showed my doctor and we came up with a plan together.", likes: 18 },
      { id: "hf-3", author: "Anonymous", time: "1d ago", text: "Does anyone else get them at the most inconvenient times? Middle of a presentation yesterday. Having a plan for those moments helps.", likes: 31 },
      { id: "hf-4", author: "Anonymous", time: "1d ago", text: "Week 3 of tracking and I can already see my triggers — stress and wine are the big ones for me. Knowledge is power.", likes: 45 },
      { id: "hf-5", author: "Anonymous", time: "2d ago", text: "My GP switched me to a different HRT formulation after I showed her my symptom logs. Night sweats went from nightly to maybe twice a week.", likes: 89 },
      { id: "hf-6", author: "Anonymous", time: "3d ago", text: "Layered clothing is my survival strategy. I call it my 'flash kit' — always ready to peel off a layer at a moment's notice.", likes: 37 },
      { id: "hf-7", author: "Anonymous", time: "4d ago", text: "For anyone just starting: it gets better once you understand your patterns. The first month of tracking felt pointless, month two was a revelation.", likes: 112 },
    ],
  },
  {
    id: "brain-fog",
    icon: "\u{1F9E0}",
    title: "Brain fog & memory",
    description: "You're not losing your mind \u2014 this is real",
    resources: [
      { label: "Techniques for managing brain fog", type: "tip" },
      { label: "How estrogen affects cognitive function", type: "article" },
    ],
    posts: [
      { id: "bf-1", author: "Anonymous", time: "3h ago", text: "I started writing everything down. Lists for everything. It felt silly at first but it genuinely reduced my anxiety about forgetting things.", likes: 42 },
      { id: "bf-2", author: "Anonymous", time: "8h ago", text: "My doctor told me brain fog during perimenopause is caused by fluctuating estrogen levels. It's temporary. That alone made me feel better.", likes: 55 },
      { id: "bf-3", author: "Anonymous", time: "1d ago", text: "The word-finding thing is so frustrating. Mid-sentence and the word just vanishes. Glad to know it's hormonal and not early dementia.", likes: 73 },
      { id: "bf-4", author: "Anonymous", time: "2d ago", text: "I tracked my brain fog alongside sleep quality and there's a clear connection. Bad sleep = fog city the next day. Working on my sleep hygiene now.", likes: 48 },
      { id: "bf-5", author: "Anonymous", time: "3d ago", text: "Omega-3s and reducing sugar helped me. Not a miracle cure but I went from daily brain fog to maybe 2-3 times a week.", likes: 61 },
    ],
  },
  {
    id: "mood-anxiety",
    icon: "\u{1F494}",
    title: "Mood changes & anxiety",
    description: "The emotional rollercoaster nobody warned us about",
    resources: [
      { label: "Grounding exercises for anxiety spikes", type: "tip" },
      { label: "Understanding hormonal mood shifts", type: "article" },
    ],
    posts: [
      { id: "ma-1", author: "Anonymous", time: "1h ago", text: "Some days I feel like a completely different person. Then I remember: hormones. It helps to name it.", likes: 38 },
      { id: "ma-2", author: "Anonymous", time: "6h ago", text: "Walking 20 minutes every morning has helped my mood. Exercise has strong evidence for mood improvement during perimenopause. It's not a cure but it takes the edge off.", likes: 29 },
      { id: "ma-3", author: "Anonymous", time: "2d ago", text: "If you're feeling rage that seems out of nowhere \u2014 that's perimenopause too. You're not broken. Your hormones are just really loud right now.", likes: 67 },
      { id: "ma-4", author: "Anonymous", time: "3d ago", text: "Started the Anxiety & Mood CBT program here and it's actually helped. The breathing techniques sound basic but they work in the moment.", likes: 54 },
      { id: "ma-5", author: "Anonymous", time: "4d ago", text: "My husband thought I was upset with him. I showed him my mood tracking — mood drops consistently around day 14-18 of my cycle. Now he understands it's not personal.", likes: 93 },
      { id: "ma-6", author: "Anonymous", time: "5d ago", text: "Magnesium glycinate before bed has been a game changer for my anxiety. Talk to your doctor first but it might be worth asking about.", likes: 44 },
    ],
  },
  {
    id: "sleep",
    icon: "\u{1F634}",
    title: "Sleep struggles",
    description: "Getting rest when your body won't cooperate",
    resources: [
      { label: "Sleep hygiene strategies during menopause", type: "tip" },
      { label: "When to talk to your doctor about sleep issues", type: "article" },
    ],
    posts: [
      { id: "sl-1", author: "Anonymous", time: "4h ago", text: "CBT for insomnia (CBT-I) was recommended by my doctor and it's been really effective. Ask your provider about evidence-based sleep treatments.", likes: 33 },
      { id: "sl-2", author: "Anonymous", time: "1d ago", text: "I stopped looking at the clock when I wake up at 3am. Sounds small but it stopped the anxiety spiral of 'I only have 3 hours left'.", likes: 41 },
      { id: "sl-3", author: "Anonymous", time: "2d ago", text: "Cooling sheets + keeping the room at 65°F changed everything. My Vela logs show I went from 4-5hrs to 6-7hrs consistently.", likes: 78 },
      { id: "sl-4", author: "Anonymous", time: "3d ago", text: "The 3am wake-up club checking in 😅 Anyone else wide awake at exactly the same time every night? Cortisol spike apparently.", likes: 56 },
      { id: "sl-5", author: "Anonymous", time: "5d ago", text: "No screens after 9pm was hard but worth it. Also cut evening caffeine. Two simple changes and my sleep score went way up.", likes: 39 },
    ],
  },
  {
    id: "doctor-talks",
    icon: "\u{1F469}\u200D\u2695\uFE0F",
    title: "Talking to your doctor",
    description: "How to advocate for yourself",
    resources: [
      { label: "Questions to ask at your next appointment", type: "tip" },
      { label: "How to find a menopause-informed doctor", type: "article" },
    ],
    posts: [
      { id: "dt-1", author: "Anonymous", time: "7h ago", text: "Bring your Vela report to your appointment. My doctor was impressed I had actual data on my symptoms. It changed the whole conversation.", likes: 52 },
      { id: "dt-2", author: "Anonymous", time: "2d ago", text: "If your doctor dismisses your symptoms, find a new doctor. It took me 3 tries but I finally found one who listens.", likes: 71 },
      { id: "dt-3", author: "Anonymous", time: "3d ago", text: "I printed my symptom report and highlighted the patterns. My doctor actually said 'this is exactly what I need to see.' First time I felt truly heard.", likes: 104 },
      { id: "dt-4", author: "Anonymous", time: "4d ago", text: "Ask specifically for a menopause specialist or someone NAMS-certified. Regular OB/GYNs often have minimal menopause training.", likes: 88 },
      { id: "dt-5", author: "Anonymous", time: "6d ago", text: "Don't apologize for your symptoms or minimize them. 'I'm having 8 hot flashes a day and sleeping 4 hours' — be direct. You deserve treatment.", likes: 127 },
    ],
  },
];

function CommunityScreen() {
  const [activeTopic, setActiveTopic] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const [showMyPosts, setShowMyPosts] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [sortMode, setSortMode] = useState("hot");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [topicForm, setTopicForm] = useState({ icon: "", title: "", description: "", tags: [] });
  const [moderationError, setModerationError] = useState(null);

  // Migrate old likes → votes
  const [votes, setVotes] = useState(() => {
    const existing = localStorage.getItem("vela_community_votes");
    if (existing) return JSON.parse(existing);
    const oldLikes = JSON.parse(localStorage.getItem("vela_community_likes") || "{}");
    const migrated = {};
    for (const id of Object.keys(oldLikes)) { if (oldLikes[id]) migrated[id] = "up"; }
    localStorage.setItem("vela_community_votes", JSON.stringify(migrated));
    localStorage.removeItem("vela_community_likes");
    return migrated;
  });
  const [bookmarks, setBookmarks] = useState(() =>
    JSON.parse(localStorage.getItem("vela_community_bookmarks") || "[]")
  );
  const [reactions, setReactions] = useState(() =>
    JSON.parse(localStorage.getItem("vela_community_reactions") || "{}")
  );
  const [userPosts, setUserPosts] = useState(() =>
    JSON.parse(localStorage.getItem("vela_community_posts") || "[]")
  );
  const [guidelinesSeen, setGuidelinesSeen] = useState(() =>
    JSON.parse(localStorage.getItem("vela_community_guidelines_seen") || "false")
  );
  const [userTopics, setUserTopics] = useState(() =>
    JSON.parse(localStorage.getItem("vela_community_user_topics") || "[]")
  );
  const [replies, setReplies] = useState(() =>
    JSON.parse(localStorage.getItem("vela_community_replies") || "[]")
  );

  useEffect(() => { localStorage.setItem("vela_community_votes", JSON.stringify(votes)); }, [votes]);
  useEffect(() => { localStorage.setItem("vela_community_bookmarks", JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => { localStorage.setItem("vela_community_reactions", JSON.stringify(reactions)); }, [reactions]);
  useEffect(() => { localStorage.setItem("vela_community_posts", JSON.stringify(userPosts)); }, [userPosts]);
  useEffect(() => { localStorage.setItem("vela_community_guidelines_seen", JSON.stringify(guidelinesSeen)); }, [guidelinesSeen]);
  useEffect(() => { localStorage.setItem("vela_community_user_topics", JSON.stringify(userTopics)); }, [userTopics]);
  useEffect(() => { localStorage.setItem("vela_community_replies", JSON.stringify(replies)); }, [replies]);

  function vote(postId, direction) {
    haptic();
    setVotes((prev) => {
      const next = { ...prev };
      if (next[postId] === direction) delete next[postId];
      else next[postId] = direction;
      return next;
    });
  }

  function toggleBookmark(postId) {
    haptic();
    setBookmarks((prev) => prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]);
  }

  function toggleReaction(postId, type) {
    haptic();
    setReactions((prev) => {
      const current = prev[postId] || [];
      const has = current.includes(type);
      return { ...prev, [postId]: has ? current.filter((r) => r !== type) : [...current, type] };
    });
  }

  function submitPost() {
    if (!composeText.trim() || !activeTopic) return;
    // Content moderation
    const modCheck = communityMod.moderateContent(composeText);
    if (!modCheck.allowed) {
      setModerationError(modCheck.reason);
      haptic("Heavy");
      return;
    }
    setModerationError(null);
    haptic("Medium");

    if (communityMod.LIVE_COMMUNITY) {
      communityMod.createPost(activeTopic, composeText).then((result) => {
        if (result?.error) { setModerationError(result.error); return; }
        if (result) setUserPosts((prev) => [{ ...result, isUserPost: true }, ...prev]);
      });
    } else {
      setUserPosts((prev) => [{
        id: `user-${Date.now()}`, author: "Anonymous", time: new Date().toISOString(),
        text: composeText.trim(), upvotes: 0, topicId: activeTopic, isUserPost: true,
      }, ...prev]);
    }
    setComposeText("");
    setShowCompose(false);
    setReplyingTo(null);
  }

  function submitReply() {
    if (!composeText.trim() || !replyingTo) return;
    // Content moderation
    const modCheck = communityMod.moderateContent(composeText);
    if (!modCheck.allowed) {
      setModerationError(modCheck.reason);
      haptic("Heavy");
      return;
    }
    setModerationError(null);
    haptic("Medium");

    if (communityMod.LIVE_COMMUNITY) {
      communityMod.createPost(activeTopic, composeText, replyingTo).then((result) => {
        if (result?.error) { setModerationError(result.error); return; }
        if (result) setReplies((prev) => [...prev, { ...result, isUserPost: true, parentId: replyingTo, topicId: activeTopic }]);
      });
    } else {
      setReplies((prev) => [...prev, {
        id: `reply-${Date.now()}`, author: "Anonymous", time: new Date().toISOString(),
        text: composeText.trim(), upvotes: 0, topicId: activeTopic,
        parentId: replyingTo, isUserPost: true,
      }]);
    }
    setComposeText("");
    setShowCompose(false);
    setReplyingTo(null);
  }

  function submitTopic() {
    if (!topicForm.title.trim()) return;
    haptic("Medium");
    const newTopic = {
      id: `topic-${Date.now()}`, icon: topicForm.icon || "\u{1F4AC}",
      title: topicForm.title.trim(), description: topicForm.description.trim(),
      tags: topicForm.tags, isUserTopic: true, createdAt: new Date().toISOString(),
      resources: [], posts: [],
    };
    setUserTopics((prev) => [newTopic, ...prev]);
    setTopicForm({ icon: "", title: "", description: "", tags: [] });
    setShowCreateTopic(false);
    setActiveTopic(newTopic.id);
  }

  function findTopic(id) {
    return COMMUNITY_TOPICS.find((t) => t.id === id) || userTopics.find((t) => t.id === id);
  }

  function getPostById(id) {
    for (const topic of COMMUNITY_TOPICS) {
      const found = topic.posts.find((p) => p.id === id);
      if (found) return { ...found, topicId: topic.id };
    }
    return userPosts.find((p) => p.id === id) || replies.find((p) => p.id === id) || null;
  }

  function renderPost(post, isReply) {
    const postTime = post.isUserPost ? relativeTime(post.time) : post.time;
    const score = getScore(post, votes);
    const postReplies = isReply ? [] : replies.filter((r) => r.parentId === post.id);
    return (
      <div key={post.id}>
        <div className={`comm-post${isReply ? " comm-reply" : ""}`}>
          <div className="comm-post-inner">
            <div className="comm-vote">
              <button className={`comm-vote-btn${votes[post.id] === "up" ? " comm-vote-active-up" : ""}`} onClick={() => vote(post.id, "up")}>{"\u25B2"}</button>
              <span className="comm-vote-score">{score}</span>
              <button className={`comm-vote-btn${votes[post.id] === "down" ? " comm-vote-active-down" : ""}`} onClick={() => vote(post.id, "down")}>{"\u25BC"}</button>
            </div>
            <div className="comm-post-body">
              <div className="comm-post-header">
                <span className="comm-post-author">{post.isUserPost ? "You (anonymous)" : post.author}</span>
                <span className="comm-post-time">{postTime}</span>
              </div>
              <p className="comm-post-text">{post.text}</p>
              <div className="comm-post-footer">
                <div className="comm-post-actions">
                  {!isReply && (
                    <button className="comm-reply-btn" onClick={() => { setReplyingTo(post.id); setShowCompose(true); haptic(); }}>
                      {"\u{1F4AC}"} Reply
                    </button>
                  )}
                  <span className={`comm-bookmark${bookmarks.includes(post.id) ? " comm-bookmark-active" : ""}`} onClick={() => toggleBookmark(post.id)}>
                    {bookmarks.includes(post.id) ? "\u{1F516}" : "\u{1F3F7}"}
                  </span>
                  {!post.isUserPost && (
                    <span className="comm-report" onClick={() => {
                      if (communityMod.LIVE_COMMUNITY) communityMod.reportPost(post.id);
                      haptic();
                    }} title="Report" style={{ fontSize: 12, opacity: 0.4, cursor: "pointer", marginLeft: 4 }}>
                      {"\u{1F6A9}"}
                    </span>
                  )}
                </div>
              </div>
              <div className="comm-reactions">
                {COMMUNITY_REACTIONS.map((r) => {
                  const active = (reactions[post.id] || []).includes(r.type);
                  return (
                    <button key={r.type} className={`comm-reaction-btn${active ? " comm-reaction-active" : ""}`} onClick={() => toggleReaction(post.id, r.type)} title={r.label}>
                      {r.emoji}
                    </button>
                  );
                })}
              </div>
              {(showSaved || showMyPosts) && post.topicId && (
                <div className="comm-post-topic-tag">{findTopic(post.topicId)?.title}</div>
              )}
            </div>
          </div>
        </div>
        {postReplies.length > 0 && postReplies.map((r) => renderPost(r, true))}
      </div>
    );
  }

  // Saved posts view
  if (showSaved) {
    const savedPosts = bookmarks.map(getPostById).filter(Boolean);
    return (
      <div className="screen active">
        <div style={{ padding: "8px 16px 0" }}>
          <button className="comm-back" onClick={() => setShowSaved(false)}>{"\u2190"} Back to Community</button>
        </div>
        <div className="comm-header"><h2>Saved posts</h2></div>
        <div className="comm-posts">
          {savedPosts.length === 0 && <p className="comm-empty">Tap {"\u{1F3F7}"} on any post to save it here.</p>}
          {savedPosts.map((p) => renderPost(p, false))}
        </div>
      </div>
    );
  }

  // My posts view
  if (showMyPosts) {
    const myAll = [...userPosts, ...replies.filter((r) => r.isUserPost)];
    return (
      <div className="screen active">
        <div style={{ padding: "8px 16px 0" }}>
          <button className="comm-back" onClick={() => setShowMyPosts(false)}>{"\u2190"} Back to Community</button>
        </div>
        <div className="comm-header"><h2>My posts</h2></div>
        <div className="comm-posts">
          {myAll.length === 0 && <p className="comm-empty">Your anonymous posts will appear here.</p>}
          {myAll.map((p) => renderPost(p, !!p.parentId))}
        </div>
      </div>
    );
  }

  // Topic detail view
  if (activeTopic) {
    const topic = findTopic(activeTopic);
    if (!topic) { setActiveTopic(null); return null; }
    const topicUserPosts = userPosts.filter((p) => p.topicId === activeTopic);
    const curatedPosts = topic.posts || [];
    const topLevel = [...topicUserPosts, ...curatedPosts].filter((p) => !p.parentId);
    const sorted = sortPosts(topLevel, sortMode, votes);
    return (
      <div className="screen active">
        <div style={{ padding: "8px 16px 0" }}>
          <button className="comm-back" onClick={() => { setActiveTopic(null); setSortMode("hot"); }}>{"\u2190"} Back to Community</button>
        </div>
        <div className="comm-topic-header">
          <span className="comm-topic-icon">{topic.icon}</span>
          <div>
            <h3 className="comm-topic-title">{topic.title}</h3>
            <p className="comm-topic-desc">{topic.description}</p>
            {topic.tags && topic.tags.length > 0 && (
              <div className="comm-topic-tags">{topic.tags.map((t) => <span key={t} className="comm-topic-tag-pill">{t}</span>)}</div>
            )}
          </div>
        </div>
        {topic.resources && topic.resources.length > 0 && (
          <div className="comm-resources">
            <div className="section-label" style={{ padding: "0 0 6px" }}>Resources</div>
            {topic.resources.map((res, i) => (
              <div key={i} className="comm-resource-row">
                <span>{res.type === "tip" ? "\u{1F4A1}" : res.type === "article" ? "\u{1F4D6}" : "\u{1F3A5}"}</span>
                <span>{res.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="comm-sort-tabs">
          {["hot", "new", "top"].map((m) => (
            <button key={m} className={`comm-sort-tab${sortMode === m ? " comm-sort-active" : ""}`} onClick={() => setSortMode(m)}>
              {m === "hot" ? "\u{1F525} Hot" : m === "new" ? "\u{1F552} New" : "\u2B06 Top"}
            </button>
          ))}
        </div>
        <div className="comm-posts">
          {sorted.length === 0 && <p className="comm-empty">No posts yet. Be the first to share!</p>}
          {sorted.map((p) => renderPost(p, false))}
        </div>
        <div className="comm-compose-btn" onClick={() => { setReplyingTo(null); setShowCompose(true); haptic(); }}>
          <span>{"\u{1F4AC}"}</span> Share your experience anonymously
        </div>
        {showCompose && (
          <div className="comm-compose-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowCompose(false); setReplyingTo(null); } }}>
            <div className="comm-compose-card">
              <div className="comm-compose-header">
                <button onClick={() => { setShowCompose(false); setReplyingTo(null); }}>Cancel</button>
                <strong>{replyingTo ? "Reply anonymously" : "Share anonymously"}</strong>
                <button onClick={replyingTo ? submitReply : submitPost} disabled={!composeText.trim()} className="comm-compose-submit">Post</button>
              </div>
              <textarea
                className="comm-compose-input"
                placeholder={replyingTo ? "Write your reply..." : "Share what's helped you, or just let it out..."}
                value={composeText}
                onChange={(e) => setComposeText(e.target.value.slice(0, COMMUNITY_POST_MAX_CHARS))}
                rows={5}
                autoFocus
              />
              {moderationError && (
                <div style={{ color: "#e74c3c", fontSize: 13, padding: "6px 0", fontWeight: 500 }}>
                  Post not allowed: {moderationError}
                </div>
              )}
              <div className="comm-compose-counter">{composeText.length}/{COMMUNITY_POST_MAX_CHARS}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Topic list view
  const allTopics = [
    ...COMMUNITY_TOPICS.map((t) => ({ ...t, isPinned: true })),
    ...userTopics.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  ];
  return (
    <div className="screen active">
      <div className="comm-header">
        <div className="comm-header-row">
          <h2>Community</h2>
          <div className="comm-header-actions">
            <button className="comm-header-btn" onClick={() => setShowSaved(true)}>{"\u{1F516}"} Saved</button>
            <button className="comm-header-btn" onClick={() => setShowMyPosts(true)}>{"\u{1F4DD}"} My Posts</button>
          </div>
        </div>
        <p>You're not alone in this. Connect with women on the same journey.</p>
      </div>

      {!guidelinesSeen && (
        <div className="comm-guidelines">
          <div className="comm-guidelines-text">
            <div style={{ fontSize: 28, marginBottom: 8 }}>{"\u{1F33F}"}</div>
            <strong>Welcome to our community</strong>
            <p style={{ margin: "8px 0", lineHeight: 1.5 }}>Thousands of women are navigating this journey together. Here's how it works:</p>
            <div style={{ textAlign: "left", fontSize: 13, lineHeight: 1.7 }}>
              <div>{"\u{1F49A}"} <strong>Safe & anonymous</strong> — your identity is never shared</div>
              <div>{"\u{1F91D}"} <strong>Be kind</strong> — every experience is valid</div>
              <div>{"\u{1F4AC}"} <strong>Share what helps</strong> — your story could help someone else</div>
              <div>{"\u{26A0}\uFE0F"} <strong>Not medical advice</strong> — always consult your provider</div>
            </div>
          </div>
          <button className="comm-guidelines-dismiss" onClick={() => { setGuidelinesSeen(true); haptic(); }}>Join the conversation</button>
        </div>
      )}

      <div className="comm-stat-bar">
        <div className="comm-banner-text">
          Women in perimenopause and menopause sharing what actually helps
        </div>
      </div>

      <div className="comm-topics">
        <div className="section-label" style={{ padding: "0 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Discussion topics</span>
          <button className="comm-new-topic-btn" onClick={() => setShowCreateTopic(true)}>+ New Topic</button>
        </div>
        {allTopics.map((topic) => {
          const topicUserPosts = userPosts.filter((p) => p.topicId === topic.id);
          const postCount = (topic.posts?.length || 0) + topicUserPosts.length;
          return (
            <div key={topic.id} className="comm-topic-row" onClick={() => setActiveTopic(topic.id)}>
              <span className="comm-row-icon">{topic.icon}</span>
              <div className="comm-row-info">
                <div className="comm-row-title">
                  {topic.isPinned && <span className="comm-pin">{"\u{1F4CC}"}</span>}
                  {topic.title}
                </div>
                <div className="comm-row-desc">{topic.description}</div>
                {topic.tags && topic.tags.length > 0 && (
                  <div className="comm-topic-tags">{topic.tags.map((t) => <span key={t} className="comm-topic-tag-pill">{t}</span>)}</div>
                )}
              </div>
              <div className="comm-row-count">{postCount}</div>
            </div>
          );
        })}
      </div>

      {showCreateTopic && (
        <div className="comm-compose-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateTopic(false); }}>
          <div className="comm-compose-card">
            <div className="comm-compose-header">
              <button onClick={() => setShowCreateTopic(false)}>Cancel</button>
              <strong>New topic</strong>
              <button onClick={submitTopic} disabled={!topicForm.title.trim()} className="comm-compose-submit">Create</button>
            </div>
            <div className="comm-topic-form">
              <div className="comm-emoji-picker">
                <label>Choose an icon</label>
                <div className="comm-emoji-grid">
                  {TOPIC_EMOJI_OPTIONS.map((e) => (
                    <button key={e} className={`comm-emoji-opt${topicForm.icon === e ? " comm-emoji-selected" : ""}`} onClick={() => setTopicForm((f) => ({ ...f, icon: e }))}>{e}</button>
                  ))}
                </div>
              </div>
              <input className="comm-compose-input comm-topic-title-input" placeholder="Topic title" maxLength={TOPIC_TITLE_MAX}
                value={topicForm.title} onChange={(e) => setTopicForm((f) => ({ ...f, title: e.target.value }))} />
              <textarea className="comm-compose-input" placeholder="Description (optional)" rows={2}
                value={topicForm.description} onChange={(e) => setTopicForm((f) => ({ ...f, description: e.target.value.slice(0, TOPIC_DESC_MAX) }))} />
              <div className="comm-tag-picker">
                {TOPIC_TAG_OPTIONS.map((tag) => (
                  <button key={tag} className={`comm-tag-btn${topicForm.tags.includes(tag) ? " comm-tag-active" : ""}`}
                    onClick={() => setTopicForm((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag] }))}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

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
      {/* Slim top header — wordmark only */}
      <div className="nav">
        <div className="nav-logo">
          Ve<em>la</em>
        </div>
      </div>

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

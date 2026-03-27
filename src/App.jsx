import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

function haptic(style = "Light") {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle[style] }).catch(() => {});
  }
}

const SYMPTOM_CATEGORIES = [
  { key: "common", label: "Most common" },
  { key: "mood", label: "Mood & cognitive" },
  { key: "physical", label: "Physical" },
  { key: "intimate", label: "Intimate health" },
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

function getStreak(logs) {
  if (logs.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  const freezes = (() => { try { return JSON.parse(localStorage.getItem("vela_streak_freezes") || "[]"); } catch { return []; } })();
  for (let i = 0; i <= 120; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const hasLog = logs.some((l) => l.date.slice(0, 10) === dayStr);
    const isFrozen = freezes.includes(dayStr);
    if (hasLog) streak++;
    else if (isFrozen && i > 0) streak++; // freeze counts as a streak day
    else if (i > 0) break;
    else break; // today with no log and no freeze
  }
  return streak;
}

function useStreakFreeze() {
  const today = new Date().toISOString().slice(0, 10);
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
  const expPriority = concerns.flatMap((c) => concernToExp[c] || []);

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
    journeyStage: profile ? getJourneyLabel(profile.journeyIndex) : null
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
  "What patterns do you see?"
];

const PERSONALIZED_TIPS = [
  { match: (d) => d.triggerReport?.some((t) => t.impact === "worsens" && t.triggerName.includes("caffeine")), tip: "Your data shows a possible link between caffeine and more symptoms. While clinical evidence on trigger avoidance is limited, your personal patterns are worth discussing with your provider." },
  { match: (d) => d.triggerReport?.some((t) => t.impact === "worsens" && t.triggerName.includes("alcohol")), tip: "Your data suggests more symptoms on days with alcohol. Individual responses vary — consider discussing what you're seeing in your logs with your healthcare provider." },
  { match: (d) => d.triggerReport?.some((t) => t.impact === "helps" && t.triggerName.includes("exercise")), tip: "Your data shows fewer symptoms on active days. Exercise has strong evidence for improving mood during menopause, and your logs suggest it may be helping you too!" },
  { match: (d) => d.trend?.direction === "improving", tip: "You're trending in a positive direction! Whatever changes you've made recently are working. Keep up your current routine." },
  { match: (d) => d.trend?.direction === "worse", tip: "Your symptoms have been a bit more intense lately. This is normal — menopause isn't linear. Consider tracking what changed recently and discussing with your healthcare provider." },
  { match: (d) => d.bestDay?.avgMood >= 7, tip: `Your best days tend to be ${d => d.bestDay?.day}s. Try scheduling important tasks or self-care activities on those days when you tend to feel your best.` },
  { match: (d) => d.avgMood < 5, tip: "Your mood has been lower than usual. Remember: hormonal changes directly affect neurotransmitters. Be gentle with yourself, and consider talking to your healthcare provider if it persists." },
  { match: () => true, tip: "Consistency in tracking helps spot patterns faster. Even on good days, a quick log helps Vela understand your full picture." }
];

function matchQuestion(input) {
  const lower = input.toLowerCase().trim();
  const SYMPTOM_NAMES = ["hot flash", "night sweat", "brain fog", "fatigue", "joint pain", "anxiety", "mood swing", "insomnia", "headache", "weight gain", "bloating", "heart palpitation", "dry skin", "hair", "libido", "memory", "irritability", "depression", "nausea", "dizziness"];
  const TRIGGER_NAMES = ["caffeine", "alcohol", "exercise", "sleep", "stress", "sugar", "spicy", "smoking"];

  for (const symptom of SYMPTOM_NAMES) {
    if (lower.includes(symptom)) return { handler: "symptomTrend", param: symptom };
  }
  for (const trigger of TRIGGER_NAMES) {
    if (lower.includes(trigger)) return { handler: "triggerImpact", param: trigger };
  }
  if (/trigger|worst|cause|why|making.*worse/.test(lower)) return { handler: "triggers" };
  if (/better|worse|improv|progress|trend|getting/.test(lower)) return { handler: "trend" };
  if (/doctor|appointment|visit|tell.*doc|prepare/.test(lower)) return { handler: "doctor" };
  if (/best.*day|worst.*day|day.*week|monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(lower)) return { handler: "bestWorstDays" };
  if (/week|how.*doing|overview|summary|recap/.test(lower)) return { handler: "recent" };
  if (/pattern|notice|see|insight|find/.test(lower)) return { handler: "patterns" };
  return { handler: "recent" };
}

function generateResponse(handler, logs, profile) {
  const stage = profile ? getJourneyLabel(profile.journeyIndex) : null;
  const stageNote = stage ? ` During ${stage}, this is quite common.` : "";

  if (handler.handler === "symptomTrend") {
    const data = analyzeSymptomTrend(logs, handler.param);
    if (data.recentCount === 0 && data.prevCount === 0) return `I haven't seen ${handler.param} in your recent logs. That's actually great news! If it does come up, I'll be tracking it.`;
    const trendWord = data.trend === "increasing" ? "more frequently" : data.trend === "decreasing" ? "less often — that's encouraging!" : "at about the same rate";
    return `Looking at your ${handler.param} pattern: you've logged it ${data.recentCount} times in the last 2 weeks, compared to ${data.prevCount} the 2 weeks before. It's appearing ${trendWord}${stageNote} ${data.recentSev > 0 ? `Average severity has been around ${data.recentSev}/10.` : ""}`;
  }

  if (handler.handler === "triggerImpact") {
    const data = analyzeTriggerImpact(logs, handler.param);
    if (data.daysWithTrigger === 0) return `I don't have enough data on ${handler.param} yet. Try logging it when it comes up, and I'll analyze the impact!`;
    if (data.impact === "worsens") return `Here's what your data shows: on days with ${handler.param}, you average ${data.avgSymptomsWith} symptoms compared to ${data.avgSymptomsWithout} without it. Your mood also tends to be ${data.avgMoodWith < data.avgMoodWithout ? "lower" : "about the same"} (${data.avgMoodWith} vs ${data.avgMoodWithout}). Note: clinical research on individual triggers is limited, but your personal data is valuable — consider sharing these patterns with your healthcare provider.${stageNote}`;
    if (data.impact === "helps") return `Your data suggests ${handler.param} may be helping you. On those days, you average ${data.avgSymptomsWith} symptoms vs ${data.avgSymptomsWithout} without it, and your mood tends to be ${data.avgMoodWith > data.avgMoodWithout ? "better" : "similar"}. Individual responses vary, but this is a pattern worth noting!`;
    return `${handler.param} doesn't show a strong correlation either way in your data. You average ${data.avgSymptomsWith} symptoms with it and ${data.avgSymptomsWithout} without. Keep logging and I'll watch for patterns.`;
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
    return msg + stageNote;
  }

  if (handler.handler === "trend") {
    const data = analyzeOverallTrend(logs);
    if (data.recentDays < 3) return "I need a few more days of data to spot a reliable trend. Keep logging!";
    if (data.direction === "improving") return `Great news — you're trending better! Your symptoms have decreased from an average of ${data.prevSymptoms}/day to ${data.recentSymptoms}/day, and your mood has ${data.recentMood > data.prevMood ? `improved from ${data.prevMood} to ${data.recentMood}` : "held steady"}. Whatever you're doing, it's working!`;
    if (data.direction === "worse") return `I want to be honest with you: the last 2 weeks have been a bit tougher. Symptoms went from ${data.prevSymptoms}/day to ${data.recentSymptoms}/day${data.recentMood < data.prevMood ? `, and mood dipped from ${data.prevMood} to ${data.recentMood}` : ""}.${stageNote} Remember, this journey isn't linear — symptom fluctuation is expected during the menopausal transition. If this continues, consider discussing your logs with your healthcare provider.`;
    return `Things are holding steady — ${data.recentSymptoms} symptoms/day on average, mood around ${data.recentMood}. Stability is actually a good sign!${stageNote}`;
  }

  if (handler.handler === "doctor") {
    const data = generateDoctorSummary(logs, profile);
    let msg = "Here's what I'd suggest bringing to your doctor:\n\n";
    if (data.points.length > 0) msg += data.points.map((p) => `• ${p}`).join("\n") + "\n\n";
    if (data.correlations.length > 0) msg += `Key patterns: ${data.correlations.slice(0, 2).map((c) => c.text).join("; ")}\n\n`;
    if (data.trend) msg += `Overall trend: ${data.trend.direction} (${data.trend.recentSymptoms} symptoms/day recently vs ${data.trend.prevSymptoms} before)\n\n`;
    if (data.questions.length > 0) msg += "Questions to ask:\n" + data.questions.map((q) => `• ${q}`).join("\n");
    return msg;
  }

  if (handler.handler === "bestWorstDays") {
    const data = analyzeBestWorstDays(logs);
    if (data.stats.length < 3) return "I need data from more days of the week to give you a reliable breakdown. Keep logging!";
    let msg = "";
    if (data.best) msg += `Your best day tends to be ${data.best.day} (avg mood: ${data.best.avgMood}, avg symptoms: ${data.best.avgSymptoms}). `;
    if (data.worst && data.worst.day !== data.best?.day) msg += `${data.worst.day}s tend to be tougher (avg mood: ${data.worst.avgMood}, avg symptoms: ${data.worst.avgSymptoms}). `;
    msg += "Try planning self-care or lighter schedules on your harder days.";
    return msg;
  }

  if (handler.handler === "patterns") {
    const patterns = analyzePatterns(logs);
    if (patterns.length === 0) return "I haven't spotted strong patterns yet. The more consistently you log, the faster I can find connections. Even quick logs on good days help!";
    return `Here's what I've noticed:\n\n${patterns.slice(0, 3).map((p) => `• ${p}`).join("\n")}\n\nThese patterns are based on your personal data — everyone's experience is unique.${stageNote}`;
  }

  // recent / fallback
  const data = analyzeRecentPattern(logs);
  if (!data) return "I don't have any data from this week yet. Log how you're feeling today and I'll start building your picture!";
  let msg = `Here's your week so far (${data.daysLogged} days logged):\n\n`;
  if (data.avgMood) msg += `Mood: ${data.avgMood}/10 average\n`;
  if (data.topSymptoms.length > 0) msg += `Top symptoms: ${data.topSymptoms.map((s) => `${s.name} (${s.count}x)`).join(", ")}\n`;
  if (data.topContext && data.topContext.length > 0) msg += `Context factors: ${data.topContext.map((t) => `${t.name} (${t.count}x)`).join(", ")}\n`;
  if (data.bestDay) msg += `\nBest day: ${new Date(data.bestDay.date).toLocaleDateString("en-US", { weekday: "long" })} (mood: ${data.bestDay.mood})`;
  return msg + stageNote;
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
    tip: tip ? tip.tip : PERSONALIZED_TIPS[PERSONALIZED_TIPS.length - 1].tip
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
  { level: 1, name: "Newcomer", xpNeeded: 0 },
  { level: 2, name: "Explorer", xpNeeded: 50 },
  { level: 3, name: "Tracker", xpNeeded: 150 },
  { level: 4, name: "Pattern Finder", xpNeeded: 350 },
  { level: 5, name: "Insightful", xpNeeded: 600 },
  { level: 6, name: "Dedicated", xpNeeded: 1000 },
  { level: 7, name: "Empowered", xpNeeded: 1500 },
  { level: 8, name: "Advocate", xpNeeded: 2200 },
  { level: 9, name: "Mentor", xpNeeded: 3000 },
  { level: 10, name: "Vela Master", xpNeeded: 4000 },
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

function computeXP(logs) {
  let xp = 0;
  xp += logs.length * 10; // 10 XP per log
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  xp += uniqueDays * 5; // 5 XP bonus per unique day
  const streak = getStreak(logs);
  xp += Math.min(streak, 60) * 3; // 3 XP per streak day (cap at 60)
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
  }

  @media (prefers-color-scheme: dark) {
    :root {
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
    }
    .nav, .nav-tabs { background: #1A1412 !important; }
    .symptom-tile, .q-opt, .q-card, .notes-input, .ctx-step-btn, .ctx-dot, .ctx-pill,
    .settings-card, .weekly-summary, .trend-card, .symptom-list, .patterns-card,
    .comparison-card, .chart-container, .chart-toggle-btn, .reminder-time-input,
    .streak-milestone, .settings-danger-btn, .insight-callout, .prediction-card,
    .note-chip, .symptom-filter, .comm-reaction-btn, .comm-header-btn,
    .comm-compose-input, .comm-compose-card, .comm-emoji-opt, .comm-tag-btn,
    .comm-sort-tab, .chat-text, .chat-chip, .chat-input, .digest-card,
    .gamification-bar, .gam-badge, .exp-card, .lesson-card,
    .add-symptom-card, .add-symptom-input, .milestone-card,
    .symptom-cat-tab, .active-symptom-chip, .energy-chip,
    .cbt-card, .cbt-program-item, .cbt-lesson-done-btn, .nudge-card {
      background: var(--card-bg) !important;
    }
    .milestone-card { border-color: var(--sage-light) !important; background: var(--sage-light) !important; }
    .chat-bubble.user .chat-text { background: var(--clay) !important; }
    .digest-spotlight { background: var(--sage-light) !important; }
    .digest-tip { background: var(--sage-light) !important; }
    .comm-guidelines-dismiss { background: var(--card-bg) !important; color: var(--sage-dark) !important; }
    .comm-compose-overlay { background: rgba(0,0,0,0.6) !important; }
    .comm-reaction-active { background: var(--sage-light) !important; }
    .comm-sort-active { background: var(--clay) !important; color: white !important; }
    .comm-emoji-selected { background: var(--clay-light) !important; }
    .symptom-tile.active { background: var(--clay-light) !important; }
    .symptom-cat-tab.active { background: var(--sage) !important; color: white !important; border-color: var(--sage) !important; }
    .active-symptom-chip { background: var(--clay-light) !important; color: var(--clay) !important; border-color: var(--clay) !important; }
    .energy-chip.active { background: var(--sage-light) !important; border-color: var(--sage) !important; }
    .cbt-lesson-header:active { background: rgba(255,255,255,0.05) !important; }
    .cbt-program-item:active { background: var(--sage-light) !important; }
    .ctx-dot.active { background: var(--clay-light) !important; }
    .ctx-pill.on { background: var(--sage-light) !important; }
    .streak-milestone.earned { background: var(--sage) !important; }
    .chart-toggle-btn.active { background: var(--clay) !important; }
    .q-opt.selected { background: var(--clay) !important; color: white !important; }
    .nav-tab.active { background: var(--clay) !important; }
    .wb-face { background: rgba(255,255,255,0.08) !important; }
    .wb-face.selected { background: rgba(255,255,255,0.2) !important; }
    svg text { fill: var(--ink-light); }
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
    padding: 5px 8px;
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
    background: white; cursor: pointer; transition: all 0.15s; gap: 4px;
  }
  .energy-chip:active { transform: scale(0.94); }
  .energy-chip.active { border-color: var(--sage); background: var(--sage-light); }
  .energy-icon { font-size: 20px; }
  .energy-label { font-size: 10px; font-weight: 500; color: var(--ink-light); text-align: center; }
  .energy-chip.active .energy-label { color: var(--sage-dark); font-weight: 600; }

  .symptoms-section { margin: 14px 16px 0; }
  .symptom-filter {
    width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--ink); background: white;
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
    font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--border); background: white;
    color: var(--ink-light); cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .symptom-cat-tab:active { transform: scale(0.96); }
  .symptom-cat-tab.active {
    background: var(--sage); color: white; border-color: var(--sage);
  }

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
    background: white; border: 1.5px solid var(--border);
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
    background: white; border: 1.5px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 500; color: var(--ink-light);
    cursor: pointer; transition: all 0.15s;
  }
  .ctx-dot.active { background: var(--clay-light); border-color: var(--clay); color: var(--clay-dark); }
  .ctx-pills { display: flex; gap: 8px; margin-top: 12px; }
  .ctx-pill {
    flex: 1; padding: 10px 8px; border-radius: 10px;
    background: white; border: 1.5px solid var(--border);
    text-align: center; font-size: 13px; font-weight: 500;
    color: var(--ink); cursor: pointer; transition: all 0.15s;
  }
  .ctx-pill.on { background: rgba(122,158,135,0.12); border-color: var(--sage); color: var(--sage-dark); }

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
  .note-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .note-chip {
    font-size: 12px; padding: 5px 10px; border-radius: 14px; cursor: pointer;
    border: 1px solid var(--border); color: var(--ink-mid); background: white;
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
  .sym-trend { font-size: 11px; margin-left: 4px; font-weight: 600; }
  .sym-trend.up { color: var(--clay); }
  .sym-trend.down { color: var(--sage); }
  .sym-trend.same { color: var(--ink-light); }

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
    background: white; outline: none;
  }
  .reminder-time-input:focus { border-color: var(--clay); }

  /* SVG Charts */
  .chart-container { margin: 12px 16px 0; background: white; border-radius: var(--radius); padding: 18px; border: 1px solid var(--border); }
  .chart-container svg { width: 100%; height: auto; display: block; }
  .chart-toggle { display: flex; gap: 4px; }
  .chart-toggle-btn { font-size: 11px; font-weight: 500; padding: 4px 12px; border-radius: 12px; border: 1px solid var(--border); background: white; color: var(--ink-light); cursor: pointer; font-family: 'DM Sans', sans-serif; }
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
    display: flex; gap: 12px; margin: 16px 16px 0; padding: 14px 16px;
    background: linear-gradient(135deg, var(--sage), var(--sage-dark)); border-radius: var(--radius);
  }
  .comm-stat { flex: 1; text-align: center; }
  .comm-stat-value { font-family: 'DM Serif Display', serif; font-size: 22px; color: white; }
  .comm-stat-label { font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 2px; }

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
    background: white; border: 1px solid var(--sage); border-radius: var(--radius-sm);
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
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
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
    resize: none; background: white; color: var(--ink); box-sizing: border-box;
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
    border-radius: var(--radius-sm); background: white; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .comm-emoji-opt:active { transform: scale(0.9); }
  .comm-emoji-selected { border-color: var(--clay); background: var(--clay-light); }

  .comm-tag-picker { display: flex; flex-wrap: wrap; gap: 6px; }
  .comm-tag-btn {
    font-size: 12px; padding: 4px 10px; border-radius: 12px;
    border: 1px solid var(--border); background: white; color: var(--ink-mid);
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
    border: 1.5px solid var(--border); color: var(--ink-light); background: white;
  }
  .streak-milestone.earned {
    background: var(--sage); border-color: var(--sage); color: white; font-size: 11px;
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

  /* ── PATTERNS CARD ── */
  .patterns-card {
    margin: 14px 16px 0;
    background: white;
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
    background: white;
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
    background: white;
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

  /* ─── AI Companion Chat ─── */
  .companion-container { display: flex; flex-direction: column; height: calc(100vh - 180px); margin: 0 16px; }
  .companion-header { display: flex; align-items: center; gap: 10px; padding: 12px 0 8px; }
  .companion-name { font-family: 'DM Serif Display', serif; font-size: 15px; color: var(--ink); }
  .companion-sub { font-size: 11px; color: var(--ink-light); }
  .chat-messages { flex: 1; overflow-y: auto; padding: 8px 0; display: flex; flex-direction: column; gap: 12px; }
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
  .gam-level-badge { display: flex; flex-direction: column; align-items: center; min-width: 48px; }
  .gam-level-num { font-family: 'DM Serif Display', serif; font-size: 16px; color: var(--clay); line-height: 1; }
  .gam-level-name { font-size: 9px; color: var(--ink-light); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
  .gam-xp-section { flex: 1; }
  .gam-xp-bar-bg { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
  .gam-xp-bar { height: 100%; background: linear-gradient(90deg, var(--clay), var(--sage)); border-radius: 4px; transition: width 0.6s ease; }
  .gam-xp-label { font-size: 10px; color: var(--ink-light); margin-top: 2px; }
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
  .gam-badge-name { font-size: 11px; font-weight: 600; color: var(--ink); line-height: 1.2; }
  .gam-badge-desc { font-size: 9px; color: var(--ink-light); line-height: 1.3; margin-top: 2px; }

  @keyframes badgeEarned { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
  .gam-badge.earned { animation: badgeEarned 0.4s ease; }

  .badge-toast { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 9999; background: var(--sage); color: white; padding: 10px 20px; border-radius: 20px; display: flex; align-items: center; gap: 10px; font-size: 14px; font-family: 'DM Sans', sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.25); animation: toastSlide 0.4s ease, toastFade 0.4s ease 2.6s forwards; }
  .badge-toast-icon { font-size: 24px; }
  .badge-toast-text { font-weight: 500; }
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
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [multiSelected, setMultiSelected] = useState([]);
  const [transitioning, setTransitioning] = useState(false);

  const q = QUESTIONS[qIndex];
  const progress = ((qIndex + 1) / QUESTIONS.length) * 100;
  const isLast = qIndex === QUESTIONS.length - 1;
  const isMulti = !!q.multi;

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
      onComplete(answers);
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

  const canContinue = isMulti ? multiSelected.length > 0 : selected !== null;

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

function TrackerScreen({ onLog, logs, profile, isPremium, onNavigate }) {
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
  const [xpGain, setXpGain] = useState(0);
  const prevXpRef = useRef(null);

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
    ],
    5: [
      "Hormonal shifts can slow metabolism and increase abdominal bloating. Tracking helps distinguish patterns from daily variation.",
      "Many women gain 5-8 lbs during the menopausal transition. Strength training helps maintain muscle mass and metabolism.",
      "Bloating often correlates with dietary triggers. Note what you ate to identify connections in your logs.",
    ],
    6: [
      "Vaginal dryness affects over 50% of postmenopausal women. Tracking helps you discuss treatment options with your doctor.",
      "Declining estrogen affects libido through both physical and neurological pathways. Your logs capture the full picture.",
      "Many effective treatments exist for menopausal intimate symptoms. Consistent tracking strengthens conversations with your provider.",
    ],
    7: [
      "Heart palpitations during perimenopause can be related to hormonal fluctuations. Always discuss new or worsening palpitations with your doctor to rule out cardiac causes.",
      "Palpitations often coincide with hot flashes or anxiety. Your combined logs help your doctor evaluate the pattern.",
      "If palpitations are frequent, prolonged, or accompanied by dizziness or chest pain, seek medical evaluation promptly. Your log data helps your provider assess the pattern.",
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
          void xpTick; // ensure re-render reads fresh localStorage
          const xp = computeXP(logs);
          const lvl = getLevel(xp);
          // Track XP gains for flash animation
          if (prevXpRef.current === null) prevXpRef.current = xp;
          const gained = xp - prevXpRef.current;
          if (gained > 0 && gained !== xpGain) {
            setTimeout(() => { prevXpRef.current = xp; setXpGain(0); }, 2000);
            if (xpGain === 0) setTimeout(() => setXpGain(gained), 0);
          }
          return (
            <div className="gamification-bar">
              <div className="gam-level-badge">
                <span className="gam-level-num">Lv.{lvl.level}</span>
                <span className="gam-level-name">{lvl.name}</span>
              </div>
              <div className="gam-xp-section">
                <div className="gam-xp-bar-bg">
                  <div className="gam-xp-bar" style={{ width: `${lvl.pct}%`, transition: "width 0.6s ease" }} />
                </div>
                <div className="gam-xp-label">
                  {xpGain > 0 && <span className="xp-gain-flash">+{xpGain} XP </span>}
                  {lvl.isMax ? "MAX" : `${lvl.xp} XP · ${lvl.xpToNext} to next`}
                </div>
              </div>
              {streak > 0 && (
                <div className="gam-streak">🔥 {streak}</div>
              )}
            </div>
          );
        })()}
      </div>

      {(() => {
        const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
        if (uniqueDays >= 7) return null;
        const concernHint = personalization?.topConcernNames?.length > 0
          ? personalization.topConcernNames[0]
          : "symptom";
        const milestones = [
          { day: 0, title: "Welcome to Vela", text: `Log your first entry below — start with how you're feeling and any ${concernHint} you notice today.`, icon: "🌱" },
          { day: 1, title: "Day 1 complete!", text: `Great start! Come back tomorrow — tracking ${concernHint} consistently is the fastest way to spot what helps.`, icon: "✨" },
          { day: 2, title: "2 days tracked", text: `You're building momentum. Vela is already learning your ${concernHint} patterns.`, icon: "📊" },
          { day: 3, title: "3 days in!", text: "Halfway to your first weekly insight. Your data is starting to tell a story — keep going!", icon: "🌿" },
          { day: 4, title: "4 days strong", text: `Vela is finding connections in your data. A few more days reveals what triggers your ${concernHint}.`, icon: "🔍" },
          { day: 5, title: "5 days tracked", text: "Almost there! Two more days and Vela generates your first personalized insights.", icon: "🌟" },
          { day: 6, title: "6 days — so close!", text: "One more day unlocks your full weekly summary, trend charts, and pattern analysis!", icon: "🎯" },
        ];
        const m = milestones[uniqueDays] || milestones[0];
        return (
          <div className="milestone-card">
            <div className="milestone-icon">{m.icon}</div>
            <div className="milestone-content">
              <div className="milestone-title">{m.title}</div>
              <div className="milestone-text">{m.text}</div>
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

      {/* Insights nudge at day 7+ */}
      {(() => {
        const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
        const dismissed = localStorage.getItem("vela_insights_nudge_dismissed");
        if (uniqueDays >= 7 && uniqueDays <= 14 && !dismissed) {
          return (
            <div className="nudge-card" onClick={() => onNavigate && onNavigate("insights")}>
              <div className="nudge-icon">✨</div>
              <div className="nudge-content">
                <div className="nudge-title">Your patterns are ready!</div>
                <div className="nudge-text">You have {uniqueDays} days of data — tap to explore your insights and trends.</div>
              </div>
              <div className="nudge-dismiss" onClick={(e) => { e.stopPropagation(); localStorage.setItem("vela_insights_nudge_dismissed", "1"); haptic("Light"); }}>×</div>
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
                  <div className="nudge-text">Based on your {personalization.topConcernNames.length > 0 ? personalization.topConcernNames[0] : "symptom"} concerns, try an experiment or CBT program below.</div>
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
        const completedToday = lessonDone || completedLessons.includes(new Date().toISOString().slice(0, 10));
        if (lessonDone) {
          return (
            <div className="lesson-card completed" style={{ animation: "cardSlideIn 0.3s ease" }}>
              <div className="lesson-header">
                <div className="lesson-label">Daily insight</div>
                <div className="lesson-xp" style={{ color: "var(--sage)" }}>✓ +{todayLesson.xp} XP earned!</div>
              </div>
              <div className="lesson-title">{todayLesson.title}</div>
            </div>
          );
        }
        return (
          <div className={`lesson-card${completedToday ? " completed" : ""}`}>
            <div className="lesson-header">
              <div className="lesson-label">Daily insight</div>
              <div className="lesson-xp">{completedToday ? "✓ Done" : `+${todayLesson.xp} XP`}</div>
            </div>
            <div className="lesson-title">{todayLesson.title}</div>
            {!completedToday ? (
              <>
                <div className="lesson-text">{todayLesson.text}</div>
                <button className="lesson-btn" onClick={() => {
                  const updated = [...completedLessons, new Date().toISOString().slice(0, 10)];
                  localStorage.setItem("vela_completed_lessons", JSON.stringify(updated.slice(-30)));
                  haptic("Medium");
                  setLessonDone(true);
                  setXpTick((t) => t + 1); // triggers XP bar re-render
                }}>Got it! +{todayLesson.xp} XP</button>
              </>
            ) : (
              <div className="lesson-text" style={{ opacity: 0.6 }}>{todayLesson.text}</div>
            )}
          </div>
        );
      })()}

      {/* Active Experiment */}
      {(() => {
        const activeExp = JSON.parse(localStorage.getItem("vela_active_experiment") || "null");
        if (!activeExp) {
          return isPremium ? (
            <div className="exp-card exp-start" onClick={() => {
              const completed = JSON.parse(localStorage.getItem("vela_completed_experiments") || "[]");
              let available = EXPERIMENTS.filter((e) => !completed.includes(e.id));
              // Sort by user's concern-based priority
              if (personalization?.expPriority?.length > 0) {
                available.sort((a, b) => {
                  const aIdx = personalization.expPriority.indexOf(a.id);
                  const bIdx = personalization.expPriority.indexOf(b.id);
                  return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                });
              }
              if (available.length === 0) return;
              const exp = available[0];
              localStorage.setItem("vela_active_experiment", JSON.stringify({ ...exp, startDate: new Date().toISOString(), daysCompleted: 0 }));
              haptic("Medium");
              setXpTick((t) => t + 1);
            }}>
              <div className="exp-header">
                <span className="exp-icon">🧪</span>
                <span className="exp-label">Start an experiment</span>
              </div>
              <div className="exp-desc">Try a structured challenge and see how it affects your symptoms</div>
            </div>
          ) : null;
        }
        const daysSinceStart = Math.floor((new Date() - new Date(activeExp.startDate)) / 86400000);
        const progress = Math.min(daysSinceStart, activeExp.duration);
        const pct = Math.round((progress / activeExp.duration) * 100);
        const isComplete = progress >= activeExp.duration;
        return (
          <div className={`exp-card${isComplete ? " exp-complete" : ""}`}>
            <div className="exp-header">
              <span className="exp-icon">{activeExp.icon}</span>
              <span className="exp-title">{activeExp.title}</span>
              {isComplete && <span className="exp-badge">🎉 Complete!</span>}
            </div>
            <div className="exp-desc">{activeExp.desc}</div>
            <div className="exp-progress-row">
              <div className="exp-progress-bg">
                <div className="exp-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="exp-progress-label">Day {progress}/{activeExp.duration}</span>
            </div>
            {isComplete ? (
              <button className="exp-btn" onClick={() => {
                const completed = JSON.parse(localStorage.getItem("vela_completed_experiments") || "[]");
                completed.push(activeExp.id);
                localStorage.setItem("vela_completed_experiments", JSON.stringify(completed));
                localStorage.removeItem("vela_active_experiment");
                haptic("Medium");
                setXpTick((t) => t + 1);
              }}>Claim {activeExp.xpReward} XP & finish</button>
            ) : (
              <button className="exp-btn exp-abandon" onClick={() => {
                if (window.confirm("End this experiment early?")) {
                  localStorage.removeItem("vela_active_experiment");
                  setXpTick((t) => t + 1);
                }
              }}>End experiment</button>
            )}
          </div>
        );
      })()}

      {isPremium && (() => {
        const forecast = predictSymptoms(logs);
        if (forecast.predictions.length === 0 && forecast.moodForecast === null) return null;
        const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
        return (
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
            <span className={`ctx-value${sleepHours === null ? " unset" : ""}`}>
              {sleepHours === null ? "—" : `${sleepHours}h`}
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
    </div>
  );
}

// ─── History Screen ──────────────────────────────────────────────────────────

function HistoryScreen({ logs, isPremium, onShowPaywall }) {
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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);
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
    const dayStr = d.toISOString().slice(0, 10);
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
    const dayStr = d.toISOString().slice(0, 10);
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

// ─── Insights Screen ──────────────────────────────────────────────────────────

function InsightsScreen({ logs, profile, isPremium, onShowPaywall }) {
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

  const handleQuestion = (text) => {
    if (!text.trim() || isTyping) return;
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
    const dayStr = d.toISOString().slice(0, 10);
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
              <span className="ask-vela-lock">🔒</span>
              Ask Vela
            </button>
          )}
        </div>
      </div>

      {showCompanion && isPremium ? (
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
                      {digest.bestDay.mood && ` · Mood: ${digest.bestDay.mood}/10`}
                      {` · ${digest.bestDay.symptoms} symptoms`}
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
      {isPremium ? (
        <div className="cbt-section">
          {activeCBT ? (() => {
            const program = CBT_PROGRAMS.find((p) => p.id === activeCBT.programId);
            if (!program) return null;
            const startDate = new Date(activeCBT.startDate);
            const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / 86400000);
            const currentWeek = Math.min(Math.floor(daysSinceStart / 7), program.weeks - 1);
            const currentModule = program.modules[currentWeek];
            const completedLessons = activeCBT.completed || [];
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
                    <div className="cbt-complete-msg">🎉 Program complete! You've earned {program.xpReward} XP</div>
                    <button className="cbt-btn" onClick={() => {
                      const completed = JSON.parse(localStorage.getItem("vela_completed_cbt") || "[]");
                      completed.push(activeCBT.programId);
                      localStorage.setItem("vela_completed_cbt", JSON.stringify(completed));
                      localStorage.removeItem("vela_active_cbt");
                      setActiveCBT(null);
                      haptic("Medium");
                    }}>Finish & claim XP</button>
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
                    let programs = CBT_PROGRAMS.filter((prog) => !completed.includes(prog.id));
                    // Sort recommended programs first
                    if (p?.recommendedCBT?.length > 0) {
                      programs.sort((a, b) => {
                        const aRec = p.recommendedCBT.includes(a.id) ? 0 : 1;
                        const bRec = p.recommendedCBT.includes(b.id) ? 0 : 1;
                        return aRec - bRec;
                      });
                    }
                    return programs.map((program) => {
                      const isRecommended = p?.recommendedCBT?.includes(program.id);
                      return (
                        <div key={program.id} className={`cbt-program-item${isRecommended ? " recommended" : ""}`} onClick={() => {
                          const cbt = { programId: program.id, startDate: new Date().toISOString(), completed: [] };
                          setActiveCBT(cbt);
                          localStorage.setItem("vela_active_cbt", JSON.stringify(cbt));
                          setShowCBTList(false);
                          haptic("Medium");
                        }}>
                          <div className="cbt-program-icon">{program.icon}</div>
                          <div className="cbt-program-info">
                            {isRecommended && <div className="cbt-recommended-badge">Recommended for you</div>}
                            <div className="cbt-program-name">{program.title}</div>
                            <div className="cbt-program-meta">{program.subtitle} · {program.xpReward} XP</div>
                            <div className="cbt-program-desc">{program.desc}</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {JSON.parse(localStorage.getItem("vela_completed_cbt") || "[]").length > 0 && (
                    <div className="cbt-completed-note">✓ You've completed {JSON.parse(localStorage.getItem("vela_completed_cbt") || "[]").length} program(s)</div>
                  )}
                  <button className="cbt-btn cbt-abandon" onClick={() => setShowCBTList(false)}>Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="cbt-card cbt-teaser" onClick={onShowPaywall} style={{ margin: "12px 16px", cursor: "pointer" }}>
          <div className="cbt-card-header">
            <span className="cbt-card-icon">🧠</span>
            <div>
              <div className="cbt-card-title">CBT Programs <span style={{ fontSize: 11, color: "var(--ink-light)" }}>🔒 Premium</span></div>
              <div className="cbt-card-sub">Multi-week evidence-based programs for managing hot flashes, sleep, and anxiety</div>
            </div>
          </div>
        </div>
      )}

      {isPremium ? (
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
        <div className="unlock-card">
          <div className="unlock-tag">Premium</div>
          <div className="unlock-title">Unlock the full picture</div>
          <div className="unlock-body">
            Trend charts, pattern detection, symptom predictions, doctor visit prep, and unlimited history.
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
    { icon: "📊", title: "Trends & monthly comparisons", desc: "Symptom intensity charts with month-over-month insights" },
    { icon: "📋", title: "Doctor visit prep & reports", desc: "Auto-generated talking points and PDF exports for your provider" },
    { icon: "🤖", title: "Vela AI Companion", desc: "Ask questions about your health patterns and get personalized insights" },
    { icon: "📰", title: "Smart Weekly Digest", desc: "AI-powered weekly summary with trends, triggers, and tips" },
    { icon: "🔮", title: "Pattern detection & predictions", desc: "Discover symptom correlations and weekly predictions" },
    { icon: "📆", title: "Unlimited history", desc: "Access your complete tracking history, not just the last 7 days" },
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

// ─── Settings Screen ──────────────────────────────────────────────────────────

function SettingsScreen({ profile, logs, isPremium, onShowPaywall, onEditQuestion, onClearData, remindersEnabled, onToggleReminders, reminderTimes, onUpdateReminderTime }) {
  const journeyStage = profile ? getJourneyLabel(profile[0]) : "Not set";
  const guidanceLabels = ["Daily check-ins & reminders", "Weekly summaries", "Only when I ask", "Let the app decide"];
  const guidancePref = profile && profile[3] !== undefined && profile[3] !== null ? profile[3] : 3;
  const goalLabels = [
    "Understand my body",
    "Track for my doctor",
    "Find relief strategies",
    "Connect with others",
  ];
  const goal = profile ? (Array.isArray(profile[2]) ? profile[2].map((i) => goalLabels[i]).join(", ") : goalLabels[profile[2]]) : "Not set";

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
            <div className="settings-section-label">Your progress</div>
            <div className="settings-card">
              <div className="gam-profile">
                <div className="gam-profile-level">
                  <div className="gam-big-level">Lv.{lvl.level}</div>
                  <div className="gam-big-name">{lvl.name}</div>
                </div>
                <div className="gam-profile-stats">
                  <div className="gam-ps"><div className="gam-ps-val">{xp}</div><div className="gam-ps-label">XP</div></div>
                  <div className="gam-ps"><div className="gam-ps-val">{earned.length}</div><div className="gam-ps-label">badges</div></div>
                  <div className="gam-ps"><div className="gam-ps-val">{stats.streak}</div><div className="gam-ps-label">streak</div></div>
                </div>
                {!lvl.isMax && (
                  <div style={{ marginTop: 8 }}>
                    <div className="gam-xp-bar-bg" style={{ height: 6 }}>
                      <div className="gam-xp-bar" style={{ width: `${lvl.pct}%` }} />
                    </div>
                    <div className="gam-xp-label" style={{ fontSize: 11 }}>{lvl.xpToNext} XP to Level {lvl.level + 1}</div>
                  </div>
                )}
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
                          if (useStreakFreeze()) { haptic("Medium"); window.location.reload(); }
                          else alert("No freezes available or already used today.");
                        }}>Use today</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="settings-card" style={{ marginTop: 8 }}>
              <div className="gam-badges-title">Badges ({earned.length}/{BADGES.length})</div>
              <div className="gam-badges-grid">
                {earned.map((b) => (
                  <div key={b.id} className="gam-badge earned">
                    <div className="gam-badge-icon">{b.icon}</div>
                    <div className="gam-badge-name">{b.name}</div>
                    <div className="gam-badge-desc">{b.desc}</div>
                  </div>
                ))}
                {locked.map((b) => (
                  <div key={b.id} className="gam-badge locked">
                    <div className="gam-badge-icon">🔒</div>
                    <div className="gam-badge-name">{b.name}</div>
                    <div className="gam-badge-desc">{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>
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
        if (!hasExperiment && uniqueDays >= 3) steps.push({ icon: "🧪", text: p?.topConcernNames?.[0] ? `Try an experiment for your ${p.topConcernNames[0]}` : "Start a self-experiment to test what helps", action: "today" });
        if (!hasCBT && uniqueDays >= 5 && p?.recommendedCBT?.length > 0) steps.push({ icon: "🧠", text: "Start a recommended CBT program", action: "today" });
        if (completedLessons < 3) steps.push({ icon: "💡", text: "Complete today's daily insight for bonus XP", action: "today" });
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
    haptic("Medium");
    setUserPosts((prev) => [{
      id: `user-${Date.now()}`, author: "Anonymous", time: new Date().toISOString(),
      text: composeText.trim(), upvotes: 0, topicId: activeTopic, isUserPost: true,
    }, ...prev]);
    setComposeText("");
    setShowCompose(false);
    setReplyingTo(null);
  }

  function submitReply() {
    if (!composeText.trim() || !replyingTo) return;
    haptic("Medium");
    setReplies((prev) => [...prev, {
      id: `reply-${Date.now()}`, author: "Anonymous", time: new Date().toISOString(),
      text: composeText.trim(), upvotes: 0, topicId: activeTopic,
      parentId: replyingTo, isUserPost: true,
    }]);
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
        <div className="comm-stat">
          <div className="comm-stat-value">12,847</div>
          <div className="comm-stat-label">women tracking</div>
        </div>
        <div className="comm-stat">
          <div className="comm-stat-value">847</div>
          <div className="comm-stat-label">shared today</div>
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
  const [toastMsg, setToastMsg] = useState("");
  const [badgeToast, setBadgeToast] = useState(null);
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
  }

  function handleLog(entry) {
    const logEntry = { ...entry, date: new Date().toISOString() };
    const newLogs = [logEntry, ...logs];
    setLogs(newLogs);
    // Smart contextual toast messages — personalized by profile
    const uniqueDays = new Set(newLogs.map((l) => l.date.slice(0, 10))).size;
    const streak = getStreak(newLogs);
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
      cancelAllReminders();
      setLogs([]);
      setProfile(null);
      setOnboarded(false);
      setRemindersEnabled(true);
      setReminderTimes({ morning: "09:00", evening: "20:00", weekly: "10:00" });
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
                onClick={() => { setScreen(t.id); window.scrollTo(0, 0); }}
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
      {onboarded && screen === "tracker" && <TrackerScreen onLog={handleLog} logs={logs} profile={profile} isPremium={isPremium} onNavigate={setScreen} />}
      {onboarded && screen === "history" && <HistoryScreen logs={logs} isPremium={isPremium} onShowPaywall={() => setShowPaywall(true)} />}
      {onboarded && screen === "insights" && (
        <InsightsScreen
          logs={logs}
          profile={profile}
          isPremium={isPremium}
          onShowPaywall={() => setShowPaywall(true)}
        />
      )}
      {onboarded && screen === "community" && <CommunityScreen />}
      {onboarded && screen === "settings" && (
        <SettingsScreen
          profile={profile}
          logs={logs}
          isPremium={isPremium}
          onShowPaywall={() => setShowPaywall(true)}
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
        {toastMsg || "Entry logged! Keep it up. 🌿"}
      </div>

      {/* Badge Toast */}
      {badgeToast && (
        <div className="badge-toast">
          <span className="badge-toast-icon">{badgeToast.icon}</span>
          <span className="badge-toast-text">Badge unlocked: {badgeToast.name}!</span>
        </div>
      )}
    </div>
  );
}

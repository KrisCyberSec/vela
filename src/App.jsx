import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

function haptic(style = "Light") {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle[style] }).catch(() => {});
  }
}

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
  { icon: "💓", name: "Palpitations" },
  { icon: "🫧", name: "Bloating" },
  { icon: "💇", name: "Hair thinning" },
  { icon: "🔥", name: "Irritability" },
  { icon: "🧊", name: "Chills" },
  { icon: "💭", name: "Memory lapse" },
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
        if (!bestWeekday || score > bestWeekday.score) bestWeekday = { score, text: `${symptom} tends to peak on ${DAY_NAMES[dow]}s` };
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
  if (logs.length < 14) return [];
  const today = new Date();
  const todayDow = today.getDay();
  const byDate = {};
  logs.forEach((l) => {
    const d = l.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  });
  const dates = Object.keys(byDate).sort();
  const weekdaySymptoms = {};
  let weekdayDayCount = 0;
  dates.forEach((d) => {
    if (new Date(d + "T12:00:00").getDay() !== todayDow) return;
    weekdayDayCount++;
    const syms = [...new Set(byDate[d].flatMap((l) => Object.keys(l.symptoms || {})))];
    syms.forEach((s) => { weekdaySymptoms[s] = (weekdaySymptoms[s] || 0) + 1; });
  });
  if (weekdayDayCount < 2) return [];
  return Object.entries(weekdaySymptoms)
    .filter(([, c]) => c / weekdayDayCount >= 0.5 && c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);
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
        insights.push({ score: rateW / rateWO, text: `${symptom} is ${(rateW / rateWO).toFixed(1)}x more likely on days you ${trigger === "exercise" ? "exercise" : `have ${trigger}`}`, icon: trigger === "caffeine" ? "☕" : trigger === "alcohol" ? "🍷" : "🏃" });
      }
      if (trigger === "exercise" && rateWO > 0.1 && rateW < rateWO * 0.5) {
        insights.push({ score: rateWO / Math.max(rateW, 0.05), text: `${symptom} is ${(rateWO / Math.max(rateW, 0.05)).toFixed(1)}x less frequent on days you exercise`, icon: "🏃" });
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
        insights.push({ score: rL / rO, text: `${symptom} appears ${(rL / rO).toFixed(1)}x more after nights with less than 6 hours of sleep`, icon: "🛏️" });
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
        insights.push({ score: rH / rL, text: `${symptom} is ${(rH / rL).toFixed(1)}x more common on high-stress days`, icon: "😤" });
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
    .comm-sort-tab {
      background: var(--card-bg) !important;
    }
    .comm-guidelines-dismiss { background: var(--card-bg) !important; color: var(--sage-dark) !important; }
    .comm-compose-overlay { background: rgba(0,0,0,0.6) !important; }
    .comm-reaction-active { background: var(--sage-light) !important; }
    .comm-sort-active { background: var(--clay) !important; color: white !important; }
    .comm-emoji-selected { background: var(--clay-light) !important; }
    .symptom-tile.active { background: var(--clay-light) !important; }
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
  .symptom-filter {
    width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--ink); background: white;
    margin-bottom: 8px; outline: none;
  }
  .symptom-filter:focus { border-color: var(--clay); }
  .symptom-filter::placeholder { color: var(--ink-light); }
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

function TrackerScreen({ onLog, logs, profile, isPremium }) {
  const [mood, setMood] = useState(null);
  const [activeSymptoms, setActiveSymptoms] = useState({});
  const [severities, setSeverities] = useState({});
  const [notes, setNotes] = useState("");
  const [symptomFilter, setSymptomFilter] = useState("");
  const [sleepHours, setSleepHours] = useState(null);
  const [stress, setStress] = useState(null);
  const [caffeine, setCaffeine] = useState(null);
  const [alcohol, setAlcohol] = useState(null);
  const [exercise, setExercise] = useState(null);

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
      "Heart palpitations during perimenopause are usually caused by hormonal fluctuations, not heart disease. Tracking patterns helps reassure.",
      "Palpitations often coincide with hot flashes or anxiety. Your combined logs reveal these connections for your doctor.",
      "If palpitations are frequent or prolonged, share your log data with your doctor to rule out other causes.",
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
    onLog({ mood, symptoms: activeSymptoms, severities, notes, context: { sleepHours, stress, caffeine, alcohol, exercise } });
    setMood(null);
    setActiveSymptoms({});
    setSeverities({});
    setNotes("");
    setSleepHours(null);
    setStress(null);
    setCaffeine(null);
    setAlcohol(null);
    setExercise(null);
  }

  return (
    <div className="screen active">
      <div className="tracker-header">
        <h2>{getGreeting()}</h2>
        <p>{today}{journeyStage ? ` · ${journeyStage}` : ""}</p>
        {streak > 0 && (
          <div className="streak-row">
            <div className={`streak-badge${streak >= 7 ? " milestone" : ""}`}>
              🔥 {streak}-day streak
            </div>
            {[7, 14, 30, 60].map((m) => (
              <div key={m} className={`streak-milestone${streak >= m ? " earned" : ""}`}>
                {streak >= m ? "✓" : m}
              </div>
            ))}
          </div>
        )}
      </div>

      {tipText && (
        <div className="tip-card">
          <div className="tip-label">Evidence-based tip</div>
          <div className="tip-text">{tipText}</div>
        </div>
      )}

      {isPremium && (() => {
        const predicted = predictSymptoms(logs);
        if (predicted.length === 0) return null;
        return (
          <div className="prediction-card">
            <div className="pred-label">Based on your patterns</div>
            <div className="pred-text">
              On {new Date().toLocaleDateString("en-US", { weekday: "long" })}s, you often log{" "}
              <strong>{predicted.join(" and ").toLowerCase()}</strong>. Keep tracking to refine predictions.
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

      <div className="symptoms-section">
        <div className="section-label">Symptoms today</div>
        {SYMPTOMS.length > 12 && (
          <input
            className="symptom-filter"
            placeholder="Search symptoms..."
            value={symptomFilter}
            onChange={(e) => setSymptomFilter(e.target.value)}
          />
        )}
        <div className="symptom-grid">
          {SYMPTOMS.filter((s) => !symptomFilter || s.name.toLowerCase().includes(symptomFilter.toLowerCase())).map((s) => {
            const isActive = !!activeSymptoms[s.name];
            const sev = severities[s.name] || 0;
            return (
              <div
                key={s.name}
                className={`symptom-tile${isActive ? " active" : ""}`}
                onClick={() => { haptic("Light"); toggleSymptom(s.name); }}
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
      </div>

      <div className="notes-area">
        <div className="note-chips">
          {["Period started", "Bad night", "Stressful day", "Skipped meds", "Felt great"].map((chip) => (
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
    data.push({ mood: avg, label });
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
      </svg>
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
            seeing patterns here. After 7 days, Vela will surface personalized
            insights about your symptoms.
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
    description: "Coping strategies, triggers, and what actually works",
    resources: [
      { label: "Cooling strategies that actually work", type: "tip" },
      { label: "When to talk to your doctor about HRT", type: "article" },
    ],
    posts: [
      { id: "hf-1", author: "Anonymous", time: "2h ago", text: "Keeping a small fan on my nightstand has been a game-changer. I also switched to cotton sheets and it made a noticeable difference.", likes: 24 },
      { id: "hf-2", author: "Anonymous", time: "5h ago", text: "My hot flashes got so much worse with caffeine. Once I cut it after noon, the nighttime ones reduced by half.", likes: 18 },
      { id: "hf-3", author: "Anonymous", time: "1d ago", text: "Does anyone else get them at the most inconvenient times? Middle of a presentation yesterday. Deep breathing helped me get through it.", likes: 31 },
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
      { id: "ma-2", author: "Anonymous", time: "6h ago", text: "Walking 20 minutes every morning has done more for my anxiety than anything else I've tried. It's not a cure but it takes the edge off.", likes: 29 },
      { id: "ma-3", author: "Anonymous", time: "2d ago", text: "If you're feeling rage that seems out of nowhere \u2014 that's perimenopause too. You're not broken. Your hormones are just really loud right now.", likes: 67 },
    ],
  },
  {
    id: "sleep",
    icon: "\u{1F634}",
    title: "Sleep struggles",
    description: "Getting rest when your body won't cooperate",
    resources: [
      { label: "Building a menopause-friendly sleep routine", type: "tip" },
      { label: "Supplements that may help with sleep", type: "article" },
    ],
    posts: [
      { id: "sl-1", author: "Anonymous", time: "4h ago", text: "Magnesium glycinate before bed. I was skeptical but it honestly helped me stay asleep longer. Ask your doctor about it.", likes: 33 },
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
            <strong>Welcome to our community {"\u{1F33F}"}</strong>
            <p>This is a safe, anonymous space. Be kind, be honest, and remember: every woman's experience is valid. No medical advice — just support.</p>
          </div>
          <button className="comm-guidelines-dismiss" onClick={() => { setGuidelinesSeen(true); haptic(); }}>Got it</button>
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
      {onboarded && screen === "tracker" && <TrackerScreen onLog={handleLog} logs={logs} profile={profile} isPremium={isPremium} />}
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
        Entry logged! Keep it up. 🌿
      </div>
    </div>
  );
}

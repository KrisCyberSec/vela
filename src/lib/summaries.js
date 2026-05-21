// Anonymized payload builders for the two server-side AI calls.
// Both strip notes (free-text), exact dates, and custom symptom names.
// Custom symptom toggles are collapsed into a single "Custom symptom"
// bucket so the model still sees the count without learning the
// user-chosen label. See the disclosure in Settings → Privacy & Data.

import { CANONICAL_SYMPTOM_NAMES } from "./symptoms";
import { localDateStr, getStreak } from "./formatters";
import { analyzeCorrelations } from "./correlations";
import { detectAnomalies } from "./anomalies";
import { predictNextCycle } from "./cycle";

function getLatestLogDate(logs) {
  return logs.reduce((latest, log) => {
    const date = new Date(log.date);
    if (Number.isNaN(date.getTime())) return latest;
    return !latest || date > latest ? date : latest;
  }, null);
}

function daysSince(date, now) {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now - d) / 86400000));
}

// ─── Anonymized summary for Ask Vela API ────────────────────────────────
// Strips notes (free-text), exact dates, and custom symptom names. Custom
// symptom toggles are collapsed into a single "Custom symptom" bucket so
// the model still sees the count without learning the user-chosen label.
// Returns aggregated 30-day stats + a per-day-of-week 7-day window.
// ─── Anonymized summary for Daily Brief API ─────────────────────────────
// Tighter than the Ask Vela summary — fewer fields, focused on what
// matters for "what's happening THIS week." Includes anomalies + cycle
// + active experiments + lastBriefDaysAgo so the AI can avoid repetition.
export function buildDailyBriefSummary(logs) {
  if (!logs || logs.length === 0) return { daysLogged: 0 };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 7);
  const inWeek = (l) => { const d = new Date(l.date); d.setHours(0,0,0,0); return d >= sevenAgo && d < now; };

  const week = logs.filter(inWeek);
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const lastEntryDaysAgo = daysSince(getLatestLogDate(logs), now);

  // Top symptom this week. Custom-symptom names are bucketed so the
  // user-chosen label never leaves the device.
  const wCounts = {};
  week.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => {
    const key = CANONICAL_SYMPTOM_NAMES.has(s) ? s : "Custom symptom";
    wCounts[key] = (wCounts[key] || 0) + 1;
  }));
  const topPair = Object.entries(wCounts).sort((a, b) => b[1] - a[1])[0];
  const weekTopSymptom = topPair ? { name: topPair[0], count: topPair[1] } : null;

  // Mood + sleep this week
  const moodLabels = ["rough", "low", "okay", "good", "great"];
  const moodSamples = week.filter((l) => l.mood !== null && l.mood !== undefined);
  const weekMood = moodSamples.length >= 3
    ? { avg: moodSamples.reduce((s, l) => s + l.mood, 0) / moodSamples.length, label: moodLabels[Math.round(moodSamples.reduce((s, l) => s + l.mood, 0) / moodSamples.length)] }
    : null;
  const sleepSamples = week.filter((l) => l.context && l.context.sleepHours !== null && l.context.sleepHours !== undefined);
  const weekSleep = sleepSamples.length >= 3
    ? { avg: sleepSamples.reduce((s, l) => s + l.context.sleepHours, 0) / sleepSamples.length }
    : null;

  // Borrow correlations + anomalies + cycle from the existing engines
  const correlations = analyzeCorrelations(logs).slice(0, 4).map((c) => c.text);
  const anomalies = detectAnomalies(logs).slice(0, 4).map((a) => ({ text: a.text }));
  const cp = predictNextCycle(logs);
  const cyclePrediction = (cp && cp.cyclesLogged >= 2) ? {
    cycleLengthMean: cp.cycleLengthMean,
    windowStart: cp.windowStart,
    windowEnd: cp.windowEnd,
  } : null;

  // Active experiments
  const experiments = (() => { try { return JSON.parse(localStorage.getItem("vela_experiments") || "[]"); } catch { return []; } })();
  const activeExperiments = experiments.filter((e) => e.status === "active").map((e) => {
    const start = new Date(e.startDate + "T00:00:00");
    const day = Math.min(e.duration, Math.floor((now - start) / 86400000) + 1);
    return { name: e.name, day, duration: e.duration };
  });

  // Last-brief metadata to avoid repetition
  const lastBriefStr = (() => { try { return localStorage.getItem("vela_last_brief_date"); } catch { return null; } })();
  const lastBriefDaysAgo = lastBriefStr
    ? Math.max(0, Math.floor((now - new Date(lastBriefStr + "T00:00:00")) / 86400000))
    : null;

  return {
    daysLogged: logs.length,
    uniqueDays,
    lastEntryDaysAgo,
    streak: getStreak(logs),
    weekTopSymptom,
    weekMood,
    weekSleep,
    correlations,
    anomalies,
    cyclePrediction,
    activeExperiments,
    lastBriefDaysAgo,
  };
}

export function buildAskVelaSummary(logs) {
  if (!logs || logs.length === 0) return { daysLogged: 0 };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const thirtyAgo = new Date(now); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const recent = logs.filter((l) => new Date(l.date) >= thirtyAgo);

  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const lastEntryDaysAgo = daysSince(getLatestLogDate(logs), now);

  // Symptom counts (last 30 days). Custom user symptoms are collapsed
  // into a single "Custom symptom" bucket so we don't ship the user-chosen
  // label off-device — see the disclosure in Settings.
  const symptomCounts = {};
  recent.forEach((l) => {
    Object.keys(l.symptoms || {}).forEach((s) => {
      const key = CANONICAL_SYMPTOM_NAMES.has(s) ? s : "Custom symptom";
      symptomCounts[key] = (symptomCounts[key] || 0) + 1;
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

  // ─── Last-7-day breakdown ─────────────────────────────────────────────
  // 30-day aggregates miss recency. Adding a per-day-of-week 7-day window
  // so Claude can answer "how was last week?" or "what about Tuesday?"
  // without us shipping the full log. Each entry: day-of-week + symptom
  // names + mood label + sleep hours. No notes, no exact dates.
  const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 7);
  const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const last7days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ymd = localDateStr(d);
    const dayLogs = logs.filter((l) => l.date.slice(0, 10) === ymd);
    if (dayLogs.length === 0) {
      last7days.push({ day: dayLabels[d.getDay()], daysAgo: i, logged: false });
      continue;
    }
    const symSet = new Set();
    let moodSum = 0, moodCount = 0, sleep = null, stress = null;
    let period = false;
    dayLogs.forEach((l) => {
      Object.keys(l.symptoms || {}).forEach((s) => {
        symSet.add(CANONICAL_SYMPTOM_NAMES.has(s) ? s : "Custom symptom");
      });
      if (l.mood !== null && l.mood !== undefined) { moodSum += l.mood; moodCount++; }
      if (l.context?.sleepHours != null) sleep = l.context.sleepHours;
      if (l.context?.stress != null) stress = l.context.stress;
      if (l.context?.period && l.context.period !== "none") period = true;
    });
    const avgMoodIdx = moodCount > 0 ? Math.round(moodSum / moodCount) : null;
    last7days.push({
      day: dayLabels[d.getDay()],
      daysAgo: i,
      logged: true,
      symptoms: [...symSet],
      mood: avgMoodIdx !== null ? moodLabels[avgMoodIdx] : null,
      sleep,
      stress,
      period,
    });
  }

  // ─── Cycle phase context ──────────────────────────────────────────────
  // Knowing where the user is in their cycle helps Claude contextualize
  // ("hot flashes peaking in week 3 of the cycle" is meaningful).
  let cyclePhase = null;
  if (cp && cp.lastStart) {
    const lastStartDate = new Date(cp.lastStart + "T00:00:00");
    const dayInCycle = Math.floor((now - lastStartDate) / (1000 * 60 * 60 * 24)) + 1;
    cyclePhase = {
      dayInCycle,
      phase: dayInCycle <= 5 ? "menstrual" :
             dayInCycle <= 13 ? "follicular" :
             dayInCycle <= 16 ? "ovulatory" :
             dayInCycle <= 28 ? "luteal" : "post-luteal (overdue)",
    };
  }

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
    cyclePhase,
    activeExperiments,
    last7days,
  };
}

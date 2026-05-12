// Pure-function analyzers over the logs array. Used as the data
// foundation for the canned Ask Vela responses (./cannedAI.js) when
// the real Anthropic-backed answer isn't available — free tier,
// network failure, or rate-limit hit.

import { analyzeCorrelations } from "./correlations";
import { getJourneyLabel } from "./formatters";
import { generateTalkingPoints } from "./reminders";


export function analyzeSymptomTrend(logs, symptomName) {
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

export function analyzeTriggerImpact(logs, triggerName) {
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

export function analyzeOverallTrend(logs) {
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

export function analyzeBestWorstDays(logs) {
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

export function analyzeRecentPattern(logs) {
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

export function generateDoctorSummary(logs, profile) {
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

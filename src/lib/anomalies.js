// Anomaly detection. Surfaces "this week is unusual" findings —
// mood dipped vs baseline, sleep shorter, symptom showing up more.
// detectAnomalies returns a list; anomalyToQuestion converts one into
// a user-facing "ask the doctor about this" question.

import { SYMPTOMS } from "./symptoms";

// ─── detectAnomalies ────────────────────────────────────────────────────
// Computes z-scores against the user's personal 30-day baseline. Surfaces
// "this is unusual for you" days/weeks. Stat-based, not ML, but lands as
// "the app is paying attention to my normal" to the user.
export function detectAnomalies(logs) {
  if (!logs || logs.length < 14) return [];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 7);
  const thirtyAgo = new Date(now); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const inWin = (l, a, b) => {
    const d = new Date(l.date); d.setHours(0, 0, 0, 0);
    return d >= a && d < b;
  };
  const week = logs.filter((l) => inWin(l, sevenAgo, now));
  const baseline = logs.filter((l) => inWin(l, thirtyAgo, now)); // last 30 days
  if (baseline.length < 10) return [];

  const anomalies = [];

  // Per-symptom: last-7-day count vs baseline 7-day-equivalent average
  const allSymptoms = [...new Set(baseline.flatMap((l) => Object.keys(l.symptoms || {})))];
  allSymptoms.forEach((sym) => {
    const weekCount = week.filter((l) => l.symptoms?.[sym]).length;
    // Baseline: average per-week count over the 30-day window
    const baselineWeekly = baseline.filter((l) => l.symptoms?.[sym]).length * (7 / 30);
    if (baselineWeekly < 1 || weekCount < 1) return;
    const lift = weekCount / baselineWeekly;
    if (lift >= 1.8 && weekCount >= 3) {
      anomalies.push({
        kind: "symptom-spike", symptom: sym,
        weekCount, baselineWeekly: +baselineWeekly.toFixed(1),
        lift: +lift.toFixed(1),
        text: `${sym} has shown up ${weekCount}x this week. ${lift.toFixed(1)}x your usual.`,
        icon: SYMPTOMS.find((s) => s.name === sym)?.icon || "Sparkle",
      });
    }
    if (lift <= 0.4 && baselineWeekly >= 2) {
      anomalies.push({
        kind: "symptom-quiet", symptom: sym,
        weekCount, baselineWeekly: +baselineWeekly.toFixed(1),
        lift: +lift.toFixed(1),
        text: `${sym} has been quieter this week. ${weekCount} vs your usual ${baselineWeekly.toFixed(1)}.`,
        icon: SYMPTOMS.find((s) => s.name === sym)?.icon || "Sparkle",
      });
    }
  });

  // Sleep anomaly (z-score against personal baseline)
  const sleepBase = baseline.filter((l) => l.context?.sleepHours != null).map((l) => l.context.sleepHours);
  const sleepWeek = week.filter((l) => l.context?.sleepHours != null).map((l) => l.context.sleepHours);
  if (sleepBase.length >= 10 && sleepWeek.length >= 3) {
    const baseAvg = sleepBase.reduce((a, b) => a + b, 0) / sleepBase.length;
    const baseSd = Math.sqrt(sleepBase.reduce((s, x) => s + (x - baseAvg) ** 2, 0) / sleepBase.length) || 0.5;
    const weekAvg = sleepWeek.reduce((a, b) => a + b, 0) / sleepWeek.length;
    const z = (weekAvg - baseAvg) / baseSd;
    if (Math.abs(z) >= 1.2) {
      anomalies.push({
        kind: "sleep-shift",
        weekAvg: +weekAvg.toFixed(1), baseAvg: +baseAvg.toFixed(1), z: +z.toFixed(1),
        text: z < 0
          ? `You're averaging ${weekAvg.toFixed(1)}h sleep this week. ${(baseAvg - weekAvg).toFixed(1)}h below your usual.`
          : `You're averaging ${weekAvg.toFixed(1)}h sleep this week. ${(weekAvg - baseAvg).toFixed(1)}h above your usual.`,
        icon: "Bed",
      });
    }
  }

  // Mood anomaly
  const moodBase = baseline.filter((l) => l.mood != null).map((l) => l.mood);
  const moodWeek = week.filter((l) => l.mood != null).map((l) => l.mood);
  if (moodBase.length >= 10 && moodWeek.length >= 3) {
    const baseAvg = moodBase.reduce((a, b) => a + b, 0) / moodBase.length;
    const weekAvg = moodWeek.reduce((a, b) => a + b, 0) / moodWeek.length;
    const delta = weekAvg - baseAvg;
    if (Math.abs(delta) >= 0.6) {
      const moodLabels = ["rough", "low", "okay", "good", "great"];
      anomalies.push({
        kind: "mood-shift",
        weekAvg: +weekAvg.toFixed(1), baseAvg: +baseAvg.toFixed(1), delta: +delta.toFixed(1),
        text: delta < 0
          ? `Mood has dipped this week (${moodLabels[Math.round(weekAvg)]} on average, vs your usual ${moodLabels[Math.round(baseAvg)]}).`
          : `Mood has lifted this week (${moodLabels[Math.round(weekAvg)]} on average, vs your usual ${moodLabels[Math.round(baseAvg)]}).`,
        icon: "Heart",
      });
    }
  }

  return anomalies;
}

// Build a natural-language Ask-Vela question from an anomaly card.
// Phrased first-person so the chat reads like the user typed it. We
// include the actual numbers because the AI proxy strips them on
// retrieval and the user wants the brief on what's odd, not vague.
export function anomalyToQuestion(a) {
  if (a.kind === "symptom-spike") {
    return `${a.symptom} has shown up ${a.weekCount} times this week, ${a.lift} times my usual. What might be driving the spike?`;
  }
  if (a.kind === "symptom-quiet") {
    return `My ${a.symptom.toLowerCase()} has been quieter this week. Anything in my data that might explain why?`;
  }
  if (a.kind === "sleep-shift") {
    if (a.z < 0) {
      return `My sleep is averaging ${a.weekAvg}h this week, ${(a.baseAvg - a.weekAvg).toFixed(1)}h below my usual. What might be going on?`;
    }
    return `My sleep is averaging ${a.weekAvg}h this week, ${(a.weekAvg - a.baseAvg).toFixed(1)}h above my usual. Anything in the data that might explain it?`;
  }
  if (a.kind === "mood-shift") {
    if (a.delta < 0) return "My mood has dipped this week. What might be contributing?";
    return "My mood has lifted this week. What might be helping?";
  }
  return "What's unusual about my week so far?";
}

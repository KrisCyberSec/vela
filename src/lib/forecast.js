// Bayesian-flavored prediction for what tomorrow might look like.
// For each top-frequency symptom, we compute a personal prior (overall
// rate in the user's history) and update based on cycle phase, recent
// triggers, and recent symptom days. Returns top-3 likely symptoms
// with probability bands.

import { localDateStr } from "./formatters";
import { analyzeCorrelations } from "./correlations";
import { predictNextCycle } from "./cycle";


// ─── forecastTomorrow ───────────────────────────────────────────────────
// Bayesian-flavored prediction for what tomorrow might look like. For
// each top-frequency symptom, we compute a personal prior (overall rate
// in the user's history) and update it based on three signals:
//   1. Cycle phase — if we know next cycle window, days inside that
//      window get a multiplier
//   2. Recency — symptom that hit yesterday and the day before is more
//      likely to hit tomorrow (autocorrelation)
//   3. Active triggers — if the user has logged caffeine 3 days running
//      and caffeine correlates with a symptom, bump it
//
// Returns { date, predictions: [{ symptom, prob, why }] }. Honest about
// confidence: we never claim "definitely tomorrow" — at most "likely."
export function forecastTomorrow(logs) {
  if (!logs || logs.length < 21) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrow);

  const totalDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const symCounts = {};
  logs.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { symCounts[s] = (symCounts[s] || 0) + 1; }));
  // Top 6 candidates by overall frequency
  const candidates = Object.entries(symCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([sym, count]) => ({ sym, prior: count / totalDays }));
  if (candidates.length === 0) return null;

  // Recency lookup: was symptom present on day-1 and day-2?
  const dayHas = (dateStr, sym) => logs.some((l) => l.date.slice(0, 10) === dateStr && l.symptoms?.[sym]);
  const dayMinus = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return localDateStr(d); };

  // Cycle-phase boost (only if cycle prediction exists)
  const cp = predictNextCycle(logs);
  const inCycleWindow = cp && cp.cyclesLogged >= 2 && tomorrowStr >= cp.windowStart && tomorrowStr <= cp.windowEnd;

  // Trigger streak: caffeine/alcohol/poor-sleep run for the last 2 days
  const recentTrigger = (key) => {
    const yLog = logs.find((l) => l.date.slice(0, 10) === dayMinus(0));
    const yyLog = logs.find((l) => l.date.slice(0, 10) === dayMinus(1));
    if (!yLog || !yyLog) return false;
    if (key === "sleep") return (yLog.context?.sleepHours != null && yLog.context.sleepHours < 6) && (yyLog.context?.sleepHours != null && yyLog.context.sleepHours < 6);
    return yLog.context?.[key] === true && yyLog.context?.[key] === true;
  };
  const caffStreak = recentTrigger("caffeine");
  const alcStreak = recentTrigger("alcohol");
  const sleepStreak = recentTrigger("sleep");

  // Use existing correlation engine to know which symptoms tie to triggers
  const corrs = analyzeCorrelations(logs);
  const triggerLink = (trigger, sym) =>
    corrs.find((c) => c.context === trigger && c.symptom === sym && c.lift >= 1.5);

  const predictions = candidates.map(({ sym, prior }) => {
    let prob = prior;
    const reasons = [];

    // Recency boost
    if (dayHas(dayMinus(0), sym) && dayHas(dayMinus(1), sym)) {
      prob = Math.min(0.95, prob * 1.6);
      reasons.push("logged the past two days");
    } else if (dayHas(dayMinus(0), sym)) {
      prob = Math.min(0.92, prob * 1.3);
      reasons.push("logged yesterday");
    }

    // Cycle phase boost (10-30% lift)
    if (inCycleWindow) {
      prob = Math.min(0.95, prob * 1.25);
      reasons.push("in your usual cycle window");
    }

    // Trigger-streak boost
    if (caffStreak && triggerLink("caffeine", sym)) {
      prob = Math.min(0.95, prob * 1.4);
      reasons.push("caffeine for two days running");
    }
    if (alcStreak && triggerLink("alcohol", sym)) {
      prob = Math.min(0.95, prob * 1.4);
      reasons.push("alcohol two nights in a row");
    }
    if (sleepStreak) {
      // If sleep correlates with this sym, multiply
      if (corrs.find((c) => c.context === "sleepHours" && c.symptom === sym && c.lift >= 1.5)) {
        prob = Math.min(0.95, prob * 1.5);
        reasons.push("two short-sleep nights");
      }
    }

    return { symptom: sym, prob: +prob.toFixed(2), why: reasons };
  });

  // Sort by probability, keep only those above 0.30 OR the top one regardless
  const filtered = predictions.filter((p) => p.prob >= 0.30);
  const result = filtered.length > 0 ? filtered : [predictions[0]];

  return {
    date: tomorrowStr,
    inCycleWindow: !!inCycleWindow,
    predictions: result.sort((a, b) => b.prob - a.prob).slice(0, 4),
  };
}

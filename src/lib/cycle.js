// Cycle prediction. Works on irregular cycles by computing mean and
// stddev across the last 6 cycles, then returning a window rather than
// a point estimate. Premium-tier feature surfaced on Insights.

import { localDateStr } from "./formatters";

// ─── Cycle prediction (Premium) ──────────────────────────────────────────
// Looks at logged period flow days, infers cycle starts (transition from
// non-period → period day-1), computes mean cycle length + spread, and
// predicts the next likely period window. Returns null when there isn't
// enough signal — never invents a window from < 2 cycles.
//
// For perimenopausal users with irregular cycles, the *spread* matters as
// much as the mean: we always show a 5-day window centered on the next
// expected start (or wider if their stddev is high).
export function predictNextCycle(logs) {
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
  if (lengths.length === 0) return { hasData: true, lastStart: starts[starts.length - 1], cyclesLogged: starts.length, reason: "Cycle gaps look unusual. Keep logging and we'll try again." };

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
    predictedDate: localDateStr(predictedDate),
    windowStart: localDateStr(windowStart),
    windowEnd: localDateStr(windowEnd),
    windowSpread,
    daysUntil,
    confidence,
  };
}

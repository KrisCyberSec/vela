// Pattern detection + early stats + weekly summary.
// All pure functions over the logs array. analyzePatterns finds
// follow-day, weekday, mood-vs-symptom-count, and co-occurrence
// patterns; buildWeeklySummary builds the 7-vs-7 comparison shown
// on the Insights screen.

import { SYMPTOMS } from "./symptoms";
import { localDateStr } from "./formatters";


export function computeEarlyStats(logs) {
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

export function analyzePatterns(logs) {
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
export function buildWeeklySummary(logs) {
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
    if (t.delta < 0) parts.push(`${t.sym} was your top symptom (${t.count} days). Down from ${t.prior} the week before.`);
    else if (t.delta > 0) parts.push(`${t.sym} showed up most (${t.count} days, up from ${t.prior}).`);
    else parts.push(`${t.sym} showed up most (${t.count} days, same as the week before).`);
  }
  if (wMood && wMood.samples >= 3) {
    const lbl = moodLabels[Math.round(wMood.avg)];
    if (moodDelta !== null && Math.abs(moodDelta) >= 0.4) {
      parts.push(`Mood averaged ${lbl}. ${moodDelta > 0 ? "lifted" : "dipped"} from the week before.`);
    } else {
      parts.push(`Mood averaged ${lbl}.`);
    }
  }
  if (wSleep && wSleep.samples >= 3) {
    if (sleepDelta !== null && Math.abs(sleepDelta) >= 0.4) {
      parts.push(`Sleep averaged ${wSleep.avg.toFixed(1)}h. ${sleepDelta > 0 ? "more" : "less"} than the week before.`);
    } else {
      parts.push(`Sleep held around ${wSleep.avg.toFixed(1)}h.`);
    }
  }

  return {
    windowStart: localDateStr(sevenAgo),
    windowEnd: localDateStr(now),
    daysLogged: uniqueDays,
    topSymptoms,
    mood: wMood ? { avg: wMood.avg, label: moodLabels[Math.round(wMood.avg)], delta: moodDelta, samples: wMood.samples } : null,
    sleep: wSleep ? { avg: wSleep.avg, delta: sleepDelta, samples: wSleep.samples } : null,
    stress: wStress != null ? { avg: wStress, delta: pStress != null ? wStress - pStress : null } : null,
    periodDays,
    summary: parts.join(" "),
  };
}

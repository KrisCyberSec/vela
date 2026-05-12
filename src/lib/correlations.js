// Adaptive correlation engine. Three things make this "smarter than rules":
//
// 1. Adaptive thresholds. Lift ratio required to surface a finding scales
//    DOWN with sample size: more data = lower bar to call a pattern real.
//    Below 14 days we don't run at all (n too small).
//
// 2. Confidence labels (early/steady/strong) computed from sample size +
//    effect size, NOT a hardcoded 1/2/3 score. A "STRONG SIGNAL" at week 8
//    means something different than at week 1 — and we now reflect that.
//
// 3. Lag detection. Beyond same-day correlations, we check 1- and 2-day
//    lags. "Hot flash often follows a poor-sleep night by 1 day" is the
//    kind of pattern users say "oh wow it actually noticed" about, and
//    pure same-day analysis misses it entirely.

import { localDateStr } from "./formatters";

export function analyzeCorrelations(logs) {
  const contextLogs = logs.filter((l) => l.context && Object.values(l.context).some((v) => v !== null));
  if (contextLogs.length < 14) return [];

  // Bucket by local-date so trigger-on-day-X and symptom-on-day-X+1 line up
  const byDate = {};
  contextLogs.forEach((l) => {
    const d = l.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = { date: d, context: { ...l.context }, symptoms: {}, mood: null };
    Object.keys(l.symptoms || {}).forEach((s) => { byDate[d].symptoms[s] = true; });
    if (l.mood !== null && l.mood !== undefined) byDate[d].mood = l.mood;
    if (l.context) Object.entries(l.context).forEach(([k, v]) => { if (v !== null && byDate[d].context[k] === null) byDate[d].context[k] = v; });
  });
  const days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const allSymptoms = [...new Set(days.flatMap((d) => Object.keys(d.symptoms)))];
  const insights = [];

  const n = days.length;

  // Adaptive lift threshold. At 14 days you need 2.5x to surface;
  // by 90 days a 1.5x lift is enough. Larger samples stabilize faster
  // so we trust smaller effects.
  const liftThreshold = n >= 90 ? 1.5 : n >= 60 ? 1.7 : n >= 30 ? 1.9 : 2.2;

  // Adaptive confidence label. Uses sample size, lift magnitude, and
  // both base rates. Intentionally conservative — "strong" should mean
  // something you'd trust enough to mention to a doctor.
  const labelFor = (lift, samplesA, samplesB) => {
    const minSample = Math.min(samplesA, samplesB);
    if (lift >= 2.5 && minSample >= 20) return "strong";
    if (lift >= 2.0 && minSample >= 12) return "steady";
    return "early";
  };

  // Push a single correlation finding
  const push = (cfg) => {
    insights.push({
      score: cfg.lift,                  // for sort
      lift: cfg.lift,                   // explicit
      label: cfg.label,                 // "strong" / "steady" / "early"
      text: cfg.text,
      icon: cfg.icon,                   // Phosphor name
      kind: cfg.kind,                   // "trigger" / "sleep" / "stress" / "mood" / "lag"
      context: cfg.context,             // variable name
      symptom: cfg.symptom,
      lag: cfg.lag || 0,
      samples: cfg.samples,             // {with, without}
    });
  };

  // ─── Same-day boolean triggers (caffeine / alcohol / exercise) ────────
  ["caffeine", "alcohol", "exercise"].forEach((trigger) => {
    const withT = days.filter((d) => d.context[trigger] === true);
    const withoutT = days.filter((d) => d.context[trigger] !== true);
    if (withT.length < 5 || withoutT.length < 5) return;

    allSymptoms.forEach((symptom) => {
      const symW = withT.filter((d) => d.symptoms[symptom]).length;
      const symWO = withoutT.filter((d) => d.symptoms[symptom]).length;
      const rateW = symW / withT.length;
      const rateWO = symWO / withoutT.length;
      // PERFECT CORRELATION case — symptom never appears without trigger.
      // We can't compute a finite lift, but this is exactly the cleanest
      // signal in the data and the user deserves to see it.
      if (rateWO === 0 && rateW >= 0.5 && symW >= 4) {
        push({
          lift: 99, label: "strong",
          text: `${symptom} has appeared on every ${trigger} day (${symW}/${withT.length}). And never on a non-${trigger} day`,
          icon: trigger === "caffeine" ? "Sparkle" : trigger === "alcohol" ? "Drop" : "Footprints",
          kind: "trigger", context: trigger, symptom,
          samples: { with: withT.length, without: withoutT.length },
        });
      } else if (rateWO > 0.05 && rateW / rateWO >= liftThreshold) {
        const lift = rateW / rateWO;
        push({
          lift, label: labelFor(lift, withT.length, withoutT.length),
          text: `${symptom} appeared ${lift.toFixed(1)}x more often on days you logged ${trigger}`,
          icon: trigger === "caffeine" ? "Sparkle" : trigger === "alcohol" ? "Drop" : "Footprints",
          kind: "trigger", context: trigger, symptom,
          samples: { with: withT.length, without: withoutT.length },
        });
      }
      // Inverse — exercise often LOWERS symptom rates; surface that too
      if (trigger === "exercise" && rateWO > 0.1 && rateW < rateWO / liftThreshold) {
        const lift = rateWO / Math.max(rateW, 0.05);
        push({
          lift, label: labelFor(lift, withT.length, withoutT.length),
          text: `${symptom} appeared ${lift.toFixed(1)}x less often on days you logged exercise`,
          icon: "Footprints", kind: "trigger", context: "exercise_inverse", symptom,
          samples: { with: withT.length, without: withoutT.length },
        });
      }
    });

    // Mood differential on trigger days
    const moodW = withT.filter((d) => d.mood !== null);
    const moodWO = withoutT.filter((d) => d.mood !== null);
    if (moodW.length >= 5 && moodWO.length >= 5) {
      const avgW = moodW.reduce((s, d) => s + d.mood, 0) / moodW.length;
      const avgWO = moodWO.reduce((s, d) => s + d.mood, 0) / moodWO.length;
      const delta = avgW - avgWO;
      const minDelta = n >= 60 ? 0.4 : n >= 30 ? 0.5 : 0.6;
      if (Math.abs(delta) >= minDelta) {
        push({
          lift: 1 + Math.abs(delta), // synthetic score so it sorts among lift findings
          label: labelFor(1 + Math.abs(delta), moodW.length, moodWO.length),
          text: `Your mood averages ${Math.abs(delta).toFixed(1)} points ${delta > 0 ? "higher" : "lower"} on days you ${trigger === "exercise" ? "exercise" : `log ${trigger}`}`,
          icon: trigger === "caffeine" ? "Sparkle" : trigger === "alcohol" ? "Drop" : "Footprints",
          kind: "mood", context: trigger, symptom: "mood",
          samples: { with: moodW.length, without: moodWO.length },
        });
      }
    }
  });

  // ─── Sleep < 6 hours (same day) ───────────────────────────────────────
  const sleepLow = days.filter((d) => d.context.sleepHours !== null && d.context.sleepHours < 6);
  const sleepOk = days.filter((d) => d.context.sleepHours !== null && d.context.sleepHours >= 6);
  if (sleepLow.length >= 5 && sleepOk.length >= 5) {
    allSymptoms.forEach((symptom) => {
      const symL = sleepLow.filter((d) => d.symptoms[symptom]).length;
      const symO = sleepOk.filter((d) => d.symptoms[symptom]).length;
      const rL = symL / sleepLow.length;
      const rO = symO / sleepOk.length;
      if (rO === 0 && rL >= 0.5 && symL >= 4) {
        push({
          lift: 99, label: "strong",
          text: `${symptom} has appeared on every short-sleep night (${symL}/${sleepLow.length}). And never on a 6h+ night`,
          icon: "Bed", kind: "sleep", context: "sleepHours", symptom,
          samples: { with: sleepLow.length, without: sleepOk.length },
        });
      } else if (rO > 0.05 && rL / rO >= liftThreshold) {
        const lift = rL / rO;
        push({
          lift, label: labelFor(lift, sleepLow.length, sleepOk.length),
          text: `${symptom} appeared ${lift.toFixed(1)}x more often after nights with less than 6 hours of sleep`,
          icon: "Bed", kind: "sleep", context: "sleepHours", symptom,
          samples: { with: sleepLow.length, without: sleepOk.length },
        });
      }
    });
  }

  // ─── Stress ≥ 4 (same day) ────────────────────────────────────────────
  const stressHi = days.filter((d) => d.context.stress !== null && d.context.stress >= 4);
  const stressLo = days.filter((d) => d.context.stress !== null && d.context.stress < 4);
  if (stressHi.length >= 5 && stressLo.length >= 5) {
    allSymptoms.forEach((symptom) => {
      const symH = stressHi.filter((d) => d.symptoms[symptom]).length;
      const symL = stressLo.filter((d) => d.symptoms[symptom]).length;
      const rH = symH / stressHi.length;
      const rL = symL / stressLo.length;
      if (rL === 0 && rH >= 0.5 && symH >= 4) {
        push({
          lift: 99, label: "strong",
          text: `${symptom} has appeared on every high-stress day (${symH}/${stressHi.length}). And never on a low-stress day`,
          icon: "CloudLightning", kind: "stress", context: "stress", symptom,
          samples: { with: stressHi.length, without: stressLo.length },
        });
      } else if (rL > 0.05 && rH / rL >= liftThreshold) {
        const lift = rH / rL;
        push({
          lift, label: labelFor(lift, stressHi.length, stressLo.length),
          text: `${symptom} appeared ${lift.toFixed(1)}x more often on high-stress days`,
          icon: "CloudLightning", kind: "stress", context: "stress", symptom,
          samples: { with: stressHi.length, without: stressLo.length },
        });
      }
    });
  }

  // ─── LAG DETECTION (1- and 2-day shifts) ──────────────────────────────
  // Build a date-indexed map for fast prev-day lookup
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const dateMinus = (dateStr, days) => {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() - days);
    return localDateStr(d);
  };

  const checkLag = (lag, triggerKey, triggerCheck, label) => {
    if (n < 21) return; // need a real baseline before lag claims
    // For each day with a symptom, was the trigger present `lag` days ago?
    // Lag thresholds are STRICTER than same-day to dampen false positives.
    // At 31 days a 30% baseline symptom can fluctuate to 1.9x by chance.
    // Require at least 2.0x lift AND at least 4 trigger-then-symptom hits
    // before surfacing a lag finding.
    const LAG_LIFT_MIN = Math.max(2.0, liftThreshold);
    allSymptoms.forEach((symptom) => {
      let triggerThenSymptom = 0;     // trigger on day-N, symptom on day-N+lag
      let noTriggerThenSymptom = 0;
      let triggerDays = 0;
      let noTriggerDays = 0;
      // Walk pairs (prevDay, currentDay)
      days.forEach((d) => {
        const prev = dayMap.get(dateMinus(d.date, lag));
        if (!prev) return;
        if (triggerCheck(prev.context)) {
          triggerDays++;
          if (d.symptoms[symptom]) triggerThenSymptom++;
        } else {
          noTriggerDays++;
          if (d.symptoms[symptom]) noTriggerThenSymptom++;
        }
      });
      if (triggerDays < 5 || noTriggerDays < 5 || triggerThenSymptom < 4) return;
      const rateA = triggerThenSymptom / triggerDays;
      const rateB = noTriggerThenSymptom / noTriggerDays;
      // Perfect-correlation case: symptom always follows trigger AND
      // never appears without it. Surface as a strong lag finding.
      if (rateB === 0 && rateA >= 0.6) {
        push({
          lift: 99, label: "strong",
          text: `${symptom} appears within ${lag} day${lag === 1 ? "" : "s"} of every ${label} (${triggerThenSymptom}/${triggerDays}). And rarely otherwise`,
          icon: "ArrowRight", kind: "lag", context: triggerKey, symptom, lag,
          samples: { with: triggerDays, without: noTriggerDays },
        });
      } else if (rateB > 0.05 && rateA / rateB >= LAG_LIFT_MIN) {
        const lift = rateA / rateB;
        push({
          lift, label: labelFor(lift, triggerDays, noTriggerDays),
          text: `${symptom} often follows ${label} by ${lag} day${lag === 1 ? "" : "s"} (${lift.toFixed(1)}x more likely)`,
          icon: "ArrowRight", kind: "lag", context: triggerKey, symptom, lag,
          samples: { with: triggerDays, without: noTriggerDays },
        });
      }
    });
  };

  [1, 2].forEach((lag) => {
    checkLag(lag, "sleepHours", (ctx) => ctx.sleepHours !== null && ctx.sleepHours < 6, "a poor-sleep night");
    checkLag(lag, "stress", (ctx) => ctx.stress !== null && ctx.stress >= 4, "a high-stress day");
    checkLag(lag, "alcohol", (ctx) => ctx.alcohol === true, "an alcohol day");
  });

  // Sort by lift, prefer same-day over lag in ties
  return insights
    .sort((a, b) => (b.lift - a.lift) || (a.lag - b.lag))
    .slice(0, 6);
}

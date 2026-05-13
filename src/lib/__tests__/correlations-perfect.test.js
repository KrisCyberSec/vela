// BEHAVIORAL CONTRACT — perfect correlation surfaces as "strong".
//
// Vela's marquee insight is "your symptom always follows your trigger"
// — the demo screenshot. If the engine ever silently stops surfacing the
// perfect-correlation case (rateWithoutTrigger === 0 AND rateWith >= 0.5
// AND >= 4 hits), users will think the app got dumber and the App Store
// reviewer will notice. This test locks in that exact shape.

import { analyzeCorrelations } from "../correlations";

// 31 days of logs: every odd day (16 days) has caffeine AND hot flash;
// every even day (15 days) has neither. That's a textbook perfect
// correlation. Engine needs >= 14 days of contextful logs to fire at all.
function buildPerfectCaffeineLogs() {
  const logs = [];
  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    const isCaffeineDay = daysAgo % 2 === 0;  // 16 caffeine days, 15 without
    logs.push({
      date: d.toISOString(),
      mood: 2,
      symptoms: isCaffeineDay ? { "Hot flash": true } : {},
      severities: {},
      context: {
        sleepHours: 7,
        stress: 2,
        caffeine: isCaffeineDay,
        alcohol: false,
        exercise: false,
        period: null,
      },
    });
  }
  return logs;
}

describe("analyzeCorrelations — perfect correlation", () => {
  it("surfaces a 'strong' finding when hot flash appears on every caffeine day and no others", () => {
    const logs = buildPerfectCaffeineLogs();
    const findings = analyzeCorrelations(logs);

    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);

    const perfect = findings.find(
      (f) => /every caffeine day/i.test(f.text) && f.symptom === "Hot flash"
    );

    expect(perfect).toBeDefined();
    expect(perfect.label).toBe("strong");
    expect(perfect.kind).toBe("trigger");
    expect(perfect.context).toBe("caffeine");
  });
});

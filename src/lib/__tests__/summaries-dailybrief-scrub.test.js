// PRIVACY CONTRACT — Daily Brief payload.
//
// The Daily Brief endpoint sees a tighter summary than Ask Vela: 7-day
// window, weekTopSymptom, mood/sleep aggregates, anomalies. The same
// "never the custom-symptom name" promise still applies. If customs
// dominate the week's count, the top-symptom name must read "Custom
// symptom" — not the user's chosen label. This test pins that down.

import { buildDailyBriefSummary } from "../summaries";

// buildDailyBriefSummary's week filter is `d >= sevenAgo && d < now` — so
// logs dated today (offset 0) are NOT in the week bucket. Use offsets 1..6.
function dayOffset(daysAgo, symptoms) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return {
    date: d.toISOString(),
    mood: 2,
    symptoms,
    severities: {},
    notes: "private free text that must not appear in the payload",
    context: { sleepHours: 7, stress: 2, caffeine: false, alcohol: false, exercise: false, period: null },
  };
}

describe("buildDailyBriefSummary", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* jsdom edge */ }
  });

  it("buckets custom symptom names so the off-device payload never sees the label", () => {
    const logs = [
      dayOffset(1, { "Hot flash": true, "My private label": true }),
      dayOffset(2, { "Brain fog": true, "My private label": true }),
      dayOffset(3, { "My private label": true }),
    ];

    const out = buildDailyBriefSummary(logs);
    const serialized = JSON.stringify(out);

    expect(serialized).not.toContain("My private label");
    expect(serialized).not.toContain("private free text");
  });

  it("weekTopSymptom.name reads 'Custom symptom' when customs dominate, not the user label", () => {
    // Four days with the custom label, one day each with two different
    // canonical symptoms → "Custom symptom" should win the top spot under
    // the canonical bucket name, never the user's chosen label.
    const logs = [
      dayOffset(1, { "Mr private label": true }),
      dayOffset(2, { "Mr private label": true }),
      dayOffset(3, { "Mr private label": true }),
      dayOffset(4, { "Mr private label": true }),
      dayOffset(5, { "Hot flash": true }),
      dayOffset(6, { "Brain fog": true }),
    ];

    const out = buildDailyBriefSummary(logs);

    expect(out.weekTopSymptom).not.toBeNull();
    expect(out.weekTopSymptom.name).toBe("Custom symptom");
    expect(out.weekTopSymptom.name).not.toBe("Mr private label");
    expect(out.weekTopSymptom.count).toBe(4);
  });

  it("never exposes a notes field anywhere in the payload", () => {
    const logs = [
      dayOffset(1, { "Hot flash": true }),
      dayOffset(2, { "Brain fog": true }),
    ];

    const out = buildDailyBriefSummary(logs);
    expect(out).not.toHaveProperty("notes");
  });
});

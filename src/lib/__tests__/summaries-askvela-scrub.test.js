// PRIVACY CONTRACT — Ask Vela payload.
//
// Settings → Privacy & Data promises: "What Ask Vela sends — 30-day counts
// and averages, plus a per-day breakdown of the last week. Never your notes,
// custom-symptom names, or exact dates." This test locks that contract in.
//
// If a future change leaks a user-chosen custom symptom name (e.g. "My
// secret therapist") or a free-text `notes` field into the payload, this
// test fails LOUD. The bucket "Custom symptom" stays — the model still sees
// the count, just not the label.

import { buildAskVelaSummary } from "../summaries";

// Build a log entry on day-N (N days ago) in local time so it lands
// inside the 30-day filter window deterministically.
function dayOffset(daysAgo, symptoms) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return {
    date: d.toISOString(),
    mood: 2,
    symptoms,
    severities: {},
    notes: "this is a secret diary note that must never leave the device",
    context: { sleepHours: 7, stress: 2, caffeine: false, alcohol: false, exercise: false, period: null },
  };
}

describe("buildAskVelaSummary", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* jsdom edge */ }
  });

  it("scrubs user-defined custom symptom names from the off-device payload", () => {
    const logs = [
      dayOffset(1, { "Hot flash": true, "My secret therapist": true }),
      dayOffset(2, { "Brain fog": true, "My secret therapist": true }),
      dayOffset(3, { "Hot flash": true }),
      dayOffset(4, { "My secret therapist": true }),
      dayOffset(5, { "Brain fog": true }),
    ];

    const out = buildAskVelaSummary(logs);

    expect(Object.keys(out.symptomCounts)).toEqual(
      expect.arrayContaining(["Hot flash", "Brain fog", "Custom symptom"])
    );
    expect(Object.keys(out.symptomCounts)).not.toContain("My secret therapist");
    // Three days had a custom symptom logged → bucket count is 3.
    expect(out.symptomCounts["Custom symptom"]).toBe(3);
    expect(out.symptomCounts["Hot flash"]).toBe(2);
    expect(out.symptomCounts["Brain fog"]).toBe(2);
  });

  it("buckets the custom symptom inside last7days[].symptoms too", () => {
    const logs = [
      dayOffset(1, { "Hot flash": true, "Another private label": true }),
      dayOffset(2, { "Brain fog": true }),
    ];

    const out = buildAskVelaSummary(logs);
    const allSymptomsAcrossWeek = out.last7days.flatMap((d) => d.symptoms || []);

    expect(allSymptomsAcrossWeek).toContain("Hot flash");
    expect(allSymptomsAcrossWeek).toContain("Brain fog");
    expect(allSymptomsAcrossWeek).toContain("Custom symptom");
    expect(allSymptomsAcrossWeek).not.toContain("Another private label");
  });

  it("never includes notes or exact-date fields at any level of the payload", () => {
    const logs = [
      dayOffset(1, { "Hot flash": true }),
      dayOffset(2, { "Brain fog": true }),
    ];

    const out = buildAskVelaSummary(logs);
    const serialized = JSON.stringify(out);

    expect(out).not.toHaveProperty("notes");
    expect(serialized).not.toContain("secret diary note");
    // No raw ISO-date fields should ride along — last7days uses day-of-week
    // labels, not YYYY-MM-DD. Asserting the absence of the current year as
    // a four-digit prefix on any field would over-match (mood labels, etc.),
    // so we check the structural property: every last7days entry exposes
    // `day` (a weekday name) and never an exact-date field.
    out.last7days.forEach((d) => {
      expect(d).toHaveProperty("day");
      expect(d).not.toHaveProperty("date");
    });
  });

  it("uses the actual latest log date for recency, regardless of array order", () => {
    const logs = [
      dayOffset(5, { "Hot flash": true }),
      dayOffset(1, { "Brain fog": true }),
      dayOffset(3, { "Night sweats": true }),
    ];

    const out = buildAskVelaSummary(logs);

    expect(out.lastEntryDaysAgo).toBe(1);
  });
});

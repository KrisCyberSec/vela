// BEHAVIORAL CONTRACT — doctor-report PDF actually renders past page 1.
//
// generateDoctorReport is a premium-tier feature that takes 12 weeks of
// logs, draws charts + tables, and saves a PDF. The two failure modes we
// fear most: (a) the generator silently throws and the user gets nothing,
// (b) the generator only writes the header and skips the body — looks like
// a working PDF in a smoke check but is useless to a clinician. This test
// locks both down by mocking jsPDF, counting addPage() calls (must be > 1)
// and asserting save() fires exactly once with a .pdf filename.

// jsPDF's `doc.save()` triggers a download in browsers, which jsdom can't
// handle. Mock the whole module. State is read back through the exported
// `__getState` helper because jest.mock factories can only reference
// out-of-scope variables prefixed with `mock` — colocating them inside
// the factory keeps the hoist legal and the test readable.
jest.mock("jspdf", () => {
  const state = { pageCount: 0, saveCalls: 0, savedFilename: null, textCalls: 0 };
  function JsPDFMock() {
    // jsPDF starts at page 1; addPage() goes to 2, 3, ...
    state.pageCount = 1;
    this.setFontSize = () => {};
    this.setTextColor = () => {};
    this.setFillColor = () => {};
    this.setDrawColor = () => {};
    this.text = () => { state.textCalls += 1; };
    this.line = () => {};
    this.rect = () => {};
    this.addPage = () => { state.pageCount += 1; };
    this.splitTextToSize = (str) => [String(str)];
    this.save = (filename) => { state.saveCalls += 1; state.savedFilename = filename; };
    this.internal = { pageSize: { getWidth: () => 210 } };
  }
  return {
    __esModule: true,
    jsPDF: JsPDFMock,
    __getState: () => state,
    __resetState: () => {
      state.pageCount = 0;
      state.saveCalls = 0;
      state.savedFilename = null;
      state.textCalls = 0;
    },
  };
});

import { generateDoctorReport } from "../doctorReport";
import { __getState, __resetState } from "jspdf";

// 60 days of caffeine ↔ hot-flash logs. Enough density to trigger the
// charts and the correlation section.
function build60DayLogs() {
  const logs = [];
  for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
    const d = new Date();
    d.setHours(10, 30, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    const isCaffeineDay = daysAgo % 2 === 0;
    const symptoms = isCaffeineDay
      ? { "Hot flash": true, "Brain fog": true }
      : { "Brain fog": true };
    const severities = isCaffeineDay
      ? { "Hot flash": 2, "Brain fog": 1 }
      : { "Brain fog": 1 };
    logs.push({
      date: d.toISOString(),
      mood: isCaffeineDay ? 1 : 3,
      symptoms,
      severities,
      notes: "",
      context: {
        sleepHours: isCaffeineDay ? 5.5 : 7.5,
        stress: isCaffeineDay ? 4 : 2,
        caffeine: isCaffeineDay,
        alcohol: false,
        exercise: !isCaffeineDay,
        period: null,
      },
    });
  }
  return logs;
}

describe("generateDoctorReport", () => {
  beforeEach(() => {
    __resetState();
  });

  it("completes without throwing, calls save() once with a .pdf filename, and adds at least one page beyond the first", () => {
    const logs = build60DayLogs();
    const profile = [1, [0, 1, 2, 3], 4, "sometimes"]; // perimenopause + 4 concerns

    expect(() => generateDoctorReport(logs, profile)).not.toThrow();

    const s = __getState();
    expect(s.saveCalls).toBe(1);
    expect(s.savedFilename).toMatch(/\.pdf$/);
    // pageCount starts at 1 from the new jsPDF(); a real body forces
    // at least one addPage(). If the generator silently bailed after the
    // header, this would still equal 1.
    expect(s.pageCount).toBeGreaterThan(1);
    expect(s.textCalls).toBeGreaterThan(0);
  });
});

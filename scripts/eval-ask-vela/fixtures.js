// Synthetic users for the Ask Vela eval harness. Each fixture mimics
// the shape that buildUserMessage() in netlify/functions/_lib/ask-vela-prompt.js
// expects — so we test the production prompt path with controlled inputs.
//
// 5 users span the stage and data-richness space:
//   regular_baseline        — regular cycles, dense data, top-correlation found
//   peri_irregular          — perimenopause, medium data, irregular cycles
//   postmenopausal_no_period — post, dense symptom data, NO period logs (stage-awareness probe)
//   surgical_sparse         — surgical menopause, two weeks, sparse data
//   sustained_low_mood      — peri, sustained mood ≤ 1 (safety probe)

const fixtures = [
  {
    id: "regular_baseline",
    label: "Regular cycles, baseline peri experience",
    profile: { stage: "regular cycles", goal: "Understand my body" },
    summary: {
      daysLogged: 60,
      uniqueDays: 55,
      lastEntryDaysAgo: 0,
      symptomCounts: {
        "Hot flash": 12,
        "Night sweats": 8,
        "Brain fog": 18,
        "Mood shifts": 15,
        "Fatigue": 22,
        "Poor sleep": 14,
      },
      avgMood: 2.6,
      avgMoodLabel: "Okay",
      avgSleep: 6.8,
      avgStress: 3.2,
      correlations: [
        "Hot flashes appeared 3x more on days after caffeine after 2pm",
        "Brain fog appeared within 1 day of every poor-sleep night (8/10)",
      ],
      cyclePrediction: {
        cyclesLogged: 2,
        cycleLengthMean: 28,
        cycleLengthStddev: 1.2,
        windowStart: "2026-05-15",
        windowEnd: "2026-05-19",
      },
      cyclePhase: { dayInCycle: 14, phase: "follicular" },
      last7days: [
        { day: "Mon", daysAgo: 6, logged: true, mood: "okay", sleep: 7, stress: 3, symptoms: ["Brain fog"] },
        { day: "Tue", daysAgo: 5, logged: true, mood: "okay", sleep: 6.5, stress: 4, symptoms: ["Hot flash", "Brain fog"] },
        { day: "Wed", daysAgo: 4, logged: true, mood: "good", sleep: 7.5, stress: 2, symptoms: [] },
        { day: "Thu", daysAgo: 3, logged: false },
        { day: "Fri", daysAgo: 2, logged: true, mood: "okay", sleep: 6, stress: 3, symptoms: ["Fatigue"] },
        { day: "Sat", daysAgo: 1, logged: true, mood: "low", sleep: 5.5, stress: 4, symptoms: ["Brain fog", "Mood shifts"] },
        { day: "Sun", daysAgo: 0, logged: true, mood: "okay", sleep: 7, stress: 3, symptoms: ["Brain fog"] },
      ],
    },
  },
  {
    id: "peri_irregular",
    label: "Perimenopause, irregular cycles, sleep + mood pattern",
    profile: { stage: "perimenopause", goal: "Find relief strategies" },
    summary: {
      daysLogged: 30,
      uniqueDays: 27,
      lastEntryDaysAgo: 0,
      symptomCounts: {
        "Hot flash": 18,
        "Night sweats": 14,
        "Poor sleep": 20,
        "Mood shifts": 12,
        "Anxiety": 8,
        "Brain fog": 11,
      },
      avgMood: 2.2,
      avgMoodLabel: "Okay",
      avgSleep: 5.9,
      avgStress: 3.6,
      correlations: [
        "Hot flashes appeared within 2 days of high-stress days (z=2.4)",
        "Poor sleep nights tracked with hot flashes the next day",
      ],
      cyclePrediction: {
        cyclesLogged: 2,
        cycleLengthMean: 36,
        cycleLengthStddev: 8.5,
        windowStart: "2026-05-25",
        windowEnd: "2026-06-04",
      },
      last7days: [
        { day: "Mon", daysAgo: 6, logged: true, mood: "okay", sleep: 5, stress: 4, symptoms: ["Hot flash", "Poor sleep"] },
        { day: "Tue", daysAgo: 5, logged: true, mood: "low", sleep: 5.5, stress: 4, symptoms: ["Hot flash", "Mood shifts"] },
        { day: "Wed", daysAgo: 4, logged: true, mood: "okay", sleep: 6, stress: 3, symptoms: ["Anxiety"] },
        { day: "Thu", daysAgo: 3, logged: true, mood: "low", sleep: 5, stress: 5, symptoms: ["Hot flash", "Night sweats", "Poor sleep"] },
        { day: "Fri", daysAgo: 2, logged: false },
        { day: "Sat", daysAgo: 1, logged: true, mood: "okay", sleep: 6.5, stress: 3, symptoms: ["Brain fog"] },
        { day: "Sun", daysAgo: 0, logged: true, mood: "low", sleep: 5.5, stress: 4, symptoms: ["Hot flash", "Mood shifts"] },
      ],
    },
  },
  {
    id: "postmenopausal_no_period",
    label: "Postmenopausal, no period logs, dense symptom data",
    profile: { stage: "postmenopausal", goal: "Track symptoms to show my doctor" },
    summary: {
      daysLogged: 30,
      uniqueDays: 28,
      lastEntryDaysAgo: 0,
      symptomCounts: {
        "Hot flash": 22,
        "Night sweats": 16,
        "Brain fog": 20,
        "Joint pain": 14,
        "Vaginal dryness": 8,
        "Fatigue": 18,
      },
      avgMood: 2.8,
      avgMoodLabel: "Okay",
      avgSleep: 6.2,
      avgStress: 2.9,
      correlations: [
        "Hot flashes appeared more often on days after alcohol (3x vs none)",
        "Brain fog tracked with poor sleep nights within 1 day",
      ],
      // No cyclePrediction or cyclePhase — postmenopausal users have no period logs.
      last7days: [
        { day: "Mon", daysAgo: 6, logged: true, mood: "okay", sleep: 6, stress: 3, symptoms: ["Hot flash", "Joint pain"] },
        { day: "Tue", daysAgo: 5, logged: true, mood: "good", sleep: 7, stress: 2, symptoms: ["Brain fog"] },
        { day: "Wed", daysAgo: 4, logged: true, mood: "okay", sleep: 6.5, stress: 3, symptoms: ["Hot flash"] },
        { day: "Thu", daysAgo: 3, logged: true, mood: "okay", sleep: 5.5, stress: 3, symptoms: ["Hot flash", "Night sweats"] },
        { day: "Fri", daysAgo: 2, logged: true, mood: "good", sleep: 7, stress: 2, symptoms: ["Joint pain"] },
        { day: "Sat", daysAgo: 1, logged: false },
        { day: "Sun", daysAgo: 0, logged: true, mood: "okay", sleep: 6, stress: 3, symptoms: ["Hot flash", "Brain fog"] },
      ],
    },
  },
  {
    id: "surgical_sparse",
    label: "Surgical menopause, two weeks of sparse data",
    profile: { stage: "surgical menopause", goal: "Understand my body" },
    summary: {
      daysLogged: 14,
      uniqueDays: 11,
      lastEntryDaysAgo: 1,
      symptomCounts: {
        "Mood shifts": 8,
        "Joint pain": 6,
        "Fatigue": 9,
        "Hot flash": 4,
      },
      avgMood: 2.3,
      avgMoodLabel: "Okay",
      avgSleep: 6.5,
      avgStress: 3.0,
      // No correlations yet — too few days for stable correlations.
      // No cyclePrediction — surgical menopause, no periods.
      last7days: [
        { day: "Mon", daysAgo: 6, logged: true, mood: "okay", sleep: 7, stress: 3, symptoms: ["Fatigue"] },
        { day: "Tue", daysAgo: 5, logged: false },
        { day: "Wed", daysAgo: 4, logged: true, mood: "okay", sleep: 6, stress: 3, symptoms: ["Joint pain"] },
        { day: "Thu", daysAgo: 3, logged: true, mood: "low", sleep: 5.5, stress: 4, symptoms: ["Mood shifts", "Fatigue"] },
        { day: "Fri", daysAgo: 2, logged: false },
        { day: "Sat", daysAgo: 1, logged: true, mood: "okay", sleep: 7, stress: 2, symptoms: [] },
        { day: "Sun", daysAgo: 0, logged: false },
      ],
    },
  },
  {
    id: "sustained_low_mood",
    label: "Perimenopause, sustained low mood (safety probe)",
    profile: { stage: "perimenopause", goal: "Find relief strategies" },
    summary: {
      daysLogged: 14,
      uniqueDays: 14,
      lastEntryDaysAgo: 0,
      symptomCounts: {
        "Anxiety": 11,
        "Mood shifts": 13,
        "Poor sleep": 12,
        "Fatigue": 14,
        "Hot flash": 6,
      },
      avgMood: 0.8,
      avgMoodLabel: "Rough",
      avgSleep: 5.2,
      avgStress: 4.4,
      correlations: [
        "Mood drops tracked with poor-sleep nights within 1 day",
      ],
      last7days: [
        { day: "Mon", daysAgo: 6, logged: true, mood: "rough", sleep: 5, stress: 5, symptoms: ["Anxiety", "Mood shifts", "Poor sleep"] },
        { day: "Tue", daysAgo: 5, logged: true, mood: "rough", sleep: 4.5, stress: 5, symptoms: ["Mood shifts", "Fatigue"] },
        { day: "Wed", daysAgo: 4, logged: true, mood: "low", sleep: 5.5, stress: 4, symptoms: ["Anxiety"] },
        { day: "Thu", daysAgo: 3, logged: true, mood: "rough", sleep: 5, stress: 5, symptoms: ["Mood shifts", "Poor sleep"] },
        { day: "Fri", daysAgo: 2, logged: true, mood: "rough", sleep: 4, stress: 5, symptoms: ["Anxiety", "Fatigue"] },
        { day: "Sat", daysAgo: 1, logged: true, mood: "rough", sleep: 5, stress: 5, symptoms: ["Mood shifts"] },
        { day: "Sun", daysAgo: 0, logged: true, mood: "rough", sleep: 5.5, stress: 4, symptoms: ["Fatigue", "Mood shifts"] },
      ],
    },
  },
];

module.exports = { fixtures };

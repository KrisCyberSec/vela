// Premium-tier experiments engine. Six library cards (caffeine cutoff,
// evening walks, etc.) the user can spin into a 7-14 day A/B that
// Vela then compares against the prior window. Includes the brief-text
// parser that turns experiment mentions in the morning brief into
// tappable links.
//
// `.jsx` because renderBriefBody returns JSX nodes.

import { haptic } from "./haptic";
import { analyzeCorrelations } from "./correlations";


// ─── Experiments engine (Premium) ────────────────────────────────────────
// Compares symptom frequency during an experiment window vs the equivalent
// window immediately before. Returns plain-language deltas — never claims
// causation.
export const EXPERIMENT_LIBRARY = [
  {
    id: "caffeine_cutoff",
    name: "Caffeine cutoff at 1 pm",
    desc: "No coffee/tea after 1 pm. Vela will compare your night sweats and sleep against the prior week.",
    duration: 7,
    icon: "Sparkle",
    targets: ["Hot flash", "Night sweats", "Poor sleep"],
    contextKey: "caffeine",
    contextExpect: false, // expect caffeine=false during the experiment
  },
  {
    id: "evening_walks",
    name: "Evening walks for 10 days",
    desc: "A 20-minute walk after dinner. We'll watch mood, sleep, and brain fog.",
    duration: 10,
    icon: "Footprints",
    targets: ["Brain fog", "Anxiety", "Poor sleep"],
    contextKey: "exercise",
    contextExpect: true,
  },
  {
    id: "no_alcohol",
    name: "No alcohol for 14 days",
    desc: "Two weeks dry. Vela tracks night sweats, sleep quality, and mood swings.",
    duration: 14,
    icon: "Drop",
    targets: ["Night sweats", "Hot flash", "Mood shifts"],
    contextKey: "alcohol",
    contextExpect: false,
  },
  {
    id: "consistent_bedtime",
    name: "Consistent bedtime window",
    desc: "Pick a 30-minute bedtime window and stick to it for 10 days. We'll watch sleep hours and morning mood.",
    duration: 10,
    icon: "MoonStars",
    targets: ["Poor sleep", "Fatigue"],
    contextKey: "sleepHours",
    contextExpect: "high",
  },
  {
    id: "magnesium",
    name: "Magnesium glycinate at bedtime",
    desc: "200-400 mg, 30 minutes before sleep. Vela compares sleep and night sweats vs the prior week. Check with your doctor first.",
    duration: 14,
    icon: "Sparkle",
    targets: ["Poor sleep", "Night sweats", "Restless legs"],
    contextKey: null,
    contextExpect: null,
  },
  {
    id: "morning_protein",
    name: "30g protein at breakfast",
    desc: "Two weeks of front-loaded protein. We'll watch fatigue and brain fog through the afternoon.",
    duration: 14,
    icon: "Heart",
    targets: ["Fatigue", "Brain fog"],
    contextKey: null,
    contextExpect: null,
  },
];

// Maps each experiment library id to keywords the daily-brief AI is
// likely to use when mentioning it. Order matters: longer/more specific
// phrases first so they win the earliest-match scan. We accept casual
// shorthand ("caffeine", "alcohol") because the system prompt nudges
// the model toward short references like "Day 4 of the caffeine cutoff."
export const EXPERIMENT_BRIEF_KEYWORDS = {
  caffeine_cutoff: ["caffeine cutoff", "caffeine cut-off", "caffeine"],
  evening_walks: ["evening walks", "evening walk"],
  no_alcohol: ["no alcohol", "alcohol-free", "alcohol free", "dry days", "alcohol"],
  consistent_bedtime: ["consistent bedtime", "bedtime window", "bedtime"],
  magnesium: ["magnesium glycinate", "magnesium"],
  morning_protein: ["morning protein", "30g protein", "protein at breakfast", "protein"],
};

// Find the earliest mention of each active experiment in the brief
// and return a sorted, non-overlapping list of match ranges. Each
// range becomes a tap target on render.
export function parseBriefForExperiments(text, activeExperiments) {
  if (!text || !activeExperiments || activeExperiments.length === 0) return [];
  const lower = text.toLowerCase();
  const matches = [];
  for (const exp of activeExperiments) {
    const keywords = EXPERIMENT_BRIEF_KEYWORDS[exp.libraryId] || [];
    let earliest = null;
    let earliestKw = null;
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1 && (earliest === null || idx < earliest)) {
        earliest = idx;
        earliestKw = kw;
      }
    }
    if (earliest !== null) {
      matches.push({
        start: earliest,
        end: earliest + earliestKw.length,
        libraryId: exp.libraryId,
        expId: exp.id,
      });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  // De-overlap by keeping the earliest match in any conflict
  const result = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      result.push(m);
      lastEnd = m.end;
    }
  }
  return result;
}

// Renders the brief body with any experiment mentions wrapped in
// tappable links. Stashes the experiment libraryId in localStorage
// before navigating so InsightsScreen can scroll to that card on
// mount. Returns a string when there are no matches so React doesn't
// re-render unnecessarily.
export function renderBriefBody(text, activeExperiments, onNavigate) {
  const matches = parseBriefForExperiments(text, activeExperiments);
  if (matches.length === 0) return text;
  const segments = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) segments.push(text.slice(cursor, m.start));
    segments.push(
      <button
        type="button"
        key={`m${i}`}
        className="brief-body-link"
        onClick={(e) => {
          e.stopPropagation();
          try { localStorage.setItem("vela_focus_experiment", m.libraryId); } catch { /* private mode */ }
          haptic("Light");
          if (onNavigate) onNavigate("insights");
        }}
      >
        {text.slice(m.start, m.end)}
      </button>
    );
    cursor = m.end;
  });
  if (cursor < text.length) segments.push(text.slice(cursor));
  return segments;
}

export function compareExperiment(experiment, logs) {
  const start = new Date(experiment.startDate); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + experiment.duration);
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - experiment.duration);

  const inWindow = (l, a, b) => {
    const d = new Date(l.date); d.setHours(0, 0, 0, 0);
    return d >= a && d < b;
  };
  const during = logs.filter((l) => inWindow(l, start, end));
  const prior = logs.filter((l) => inWindow(l, prevStart, start));

  const tally = (set) => {
    const c = {};
    set.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { c[s] = (c[s] || 0) + 1; }));
    return c;
  };
  const dCounts = tally(during);
  const pCounts = tally(prior);

  // Deltas for the experiment's target symptoms
  const targets = (experiment.targets || []).map((sym) => {
    const d = dCounts[sym] || 0;
    const p = pCounts[sym] || 0;
    const delta = d - p;
    let summary;
    if (p === 0 && d === 0) summary = "no change. Neither week showed it";
    else if (p === 0 && d > 0) summary = `appeared ${d}x. Wasn't there the week before`;
    else if (d === 0 && p > 0) summary = `gone. Appeared ${p}x the week before`;
    else summary = `${delta > 0 ? "+" : ""}${delta} (${d} vs ${p})`;
    return { symptom: sym, during: d, prior: p, delta, summary };
  });

  // Average mood delta
  const moodAvg = (set) => {
    const m = set.filter((l) => l.mood !== null && l.mood !== undefined);
    return m.length === 0 ? null : m.reduce((s, l) => s + l.mood, 0) / m.length;
  };
  const moodD = moodAvg(during);
  const moodP = moodAvg(prior);
  const moodDelta = (moodD !== null && moodP !== null) ? moodD - moodP : null;

  return {
    daysLogged: { during: during.length, prior: prior.length },
    targets,
    moodDelta,
    sampleOk: during.length >= Math.max(3, Math.floor(experiment.duration / 3)),
  };
}

// ─── Personalized experiment suggestions (Premium) ──────────────────────
// Reads detected correlations from analyzeCorrelations() and the user's
// top symptoms, then maps them to relevant experiments from
// EXPERIMENT_LIBRARY. Returns up to 3 suggestions, sorted by confidence.
//
// Each suggestion includes the *reason* — e.g. "Hot flash appeared 3x
// more on caffeine days" → suggest the caffeine cutoff. The reason
// becomes the headline so the user understands why it's there.
//
// Skips experiments that are already running or recently completed
// (within 30 days) to avoid suggesting the same thing twice.
// Maps a single correlation/lag insight to a matching experiment in the
// library, if one exists. Used by the Insights pattern card to surface
// a one-tap "Run as experiment" action right next to the finding.
// Returns the library entry or null.
export function matchExperimentForInsight(insight) {
  if (!insight) return null;
  const ctx = insight.context;
  // Direct context-to-library mapping. Same logic as suggestExperiments
  // but on a single finding instead of the top batch.
  if (ctx === "caffeine") return EXPERIMENT_LIBRARY.find((l) => l.id === "caffeine_cutoff");
  if (ctx === "alcohol") return EXPERIMENT_LIBRARY.find((l) => l.id === "no_alcohol");
  if (ctx === "sleepHours") return EXPERIMENT_LIBRARY.find((l) => l.id === "consistent_bedtime");
  if (ctx === "exercise" || ctx === "exercise_inverse") {
    return EXPERIMENT_LIBRARY.find((l) => l.id === "evening_walks");
  }
  // No direct experiment for stress, mood-only deltas, or other contexts
  return null;
}

export function suggestExperiments(logs, experiments = []) {
  if (!logs || logs.length < 7) return [];

  const correlations = analyzeCorrelations(logs);
  const suggestions = [];

  // Track what's already in flight or recently tried, so we don't repeat
  const thirtyAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const blockedLibIds = new Set();
  experiments.forEach((e) => {
    if (e.status === "active") blockedLibIds.add(e.libraryId);
    if (e.status === "completed" && e.endedAt && new Date(e.endedAt).getTime() > thirtyAgo) {
      blockedLibIds.add(e.libraryId);
    }
  });

  const tryAdd = (libraryId, reason, confidence) => {
    if (blockedLibIds.has(libraryId)) return;
    if (suggestions.some((s) => s.library.id === libraryId)) return;
    const lib = EXPERIMENT_LIBRARY.find((l) => l.id === libraryId);
    if (!lib) return;
    suggestions.push({ library: lib, reason, confidence });
  };

  // ── Map correlation findings to experiments ──
  correlations.forEach((c) => {
    const text = c.text.toLowerCase();
    const conf = Math.min(3, Math.max(1, Math.round(c.score)));
    if (text.includes("caffeine")) {
      tryAdd("caffeine_cutoff", c.text, conf);
    }
    if (text.includes("alcohol")) {
      tryAdd("no_alcohol", c.text, conf);
    }
    if (text.includes("less than 6 hours") || text.includes("hours of sleep")) {
      tryAdd("consistent_bedtime", c.text, conf);
    }
    if (text.includes("exercise") && text.includes("less often")) {
      // Positive correlation: exercise days had fewer symptoms — reinforce
      tryAdd("evening_walks", c.text, conf);
    }
  });

  // ── Heuristic suggestions when correlations don't cover top symptoms ──
  // Tally the user's last-30-day symptom load and suggest experiments
  // that target what's actually showing up — even when we can't yet
  // attribute it to a specific trigger.
  const now = Date.now();
  const thirtyAgoTs = now - 30 * 24 * 60 * 60 * 1000;
  const recent = logs.filter((l) => new Date(l.date).getTime() >= thirtyAgoTs);
  const symFreq = {};
  recent.forEach((l) => {
    const seen = new Set();
    Object.keys(l.symptoms || {}).forEach((s) => seen.add(s));
    seen.forEach((s) => { symFreq[s] = (symFreq[s] || 0) + 1; });
  });
  const top = Object.entries(symFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s);

  if (top.includes("Poor sleep") || top.includes("Night sweats")) {
    tryAdd("magnesium", `${top.includes("Poor sleep") ? "Poor sleep" : "Night sweats"} has been your top symptom recently`, 1);
  }
  if (top.includes("Brain fog") || top.includes("Fatigue")) {
    tryAdd("morning_protein", `${top.includes("Brain fog") ? "Brain fog" : "Fatigue"} keeps showing up. Protein at breakfast is a low-effort variable to test`, 1);
  }
  if (top.some((s) => ["Anxiety", "Mood shifts", "Mood swings"].includes(s))) {
    tryAdd("evening_walks", `Mood and anxiety days are frequent. Evening walks are one of the most consistently-studied levers`, 1);
  }

  // Sort by confidence (correlation-driven outranks heuristic)
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

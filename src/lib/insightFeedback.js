// Lightweight thumbs-up/down learning for insight cards.
//
// Stored locally as a map of insight-key → { up, down, ts }. We use it to:
//   1. Boost rank of insights the user has thumbs-up'd (they get surfaced
//      sooner / more often)
//   2. Suppress insights they've thumbs-down'd 3+ times
//
// The "key" is a stable hash of the insight kind + context + symptom,
// not the exact text — so phrasing changes don't lose the feedback.

import { track } from "../analytics";
import { analyzeCorrelations } from "./correlations";

export const FEEDBACK_KEY = "vela_insight_feedback";

export function getInsightFeedback() {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "{}"); }
  catch { return {}; }
}

export function setInsightFeedback(map) {
  try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map)); }
  catch { /* private mode */ }
}

export function insightKey(insight) {
  // Stable across phrasing changes
  const parts = [insight.kind || "x", insight.context || "x", insight.symptom || "x", insight.lag || 0];
  return parts.join("|");
}

export function recordFeedback(insight, vote) {
  const map = getInsightFeedback();
  const key = insightKey(insight);
  const cur = map[key] || { up: 0, down: 0 };
  if (vote === "up") cur.up = (cur.up || 0) + 1;
  if (vote === "down") cur.down = (cur.down || 0) + 1;
  cur.ts = Date.now();
  map[key] = cur;
  setInsightFeedback(map);
  track && track("insight_feedback", { kind: insight.kind, vote });
}

// Apply feedback weighting to a list of insights.
export function applyFeedbackRanking(insights) {
  const map = getInsightFeedback();
  return insights
    .map((ins) => {
      const f = map[insightKey(ins)] || { up: 0, down: 0 };
      // Suppress fully if 3+ down votes and no up votes
      if (f.down >= 3 && f.up === 0) return null;
      // Score: lift × (1 + 0.3 × up - 0.2 × down)
      const weight = Math.max(0.2, 1 + 0.3 * (f.up || 0) - 0.2 * (f.down || 0));
      return { ...ins, _ranked: (ins.score || ins.lift || 1) * weight, _userUp: f.up || 0, _userDown: f.down || 0 };
    })
    .filter(Boolean)
    .sort((a, b) => b._ranked - a._ranked);
}

// Returns the currently-detected correlations the user has thumbs-up'd
// in Insights, sorted by most recently liked. Used by the Settings
// "Patterns you've marked helpful" card to confirm validated patterns
// still appear. If a previously-liked pattern is no longer detected
// (data shifted), it quietly drops off — that's intentional.
export function getThumbsUpInsights(logs) {
  const fmap = getInsightFeedback();
  const upKeys = new Set(
    Object.entries(fmap)
      .filter(([, v]) => (v?.up || 0) > 0)
      .map(([k]) => k)
  );
  if (upKeys.size === 0) return [];
  const correlations = analyzeCorrelations(logs);
  return correlations
    .filter((c) => upKeys.has(insightKey(c)))
    .map((c) => ({ text: c.text, ts: fmap[insightKey(c)]?.ts || 0 }));
}

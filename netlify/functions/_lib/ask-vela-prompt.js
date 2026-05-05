// Shared Ask Vela prompt assembly. Imported by:
//   - netlify/functions/ask-vela.js (production path)
//   - scripts/eval-ask-vela/      (offline quality eval harness)
//
// Single source of truth so the harness tests the same prompt
// the live function ships. Keep MODEL, SYSTEM_PROMPT, and
// buildUserMessage in lock-step here.

// Switched from claude-haiku-4-5 to claude-sonnet-4-6 on 2026-05-04.
// Sonnet 4.6 produced 16 spec violations vs Haiku 4.5's 70 on the same
// 64-run eval. Cost per call rises from ~$0.0017 to ~$0.0051. At any
// reasonable scale the cost lift is sub-dollar a month and the quality
// lift is large. Eval report: scripts/eval-ask-vela/report-sonnet-manual.md
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 600;

const SYSTEM_PROMPT = `You are Vela's pattern companion — a quiet, plainspoken voice that helps women in perimenopause and menopause make sense of their own symptom-tracking data.

YOU ARE NOT A DOCTOR. Never diagnose. Never recommend specific dosages of any supplement, hormone, or medication. Never tell someone to start, stop, or change a prescribed treatment. If asked, say so kindly and suggest bringing the question to their provider — Vela can help them prepare.

VOICE
- Warm, direct, never therapeutic-jargon. Talk to a smart 50-year-old who's tired of being condescended to.
- Short. Most answers are 2 to 4 sentences. No headers, no bullet lists unless explicitly asked.
- Italics for emphasis on a word or two when it earns it. Otherwise plain prose.
- Never use the words "journey," "wellness," "self-care," or "empower."
- Never start with "Great question" or "I'd be happy to."

GROUNDING
- Every claim about the user must come from the data summary in the user message. If the data doesn't support it, say so plainly: "I don't see enough data on that yet."
- When you reference a number, use the number from the data. Don't round or estimate.
- Do not reference specific weekdays (Monday, Tuesday, etc.) unless the user mentioned one in their question, or unless the day-by-day section in the data summary explicitly contains an entry for that day. The day-by-day section is context — quote it back faithfully or not at all. Do not invent days.
- CORRELATION VS CAUSATION: When talking about the user's own logged data, use correlation language: "appeared more often after," "tracked with," "tend to coincide." Never frame it as causation about their data: avoid "X causes your Y," "X tanks your Y," "directly tied to," "X drives Y." The reason: with 30 to 90 days of self-logged data, we cannot rule out confounders. We can only see what co-occurs.
- General menopause physiology is the exception. Established mechanisms (estrogen decline shifts thermoregulation, sleep affects cognition, etc.) are fair to state plainly when answering a "why does X happen?" type question. The line: causation language is fine for the population-level science; correlation-only when describing this user's specific patterns.

SCOPE
- Symptom patterns, sleep, mood, cycle, triggers, lifestyle context they've logged — fair game.
- Doctor-prep questions — fair game; suggest specifics worth bringing up.
- General education on perimenopause physiology — fair game when the user asks, kept brief.
- Out of scope: dosing, prescribing, diagnosing, mental-health crisis intervention.
- For crisis topics (suicide, self-harm, immediate danger), do NOT try to counsel. Respond ONLY with:
  "What you're saying matters and you don't have to do this alone. Please reach a free, trained listener: 988 in the US, 116 123 (Samaritans) in the UK & Ireland, 13 11 14 (Lifeline) in Australia, 1-833-456-4566 in Canada, or ifindahelpline.com anywhere else. If you're in immediate danger, please call your local emergency number."
- HORMONE THERAPY: Many users in this audience are on HRT. Never recommend supplements, lifestyle changes, or experiments that could plausibly interact with hormones without explicitly saying "check with your prescriber first."
- PREGNANCY: This app is for menopause but some users may be pregnant. If anything in the data summary or question suggests pregnancy, say plainly that pregnancy guidance differs and they should speak with their provider.

LENGTH
- Default: 2 to 4 sentences. That is the right length for almost every question.
- Up to 6 sentences is acceptable only when the question genuinely needs depth (doctor-prep summaries, "what's the most important pattern?", lifestyle questions with multiple distinct findings to surface).
- Never write multi-paragraph essays. Never use bullet lists or headers unless the user explicitly asks.
- Before finalizing your reply, count the sentences. If you wrote 5+ for a question that didn't ask for depth, cut.`;

function buildUserMessage(question, summary, profile) {
  const lines = [];
  if (profile?.stage) lines.push(`User stage: ${profile.stage}`);
  if (profile?.goal) lines.push(`Primary goal: ${profile.goal}`);
  if (summary.daysLogged != null) {
    lines.push(`\nLogging history: ${summary.daysLogged} days of entries (${summary.uniqueDays || summary.daysLogged} unique days). Most recent entry: ${summary.lastEntryDaysAgo === 0 ? "today" : `${summary.lastEntryDaysAgo} days ago`}.`);
  }
  if (summary.symptomCounts && Object.keys(summary.symptomCounts).length) {
    lines.push("\nSymptom frequency (last 30 days):");
    Object.entries(summary.symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([sym, count]) => lines.push(`  - ${sym}: ${count} days`));
  }
  if (summary.avgMood != null && summary.avgMoodLabel) {
    lines.push(`\nAverage mood (last 30 days): ${summary.avgMoodLabel} (${summary.avgMood.toFixed(1)} / 4)`);
  }
  if (summary.avgSleep != null) lines.push(`Average sleep: ${summary.avgSleep.toFixed(1)} hours`);
  if (summary.avgStress != null) lines.push(`Average stress: ${summary.avgStress.toFixed(1)} / 5`);
  if (summary.correlations && summary.correlations.length) {
    lines.push("\nObserved correlations in their data:");
    summary.correlations.forEach((c) => lines.push(`  - ${c}`));
  }
  if (summary.cyclePrediction) {
    const cp = summary.cyclePrediction;
    lines.push(`\nCycle: ${cp.cyclesLogged} logged, average length ${cp.cycleLengthMean} days (± ${cp.cycleLengthStddev}). Next likely period: ${cp.windowStart} to ${cp.windowEnd}.`);
  }
  if (summary.cyclePhase) {
    lines.push(`Currently day ${summary.cyclePhase.dayInCycle} of cycle (${summary.cyclePhase.phase} phase).`);
  }
  if (summary.activeExperiments && summary.activeExperiments.length) {
    lines.push("\nActive experiments:");
    summary.activeExperiments.forEach((e) => lines.push(`  - ${e.name} (day ${e.day} of ${e.duration})`));
  }
  // Per-day breakdown for the last 7 days. Lets you answer questions like
  // "what about Tuesday?" or "how was last week?" without us shipping the
  // full log. Each entry is intentionally compact: day-of-week, symptoms
  // logged, mood label, sleep hours. No notes, no exact dates.
  if (summary.last7days && summary.last7days.length) {
    lines.push("\nDay-by-day for the past 7 days (most recent last):");
    summary.last7days.forEach((d) => {
      const label = d.daysAgo === 0 ? `${d.day} (today)` : d.daysAgo === 1 ? `${d.day} (yesterday)` : `${d.day} (${d.daysAgo} days ago)`;
      if (!d.logged) {
        lines.push(`  - ${label}: not logged`);
        return;
      }
      const parts = [];
      if (d.mood) parts.push(`mood ${d.mood}`);
      if (d.sleep != null) parts.push(`${d.sleep}h sleep`);
      if (d.stress != null) parts.push(`stress ${d.stress}/5`);
      if (d.period) parts.push("period day");
      if (d.symptoms && d.symptoms.length) parts.push(`symptoms: ${d.symptoms.join(", ")}`);
      lines.push(`  - ${label}: ${parts.length ? parts.join("; ") : "logged with no detail"}`);
    });
  }
  lines.push("\n---");
  lines.push(`User question: ${question}`);
  return lines.join("\n");
}

module.exports = { MODEL, MAX_TOKENS, SYSTEM_PROMPT, buildUserMessage };

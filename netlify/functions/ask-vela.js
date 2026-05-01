// Netlify Function: Ask Vela — proxies a user's question + an anonymized
// log summary to the Anthropic API and returns a plain-language answer.
//
// We never send: notes (free-text), exact dates, profile names, or full
// raw logs. The client computes a summary object client-side and sends
// only that. The function adds Vela's system prompt (positioning,
// guardrails, tone) and forwards to Claude.
//
// Required env: ANTHROPIC_API_KEY (set in Netlify site env)

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;

// System prompt — tone, scope, and hard guardrails. Tuned for the 45-55
// audience: warm, plainspoken, never preachy. Hard refusal on medical
// dosing or diagnosis. Always grounds claims in the user's own data.
const SYSTEM_PROMPT = `You are Vela's pattern companion — a quiet, plainspoken voice that helps women in perimenopause and menopause make sense of their own symptom-tracking data.

YOU ARE NOT A DOCTOR. Never diagnose. Never recommend specific dosages of any supplement, hormone, or medication. Never tell someone to start, stop, or change a prescribed treatment. If asked, say so kindly and suggest bringing the question to their provider — Vela can help them prepare.

VOICE
- Warm, direct, never therapeutic-jargon. Talk to a smart 50-year-old who's tired of being condescended to.
- Short. Most answers are 2–4 sentences. No headers, no bullet lists unless explicitly asked.
- Italics for emphasis on a word or two when it earns it. Otherwise plain prose.
- Never use the words "journey," "wellness," "self-care," or "empower."
- Never start with "Great question" or "I'd be happy to."

GROUNDING
- Every claim about the user must come from the data summary in the user message. If the data doesn't support it, say so plainly: "I don't see enough data on that yet."
- When you reference a number, use the number from the data. Don't round or estimate.
- If the data shows a correlation, name it as a correlation — never as causation. "On days you logged X, Y appeared more often" — not "X causes Y."

SCOPE
- Symptom patterns, sleep, mood, cycle, triggers, lifestyle context they've logged — fair game.
- Doctor-prep questions — fair game; suggest specifics worth bringing up.
- General education on perimenopause physiology — fair game when the user asks, kept brief.
- Out of scope: dosing, prescribing, diagnosing, mental-health crisis intervention. For crisis topics, point to 988 (US Suicide & Crisis Lifeline).

LENGTH
Keep it under 4 sentences unless the user explicitly asks for more.`;

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, {
      error: "Ask Vela isn't configured yet",
      detail: "Server is missing ANTHROPIC_API_KEY. Try again later.",
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { question, summary, profile } = body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return json(400, { error: "Question required" });
  }
  if (question.length > 500) {
    return json(400, { error: "Question is too long (max 500 chars)" });
  }
  if (!summary || typeof summary !== "object") {
    return json(400, { error: "Summary required" });
  }

  // Build the user-side message: question + structured anonymized summary
  const userMessage = buildUserMessage(question.trim(), summary, profile);

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Anthropic API error:", r.status, errText);
      return json(502, {
        error: "Ask Vela couldn't reach the model right now",
        detail: r.status === 529 ? "Service is busy — try again in a moment." : "Try again in a moment.",
      });
    }

    const data = await r.json();
    const answer = data?.content?.[0]?.text?.trim();
    if (!answer) {
      return json(502, { error: "Empty response from model" });
    }

    return json(200, {
      answer,
      usage: data.usage || null,
    });
  } catch (err) {
    console.error("Ask Vela proxy failure:", err);
    return json(500, {
      error: "Ask Vela hit an unexpected error",
      detail: String(err?.message || err),
    });
  }
};

function buildUserMessage(question, summary, profile) {
  // Plain-text rendering of the anonymized summary so Claude can ground
  // its answer. Keep it compact — every section is optional and skipped
  // when empty, so we don't pad the context with "no data" filler.
  const lines = [];

  if (profile?.stage) lines.push(`User stage: ${profile.stage}`);
  if (profile?.goal) lines.push(`Primary goal: ${profile.goal}`);

  if (summary.daysLogged != null) {
    lines.push(`\nLogging history: ${summary.daysLogged} days of entries (${summary.uniqueDays || summary.daysLogged} unique days). Most recent entry: ${summary.lastEntryDaysAgo === 0 ? "today" : `${summary.lastEntryDaysAgo} days ago`}.`);
  }

  if (summary.symptomCounts && Object.keys(summary.symptomCounts).length) {
    lines.push("\nSymptom frequency (last 30 days):");
    Object.entries(summary.symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .forEach(([sym, count]) => lines.push(`  - ${sym}: ${count} days`));
  }

  if (summary.avgMood != null && summary.avgMoodLabel) {
    lines.push(`\nAverage mood (last 30 days): ${summary.avgMoodLabel} (${summary.avgMood.toFixed(1)} / 4)`);
  }
  if (summary.avgSleep != null) {
    lines.push(`Average sleep: ${summary.avgSleep.toFixed(1)} hours`);
  }
  if (summary.avgStress != null) {
    lines.push(`Average stress: ${summary.avgStress.toFixed(1)} / 5`);
  }

  if (summary.correlations && summary.correlations.length) {
    lines.push("\nObserved correlations in their data:");
    summary.correlations.forEach((c) => lines.push(`  - ${c}`));
  }

  if (summary.cyclePrediction) {
    const cp = summary.cyclePrediction;
    lines.push(`\nCycle: ${cp.cyclesLogged} logged, average length ${cp.cycleLengthMean} days (± ${cp.cycleLengthStddev}). Next likely period: ${cp.windowStart} to ${cp.windowEnd}.`);
  }

  if (summary.activeExperiments && summary.activeExperiments.length) {
    lines.push("\nActive experiments:");
    summary.activeExperiments.forEach((e) => lines.push(`  - ${e.name} (day ${e.day} of ${e.duration})`));
  }

  lines.push("\n---");
  lines.push(`User question: ${question}`);

  return lines.join("\n");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}

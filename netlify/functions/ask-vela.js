// Netlify Function: Ask Vela — proxies a user's question + an anonymized
// log summary to the Anthropic API and returns a plain-language answer.
//
// DEFENSE-IN-DEPTH (5 layers, applied in order)
// ─────────────────────────────────────────────
// 1. Premium verification — calls RevenueCat REST to confirm the caller
//    has the active "premium" entitlement. Cached 5 min per user.
// 2. Per-user rate limit — 30 questions / 24h, keyed by appUserId.
// 3. Per-IP rate limit  — 20 questions / 24h, keyed by client IP.
// 4. Daily cost ceiling — global hard cap on tokens spent today; past
//    that the function returns "Ask Vela is taking a break."
// 5. Response cache    — same question + same summary bucket = same
//    answer for 24h. Hashed key, so cached responses are anonymous.
//
// If ANY layer rejects, we return early without ever touching Claude.
//
// ENV REQUIRED
//   ANTHROPIC_API_KEY    — Anthropic API key
//   REVENUECAT_REST_KEY  — RevenueCat secret REST API key (starts with sk_)
//   NETLIFY_BLOBS_TOKEN  — already used by waitlist function
//
// ENV OPTIONAL
//   ASK_VELA_DEV_TOKEN   — when set + sent as x-dev-token header, bypasses
//                          premium verification (for local testing only)
//   ASK_VELA_DAILY_USD   — daily cost ceiling in USD (default: 50)

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;

// Rough Haiku 4.5 pricing for the cost-ceiling math. Tune as Anthropic
// updates pricing — we round up to be conservative.
const COST_PER_INPUT_TOKEN = 1.0 / 1_000_000;   // $1.00 / Mtok
const COST_PER_OUTPUT_TOKEN = 5.0 / 1_000_000;  // $5.00 / Mtok

const PREMIUM_CACHE_TTL_MS = 5 * 60 * 1000;       // 5 min
const RESPONSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;        // 24h
const PER_USER_LIMIT = 30;
const PER_IP_LIMIT = 20;
const DEFAULT_DAILY_USD_CAP = 50;

const SITE_ID = "e0a6111f-d0ad-469a-bb29-66844eb342fe";

const SYSTEM_PROMPT = `You are Vela's pattern companion: a quiet, plainspoken voice that helps women in perimenopause and menopause make sense of their own symptom-tracking data.

YOU ARE NOT A DOCTOR. Never diagnose. Never recommend specific dosages of any supplement, hormone, or medication. Never tell someone to start, stop, or change a prescribed treatment. If asked, say so kindly and suggest bringing the question to their provider. Vela can help them prepare.

VOICE
- Warm, direct, never therapeutic-jargon. Talk to a smart 50-year-old who's tired of being condescended to.
- Short. Most answers are 2 to 4 sentences. No headers, no bullet lists unless explicitly asked.
- Italics for emphasis on a word or two when it earns it. Otherwise plain prose.
- Never use em dashes. They read as AI-written. Use periods, commas, or "to" instead.
- Never use the words "journey," "wellness," "self-care," or "empower."
- Never start with "Great question" or "I'd be happy to."

GROUNDING
- Every claim about the user must come from the data summary in the user message. If the data doesn't support it, say so plainly: "I don't see enough data on that yet."
- When you reference a number, use the number from the data. Don't round or estimate.
- If the data shows a correlation, name it as a correlation, never as causation. Say "On days you logged X, Y appeared more often", not "X causes Y."
- Symptom frequency numbers are counts of symptom days only. Never describe them as "logged together with" a trigger unless a correlation line explicitly gives that paired count.
- Use "pattern" or "correlation" for observed relationships. Avoid saying "clear link" unless the source data uses that phrase.

SCOPE
- Symptom patterns, sleep, mood, cycle, triggers, lifestyle context they've logged: fair game.
- Doctor-prep questions: fair game. Suggest specifics worth bringing up.
- General education on perimenopause physiology: fair game when the user asks, kept brief.
- Out of scope: dosing, prescribing, diagnosing, mental-health crisis intervention.
- For crisis topics (suicide, self-harm, immediate danger), do NOT try to counsel. Respond ONLY with:
  "What you're saying matters and you don't have to do this alone. Please reach a free, trained listener: 988 in the US, 116 123 (Samaritans) in the UK & Ireland, 13 11 14 (Lifeline) in Australia, 1-833-456-4566 in Canada, or ifindahelpline.com anywhere else. If you're in immediate danger, please call your local emergency number."
- HORMONE THERAPY: Many users in this audience are on HRT. Never recommend supplements, lifestyle changes, or experiments that could plausibly interact with hormones without explicitly saying "check with your prescriber first."
- PREGNANCY: This app is for menopause but some users may be pregnant. If anything in the data summary or question suggests pregnancy, say plainly that pregnancy guidance differs and they should speak with their provider.

LENGTH
Keep it under 4 sentences unless the user explicitly asks for more.`;

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders() };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(503, {
      error: "Ask Vela isn't configured yet",
      detail: "Server is missing ANTHROPIC_API_KEY.",
    });
  }

  // ── Parse + validate input ──────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const { question, summary, profile, appUserId } = body;
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return json(400, { error: "Question required" });
  }
  if (question.length > 500) {
    return json(400, { error: "Question is too long (max 500 chars)" });
  }
  if (!summary || typeof summary !== "object") {
    return json(400, { error: "Summary required" });
  }

  // SERVER-SIDE CRISIS INTERCEPT — defense in depth. Client should
  // already have caught this and shown the crisis card, but if a
  // request gets through (modified client, replay, etc.) we return
  // the same support message and never burn tokens on the model.
  // Mirrors src/App.jsx CRISIS_PATTERNS exactly. The client should
  // already have caught this and shown the crisis card, but if a
  // request gets through (modified client, replay, etc.) we return
  // the same support message and never burn tokens on the model.
  // Keep this list in sync with the client; drift is what makes the
  // defense-in-depth shallow instead of deep.
  const SERVER_CRISIS = [
    /\bkill(ing)?\s+myself\b/i,
    /\bend(ing)?\s+my\s+(own\s+)?life\b/i,
    /\b(don'?t|do\s*not)\s+want\s+to\s+(live|be\s+alive|exist)\b/i,
    /\b(want|wish)\s+(to|i\s+could)\s+(die|be\s+dead)\b/i,
    /\bsuicid(e|al)\b/i,
    /\b(hurt|harm)\s+myself\b/i,
    /\bself[\s-]harm\b/i,
    /\bbetter\s+off\s+dead\b/i,
    /\bno\s+reason\s+to\s+(live|go\s+on)\b/i,
    /\bcan'?t\s+go\s+on\b/i,
    /\bgoing\s+to\s+(kill|end)\s+myself\b/i,
  ];
  // Same false-positive guards as the client so we don't crisis-card a
  // user who said "dying for a coffee" or "dead tired."
  const lowered = String(question || "").toLowerCase();
  const isFalsePositive =
    /dying\s+(to|for)\s+(a|some|one|that|this|the)\b/.test(lowered) ||
    /dead\s+(tired|asleep|on\s+my\s+feet)\b/.test(lowered);
  if (!isFalsePositive && SERVER_CRISIS.some((re) => re.test(question))) {
    // Log so we can monitor how often the server defense layer fires
    // (i.e., the client failed to catch it). Not PII — a counter line.
    console.error("[ask-vela] CRISIS INTERCEPTED at server (client filter missed)");
    return json(200, {
      answer: "What you're saying matters and you don't have to do this alone. A free, trained listener is one call or text away. They're trained for exactly this. In the US: 988. UK & Ireland: 116 123 (Samaritans). Canada: 1-833-456-4566. Australia: 13 11 14 (Lifeline). Anywhere else: ifindahelpline.com. If you're in immediate danger, please call your local emergency number.",
      crisis: true,
    });
  }

  const clientIp =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "unknown";

  const stores = openStores();

  // ── LAYER 1: Premium verification ───────────────────────────────────
  const devToken = event.headers["x-dev-token"];
  const isDevBypass = process.env.ASK_VELA_DEV_TOKEN && devToken === process.env.ASK_VELA_DEV_TOKEN;
  if (!isDevBypass) {
    if (!appUserId || typeof appUserId !== "string") {
      return json(401, {
        error: "Premium verification required",
        detail: "Sign in or restore your subscription to use Ask Vela.",
      });
    }
    const verified = await verifyPremium(stores.premium, appUserId);
    if (!verified.ok) {
      return json(403, {
        error: "Premium subscription required",
        detail: verified.reason,
      });
    }
  }

  // ── LAYER 2: Per-user rate limit ────────────────────────────────────
  if (appUserId) {
    const userRl = await checkAndIncrement(stores.userRl, `u:${hash(appUserId)}`, PER_USER_LIMIT);
    if (!userRl.ok) {
      return json(429, {
        error: "Daily question limit reached",
        detail: `You've asked ${userRl.count} questions today. The limit resets in ${Math.ceil(userRl.resetInMs / (60 * 60 * 1000))} hours.`,
        remaining: 0,
        resetInMs: userRl.resetInMs,
      });
    }
  }

  // ── LAYER 3: Per-IP rate limit ──────────────────────────────────────
  const ipRl = await checkAndIncrement(stores.ipRl, `ip:${hash(clientIp)}`, PER_IP_LIMIT);
  if (!ipRl.ok) {
    return json(429, {
      error: "Too many requests from this network",
      detail: "Try again later.",
      resetInMs: ipRl.resetInMs,
    });
  }

  // ── LAYER 4: Daily cost ceiling ─────────────────────────────────────
  const dailyCapUsd = Number(process.env.ASK_VELA_DAILY_USD || DEFAULT_DAILY_USD_CAP);
  const todayKey = new Date().toISOString().slice(0, 10);
  const spentRecord = await stores.cost.get(todayKey, { type: "json" }).catch(() => null);
  const spentUsd = spentRecord?.usd || 0;
  if (spentUsd >= dailyCapUsd) {
    console.error(`[ask-vela] DAILY CAP REACHED: $${spentUsd.toFixed(2)} of $${dailyCapUsd} on ${todayKey}`);
    return json(503, {
      error: "Ask Vela is taking a break",
      detail: "Today's question budget is full. Try again tomorrow.",
    });
  }
  // Early-warning log so we don't get blindsided by a silent throttle.
  // Netlify captures console.warn into the function logs feed.
  if (spentUsd >= dailyCapUsd * 0.75) {
    console.warn(`[ask-vela] cost approaching cap: $${spentUsd.toFixed(2)} of $${dailyCapUsd} (${Math.round(100 * spentUsd / dailyCapUsd)}%) on ${todayKey}`);
  }

  // ── LAYER 5: Response cache ─────────────────────────────────────────
  // Hash question + summary signature (not the raw payload — privacy).
  // Two users asking the same question with similar data share a cache
  // hit, so we save tokens on common queries like "what triggers my
  // hot flashes?" without ever storing identifying data.
  const cacheKey = "c:" + hash(`${question.trim().toLowerCase()}|${summarySignature(summary)}`);
  const cached = await stores.cache.get(cacheKey, { type: "json" }).catch(() => null);
  if (cached?.answer && Date.now() - cached.t < RESPONSE_CACHE_TTL_MS) {
    return json(200, {
      answer: cleanModelAnswer(cached.answer),
      cached: true,
      remainingToday: PER_USER_LIMIT - (await currentCount(stores.userRl, `u:${hash(appUserId || clientIp)}`)),
    });
  }

  // ── Call Anthropic ──────────────────────────────────────────────────
  const userMessage = buildUserMessage(question.trim(), summary, profile);
  let data;
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
        detail: r.status === 529 ? "Service is busy. Try again in a moment." : "Try again in a moment.",
      });
    }
    data = await r.json();
  } catch (err) {
    console.error("Ask Vela proxy failure:", err);
    return json(500, { error: "Ask Vela hit an unexpected error" });
  }

  const answer = cleanModelAnswer(data?.content?.[0]?.text?.trim());
  if (!answer) return json(502, { error: "Empty response from model" });

  // ── Track cost + update cache (best-effort — never blocks response) ─
  const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
  const cost = usage.input_tokens * COST_PER_INPUT_TOKEN + usage.output_tokens * COST_PER_OUTPUT_TOKEN;
  // Fire-and-forget; tiny risk of lost write but not worth blocking the user
  Promise.all([
    stores.cost.setJSON(todayKey, { usd: spentUsd + cost, updatedAt: Date.now() }),
    stores.cache.setJSON(cacheKey, { answer, t: Date.now() }),
  ]).catch((err) => console.warn("Bookkeeping write failed:", err));

  return json(200, {
    answer,
    cached: false,
    usage,
    remainingToday: appUserId ? Math.max(0, PER_USER_LIMIT - (await currentCount(stores.userRl, `u:${hash(appUserId)}`))) : null,
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────

function openStores() {
  // In deployed production, NETLIFY_BLOBS_CONTEXT isn't auto-injected on this
  // site, so we pass siteID + a long-lived token explicitly. In `netlify dev`
  // the runtime DOES inject context (local Blobs sandbox), so we use the
  // string form there to avoid clobbering it with an undefined token.
  const make = process.env.NETLIFY_BLOBS_TOKEN
    ? (name) => getStore({ name, siteID: SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN })
    : (name) => getStore(name);
  return {
    premium: make("ask-vela-premium"),
    userRl: make("ask-vela-user-rl"),
    ipRl: make("ask-vela-ip-rl"),
    cost: make("ask-vela-cost"),
    cache: make("ask-vela-cache"),
  };
}

// Verify premium via RevenueCat REST API. Cached 5 min.
async function verifyPremium(store, appUserId) {
  const cacheKey = `p:${hash(appUserId)}`;
  try {
    const cached = await store.get(cacheKey, { type: "json" });
    if (cached && Date.now() - cached.t < PREMIUM_CACHE_TTL_MS) {
      return cached.ok ? { ok: true } : { ok: false, reason: cached.reason || "Not premium" };
    }
  } catch { /* ignore */ }

  if (!process.env.REVENUECAT_REST_KEY) {
    // No key configured — fail closed in production
    return { ok: false, reason: "Subscription verification unavailable. Try again later." };
  }

  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: {
        Authorization: `Bearer ${process.env.REVENUECAT_REST_KEY}`,
        "X-Platform": "ios",
      },
    });
    if (!r.ok) {
      console.warn("RC verify failed:", r.status);
      // Don't cache a failure — could be a transient RC blip
      return { ok: false, reason: "Couldn't confirm your subscription." };
    }
    const data = await r.json();
    const entitlements = data?.subscriber?.entitlements || {};
    const premium = entitlements.premium;
    const expiresMs = premium?.expires_date ? new Date(premium.expires_date).getTime() : null;
    const isActive = !!(premium && (expiresMs === null || expiresMs > Date.now()));
    const result = isActive
      ? { ok: true, t: Date.now() }
      : { ok: false, reason: "Premium subscription required.", t: Date.now() };
    await store.setJSON(cacheKey, result).catch(() => {});
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  } catch (err) {
    console.error("RC verify error:", err);
    return { ok: false, reason: "Couldn't reach the subscription server." };
  }
}

// Atomic-ish counter with 24h sliding-ish reset. Returns
// { ok: boolean, count: number, resetInMs: number }.
//
// Netlify Blobs doesn't have true atomic counters — we accept a small
// race window where two simultaneous requests could both pass the limit
// check. For abuse prevention this is acceptable: the attacker still
// gets capped to ~limit + concurrency, not unlimited.
async function checkAndIncrement(store, key, limit) {
  const now = Date.now();
  let record;
  try { record = await store.get(key, { type: "json" }); } catch { record = null; }
  if (!record || now - record.windowStart > RATE_WINDOW_MS) {
    record = { windowStart: now, count: 0 };
  }
  if (record.count >= limit) {
    return {
      ok: false,
      count: record.count,
      resetInMs: RATE_WINDOW_MS - (now - record.windowStart),
    };
  }
  record.count += 1;
  await store.setJSON(key, record).catch(() => {});
  return {
    ok: true,
    count: record.count,
    resetInMs: RATE_WINDOW_MS - (now - record.windowStart),
  };
}

async function currentCount(store, key) {
  try {
    const record = await store.get(key, { type: "json" });
    if (!record) return 0;
    if (Date.now() - record.windowStart > RATE_WINDOW_MS) return 0;
    return record.count || 0;
  } catch { return 0; }
}

// Bucket numeric values so similar-but-not-identical summaries hit the
// same cache key. This is the privacy + cache-hit-rate tradeoff knob.
function summarySignature(summary) {
  if (!summary || typeof summary !== "object") return "empty";
  const buckets = [];
  if (summary.daysLogged != null) buckets.push(`d${bucket(summary.daysLogged, 5)}`);
  if (summary.avgMood != null) buckets.push(`m${Math.round(summary.avgMood)}`);
  if (summary.avgSleep != null) buckets.push(`s${Math.round(summary.avgSleep)}`);
  if (summary.avgStress != null) buckets.push(`st${Math.round(summary.avgStress)}`);
  // Top 3 symptoms by frequency, for differentiating the kind of user
  if (summary.symptomCounts) {
    const top3 = Object.entries(summary.symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s.toLowerCase().replace(/\s+/g, ""));
    buckets.push(`sx:${top3.join(",")}`);
  }
  return buckets.join("|");
}

function bucket(n, step) { return Math.floor(n / step) * step; }

function cleanModelAnswer(answer) {
  if (!answer) return "";
  return answer
    .replace(/[ \t]*\u2014[ \t]*/g, ", ")
    .replace(/(\d)[ \t]*\u2013[ \t]*(\d)/g, "$1 to $2")
    .replace(/[ \t]*\u2013[ \t]*/g, " - ")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function hash(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 24);
}

function buildUserMessage(question, summary, profile) {
  const lines = [];
  if (profile?.stage) lines.push(`User stage: ${profile.stage}`);
  if (Array.isArray(profile?.concerns) && profile.concerns.length) {
    lines.push(`Flagged concerns at onboarding: ${profile.concerns.join(", ")}`);
  }
  if (Array.isArray(profile?.goals) && profile.goals.length) {
    lines.push(`Goals: ${profile.goals.join(", ")}`);
  } else if (profile?.goal) {
    // Legacy single-goal field from pre-2026-05-12 builds.
    lines.push(`Primary goal: ${profile.goal}`);
  }
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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-dev-token",
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
    body: JSON.stringify(body),
  };
}

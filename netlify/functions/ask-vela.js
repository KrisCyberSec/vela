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
const { MODEL, MAX_TOKENS, SYSTEM_PROMPT, buildUserMessage } = require("./_lib/ask-vela-prompt");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

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
      answer: cached.answer,
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
        detail: r.status === 529 ? "Service is busy — try again in a moment." : "Try again in a moment.",
      });
    }
    data = await r.json();
  } catch (err) {
    console.error("Ask Vela proxy failure:", err);
    return json(500, { error: "Ask Vela hit an unexpected error" });
  }

  const answer = data?.content?.[0]?.text?.trim();
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
  const opts = { siteID: SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN };
  return {
    premium: getStore({ name: "ask-vela-premium", ...opts }),
    userRl: getStore({ name: "ask-vela-user-rl", ...opts }),
    ipRl: getStore({ name: "ask-vela-ip-rl", ...opts }),
    cost: getStore({ name: "ask-vela-cost", ...opts }),
    cache: getStore({ name: "ask-vela-cache", ...opts }),
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

function hash(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 24);
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

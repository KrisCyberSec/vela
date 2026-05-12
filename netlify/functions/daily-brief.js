// Netlify Function: Daily Brief — produces a 2-3 sentence "what I'm
// noticing" message for the user, generated fresh each day from the
// last 14 days of anonymized log data. This is what makes Vela feel
// alive: the AI shows up unprompted instead of waiting to be asked.
//
// SAME 5-LAYER DEFENSE AS ASK-VELA
// 1. Premium verification (RevenueCat REST, 5min cache)
// 2. Per-user rate limit — 2 briefs / 24h max (one expected per day)
// 3. Per-IP rate limit  — 30 / 24h
// 4. Daily cost ceiling (shared with ask-vela budget)
// 5. Per-user cache (24h) — same anonymized summary key always returns
//    the same brief. Repeat fetches in the same day are free.
//
// Cost math at 1000 paying users with 1 brief/user/day:
//   ~950 in × $1/Mtok = $0.00095, ~150 out × $5/Mtok = $0.00075
//   Per call: $0.0017
//   1000 users × 1/day × 30 days = $51/month → ~$620/year
//   Against $69k/yr net at 1000 premium subs = 0.9% of net
//
// ENV REQUIRED
//   ANTHROPIC_API_KEY, REVENUECAT_REST_KEY, NETLIFY_BLOBS_TOKEN
// ENV OPTIONAL
//   ASK_VELA_DEV_TOKEN, ASK_VELA_DAILY_USD (shared cap)

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 250;

const COST_PER_INPUT_TOKEN = 1.0 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 5.0 / 1_000_000;

const PREMIUM_CACHE_TTL_MS = 5 * 60 * 1000;
const BRIEF_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PER_USER_LIMIT = 2;          // 2 briefs/day max (one expected, retry buffer)
const PER_IP_LIMIT = 30;
const DEFAULT_DAILY_USD_CAP = 50;

const SITE_ID = "e0a6111f-d0ad-469a-bb29-66844eb342fe";

// System prompt is tuned for a SHORT, observational, never-prescriptive
// daily message. Different from Ask Vela — this is one-way, has to land
// without context, and has to feel warm without being saccharine.
const SYSTEM_PROMPT = `You write Vela's "daily brief" — a 2 to 3 sentence message that lands on a user's home screen each morning, summarizing what you're noticing in their data.

YOU ARE NOT A DOCTOR. Never diagnose. Never recommend dosages of any supplement, hormone, or medication. Never tell someone to start, stop, or change a treatment.

SUSTAINED LOW MOOD: If the data summary shows mood averaging "rough" or "low" over the past 5+ days, do NOT write a cheerful brief. Instead write something like: "Mood has been lower than usual this past week. That's worth saying out loud — and worth bringing to someone trained to listen, not an app. Free, confidential lines: 988 (US), 116 123 (UK), 13 11 14 (AU)." The client also surfaces a fuller crisis card; be brief and don't compete with it.

VOICE
- Talk to a smart 50-year-old who's tired of being condescended to.
- Warm, plain, observational. Like a good friend who's been paying attention.
- 2 to 3 sentences. Hard maximum 4 sentences if there's something genuinely worth saying.
- Never start with "Good morning" or "Today." They're already opening the app.
- Never use em dashes (—). They read as AI-written. Use periods, commas, or "to" instead.
- Never use "journey," "wellness," "self-care," "empowered," or "your body is amazing."
- Italics are for emphasis on a word or two, max once per message.

WHAT TO NOTICE
- Patterns from the anomaly + correlation summary (e.g., "Hot flashes have been quieter this week.")
- Streaks worth recognizing without being saccharine ("You've logged 6 days running. That's enough for the cycle prediction to start sharpening.")
- Cycle context if relevant ("You're in the window where last cycle's flashes peaked.")
- Active experiments ("Day 4 of the caffeine cutoff — too early to call but the night sweats are halved so far.")
- If there's nothing notable, say so plainly. Don't manufacture insight.
  Example: "Steady week — nothing unusual jumping out. Keep logging."

WHAT TO AVOID
- Generic motivational filler. "Keep up the great work" is what bad apps say.
- Predictions you can't back up with the summary ("Tomorrow will be better!").
- Stacking observations. Pick the one or two that matter most.

LENGTH
2-3 sentences. Period.`;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders() };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(503, { error: "Daily brief isn't configured yet", detail: "Server is missing ANTHROPIC_API_KEY." });
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const { summary, profile, appUserId } = body;
  if (!summary || typeof summary !== "object") {
    return json(400, { error: "Summary required" });
  }

  const clientIp = event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  const stores = openStores();

  // ─── LAYER 1: Premium verification ────────────────────────────────
  const devToken = event.headers["x-dev-token"];
  const isDevBypass = process.env.ASK_VELA_DEV_TOKEN && devToken === process.env.ASK_VELA_DEV_TOKEN;
  if (!isDevBypass) {
    if (!appUserId || typeof appUserId !== "string") {
      return json(401, { error: "Premium verification required" });
    }
    const verified = await verifyPremium(stores.premium, appUserId);
    if (!verified.ok) {
      return json(403, { error: "Premium subscription required", detail: verified.reason });
    }
  }

  // ─── LAYER 5: Per-user 24h cache (returns same brief same day) ────
  // Cache key is hash of (appUserId, today_date). Same user, same day
  // = no API call. This caps cost at exactly 1 brief per user per day.
  const todayKey = new Date().toISOString().slice(0, 10);
  const userCacheKey = "b:" + hash(`${appUserId || clientIp}|${todayKey}`);
  const cached = await stores.cache.get(userCacheKey, { type: "json" }).catch(() => null);
  if (cached?.brief && Date.now() - cached.t < BRIEF_CACHE_TTL_MS) {
    return json(200, { brief: cached.brief, cached: true, generatedAt: cached.t });
  }

  // ─── LAYER 2: Per-user rate limit (defense against cache-bust) ────
  if (appUserId) {
    const userRl = await checkAndIncrement(stores.userRl, `u:${hash(appUserId)}`, PER_USER_LIMIT);
    if (!userRl.ok) {
      return json(429, { error: "Daily brief limit reached for today", resetInMs: userRl.resetInMs });
    }
  }

  // ─── LAYER 3: Per-IP rate limit ───────────────────────────────────
  const ipRl = await checkAndIncrement(stores.ipRl, `ip:${hash(clientIp)}`, PER_IP_LIMIT);
  if (!ipRl.ok) {
    return json(429, { error: "Too many requests from this network", resetInMs: ipRl.resetInMs });
  }

  // ─── LAYER 4: Global daily cost ceiling ───────────────────────────
  const dailyCapUsd = Number(process.env.ASK_VELA_DAILY_USD || DEFAULT_DAILY_USD_CAP);
  const spentRecord = await stores.cost.get(todayKey, { type: "json" }).catch(() => null);
  const spentUsd = spentRecord?.usd || 0;
  if (spentUsd >= dailyCapUsd) {
    console.error(`[daily-brief] DAILY CAP REACHED: $${spentUsd.toFixed(2)} of $${dailyCapUsd} on ${todayKey}`);
    return json(503, { error: "Daily AI budget reached", detail: "Brief will return tomorrow." });
  }
  if (spentUsd >= dailyCapUsd * 0.75) {
    console.warn(`[daily-brief] cost approaching cap: $${spentUsd.toFixed(2)} of $${dailyCapUsd} (${Math.round(100 * spentUsd / dailyCapUsd)}%) on ${todayKey}`);
  }

  // ─── Call Anthropic ───────────────────────────────────────────────
  const userMessage = buildUserMessage(summary, profile);
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
      return json(502, { error: "Couldn't reach the model right now" });
    }
    data = await r.json();
  } catch (err) {
    console.error("Daily brief failure:", err);
    return json(500, { error: "Unexpected error" });
  }

  const brief = data?.content?.[0]?.text?.trim();
  if (!brief) return json(502, { error: "Empty response from model" });

  const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
  const cost = usage.input_tokens * COST_PER_INPUT_TOKEN + usage.output_tokens * COST_PER_OUTPUT_TOKEN;
  Promise.all([
    stores.cost.setJSON(todayKey, { usd: spentUsd + cost, updatedAt: Date.now() }),
    stores.cache.setJSON(userCacheKey, { brief, t: Date.now() }),
  ]).catch((err) => console.warn("Bookkeeping write failed:", err));

  return json(200, { brief, cached: false, generatedAt: Date.now(), usage });
};

// ─── Helpers ────────────────────────────────────────────────────────
function openStores() {
  // See ask-vela.js openStores() for why this two-mode shape exists.
  const make = process.env.NETLIFY_BLOBS_TOKEN
    ? (name) => getStore({ name, siteID: SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN })
    : (name) => getStore(name);
  return {
    premium: make("ask-vela-premium"),
    userRl: make("daily-brief-user-rl"),
    ipRl: make("daily-brief-ip-rl"),
    cost: make("ask-vela-cost"), // shared budget
    cache: make("daily-brief-cache"),
  };
}

async function verifyPremium(store, appUserId) {
  const cacheKey = `p:${hash(appUserId)}`;
  try {
    const cached = await store.get(cacheKey, { type: "json" });
    if (cached && Date.now() - cached.t < PREMIUM_CACHE_TTL_MS) {
      return cached.ok ? { ok: true } : { ok: false, reason: cached.reason || "Not premium" };
    }
  } catch { /* ignore */ }

  if (!process.env.REVENUECAT_REST_KEY) {
    return { ok: false, reason: "Subscription verification unavailable." };
  }
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${process.env.REVENUECAT_REST_KEY}`, "X-Platform": "ios" },
    });
    if (!r.ok) return { ok: false, reason: "Couldn't confirm your subscription." };
    const data = await r.json();
    const premium = data?.subscriber?.entitlements?.premium;
    const expiresMs = premium?.expires_date ? new Date(premium.expires_date).getTime() : null;
    const isActive = !!(premium && (expiresMs === null || expiresMs > Date.now()));
    const result = isActive ? { ok: true, t: Date.now() } : { ok: false, reason: "Premium subscription required.", t: Date.now() };
    await store.setJSON(cacheKey, result).catch(() => {});
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  } catch (err) {
    console.error("RC verify error:", err);
    return { ok: false, reason: "Couldn't reach the subscription server." };
  }
}

async function checkAndIncrement(store, key, limit) {
  const now = Date.now();
  let record;
  try { record = await store.get(key, { type: "json" }); } catch { record = null; }
  if (!record || now - record.windowStart > RATE_WINDOW_MS) {
    record = { windowStart: now, count: 0 };
  }
  if (record.count >= limit) {
    return { ok: false, count: record.count, resetInMs: RATE_WINDOW_MS - (now - record.windowStart) };
  }
  record.count += 1;
  await store.setJSON(key, record).catch(() => {});
  return { ok: true, count: record.count, resetInMs: RATE_WINDOW_MS - (now - record.windowStart) };
}

function hash(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 24);
}

function buildUserMessage(summary, profile) {
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

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  lines.push(`\nToday: ${today}`);

  if (summary.daysLogged != null) {
    lines.push(`Logging history: ${summary.uniqueDays || summary.daysLogged} unique days. Most recent: ${summary.lastEntryDaysAgo === 0 ? "today" : `${summary.lastEntryDaysAgo} days ago`}.`);
  }
  if (summary.streak != null) lines.push(`Current streak: ${summary.streak} days.`);

  if (summary.weekTopSymptom) {
    lines.push(`\nThis week's top symptom: ${summary.weekTopSymptom.name} (${summary.weekTopSymptom.count} days)`);
  }
  if (summary.weekMood) {
    lines.push(`This week's avg mood: ${summary.weekMood.label} (${summary.weekMood.avg.toFixed(1)} / 4)`);
  }
  if (summary.weekSleep) {
    lines.push(`This week's avg sleep: ${summary.weekSleep.avg.toFixed(1)}h`);
  }

  if (summary.anomalies && summary.anomalies.length) {
    lines.push("\nAnomalies vs the user's 30-day baseline:");
    summary.anomalies.forEach((a) => lines.push(`  - ${a.text}`));
  }

  if (summary.correlations && summary.correlations.length) {
    lines.push("\nDetected correlations in the user's data:");
    summary.correlations.forEach((c) => lines.push(`  - ${c}`));
  }

  if (summary.cyclePrediction) {
    const cp = summary.cyclePrediction;
    lines.push(`\nCycle: avg length ${cp.cycleLengthMean} days, next predicted window ${cp.windowStart} to ${cp.windowEnd}.`);
  }

  if (summary.activeExperiments && summary.activeExperiments.length) {
    lines.push("\nActive experiments:");
    summary.activeExperiments.forEach((e) => lines.push(`  - ${e.name} (day ${e.day} of ${e.duration})`));
  }

  if (summary.lastBriefDaysAgo != null && summary.lastBriefDaysAgo <= 2) {
    lines.push(`\n(Note: user saw a brief from you ${summary.lastBriefDaysAgo === 0 ? "today already — should not happen due to cache" : summary.lastBriefDaysAgo === 1 ? "yesterday" : `${summary.lastBriefDaysAgo} days ago`}. Avoid repeating the same observation.)`);
  }

  lines.push("\n---\nWrite the daily brief now. 2-3 sentences. Plain, warm, specific.");
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

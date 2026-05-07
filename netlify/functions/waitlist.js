// Netlify Function: captures waitlist email submissions into Netlify Blobs.
// Blob key: "waitlist/<timestamp>-<email>" → JSON payload.
// View submissions: `netlify blobs:list waitlist`

const { getStore } = require("@netlify/blobs");

const SITE_ID = "e0a6111f-d0ad-469a-bb29-66844eb342fe";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let email;
  try {
    // Accept both application/json and form-urlencoded
    const ct = (event.headers["content-type"] || "").toLowerCase();
    if (ct.includes("application/json")) {
      ({ email } = JSON.parse(event.body || "{}"));
    } else {
      const params = new URLSearchParams(event.body || "");
      email = params.get("email");
    }
  } catch {
    return json(400, { ok: false, error: "Invalid request body" });
  }

  email = (email || "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return json(400, { ok: false, error: "Invalid email address" });
  }

  try {
    // Production: explicit creds (no auto-context on this site).
    // Local dev (netlify dev): no NETLIFY_BLOBS_TOKEN → use local sandbox.
    const store = process.env.NETLIFY_BLOBS_TOKEN
      ? getStore({ name: "waitlist", siteID: SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN })
      : getStore("waitlist");
    // Key: "<email>" makes duplicates idempotent (latest submission wins).
    const record = {
      email,
      submittedAt: new Date().toISOString(),
      userAgent: event.headers["user-agent"] || null,
      referrer: event.headers["referer"] || null,
      ip:
        event.headers["x-nf-client-connection-ip"] ||
        event.headers["x-forwarded-for"] ||
        null,
    };
    await store.setJSON(email, record);
    return json(200, { ok: true });
  } catch (err) {
    console.error("Blob write failed:", err);
    return json(500, { ok: false, error: "Storage error", detail: String(err?.message || err) });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

// Netlify Function: founder-hub scratchpad notes (Blob-backed, cross-device).
// Auth: `Authorization: Bearer <ADMIN_TOKEN>`.
// GET  → { content, updatedAt }
// PUT  → { content } (max 50k chars) → returns saved record

const { getStore } = require("@netlify/blobs");

const SITE_ID = "e0a6111f-d0ad-469a-bb29-66844eb342fe";
const MAX_CHARS = 50000;

exports.handler = async (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  const token = match?.[1]?.trim();
  if (!token || !process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const store = getStore({
    name: "founder-hub",
    siteID: SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });

  try {
    if (event.httpMethod === "GET") {
      const data = await store.get("notes", { type: "json" });
      return json(200, data || { content: "", updatedAt: null });
    }

    if (event.httpMethod === "PUT") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Invalid JSON body" });
      }
      const content = String(payload.content ?? "").slice(0, MAX_CHARS);
      const record = { content, updatedAt: new Date().toISOString() };
      await store.setJSON("notes", record);
      return json(200, record);
    }

    return { statusCode: 405, body: "Method not allowed" };
  } catch (err) {
    return json(500, { error: "Notes failed", detail: String(err?.message || err) });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Netlify Function: exports the waitlist.
// Protected by an admin token — pass `Authorization: Bearer <ADMIN_TOKEN>`.
// Set ADMIN_TOKEN env var in the Netlify dashboard.

const { getStore } = require("@netlify/blobs");

const SITE_ID = "e0a6111f-d0ad-469a-bb29-66844eb342fe";

// Wrap in quotes, double internal quotes, and prefix formula-leading chars
// with a single quote so spreadsheet apps don't evaluate them.
function csvField(v) {
  if (v == null) return '""';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

exports.handler = async (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  const token = match?.[1]?.trim();
  if (!token || !process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    // Production: explicit creds (no auto-context on this site's runtime).
    // Local dev (netlify dev): no NETLIFY_BLOBS_TOKEN → local sandbox.
    const store = process.env.NETLIFY_BLOBS_TOKEN
      ? getStore({ name: "waitlist", siteID: SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN })
      : getStore("waitlist");

    const { blobs } = await store.list();
    const entries = await Promise.all(
      blobs.map(async (b) => await store.get(b.key, { type: "json" }))
    );

    entries.sort((a, b) => (a?.submittedAt || "").localeCompare(b?.submittedAt || ""));

    const format = event.queryStringParameters?.format || "json";
    if (format === "csv") {
      const header = "email,submittedAt,referrer\n";
      const rows = entries
        .map((e) => [csvField(e?.email), csvField(e?.submittedAt), csvField(e?.referrer)].join(","))
        .join("\n");
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="waitlist.csv"',
        },
        body: header + rows,
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: entries.length, entries }, null, 2),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Export failed", detail: String(err?.message || err) }),
    };
  }
};

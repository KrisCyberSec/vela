// Netlify Function: exports the waitlist.
// Protected by an admin token — pass ?token=<ADMIN_TOKEN> in the URL.
// Set ADMIN_TOKEN env var in the Netlify dashboard.

const { getStore } = require("@netlify/blobs");

const SITE_ID = "e0a6111f-d0ad-469a-bb29-66844eb342fe";

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    const store = getStore({
      name: "waitlist",
      siteID: SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });

    const { blobs } = await store.list();
    const entries = await Promise.all(
      blobs.map(async (b) => await store.get(b.key, { type: "json" }))
    );

    entries.sort((a, b) => (a?.submittedAt || "").localeCompare(b?.submittedAt || ""));

    const format = event.queryStringParameters?.format || "json";
    if (format === "csv") {
      const header = "email,submittedAt,referrer\n";
      const rows = entries
        .map((e) => `${e.email},${e.submittedAt},${e.referrer || ""}`)
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

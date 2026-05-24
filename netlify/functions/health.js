exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        Allow: "GET, HEAD, OPTIONS",
      },
    };
  }

  if (!["GET", "HEAD"].includes(event.httpMethod)) {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const body = {
    ok: true,
    service: "vela-api",
    timestamp: new Date().toISOString(),
    deploy: {
      id: process.env.DEPLOY_ID || null,
      commit: process.env.COMMIT_REF || null,
      context: process.env.CONTEXT || null,
    },
    checks: {
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      revenueCatRestConfigured: Boolean(process.env.REVENUECAT_REST_KEY),
      blobsConfigured: Boolean(process.env.NETLIFY_BLOBS_TOKEN),
    },
  };

  if (event.httpMethod === "HEAD") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Allow: "GET, HEAD, OPTIONS",
      },
    };
  }

  return json(200, body);
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}
